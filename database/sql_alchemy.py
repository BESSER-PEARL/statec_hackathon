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
class Observation(Base):
    __tablename__ = "observation"
    id: Mapped[int] = mapped_column(primary_key=True)
    value: Mapped[float] = mapped_column(Float)
    dimension_id: Mapped[int] = mapped_column(ForeignKey("dimension.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id"), nullable=False)

class Category(Base):
    __tablename__ = "category"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(100))
    label: Mapped[str] = mapped_column(String(100))
    data_table_id: Mapped[int] = mapped_column(ForeignKey("datatable.id"), nullable=False)
    parent_id: Mapped[int] = mapped_column(ForeignKey("category.id"))

class Dimension(Base):
    __tablename__ = "dimension"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(100))
    label: Mapped[str] = mapped_column(String(100))

class DataTable(Base):
    __tablename__ = "datatable"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(100))
    provider: Mapped[str] = mapped_column(String(100))


#--- Relationships of the observation table
Observation.dimension: Mapped["Dimension"] = relationship("Dimension", back_populates="obs", foreign_keys=[Observation.dimension_id])
Observation.category: Mapped["Category"] = relationship("Category", back_populates="data", foreign_keys=[Observation.category_id])

#--- Relationships of the category table
Category.data_table: Mapped["DataTable"] = relationship("DataTable", back_populates="category", foreign_keys=[Category.data_table_id])
Category.data: Mapped[List["Observation"]] = relationship("Observation", back_populates="category", foreign_keys=[Observation.category_id])
Category.sub: Mapped[List["Category"]] = relationship("Category", back_populates="parent", foreign_keys=[Category.parent_id])
Category.parent: Mapped["Category"] = relationship("Category", back_populates="sub", foreign_keys=[Category.parent_id])

#--- Relationships of the dimension table
Dimension.obs: Mapped[List["Observation"]] = relationship("Observation", back_populates="dimension", foreign_keys=[Observation.dimension_id])

#--- Relationships of the datatable table
DataTable.category: Mapped[List["Category"]] = relationship("Category", back_populates="data_table", foreign_keys=[Category.data_table_id])

# Database connection
DATABASE_URL = "sqlite:///Class_Diagram.db"  # SQLite connection
engine = create_engine(DATABASE_URL, echo=True)

# Create tables in the database
Base.metadata.create_all(engine, checkfirst=True)