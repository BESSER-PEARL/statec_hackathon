from __future__ import annotations

import logging
from typing import Dict, List, Optional

import requests
from lxml import etree
from requests import Response
from sqlalchemy.orm import Session

try:  # pragma: no cover - support both package and script execution
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

DATAFLOW_URL = "https://lustat.statec.lu/rest/dataflow/LU1/DSD_CENSUS_GROUP1_3@DF_B1600/1.0?references=all"
DATA_URL = "https://lustat.statec.lu/rest/data/LU1,DSD_CENSUS_GROUP1_3@DF_B1600,1.0/..A10...................?dimensionAtObservation=AllDimensions"
DEFAULT_TIMEOUT = 60
LANG_PRIORITY = ("en", "fr", "de", "lb")
XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"
SDMX_NS = {
    "mes": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message",
    "str": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure",
    "common": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common",
    "gen": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic",
}


def preferred_text(nodes: List[etree._Element], default: Optional[str] = None) -> Optional[str]:
    """Return the first non-empty text using a preferred language order."""
    if not nodes:
        return default
    by_lang: Dict[str, str] = {}
    for node in nodes:
        text = (node.text or "").strip()
        if not text:
            continue
        lang = node.attrib.get(XML_LANG, "").lower() or "und"
        by_lang.setdefault(lang, text)
    for lang in LANG_PRIORITY:
        if lang in by_lang:
            return by_lang[lang]
    if by_lang:
        return next(iter(by_lang.values()))
    return default


def fetch_xml(url: str) -> etree._Element:
    response: Response = requests.get(url, timeout=DEFAULT_TIMEOUT)
    response.raise_for_status()
    try:
        return etree.fromstring(response.content)
    except etree.XMLSyntaxError as exc:  # pragma: no cover - defensive
        LOGGER.error("Failed to parse XML from %s", url)
        raise exc


def parse_metadata(root: etree._Element) -> Dict[str, object]:
    concept_labels: Dict[str, str] = {}
    for concept in root.xpath(".//str:Concepts//str:Concept", namespaces=SDMX_NS):
        concept_id = concept.get("id")
        if not concept_id:
            continue
        concept_labels[concept_id] = preferred_text(
            concept.xpath("common:Name", namespaces=SDMX_NS), concept_id
        ) or concept_id

    dataflows = root.xpath(".//str:Dataflows/str:Dataflow", namespaces=SDMX_NS)
    if not dataflows:
        raise ValueError("No dataflow definition found in metadata response.")
    dataflow = dataflows[0]
    dataflow_info = {
        "code": dataflow.get("id"),
        "name": preferred_text(
            dataflow.xpath("common:Name", namespaces=SDMX_NS),
            dataflow.get("id"),
        ),
        "description": preferred_text(
            dataflow.xpath("common:Description", namespaces=SDMX_NS)
        ),
        "agency": dataflow.get("agencyID"),
    }

    dimensions: List[Dict[str, Optional[str]]] = []
    for idx, dim in enumerate(
        root.xpath(".//str:DimensionList/str:Dimension", namespaces=SDMX_NS), start=1
    ):
        dim_code = dim.get("id")
        if not dim_code:
            continue
        concept_id = None
        concept_identity = dim.find("str:ConceptIdentity", namespaces=SDMX_NS)
        if concept_identity is not None:
            ref = concept_identity.find("Ref")
            if ref is None:
                ref = concept_identity.find("str:Ref", namespaces=SDMX_NS)
            if ref is not None:
                concept_id = ref.get("id")
        dim_label = preferred_text(
            dim.xpath("str:Name", namespaces=SDMX_NS),
            concept_labels.get(concept_id, dim_code),
        ) or concept_labels.get(concept_id, dim_code)
        codelist_id = None
        for rep_path in ("str:LocalRepresentation", "str:Representation"):
            rep = dim.find(rep_path, namespaces=SDMX_NS)
            if rep is None:
                continue
            enumeration = rep.find("str:Enumeration", namespaces=SDMX_NS)
            if enumeration is None:
                continue
            ref = enumeration.find("Ref")
            if ref is None:
                ref = enumeration.find("str:Ref", namespaces=SDMX_NS)
            if ref is not None and ref.get("id"):
                codelist_id = ref.get("id")
                break
        position_raw = dim.get("position")
        position = int(position_raw) if position_raw and position_raw.isdigit() else idx
        dimensions.append(
            {
                "code": dim_code,
                "concept_id": concept_id,
                "name": concept_id or dim_code,
                "label": dim_label,
                "position": position,
                "codelist_id": codelist_id,
            }
        )

    codelists: Dict[str, List[Dict[str, Optional[str]]]] = {}
    for codelist in root.xpath(".//str:Codelists/str:Codelist", namespaces=SDMX_NS):
        codelist_id = codelist.get("id")
        if not codelist_id:
            continue
        entries: List[Dict[str, Optional[str]]] = []
        for code in codelist.xpath("str:Code", namespaces=SDMX_NS):
            code_id = code.get("id")
            if not code_id:
                continue
            code_name = preferred_text(
                code.xpath("common:Name", namespaces=SDMX_NS), code_id
            ) or code_id
            code_desc = preferred_text(
                code.xpath("common:Description", namespaces=SDMX_NS)
            )
            parent_code = code.get("parentID")
            if not parent_code:
                parent = code.find("str:Parent", namespaces=SDMX_NS)
                if parent is not None:
                    ref = parent.find("Ref")
                    if ref is None:
                        ref = parent.find("str:Ref", namespaces=SDMX_NS)
                    if ref is not None:
                        parent_code = ref.get("id")
            entries.append(
                {
                    "code": code_id,
                    "name": code_name,
                    "label": code_desc or code_name,
                    "parent": parent_code,
                }
            )
        codelists[codelist_id] = entries

    return {
        "dataflow": dataflow_info,
        "dimensions": dimensions,
        "codelists": codelists,
    }


