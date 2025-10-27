#!/usr/bin/env python3
"""Fetch SDMX observations from LUSTAT and export them as a flat table.

The script relies on the structure metadata produced by `sdmx_dataflow_parser.py`
to derive the list of dimensions, their allowed values, and the preferred
defaults when no explicit filter is provided.

Example
-------
    python scripts/sdmx_fetch_data.py \\
        --flow DSD_CENSUS_GROUP1_3@DF_B1600 \\
        --structure-url https://lustat.statec.lu/rest/dataflow/LU1/DSD_CENSUS_GROUP1_3@DF_B1600/1.0?references=all \\
        --dim SEX=F \\
        --dim AGE=Y65T69,Y70T74 \\
        --start-period 2011 \\
        --output data/census_age_sex.csv
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import OrderedDict
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.parse import urlencode

import requests
import xml.etree.ElementTree as ET

try:
    # Reuse the structure parser when available.
    from scripts import sdmx_dataflow_parser
except ImportError:
    sdmx_dataflow_parser = None  # type: ignore


GENERIC_NS = {
    "message": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message",
    "generic": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic",
}


def load_structure(
    structure_path: Optional[Path],
    structure_url: Optional[str],
) -> dict:
    if structure_path:
        return json.loads(structure_path.read_text(encoding="utf-8"))
    if structure_url:
        if sdmx_dataflow_parser is None:
            raise SystemExit(
                "sdmx_dataflow_parser module not available; provide --structure instead."
            )
        return sdmx_dataflow_parser.build_summary(structure_url)
    raise SystemExit("Either --structure or --structure-url must be provided.")


def preferred_default(values: List[str]) -> Optional[str]:
    for candidate in ("_T", "_Z", "TOTAL", "ALL"):
        if candidate in values:
            return candidate
    return values[0] if values else None


def resolve_defaults(structure: dict) -> Dict[str, str]:
    constraints = structure.get("constraints", [])
    codelists = {cl["id"]: cl for cl in structure.get("codelists", {}).values()}
    defaults: Dict[str, str] = {}

    def from_codelist(dim: dict) -> Optional[str]:
        cl_id = (dim.get("codelist") or {}).get("id")
        if not cl_id or cl_id not in codelists:
            return None
        values = [code["id"] for code in codelists[cl_id]["codes"]]
        return preferred_default(values)

    for dim in structure["data_structure"]["dimensions"]:
        dim_id = dim["id"]
        if dim_id == "TIME_PERIOD":
            continue
        chosen: Optional[str] = None
        for constraint in constraints:
            values = constraint.get("key_values", {}).get(dim_id, [])
            if values:
                chosen = preferred_default(values)
                if chosen is not None:
                    break
        if chosen is None:
            chosen = from_codelist(dim)
        if chosen is not None:
            defaults[dim_id] = chosen
    return defaults


def parse_dim_filters(raw_filters: Iterable[str]) -> Dict[str, List[str]]:
    parsed: Dict[str, List[str]] = {}
    for item in raw_filters:
        if "=" not in item:
            raise SystemExit(f"Invalid --dim input (expected DIM=VAL,...): {item}")
        dim, values = item.split("=", 1)
        dim = dim.strip().upper()
        vals = [value.strip() for value in values.split(",") if value.strip()]
        if not vals:
            raise SystemExit(f"No values provided for dimension {dim}")
        parsed[dim] = vals
    return parsed


def build_key_string(
    structure: dict,
    defaults: Dict[str, str],
    filters: Dict[str, List[str]],
) -> str:
    key_values: List[str] = []
    for dim in structure["data_structure"]["dimensions"]:
        dim_id = dim["id"]
        if dim_id == "TIME_PERIOD":
            continue
        if dim_id in filters:
            key_values.append("+".join(filters[dim_id]))
        else:
            key_values.append(defaults.get(dim_id, ""))
    return ".".join(key_values)


def fetch_sdmx_series(url: str) -> bytes:
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    return response.content


def parse_generic_dataset(xml_payload: bytes) -> List[Dict[str, str]]:
    root = ET.fromstring(xml_payload)
    records: List[Dict[str, str]] = []

    for series in root.findall(".//generic:Series", GENERIC_NS):
        series_key = {
            elem.attrib["id"]: elem.attrib.get("value")
            for elem in series.findall("generic:SeriesKey/generic:Value", GENERIC_NS)
        }

        for obs in series.findall("generic:Obs", GENERIC_NS):
            record = dict(series_key)
            obs_dim = obs.find("generic:ObsDimension", GENERIC_NS)
            if obs_dim is not None:
                record[obs_dim.attrib["id"]] = obs_dim.attrib.get("value")

            obs_val = obs.find("generic:ObsValue", GENERIC_NS)
            if obs_val is not None:
                record["OBS_VALUE"] = obs_val.attrib.get("value")

            for attr_val in obs.findall("generic:Attributes/generic:Value", GENERIC_NS):
                record[attr_val.attrib["id"]] = attr_val.attrib.get("value")

            records.append(record)
    return records


def build_label_lookup(structure: dict, lang: str) -> Dict[tuple, str]:
    lookup: Dict[tuple, str] = {}
    for dim in structure["data_structure"]["dimensions"]:
        codelist = (dim.get("codelist") or {}).get("id")
        if not codelist:
            continue
        codes = structure["codelists"][codelist]["codes"]
        for code in codes:
            label = code["names"].get(lang) or next(iter(code["names"].values()), "")
            lookup[(dim["id"], code["id"])] = label
    return lookup


def attach_labels(
    records: List[Dict[str, str]],
    lookup: Dict[tuple, str],
    dimension_ids: List[str],
) -> None:
    for record in records:
        for dim_id in dimension_ids:
            code = record.get(dim_id)
            if code is None:
                continue
            label_text = lookup.get((dim_id, code))
            if label_text:
                record[f"{dim_id}_label"] = label_text


def write_csv(
    records: List[Dict[str, str]],
    path: Path,
    column_order: Optional[List[str]] = None,
) -> None:
    if not records:
        path.write_text("", encoding="utf-8")
        return
    if column_order is None:
        # Preserve insertion order but ensure OBS_VALUE near the end.
        first_record = records[0]
        column_order = list(first_record.keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=column_order)
        writer.writeheader()
        writer.writerows(records)


def preview_records(records: List[Dict[str, str]], max_rows: int = 5) -> str:
    if not records:
        return "No records returned."
    sample_rows = records[:max_rows]
    columns = list(sample_rows[0].keys())
    lines = [" | ".join(columns)]
    for row in sample_rows:
        lines.append(" | ".join(row.get(col, "") or "" for col in columns))
    if len(records) > max_rows:
        lines.append(f"... ({len(records)} total rows)")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--flow",
        required=True,
        help="SDMX dataflow identifier (e.g., DSD_CENSUS_GROUP1_3@DF_B1600).",
    )
    parser.add_argument(
        "--structure",
        type=Path,
        help="Path to a JSON structure file produced by sdmx_dataflow_parser.py.",
    )
    parser.add_argument(
        "--structure-url",
        help="Structure URL to download if --structure is not supplied.",
    )
    parser.add_argument(
        "--dim",
        action="append",
        default=[],
        help="Dimension filter in the form DIM=code1,code2. Repeatable.",
    )
    parser.add_argument(
        "--start-period",
        help="Optional start period for the time series (e.g., 2011).",
    )
    parser.add_argument(
        "--end-period",
        help="Optional end period for the time series.",
    )
    parser.add_argument(
        "--last-n",
        type=int,
        help="Retrieve only the last N observations (maps to lastNObservations).",
    )
    parser.add_argument(
        "--lang",
        default="en",
        help="Preferred language for concept labels (default: en).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional CSV output path. When omitted, prints a preview.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    structure_url = args.structure_url
    if args.structure is None and not structure_url:
        structure_url = (
            f"https://lustat.statec.lu/rest/dataflow/LU1/{args.flow}/1.0?references=all"
        )

    structure = load_structure(args.structure, structure_url)
    defaults = resolve_defaults(structure)
    filters = parse_dim_filters(args.dim)
    key_string = build_key_string(structure, defaults, filters)

    params = OrderedDict()
    if args.start_period:
        params["startPeriod"] = args.start_period
    if args.end_period:
        params["endPeriod"] = args.end_period
    if args.last_n is not None:
        params["lastNObservations"] = str(args.last_n)

    query = f"?{urlencode(params)}" if params else ""
    request_url = f"https://lustat.statec.lu/rest/data/{args.flow}/{key_string}{query}"

    xml_payload = fetch_sdmx_series(request_url)
    records = parse_generic_dataset(xml_payload)

    dimension_ids = [
        dim["id"]
        for dim in structure["data_structure"]["dimensions"]
        if dim["id"] != "TIME_PERIOD"
    ] + ["TIME_PERIOD"]

    label_lookup = build_label_lookup(structure, args.lang)
    attach_labels(records, label_lookup, dimension_ids)

    if args.output:
        ordered_columns = list(records[0].keys()) if records else []
        write_csv(records, args.output, ordered_columns)
        print(f"Wrote {len(records)} rows to {args.output}")
    else:
        print(preview_records(records))
        print(f"\nTotal rows: {len(records)}")


if __name__ == "__main__":
    main()
