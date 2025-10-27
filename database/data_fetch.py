import requests
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from datetime import datetime
from lxml import etree
import sys

from sql_alchemy import Base, Observation, Category, Dimension, DataTable  # Adjust import path

# --- Database setup ---
DATABASE_URL = "sqlite:///Class_Diagram.db"
engine = create_engine(DATABASE_URL, echo=True)
Base.metadata.create_all(engine)

# --- LUSTAT API endpoints ---
DATAFLOW_URL = "https://lustat.statec.lu/rest/dataflow/LU1/DSD_CENSUS_GROUP15_17@DF_B1652/1.0?references=all"
DATA_URL = "https://lustat.statec.lu/rest/data/LU1,DSD_CENSUS_GROUP15_17@DF_B1652,1.0/..A10._T._T.................?startPeriod=2021&endPeriod=2021&dimensionAtObservation=AllDimensions"

def fetch_metadata():
    # Open output file for debug logs
    log_file = open("console_output.txt", "w", encoding="utf-8")
    def log(msg):
        print(msg)
        log_file.write(str(msg) + "\n")

    response = requests.get(DATAFLOW_URL)
    try:
        response.raise_for_status()
        log("Metadata XML preview: " + response.text[:1000])
        xml_root = etree.fromstring(response.content)
    except Exception as e:
        log("Error fetching metadata!")
        log("Status code: " + str(response.status_code))
        log("Response text: " + response.text)
        log_file.close()
        raise e

    # Namespaces used in SDMX XML
    ns = {
        'mes': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message',
        'str': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure',
        'common': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common',
        'xml': 'http://www.w3.org/XML/1998/namespace',
    }

    # Extract dimensions (debug raw XML nodes)
    dims = {}
    dim_nodes = xml_root.xpath('.//str:DimensionList/str:Dimension', namespaces=ns)
    log(f"Raw dimension XML nodes found: {len(dim_nodes)}")
    for dim in dim_nodes:
        log(etree.tostring(dim, pretty_print=True).decode())
        dim_id = dim.get('id')
        # Try to get English name, fallback to French
        dim_name = None
        name_nodes = dim.findall('str:Name', namespaces=ns)
        for name_node in name_nodes:
            if name_node.get('{http://www.w3.org/XML/1998/namespace}lang') == 'en':
                dim_name = name_node.text
                break
        if dim_name is None and name_nodes:
            dim_name = name_nodes[0].text
        if dim_name is None:
            log(f"No <Name> found for Dimension '{dim_id}', using id as name.")
            dim_name = dim_id
        dims[dim_id] = dim_name

    # Extract codelists and categories (correct XPath and namespaces)
    cats = {}
    for codelist in xml_root.xpath('.//str:Codelists/str:Codelist', namespaces=ns):
        for code in codelist.xpath('str:Code', namespaces=ns):
            code_id = code.get('id')
            # Try to get English name, fallback to French
            code_name = code.findtext("common:Name[@xml:lang='en']", namespaces=ns)
            if code_name is None:
                code_name = code.findtext("common:Name[@xml:lang='fr']", namespaces=ns)
            # Try to get English description, fallback to French
            code_desc = code.findtext("common:Description[@xml:lang='en']", namespaces=ns)
            if code_desc is None:
                code_desc = code.findtext("common:Description[@xml:lang='fr']", namespaces=ns)
            # Get parent code from structure:Parent/Ref/@id
            parent_ref = code.find("str:Parent/str:Ref", namespaces=ns)
            parent_code = parent_ref.get('id') if parent_ref is not None else None
            if code_name is None:
                print(f"Warning: Category '{code_id}' has no name, skipping.")
                continue
            cats[code_id] = {
                'name': code_name,
                'code': code_id,
                'label': code_desc if code_desc else code_name,
                'parent_id': parent_code
            }

    return dims, cats

