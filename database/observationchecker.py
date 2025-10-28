import json
import os
from sql_alchemy import (
    SessionLocal,
    Observation,
    ObservationDimensionValue,
    Dimension,
    Category,
    DataTable,
)

def export_observations_by_datatable(output_dir: str = "datatable_exports") -> dict:
    """
    Export all observations organized by datatable, creating one JSON file per datatable.
    Also creates a metadata file listing all available datatables.
    
    Args:
        output_dir: Directory where JSON files will be saved
    
    Returns:
        Dictionary containing export statistics
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    with SessionLocal() as session:
        # Get all datatables
        datatables = session.query(DataTable).all()
        
        if not datatables:
            print("No datatables found in the database!")
            return None
        
        print(f"Found {len(datatables)} datatables to process...")
        
        export_stats = {
            "total_datatables": len(datatables),
            "datatables_processed": [],
            "total_observations_exported": 0
        }
        
        # Create metadata file for all datatables
        datatables_metadata = []
        
        # Process each datatable
        for dt_idx, datatable in enumerate(datatables, 1):
            print(f"\nProcessing datatable {dt_idx}/{len(datatables)}: {datatable.name}")
            
            # Get all observations for this datatable
            observations = (
                session.query(Observation)
                .filter(Observation.data_table_id == datatable.id)
                .all()
            )
            
            if not observations:
                print(f"  No observations found for datatable: {datatable.name}")
                continue
            
            print(f"  Found {len(observations)} observations")
            
            # Build the data structure for this datatable
            datatable_export = {
                "datatable": {
                    "name": datatable.name,
                    "code": datatable.code,
                    "description": datatable.description if hasattr(datatable, 'description') else None
                },
                "total_observations": len(observations),
                "observations": []
            }
            
            # Process each observation in this datatable
            for obs_idx, obs in enumerate(observations, 1):
                if obs_idx % 1000 == 0:
                    print(f"    Processed {obs_idx}/{len(observations)} observations...")
                
                observation_entry = {
                    "observation_id": obs.id,
                    "value": obs.value,
                    "time_period": obs.time_period,
                    "dimensions": []
                }
                
                # Get all dimension values for this observation
                dim_values = (
                    session.query(ObservationDimensionValue)
                    .filter(ObservationDimensionValue.observation_id == obs.id)
                    .order_by(ObservationDimensionValue.dimension_id)
                    .all()
                )
                
                # Add dimension values
                for dv in dim_values:
                    dimension_entry = {
                        "dimension": {
                            "label": dv.dimension.label,
                            "code": dv.dimension.code
                        },
                        "category": {
                            "label": dv.category.label,
                            "code": dv.category.code
                        }
                    }
                    
                    # Add parent if exists
                    if dv.category.parent:
                        dimension_entry["category"]["parent"] = {
                            "label": dv.category.parent.label,
                            "code": dv.category.parent.code
                        }
                    
                    observation_entry["dimensions"].append(dimension_entry)
                
                # Build interpretation details
                interpretation_parts = []
                for dv in sorted(dim_values, key=lambda x: x.dimension.position):
                    interpretation_parts.append({
                        "dimension": dv.dimension.label,
                        "value": dv.category.label
                    })
                
                observation_entry["interpretation"] = {
                    "summary": f"Value of {obs.value} for the specified dimensions in {obs.time_period}",
                    "details": interpretation_parts
                }
                
                datatable_export["observations"].append(observation_entry)
            
            # Generate filename from datatable code (sanitize for filesystem)
            safe_code = datatable.code.replace('@', '_').replace('/', '_').replace('\\', '_')
            output_file = os.path.join(output_dir, f"datatable_{safe_code}.json")
            
            # Save this datatable's observations to JSON
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(datatable_export, f, indent=2, ensure_ascii=False)
            
            print(f"  Exported to: {output_file}")
            
            # Update statistics
            export_stats["datatables_processed"].append({
                "name": datatable.name,
                "code": datatable.code,
                "file": output_file,
                "observation_count": len(observations)
            })
            export_stats["total_observations_exported"] += len(observations)
            
            # Add to metadata
            datatables_metadata.append({
                "name": datatable.name,
                "code": datatable.code,
                "description": datatable.description if hasattr(datatable, 'description') else None,
                "observation_count": len(observations),
                "file": f"datatable_{safe_code}.json"
            })
        
        # Save metadata file
        metadata_file = os.path.join(output_dir, "datatables_metadata.json")
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump({
                "total_datatables": len(datatables_metadata),
                "total_observations": export_stats["total_observations_exported"],
                "datatables": datatables_metadata
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n{'='*60}")
        print(f"EXPORT COMPLETE")
        print(f"{'='*60}")
        print(f"Total datatables exported: {len(export_stats['datatables_processed'])}")
        print(f"Total observations exported: {export_stats['total_observations_exported']}")
        print(f"Output directory: {output_dir}")
        print(f"Metadata file: {metadata_file}")
        print(f"{'='*60}\n")
        
        return export_stats

def explain_observation_to_json(obs_id: int, output_file: str = None) -> dict:
    """
    Extract the complete mapping for a specific observation and save it to JSON.
    This function is useful for inspecting individual observations.
    
    Args:
        obs_id: The observation ID to extract
        output_file: Optional path to save JSON file. If None, uses 'observation_{obs_id}.json'
    
    Returns:
        Dictionary containing the observation data
    """
    if output_file is None:
        output_file = f"observation_{obs_id}.json"
    
    with SessionLocal() as session:
        # Get the observation
        obs = session.query(Observation).filter(Observation.id == obs_id).first()
        
        if not obs:
            print(f"Observation {obs_id} not found!")
            return None
        
        # Build the data structure
        observation_data = {
            "observation_id": obs_id,
            "value": obs.value,
            "time_period": obs.time_period,
            "dataset": {
                "name": obs.data_table.name,
                "code": obs.data_table.code
            },
            "dimensions": [],
            "interpretation": {}
        }
        
        # Get all dimension values for this observation
        dim_values = (
            session.query(ObservationDimensionValue)
            .filter(ObservationDimensionValue.observation_id == obs_id)
            .order_by(ObservationDimensionValue.dimension_id)
            .all()
        )
        
        # Add dimension values
        for dv in dim_values:
            dimension_entry = {
                "dimension": {
                    "label": dv.dimension.label,
                    "code": dv.dimension.code
                },
                "category": {
                    "label": dv.category.label,
                    "code": dv.category.code
                }
            }
            
            # Add parent if exists
            if dv.category.parent:
                dimension_entry["category"]["parent"] = {
                    "label": dv.category.parent.label,
                    "code": dv.category.parent.code
                }
            
            observation_data["dimensions"].append(dimension_entry)
        
        # Build interpretation
        interpretation_parts = []
        for dv in sorted(dim_values, key=lambda x: x.dimension.position):
            interpretation_parts.append({
                "dimension": dv.dimension.label,
                "value": dv.category.label
            })
        
        observation_data["interpretation"] = {
            "summary": f"Value of {obs.value} for the specified dimensions in {obs.time_period}",
            "details": interpretation_parts
        }
        
        # Save to JSON file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(observation_data, f, indent=2, ensure_ascii=False)
        
        print(f"Observation data saved to {output_file}")
        
        return observation_data

def fetch_all_datatables() -> str:
    """Fetch and return all datatables with their name and description as a single string."""
    with SessionLocal() as session:
        datatables = session.query(DataTable).all()

        if not datatables:
            return "No datatables found!\n"

        lines = []
        lines.append("=" * 60)
        lines.append("DATATABLES")
        lines.append("=" * 60)

        for dt in datatables:
            lines.append(f"Name: {dt.name}")
            lines.append(f"Description: {dt.description}")
            lines.append("-" * 60)

        return "\n".join(lines) + "\n"


def get_datatable_id_by_name(name: str) -> int:
    """Fetch and return the ID of a datatable based on its name."""
    with SessionLocal() as session:
        datatable = session.query(DataTable).filter(DataTable.name == name).first()

        if not datatable:
            raise ValueError(f"No datatable found with the name: {name}")

        return datatable.id


def get_dimensions_by_datatable_id(datatable_id: int) -> str:
    """Fetch and return all dimensions linked to a datatable as a JSON string."""
    with SessionLocal() as session:
        dimensions = (
            session.query(Dimension)
            .filter(Dimension.data_table_id == datatable_id)
            .all()
        )

        if not dimensions:
            return json.dumps({"error": "No dimensions found for the given datatable ID."})

        result = []
        for dimension in dimensions:
            result.append(
                {
                    "id": dimension.id,
                    "name": dimension.name,
                    "label": dimension.label,
                    "code": dimension.code,
                }
            )

        return json.dumps(result, indent=4)


def get_dimension_ids_by_names(names: list[str]) -> list[int]:
    """Fetch and return the IDs of dimensions based on their names."""
    with SessionLocal() as session:
        dimensions = (
            session.query(Dimension)
            .filter(Dimension.name.in_(names))
            .all()
        )

        if not dimensions:
            return []

        return [dimension.id for dimension in dimensions]


def get_observation_values(datatable_id: int, dimension_ids: list[int]) -> list[float]:
    """Fetch and return all observation values for a given datatable ID and list of dimension IDs."""
    with SessionLocal() as session:
        observations = (
            session.query(Observation)
            .join(ObservationDimensionValue, Observation.id == ObservationDimensionValue.observation_id)
            .filter(
                Observation.data_table_id == datatable_id,
                ObservationDimensionValue.dimension_id.in_(dimension_ids)
            )
            .all()
        )

        if not observations:
            return []

        return [obs.value for obs in observations]





def get_observation_ids_by_dimension(datatable_id: int, dimension_id: int) -> list[int]:
    """Fetch and return all observation IDs linked to a given dimension ID and datatable ID."""
    with SessionLocal() as session:
        observation_ids = (
            session.query(ObservationDimensionValue.observation_id)
            .join(Observation, Observation.id == ObservationDimensionValue.observation_id)
            .filter(
                Observation.data_table_id == datatable_id,
                ObservationDimensionValue.dimension_id == dimension_id
            )
            .all()
        )

        return [obs_id[0] for obs_id in observation_ids]


def get_values_by_observation_ids(observation_ids: list[int]) -> list[float]:
    """Fetch and return all values for the given observation IDs."""
    with SessionLocal() as session:
        observations = (
            session.query(Observation.value)
            .filter(Observation.id.in_(observation_ids))
            .all()
        )

        return [obs[0] for obs in observations]


def get_categories_by_datatable_id(datatable_id: int) -> list[dict]:
    """Fetch and return all categories linked to a datatable by its ID, excluding those with label 'not applicable'."""
    with SessionLocal() as session:
        categories = (
            session.query(Category)
            .join(Dimension, Category.dimension_id == Dimension.id)
            .filter(Dimension.data_table_id == datatable_id)
            .all()
        )

        result = []
        for category in categories:
            if category.label.lower() != "not applicable":
                result.append({
                    "id": category.id,
                    "name": category.name,
                    "label": category.label,
                    "code": category.code
                })

        return result

if __name__ == "__main__":
    # Export all observations organized by datatable
    export_observations_by_datatable()
    
    # Optional: inspect a single observation if needed
    # explain_observation_to_json(2531)