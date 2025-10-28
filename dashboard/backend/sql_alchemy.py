import enum
from typing import List, Optional
from sqlalchemy import (
    create_engine, Column, ForeignKey, Table, Text, Boolean, String, Date, 
    Time, DateTime, Float, Integer, Enum
)
from sqlalchemy.orm import (
    column_property, DeclarativeBase, Mapped, mapped_column, relationship
)
from datetime import datetime, time, date

class Base(DeclarativeBase):
    pass



# Tables definition for many-to-many relationships

# Tables definition
class ObservationDimensionValue(Base):
    __tablename__ = "observationdimensionvalue"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    observation_id: Mapped[int] = mapped_column(Integer)
    dimension_id: Mapped[int] = mapped_column(Integer)
    category_id: Mapped[int] = mapped_column(Integer)

class Observation(Base):
    __tablename__ = "observation"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    value: Mapped[float] = mapped_column(Float)
    time_period: Mapped[str] = mapped_column(String(100))
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    data_table_id: Mapped[int] = mapped_column(Integer)

class Category(Base):
    __tablename__ = "category"
    dimension_id: Mapped[int] = mapped_column(Integer)
    parent_id: Mapped[int] = mapped_column(Integer)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    label: Mapped[str] = mapped_column(String(100))
    data_table_id: Mapped[int] = mapped_column(Integer)

class Dimension(Base):
    __tablename__ = "dimension"
    name: Mapped[str] = mapped_column(String(100))
    label: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer)
    codelist_id: Mapped[str] = mapped_column(String(100))
    data_table_id: Mapped[int] = mapped_column(Integer)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100))

class DataTable(Base):
    __tablename__ = "datatable"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(100))
    provider: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)

#--- Foreign keys and relationships of the observationdimensionvalue table
ObservationDimensionValue.category_2_id: Mapped["Category"] = mapped_column(ForeignKey("category.id"), nullable=False)
ObservationDimensionValue.category_2: Mapped["Category"] = relationship("Category", back_populates="observationdimensionvalue_1")
ObservationDimensionValue.dimension_2_id: Mapped["Dimension"] = mapped_column(ForeignKey("dimension.id"), nullable=False)
ObservationDimensionValue.dimension_2: Mapped["Dimension"] = relationship("Dimension", back_populates="observationdimensionvalue")
ObservationDimensionValue.observation_1_id: Mapped["Observation"] = mapped_column(ForeignKey("observation.id"), nullable=False)
ObservationDimensionValue.observation_1: Mapped["Observation"] = relationship("Observation", back_populates="observationdimensionvalue_2")
#--- Foreign keys and relationships of the observation table
Observation.datatable_2_id: Mapped["DataTable"] = mapped_column(ForeignKey("datatable.id"), nullable=False)
Observation.datatable_2: Mapped["DataTable"] = relationship("DataTable", back_populates="observation")
Observation.observationdimensionvalue_2: Mapped[List["ObservationDimensionValue"]] = relationship("ObservationDimensionValue", back_populates="observation_1")
#--- Foreign keys and relationships of the category table
Category.datatable_1_id: Mapped["DataTable"] = mapped_column(ForeignKey("datatable.id"), nullable=False)
Category.datatable_1: Mapped["DataTable"] = relationship("DataTable", back_populates="category")
Category.dimension_1_id: Mapped["Dimension"] = mapped_column(ForeignKey("dimension.id"), nullable=False)
Category.dimension_1: Mapped["Dimension"] = relationship("Dimension", back_populates="category_1")
Category.observationdimensionvalue_1: Mapped[List["ObservationDimensionValue"]] = relationship("ObservationDimensionValue", back_populates="category_2")
#--- Foreign keys and relationships of the dimension table
Dimension.datatable_id: Mapped["DataTable"] = mapped_column(ForeignKey("datatable.id"), nullable=False)
Dimension.datatable: Mapped["DataTable"] = relationship("DataTable", back_populates="dimension")
Dimension.observationdimensionvalue: Mapped[List["ObservationDimensionValue"]] = relationship("ObservationDimensionValue", back_populates="dimension_2")
Dimension.category_1: Mapped[List["Category"]] = relationship("Category", back_populates="dimension_1")
#--- Foreign keys and relationships of the datatable table
DataTable.observation: Mapped[List["Observation"]] = relationship("Observation", back_populates="datatable_2")
DataTable.category: Mapped[List["Category"]] = relationship("Category", back_populates="datatable_1")
DataTable.dimension: Mapped[List["Dimension"]] = relationship("Dimension", back_populates="datatable")

# Database connection

DATABASE_URL = "sqlite:///Class_Diagram.db"  # SQLite connection

engine = create_engine(DATABASE_URL, echo=True)

# Create tables in the database
Base.metadata.create_all(engine, checkfirst=True)