def fetch_metadata() -> Dict[str, object]:
    LOGGER.info("Fetching metadata from %s", DATAFLOW_URL)
    root = fetch_xml(DATAFLOW_URL)
    return parse_metadata(root)


def store_metadata(
    session: Session, metadata: Dict[str, object]
) -> Tuple[DataTable, Dict[str, Dimension], Dict[str, Dict[str, Category]]]:
    dataflow = metadata["dataflow"]
    code = dataflow.get("code")
    existing = None
    if code:
        existing = (
            session.query(DataTable)
            .filter(DataTable.code == code)
            .one_or_none()
        )
    if existing:
        LOGGER.info("Replacing existing metadata for dataflow %s", code)
        session.delete(existing)
        session.flush()

    datatable = DataTable(
        code=code or "UNKNOWN",
        name=dataflow.get("name") or code or "Unknown dataset",
        description=dataflow.get("description"),
        provider=dataflow.get("agency"),
    )
    session.add(datatable)
    session.flush()

    dimension_lookup: Dict[str, Dimension] = {}
    category_lookup: Dict[str, Dict[str, Category]] = {}
    codelists = metadata["codelists"]

    for dim_meta in sorted(
        metadata["dimensions"], key=lambda item: item["position"] or 0
    ):
        dimension = Dimension(
            code=dim_meta["code"],
            name=dim_meta["name"],
            label=dim_meta["label"],
            position=dim_meta["position"] or 0,
            codelist_id=dim_meta.get("codelist_id"),
            data_table=datatable,
        )
        session.add(dimension)
        dimension_lookup[dimension.code] = dimension
        category_lookup[dimension.code] = {}

        categories_meta = codelists.get(dimension.codelist_id, [])
        for cat_meta in categories_meta:
            category = Category(
                code=cat_meta["code"],
                name=cat_meta["name"],
                label=cat_meta["label"],
                data_table=datatable,
                dimension=dimension,
            )
            parent_code = cat_meta.get("parent")
            if parent_code:
                category_lookup[dimension.code].setdefault("_pending", []).append(
                    (category, parent_code)
                )
            category_lookup[dimension.code][category.code] = category
            session.add(category)

    # Resolve parent relationships after all categories are registered
    for dim_code, categories in category_lookup.items():
        pending = categories.pop("_pending", [])
        for category, parent_code in pending:
            parent = categories.get(parent_code)
            if parent is not None:
                category.parent = parent

    session.flush()

    LOGGER.info(
        "Stored %d dimensions and %d categories",
        len(dimension_lookup),
        sum(len(cat_map) for cat_map in category_lookup.values()),
    )
    return datatable, dimension_lookup, category_lookup


