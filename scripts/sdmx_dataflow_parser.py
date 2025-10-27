#!/usr/bin/env python3
"""Download and parse an SDMX dataflow definition into structured JSON.

This parser focuses on SDMX 2.1 `dataflow` responses such as
https://lustat.statec.lu/rest/dataflow/LU1/DSD_CENSUS_GROUP1_3@DF_B1600/1.0?references=all
and extracts:

* high-level metadata about the dataflow itself,
* the referenced DataStructure with its dimensions, attributes, and primary measure,
* associated concept metadata (names/descriptions by language),
* associated codelists and their codes (including hierarchical parent references),
* availability constraints listing which key values are present in the cube.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import OrderedDict
from typing import Dict, Iterable, List, Optional

import requests
import xml.etree.ElementTree as ET


NS = {
    "message": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message",
    "structure": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure",
    "common": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common",
}

XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"


def fetch_xml(url: str) -> ET.Element:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    try:
        return ET.fromstring(response.content)
    except ET.ParseError as exc:
        raise SystemExit(f"Failed to parse XML from {url}: {exc}") from exc


def text_by_lang(element: ET.Element, item_tag: str) -> Dict[str, str]:
    items: Dict[str, str] = OrderedDict()
    for child in element.findall(item_tag, NS):
        text = (child.text or "").strip()
        if not text:
            continue
        lang = child.attrib.get(XML_LANG, "und")
        if lang not in items:
            items[lang] = text
    return items


def parse_concepts(root: ET.Element) -> Dict[str, dict]:
    concepts: Dict[str, dict] = {}
    for concept in root.findall(".//structure:Concepts//structure:Concept", NS):
        concept_id = concept.attrib["id"]
        concepts[concept_id] = {
            "id": concept_id,
            "names": text_by_lang(concept, "common:Name"),
            "descriptions": text_by_lang(concept, "common:Description"),
        }
    return concepts


def parse_codelists(root: ET.Element) -> Dict[str, dict]:
    codelists: Dict[str, dict] = {}
    for codelist in root.findall(".//structure:Codelists/structure:Codelist", NS):
        cl_id = codelist.attrib["id"]
        codes: List[dict] = []
        for code in codelist.findall("structure:Code", NS):
            code_id = code.attrib["id"]
            codes.append(
                {
                    "id": code_id,
                    "parent": code.attrib.get("parentID"),
                    "names": text_by_lang(code, "common:Name"),
                    "descriptions": text_by_lang(code, "common:Description"),
                }
            )
        codelists[cl_id] = {
            "id": cl_id,
            "agency": codelist.attrib.get("agencyID"),
            "version": codelist.attrib.get("version"),
            "is_final": codelist.attrib.get("isFinal") == "true",
            "names": text_by_lang(codelist, "common:Name"),
            "descriptions": text_by_lang(codelist, "common:Description"),
            "codes": codes,
        }
    return codelists


def parse_dataflows(root: ET.Element) -> Dict[str, dict]:
    dataflows: Dict[str, dict] = {}
    for dataflow in root.findall(".//structure:Dataflows/structure:Dataflow", NS):
        flow_id = dataflow.attrib["id"]
        structure_ref = dataflow.find("structure:Structure/Ref", NS)
        dataflows[flow_id] = {
            "id": flow_id,
            "agency": dataflow.attrib.get("agencyID"),
            "version": dataflow.attrib.get("version"),
            "names": text_by_lang(dataflow, "common:Name"),
            "descriptions": text_by_lang(dataflow, "common:Description"),
            "structure_ref": structure_ref.attrib.get("id") if structure_ref is not None else None,
            "annotations": parse_annotations(dataflow),
        }
    return dataflows


def parse_annotations(element: ET.Element) -> List[dict]:
    annotations: List[dict] = []
    for ann in element.findall(".//common:Annotation", NS):
        annotations.append(
            {
                "id": ann.attrib.get("id"),
                "title": ann.findtext("common:AnnotationTitle", default="", namespaces=NS)
                or None,
                "type": ann.findtext("common:AnnotationType", default="", namespaces=NS)
                or None,
                "text": text_by_lang(ann, "common:AnnotationText"),
            }
        )
    return annotations


def parse_measure_descriptor(dim_container: ET.Element, concepts: Dict[str, dict]) -> dict:
    primary = dim_container.find(
        "structure:MeasureList/structure:PrimaryMeasure", NS
    )
    if primary is None:
        return {}

    concept_ref = primary.find("structure:ConceptIdentity/Ref", NS)
    concept_id = concept_ref.attrib["id"] if concept_ref is not None else None
    concept_info = concepts.get(concept_id) if concept_id else None
    local_representation = primary.find("structure:LocalRepresentation", NS)
    text_format = None

    if local_representation is not None:
        text_elem = local_representation.find("structure:TextFormat", NS)
        if text_elem is not None:
            text_format = dict(text_elem.attrib)

    return {
        "id": primary.attrib.get("id"),
        "concept_id": concept_id,
        "concept": concept_info,
        "text_format": text_format,
    }


def parse_attribute(
    attribute: ET.Element,
    concepts: Dict[str, dict],
    codelists: Dict[str, dict],
) -> dict:
    concept_ref = attribute.find("structure:ConceptIdentity/Ref", NS)
    concept_id = concept_ref.attrib["id"] if concept_ref is not None else None
    concept_info = concepts.get(concept_id)

    codelist_ref = attribute.find(
        "structure:LocalRepresentation/structure:Enumeration/Ref", NS
    )
    codelist_id = codelist_ref.attrib["id"] if codelist_ref is not None else None

    relationship = None
    rel_elem = attribute.find("structure:AttributeRelationship", NS)
    if rel_elem is not None:
        if rel_elem.find("structure:None", NS) is not None:
            relationship = {"type": "None"}
        elif rel_elem.find("structure:PrimaryMeasure", NS) is not None:
            target = rel_elem.find("structure:PrimaryMeasure/Ref", NS)
            relationship = {"type": "PrimaryMeasure", "target": target.attrib["id"]}

    return {
        "id": attribute.attrib.get("id"),
        "assignment_status": attribute.attrib.get("assignmentStatus"),
        "concept_id": concept_id,
        "concept": concept_info,
        "codelist_id": codelist_id,
        "codelist": codelists.get(codelist_id),
        "relationship": relationship,
    }


def parse_dimensions(
    dim_list: ET.Element,
    concepts: Dict[str, dict],
    codelists: Dict[str, dict],
) -> List[dict]:
    dimensions: List[dict] = []
    for dim_elem in dim_list:
        is_time = dim_elem.tag.endswith("TimeDimension")
        if not is_time and not dim_elem.tag.endswith("Dimension"):
            continue

        concept_ref = dim_elem.find("structure:ConceptIdentity/Ref", NS)
        concept_id = concept_ref.attrib["id"] if concept_ref is not None else None

        codelist_ref = dim_elem.find(
            "structure:LocalRepresentation/structure:Enumeration/Ref", NS
        )
        codelist_id = codelist_ref.attrib["id"] if codelist_ref is not None else None

        dimensions.append(
            {
                "id": dim_elem.attrib.get("id"),
                "position": int(dim_elem.attrib.get("position", "0")),
                "type": "TimeDimension" if is_time else "Dimension",
                "concept_id": concept_id,
                "concept": concepts.get(concept_id),
                "codelist_id": codelist_id,
                "codelist": codelists.get(codelist_id),
            }
        )
    dimensions.sort(key=lambda item: item.get("position", 0))
    return dimensions


def parse_data_structure(
    root: ET.Element,
    structure_id: str,
    concepts: Dict[str, dict],
    codelists: Dict[str, dict],
) -> dict:
    structure_elem = root.find(
        f".//structure:DataStructures/structure:DataStructure[@id='{structure_id}']",
        NS,
    )
    if structure_elem is None:
        raise KeyError(f"DataStructure {structure_id} not found")

    components = structure_elem.find("structure:DataStructureComponents", NS)
    if components is None:
        raise KeyError(f"No components found for DataStructure {structure_id}")

    dim_list = components.find("structure:DimensionList", NS)
    attr_list = components.find("structure:AttributeList", NS)

    dimensions = (
        parse_dimensions(dim_list, concepts, codelists) if dim_list is not None else []
    )
    attributes = (
        [
            parse_attribute(attr_elem, concepts, codelists)
            for attr_elem in attr_list.findall("structure:Attribute", NS)
        ]
        if attr_list is not None
        else []
    )
    measure = parse_measure_descriptor(components, concepts)

    return {
        "id": structure_elem.attrib["id"],
        "agency": structure_elem.attrib.get("agencyID"),
        "version": structure_elem.attrib.get("version"),
        "names": text_by_lang(structure_elem, "common:Name"),
        "descriptions": text_by_lang(structure_elem, "common:Description"),
        "dimensions": dimensions,
        "attributes": attributes,
        "primary_measure": measure,
    }


def parse_constraints(root: ET.Element, target_flow: str) -> List[dict]:
    constraints: List[dict] = []
    for constraint in root.findall(".//structure:Constraints/structure:ContentConstraint", NS):
        attachment = constraint.find(
            "structure:ConstraintAttachment/structure:Dataflow/Ref", NS
        )
        if attachment is None or attachment.attrib.get("id") != target_flow:
            continue

        cube_region = constraint.find("structure:CubeRegion", NS)
        key_values: Dict[str, List[str]] = OrderedDict()
        if cube_region is not None:
            for key_value in cube_region.findall("common:KeyValue", NS):
                dimension = key_value.attrib.get("id")
                values = [value.text for value in key_value.findall("common:Value", NS)]
                key_values[dimension] = [value for value in values if value]

        constraints.append(
            {
                "id": constraint.attrib.get("id"),
                "type": constraint.attrib.get("type"),
                "version": constraint.attrib.get("version"),
                "annotations": parse_annotations(constraint),
                "key_values": key_values,
            }
        )
    return constraints


def build_summary(url: str) -> dict:
    root = fetch_xml(url)
    concepts = parse_concepts(root)
    codelists = parse_codelists(root)
    dataflows = parse_dataflows(root)

    if not dataflows:
        raise SystemExit("No dataflows found in the response.")

    # The endpoint typically returns a single dataflow; pick the first.
    dataflow = next(iter(dataflows.values()))

    structure_ref = dataflow["structure_ref"]
    if not structure_ref:
        ref_elem = root.find(".//structure:Structure/Ref", NS)
        structure_ref = ref_elem.attrib.get("id") if ref_elem is not None else ""
    if not structure_ref:
        raise SystemExit("Could not determine the referenced DataStructure ID.")

    try:
        data_structure = parse_data_structure(root, structure_ref, concepts, codelists)
    except KeyError as exc:
        raise SystemExit(str(exc))

    constraints = parse_constraints(root, dataflow["id"])

    return {
        "source_url": url,
        "dataflow": dataflow,
        "data_structure": data_structure,
        "concepts": concepts,
        "codelists": codelists,
        "constraints": constraints,
    }


def parse_args(argv: Optional[Iterable[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "url",
        help="REST dataflow URL (SDMX 2.1) to parse.",
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Optional output file path (JSON). Defaults to stdout.",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="Pretty-print indentation for JSON output (default: 2).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Iterable[str]] = None) -> None:
    args = parse_args(argv)
    summary = build_summary(args.url)
    json_payload = json.dumps(summary, ensure_ascii=False, indent=args.indent)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(json_payload)
    else:
        print(json_payload)


if __name__ == "__main__":
    main()
