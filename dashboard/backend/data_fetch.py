from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

import requests
from sqlalchemy.orm import Session

try:  # pragma: no cover - allow execution as module or script
    from .sql_alchemy import (  # type: ignore[attr-defined]
        Category,
        DataTable,
        Dimension,
        Observation,
        ObservationDimensionValue,
        SessionLocal,
    )
except ImportError:  # pragma: no cover
    from sql_alchemy import (
        Category,
        DataTable,
        Dimension,
        Observation,
        ObservationDimensionValue,
        SessionLocal,
    )

LOGGER = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

DEFAULT_TIMEOUT = 60
LANG_PRIORITY = ("en", "fr", "de", "lb")


def _prefer_text(source: Optional[dict], fallback: Optional[str] = None) -> Optional[str]:
    """Return the first non-empty text value using a preferred language order."""
    if not source:
        return fallback
    for lang in LANG_PRIORITY:
        value = source.get(lang)
        if value:
            return value
    if source:
        return next(iter(source.values()))
    return fallback


def _extract_dataset_code(url: str) -> str:
    """Infer the dataset code from the SDMX data URL."""
    parsed = urlparse(url)
    match = re.search(r"/data/([^/]+)/", parsed.path)
    if not match:
        raise ValueError(f"Cannot infer dataset code from URL: {url}")
    parts = match.group(1).split(",")
    if len(parts) < 2:
        raise ValueError(f"Unexpected path shape for dataset URL: {url}")
    return parts[1]