def fetch_observations() -> etree._Element:
    LOGGER.info("Fetching observations from %s", DATA_URL)
    return fetch_xml(DATA_URL)


def ensure_category(
    session: Session,
    datatable: DataTable,
    dimension: Dimension,
    category_lookup: Dict[str, Dict[str, Category]],
    dim_code: str,
    category_code: str,
) -> Category:
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
    cat_map[category_code] = category
    return category


def store_observations(
    session: Session,
    datatable: DataTable,
    dimension_lookup: Dict[str, Dimension],
    category_lookup: Dict[str, Dict[str, Category]],
    observations_root: etree._Element,
) -> None:
    obs_count = 0
    for obs in observations_root.xpath(".//gen:Obs", namespaces=SDMX_NS):
        value_elem = obs.find("gen:ObsValue", namespaces=SDMX_NS)
        if value_elem is None:
            continue
        raw_value = value_elem.get("value")
        if raw_value is None:
            continue
        try:
            value = float(raw_value)
        except ValueError:
            LOGGER.debug("Skipping observation with non-numeric value %s", raw_value)
            continue

        dim_values: Dict[str, str] = {}
        for dim_value in obs.xpath("gen:ObsKey/gen:Value", namespaces=SDMX_NS):
            dim_id = dim_value.get("id")
            dim_code = dim_value.get("value")
            if not dim_id or dim_code is None:
                continue
            dim_values[dim_id] = dim_code

        observation = Observation(
            value=value,
            time_period=dim_values.get("TIME_PERIOD"),
            data_table=datatable,
        )
        session.add(observation)

        for dim_code, category_code in dim_values.items():
            dimension = dimension_lookup.get(dim_code)
            if dimension is None:
                continue
            category = ensure_category(
                session, datatable, dimension, category_lookup, dim_code, category_code
            )
            session.add(
                ObservationDimensionValue(
                    observation=observation,
                    dimension=dimension,
                    category=category,
                )
            )
        obs_count += 1

    LOGGER.info("Prepared %d observations for persistence", obs_count)


# Add a new function to fetch data recurrently for multiple URLs
def fetch_data_recurrently(dataflow_urls: List[str], data_urls: List[str]) -> None:
    """Fetch data recurrently for all provided dataflow and data URLs."""
    for dataflow_url, data_url in zip(dataflow_urls, data_urls):
        LOGGER.info("Fetching metadata and observations for dataflow URL: %s", dataflow_url)
        try:
            root = fetch_xml(dataflow_url)
            metadata = parse_metadata(root)
            observations = fetch_xml(data_url)
            with SessionLocal() as session:
                datatable, dimension_lookup, category_lookup = store_metadata(session, metadata)
                store_observations(session, datatable, dimension_lookup, category_lookup, observations)
                session.commit()
            LOGGER.info("Successfully processed dataflow URL: %s", dataflow_url)
        except Exception as e:
            LOGGER.error("Error processing dataflow URL %s: %s", dataflow_url, e)


def load_urls_from_file(file_path: str) -> tuple[List[str], List[str]]:
    """Load data URLs and dataflow URLs from a text file.
    
    Expected format: data_url;dataflow_url (one pair per line)
    """
    data_urls = []
    dataflow_urls = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(';')
            if len(parts) == 2:
                data_urls.append(parts[0].strip())
                dataflow_urls.append(parts[1].strip())
    
    return data_urls, dataflow_urls


def main() -> None:
    # Load URLs from the LustatCensus.txt file
    urls_file = "LustatCensus.txt"
    try:
        data_urls, dataflow_urls = load_urls_from_file(urls_file)
        LOGGER.info("Loaded %d URL pairs from %s", len(data_urls), urls_file)
        fetch_data_recurrently(dataflow_urls, data_urls)
    except FileNotFoundError:
        LOGGER.error("File %s not found. Using default URLs.", urls_file)
        dataflow_urls = [
            "https://lustat.statec.lu/rest/dataflow/LU1/DSD_CENSUS_GROUP1_3@DF_B1600/1.0?references=all",
        ]
        data_urls = [
            "https://lustat.statec.lu/rest/data/LU1,DSD_CENSUS_GROUP1_3@DF_B1600,1.0/..A10...................?dimensionAtObservation=AllDimensions",
        ]
        fetch_data_recurrently(dataflow_urls, data_urls)


if __name__ == "__main__":
    main()
