"""
Script to remove duplicate dimensions and categories from the database.
This consolidates observations to use the first occurrence of each dimension/category.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, List

from sqlalchemy import func

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


def remove_duplicate_categories() -> None:
    """Remove duplicate categories and update observations to use the first occurrence."""
    LOGGER.info("Scanning for duplicate categories...")
    
    with SessionLocal() as session:
        # Find all datatables
        datatables = session.query(DataTable).all()
        
        for datatable in datatables:
            LOGGER.info("Processing datatable: %s (ID: %d)", datatable.code, datatable.id)
            
            # Get all dimensions for this datatable
            dimensions = session.query(Dimension).filter(
                Dimension.data_table_id == datatable.id
            ).all()
            
            for dimension in dimensions:
                # Find duplicate categories (same code within same dimension)
                categories = session.query(Category).filter(
                    Category.dimension_id == dimension.id
                ).order_by(Category.id).all()
                
                # Group categories by code
                categories_by_code: Dict[str, List[Category]] = defaultdict(list)
                for category in categories:
                    categories_by_code[category.code].append(category)
                
                # Process duplicates
                for code, cat_list in categories_by_code.items():
                    if len(cat_list) > 1:
                        # Keep the first one, update references for others
                        primary_category = cat_list[0]
                        duplicates = cat_list[1:]
                        
                        LOGGER.info(
                            "Found %d duplicate categories for code '%s' in dimension '%s'",
                            len(duplicates),
                            code,
                            dimension.code
                        )
                        
                        for duplicate in duplicates:
                            # Update all observation dimension values to use primary category
                            obs_values = session.query(ObservationDimensionValue).filter(
                                ObservationDimensionValue.category_id == duplicate.id
                            ).all()
                            
                            for obs_value in obs_values:
                                obs_value.category_id = primary_category.id
                            
                            LOGGER.info(
                                "Redirected %d observation values from category ID %d to %d",
                                len(obs_values),
                                duplicate.id,
                                primary_category.id
                            )
                            
                            # Delete the duplicate category
                            session.delete(duplicate)
                        
                        session.flush()
        
        session.commit()
        LOGGER.info("Category deduplication complete")


def remove_duplicate_dimensions() -> None:
    """Remove duplicate dimensions and update observations to use the first occurrence."""
    LOGGER.info("Scanning for duplicate dimensions...")
    
    with SessionLocal() as session:
        # Find all datatables
        datatables = session.query(DataTable).all()
        
        for datatable in datatables:
            LOGGER.info("Processing datatable: %s (ID: %d)", datatable.code, datatable.id)
            
            # Get all dimensions for this datatable
            dimensions = session.query(Dimension).filter(
                Dimension.data_table_id == datatable.id
            ).order_by(Dimension.id).all()
            
            # Group dimensions by code
            dimensions_by_code: Dict[str, List[Dimension]] = defaultdict(list)
            for dimension in dimensions:
                dimensions_by_code[dimension.code].append(dimension)
            
            # Process duplicates
            for code, dim_list in dimensions_by_code.items():
                if len(dim_list) > 1:
                    # Keep the first one, merge categories from others
                    primary_dimension = dim_list[0]
                    duplicates = dim_list[1:]
                    
                    LOGGER.info(
                        "Found %d duplicate dimensions for code '%s'",
                        len(duplicates),
                        code
                    )
                    
                    for duplicate in duplicates:
                        # Get categories from duplicate dimension
                        duplicate_categories = session.query(Category).filter(
                            Category.dimension_id == duplicate.id
                        ).all()
                        
                        for dup_category in duplicate_categories:
                            # Check if primary dimension already has this category
                            existing_category = session.query(Category).filter(
                                Category.dimension_id == primary_dimension.id,
                                Category.code == dup_category.code
                            ).one_or_none()
                            
                            if existing_category:
                                # Update observation values to use existing category
                                obs_values = session.query(ObservationDimensionValue).filter(
                                    ObservationDimensionValue.category_id == dup_category.id
                                ).all()
                                
                                for obs_value in obs_values:
                                    obs_value.category_id = existing_category.id
                                
                                # Delete duplicate category
                                session.delete(dup_category)
                            else:
                                # Move category to primary dimension
                                dup_category.dimension_id = primary_dimension.id
                        
                        # Update observation dimension values to use primary dimension
                        obs_values = session.query(ObservationDimensionValue).filter(
                            ObservationDimensionValue.dimension_id == duplicate.id
                        ).all()
                        
                        for obs_value in obs_values:
                            obs_value.dimension_id = primary_dimension.id
                        
                        LOGGER.info(
                            "Redirected %d observation values from dimension ID %d to %d",
                            len(obs_values),
                            duplicate.id,
                            primary_dimension.id
                        )
                        
                        # Delete the duplicate dimension
                        session.delete(duplicate)
                    
                    session.flush()
        
        session.commit()
        LOGGER.info("Dimension deduplication complete")


def show_statistics() -> None:
    """Display database statistics."""
    with SessionLocal() as session:
        total_datatables = session.query(func.count(DataTable.id)).scalar()
        total_dimensions = session.query(func.count(Dimension.id)).scalar()
        total_categories = session.query(func.count(Category.id)).scalar()
        total_observations = session.query(func.count(Observation.id)).scalar()
        total_obs_values = session.query(func.count(ObservationDimensionValue.id)).scalar()
        
        LOGGER.info("=== Database Statistics ===")
        LOGGER.info("DataTables: %d", total_datatables)
        LOGGER.info("Dimensions: %d", total_dimensions)
        LOGGER.info("Categories: %d", total_categories)
        LOGGER.info("Observations: %d", total_observations)
        LOGGER.info("Observation-Dimension Values: %d", total_obs_values)
        LOGGER.info("===========================")


def main() -> None:
    """Main function to remove duplicates."""
    LOGGER.info("Starting duplicate removal process...")
    
    LOGGER.info("\nBefore cleanup:")
    show_statistics()
    
    # First remove duplicate categories (within same dimension)
    remove_duplicate_categories()
    
    # Then remove duplicate dimensions (within same datatable)
    remove_duplicate_dimensions()
    
    LOGGER.info("\nAfter cleanup:")
    show_statistics()
    
    LOGGER.info("\nDuplicate removal completed successfully!")


if __name__ == "__main__":
    main()
