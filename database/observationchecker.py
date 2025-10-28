from sql_alchemy import (
    SessionLocal,
    Observation,
    ObservationDimensionValue,
    Dimension,
    Category,
    DataTable,
)

def explain_observation(obs_id: int) -> None:
    """Show the complete mapping for a specific observation."""
    with SessionLocal() as session:
        # Get the observation
        obs = session.query(Observation).filter(Observation.id == obs_id).first()
        
        if not obs:
            print(f"Observation {obs_id} not found!")
            return
        
        print(f"\n{'='*60}")
        print(f"OBSERVATION ID: {obs_id}")
        print(f"{'='*60}")
        print(f"Value: {obs.value}")
        print(f"Time Period: {obs.time_period}")
        print(f"Dataset: {obs.data_table.name} (code: {obs.data_table.code})")
        print(f"\n{'='*60}")
        print("DIMENSION VALUES:")
        print(f"{'='*60}\n")
        
        # Get all dimension values for this observation
        dim_values = (
            session.query(ObservationDimensionValue)
            .filter(ObservationDimensionValue.observation_id == obs_id)
            .order_by(ObservationDimensionValue.dimension_id)
            .all()
        )
        
        for dv in dim_values:
            print(f"Dimension: {dv.dimension.label} ({dv.dimension.code})")
            print(f"  └─ Category: {dv.category.label}")
            print(f"     └─ Code: {dv.category.code}")
            
            # Show parent if exists
            if dv.category.parent:
                print(f"     └─ Parent: {dv.category.parent.label} ({dv.category.parent.code})")
            print()
        
        print(f"{'='*60}")
        print("INTERPRETATION:")
        print(f"{'='*60}")
        
        # Build a human-readable description
        parts = []
        for dv in sorted(dim_values, key=lambda x: x.dimension.position):
            parts.append(f"{dv.dimension.label}={dv.category.label}")
        
        print(f"\nThis observation represents:")
        print(f"Value of {obs.value} for:")
        for part in parts:
            print(f"  • {part}")
        if obs.time_period:
            print(f"  • Time Period: {obs.time_period}")
        print()

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

if __name__ == "__main__":
    explain_observation(2531)
    # Example usage of fetch_all_datatables
    fetch_all_datatables()