# --- Step 2: Store metadata ---
def store_metadata(dims, cats):
    session = Session(engine)

    log_file = open("console_output.txt", "a", encoding="utf-8")
    def log(msg):
        print(msg)
        log_file.write(str(msg) + "\n")

    log("Dimensions to store: " + str(dims))
    log("Categories to store: " + str({k: v for k, v in list(cats.items())[:10]}))  # Print first 10 for brevity

    # Create DataTable
    datatable = DataTable(
        name="Census 2021",
        description="Census 2021 Data",
        provider="STATEC"
    )
    session.add(datatable)
    session.commit()

    # Store dimensions
    dim_objs = {}
    for dim_id, dim_name in dims.items():
        log(f"Storing dimension: id={dim_id}, name={dim_name}")
        dim_obj = Dimension(name=dim_name, code=dim_id, label=dim_name)
        session.add(dim_obj)
        session.flush()  # Get ID before commit
        dim_objs[dim_id] = dim_obj.id
    session.commit()

    # Store categories (without parent yet)
    cat_objs = {}
    for cat_id, cat_info in cats.items():
        log(f"Storing category: id={cat_id}, name={cat_info['name']}")
        cat_obj = Category(
            name=cat_info["name"],
            code=cat_info["code"],
            label=cat_info["label"],
            data_table_id=datatable.id
        )
        session.add(cat_obj)
        session.flush()  # Get ID before commit
        cat_objs[cat_id] = cat_obj.id
    session.commit()

    # Now update parent_id relationships
    for cat_id, cat_info in cats.items():
        parent_code = cat_info.get("parent_id")
        if parent_code and parent_code in cat_objs:
            session.query(Category).filter_by(id=cat_objs[cat_id]).update({"parent_id": cat_objs[parent_code]})
    session.commit()

    session.close()
    log_file.close()
    return datatable, dim_objs, cat_objs

# --- Step 3: Fetch observations ---
def fetch_observations():
    from lxml import etree
    response = requests.get(DATA_URL)
    try:
        response.raise_for_status()
        xml_root = etree.fromstring(response.content)
        return xml_root  # Return XML root for further processing
    except Exception as e:
        print("Error fetching observations!")
        print("Status code:", response.status_code)
        print("Response text:", response.text)
        raise e

# --- Step 4: Store observations ---
def store_observations(obs_json, dim_objs, cat_objs):
    session = Session(engine)

    # Namespaces used in SDMX XML
    ns = {
        'mes': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message',
        'gen': 'http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic',
    }

    log_file = open("console_output.txt", "a", encoding="utf-8")
    def log(msg):
        log_file.write(str(msg) + "\n")

    # Find all observations in the XML (correct XPath)
    for obs in obs_json.xpath('.//gen:Obs', namespaces=ns):
        # Get value
        value_elem = obs.find('gen:ObsValue', namespaces=ns)
        value = float(value_elem.get('value', 0)) if value_elem is not None else 0.0

        # Get dimensions from ObsKey
        obs_dims = {}
        dim_ids_in_obs = []
        for val in obs.xpath('gen:ObsKey/gen:Value', namespaces=ns):
            dim_id = val.get('id')
            cat_id = val.get('value')
            obs_dims[dim_id] = cat_id
            dim_ids_in_obs.append(dim_id)

        # Debug print for each observation
    log(f"Obs value: {value}, dims: {obs_dims}")
    log(f"Dimension IDs in this observation: {dim_ids_in_obs}")

    # Each observation can have multiple dimensions
    for dim_id, cat_id in obs_dims.items():
        if dim_id in dim_objs and cat_id in cat_objs:
            observation = Observation(
                value=value,
                dimension_id=dim_objs[dim_id],
                category_id=cat_objs[cat_id]
            )
            session.add(observation)

    session.commit()
    session.close()
    log_file.close()

    session.commit()
    session.close()

# --- Main workflow ---
def main():
    dims, cats = fetch_metadata()
    datatable, dim_objs, cat_objs = store_metadata(dims, cats)
    obs_json = fetch_observations()
    store_observations(obs_json, dim_objs, cat_objs)
    pass

if __name__ == "__main__":
    main()