def fetch_dataset_payload(url: str) -> dict:
    """Retrieve the SDMX-JSON payload for the provided dataset URL."""
    LOGGER.info("Fetching dataset JSON from %s", url)
    response = requests.get(url, timeout=DEFAULT_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    if "data" not in payload:
        raise ValueError("Payload does not contain 'data' section.")
    return payload


def _build_dimension_metadata(structure: dict) -> List[dict]:
    """Normalise observation dimension metadata from the structure section."""
    obs_dimensions = structure.get("dimensions", {}).get("observation", [])
    normalised: List[dict] = []
    for index, dim in enumerate(obs_dimensions):
        code = dim.get("id")
        if not code:
            continue
        key_position = dim.get("keyPosition")
        position = int(key_position) if key_position is not None else index
        label = dim.get("name") or code
        label = _prefer_text(dim.get("names"), label)

        values_meta: List[dict] = []
        for value in dim.get("values", []):
            value_code = value.get("id")
            if value_code is None:
                continue
            value_label = value.get("name") or value_code
            value_label = _prefer_text(value.get("names"), value_label)
            parent_code = value.get("parent")
            if not parent_code:
                parents = value.get("parents")
                if parents:
                    parent_code = parents[0]
            values_meta.append(
                {
                    "code": value_code,
                    "label": value_label,
                    "parent_code": parent_code,
                }
            )

        normalised.append(
            {
                "code": code,
                "label": label or code,
                "position": position,
                "values": values_meta,
            }
        )

    normalised.sort(key=lambda item: item["position"])
    return normalised


def store_metadata(
    session: Session,
    dataset_code: str,
    payload: dict,
) -> Tuple[
    DataTable,
    Dict[str, Dimension],
    Dict[str, Dict[str, Category]],
    List[str],
    Dict[str, List[str]],
]:
    """Create (or reuse) the dataset, dimensions, and categories described in the payload."""
    data_section = payload.get("data", {})
    structures = data_section.get("structures") or []
    if not structures:
        raise ValueError("Dataset payload does not include any structure definition.")

    structure = structures[0]
    dataset_name = structure.get("name") or dataset_code
    dataset_name = str(_prefer_text(structure.get("names"), dataset_name))
    dataset_description = _prefer_text(structure.get("descriptions"), structure.get("description"))

    datatable = (
        session.query(DataTable)
        .filter(DataTable.code == dataset_code)
        .one_or_none()
    )
    if datatable:
        datatable.name = dataset_name
        datatable.description = dataset_description
    else:
        datatable = DataTable(
            code=dataset_code,
            name=dataset_name,
            description=dataset_description,
        )
        session.add(datatable)
        session.flush()

    dimension_lookup: Dict[str, Dimension] = {}
    category_lookup: Dict[str, Dict[str, Category]] = {}
    dimension_order: List[str] = []
    dimension_value_codes: Dict[str, List[str]] = {}
    pending_parents: List[Tuple[str, Category, str]] = []

    dimensions_meta = _build_dimension_metadata(structure)

    new_dim_count = 0
    new_cat_count = 0

    for meta in dimensions_meta:
        dim_code = meta["code"]
        dim_label = meta["label"]

        existing_dimension = (
            session.query(Dimension)
            .filter(
                Dimension.data_table_id == datatable.id,
                Dimension.code == dim_code,
            )
            .one_or_none()
        )

        if existing_dimension:
            dimension = existing_dimension
        else:
            dimension = Dimension(
                code=dim_code,
                name=dim_label,
                label=dim_label,
                position=meta["position"],
                data_table=datatable,
            )
            session.add(dimension)
            session.flush()
            new_dim_count += 1

        dimension_lookup[dim_code] = dimension
        dimension_order.append(dim_code)
        category_lookup[dim_code] = {}
        value_codes: List[str] = []

        for value_meta in meta["values"]:
            category_code = value_meta["code"]
            category_label = value_meta["label"] or category_code

            existing_category = (
                session.query(Category)
                .filter(
                    Category.dimension_id == dimension.id,
                    Category.code == category_code,
                )
                .one_or_none()
            )
            if existing_category:
                category = existing_category
                category.name = category_label
                category.label = category_label
            else:
                category = Category(
                    code=category_code,
                    name=category_label,
                    label=category_label,
                    data_table=datatable,
                    dimension=dimension,
                )
                session.add(category)
                new_cat_count += 1

            category_lookup[dim_code][category_code] = category
            value_codes.append(category_code)

            parent_code = value_meta.get("parent_code")
            if parent_code:
                pending_parents.append((dim_code, category, parent_code))

        dimension_value_codes[dim_code] = value_codes

    for dim_code, category, parent_code in pending_parents:
        parent = category_lookup.get(dim_code, {}).get(parent_code)
        if parent is None:
            parent = (
                session.query(Category)
                .filter(
                    Category.dimension_id == dimension_lookup[dim_code].id,
                    Category.code == parent_code,
                )
                .one_or_none()
            )
        if parent is not None:
            category.parent = parent

    session.flush()

    LOGGER.info(
        "Dataset %s - dimensions: %d (%d new), categories: %d (%d new)",
        dataset_code,
        len(dimension_order),
        new_dim_count,
        sum(len(codes) for codes in dimension_value_codes.values()),
        new_cat_count,
    )

    return (
        datatable,
        dimension_lookup,
        category_lookup,
        dimension_order,
        dimension_value_codes,
    )


def ensure_category(
    session: Session,
    datatable: DataTable,
    dimension: Dimension,
    category_lookup: Dict[str, Dict[str, Category]],
    dim_code: str,
    category_code: str,
) -> Category:
    """Safely resolve or create a category for the provided dimension."""
    cat_map = category_lookup.setdefault(dim_code, {})
    category = cat_map.get(category_code)
    if category:
        return category

    category = Category(
        code=category_code,
        name=category_code,
        label=category_code,
        data_table=datatable,
        dimension=dimension,
    )
    session.add(category)
    session.flush()
    cat_map[category_code] = category
    return category


def store_observations(
    session: Session,
    datatable: DataTable,
    dimension_lookup: Dict[str, Dimension],
    category_lookup: Dict[str, Dict[str, Category]],
    dimension_order: Sequence[str],
    dimension_value_codes: Dict[str, List[str]],
    payload: dict,
) -> None:
    """Persist all observations contained in the dataset payload."""
    datasets = payload.get("data", {}).get("dataSets") or []
    if not datasets:
        LOGGER.warning("Dataset %s has no dataSets section.", datatable.code)
        return

    observations = datasets[0].get("observations") or {}
    if not observations:
        LOGGER.warning("Dataset %s has no observation entries.", datatable.code)
        return

    total = 0
    skipped_missing_category = 0
    skipped_missing_value = 0

    expected_len = len(dimension_order)

    for key, row in observations.items():
        if not row:
            skipped_missing_value += 1
            continue
        raw_value = row[0]
        if raw_value is None:
            skipped_missing_value += 1
            continue

        indices = key.split(":")
        if len(indices) != expected_len:
            LOGGER.warning(
                "Observation key length mismatch for dataset %s: got %d, expected %d",
                datatable.code,
                len(indices),
                expected_len,
            )
            if len(indices) < expected_len:
                indices = indices + ["0"] * (expected_len - len(indices))
            else:
                indices = indices[:expected_len]

        dims_map: Dict[str, str] = {}
        for position, index_str in enumerate(indices):
            dim_code = dimension_order[position]
            value_list = dimension_value_codes.get(dim_code, [])
            try:
                index_int = int(index_str)
            except ValueError:
                index_int = 0
            if not value_list:
                continue
            if index_int >= len(value_list):
                skipped_missing_category += 1
                break
            dims_map[dim_code] = value_list[index_int]
        else:
            observation = Observation(
                value=float(raw_value),
                time_period=dims_map.get("TIME_PERIOD"),
                data_table=datatable,
            )
            session.add(observation)
            session.flush()

            for dim_code, category_code in dims_map.items():
                dimension = dimension_lookup[dim_code]
                category = category_lookup.get(dim_code, {}).get(category_code)
                if category is None:
                    category = ensure_category(
                        session,
                        datatable,
                        dimension,
                        category_lookup,
                        dim_code,
                        category_code,
                    )
                session.add(
                    ObservationDimensionValue(
                        observation=observation,
                        dimension=dimension,
                        category=category,
                    )
                )
            total += 1

    session.flush()
    LOGGER.info(
        "Stored %d observations for dataset %s (skipped %d missing value, %d missing category)",
        total,
        datatable.code,
        skipped_missing_value,
        skipped_missing_category,
    )


def load_urls_from_file(file_path: str) -> List[str]:
    """Load dataset URLs from the provided text file (one per line)."""
    urls: List[str] = []
    with open(file_path, "r", encoding="utf-8") as handle:
        for line in handle:
            trimmed = line.strip()
            if not trimmed or trimmed.startswith("#"):
                continue
            if ";" in trimmed:
                parts = trimmed.split(";")
                if parts:
                    urls.append(parts[0].strip())
            else:
                urls.append(trimmed)
    return urls


def fetch_data_recurrently(dataset_urls: Sequence[str]) -> None:
    """Fetch data for all provided dataset URLs."""
    for url in dataset_urls:
        dataset_code = _extract_dataset_code(url)
        LOGGER.info("Processing dataset %s", dataset_code)
        try:
            payload = fetch_dataset_payload(url)
            with SessionLocal() as session:
                datatable, dimension_lookup, category_lookup, dimension_order, dimension_value_codes = store_metadata(
                    session,
                    dataset_code,
                    payload,
                )
                store_observations(
                    session,
                    datatable,
                    dimension_lookup,
                    category_lookup,
                    dimension_order,
                    dimension_value_codes,
                    payload,
                )
                session.commit()
        except Exception as exc:  # pragma: no cover - defensive logging
            LOGGER.exception("Failed to process dataset %s: %s", dataset_code, exc)


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    urls_file = script_dir / "database" / "LustatCensus.txt"
    try:
        dataset_urls = load_urls_from_file(str(urls_file))
        LOGGER.info("Loaded %d dataset URLs from %s", len(dataset_urls), urls_file)
    except FileNotFoundError:
        LOGGER.error("Dataset URL file %s not found.", urls_file)
        dataset_urls = []

    if not dataset_urls:
        LOGGER.warning("No dataset URLs to process; exiting.")
        return

    fetch_data_recurrently(dataset_urls)


if __name__ == "__main__":
    main()
