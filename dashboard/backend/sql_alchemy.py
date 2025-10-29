from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import List, Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


class Base(DeclarativeBase):
    """Base declarative class shared by all ORM models."""


class DataTable(Base):
    __tablename__ = "datatable"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(120), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[Optional[str]] = mapped_column(String(512))
    provider: Mapped[Optional[str]] = mapped_column(String(150))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    dimensions: Mapped[List["Dimension"]] = relationship(
        back_populates="data_table", cascade="all, delete-orphan"
    )
    categories: Mapped[List["Category"]] = relationship(
        back_populates="data_table", cascade="all, delete-orphan"
    )
    observations: Mapped[List["Observation"]] = relationship(
        back_populates="data_table", cascade="all, delete-orphan"
    )


class Dimension(Base):
    __tablename__ = "dimension"
    __table_args__ = (
        UniqueConstraint("data_table_id", "code", name="uq_dimension_datatable_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    label: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer)
    codelist_id: Mapped[Optional[str]] = mapped_column(String(150))
    data_table_id: Mapped[int] = mapped_column(ForeignKey("datatable.id"), nullable=False)

    data_table: Mapped["DataTable"] = relationship(back_populates="dimensions")
    categories: Mapped[List["Category"]] = relationship(
        back_populates="dimension", cascade="all, delete-orphan"
    )
    observation_values: Mapped[List["ObservationDimensionValue"]] = relationship(
        back_populates="dimension", cascade="all, delete-orphan"
    )


class Category(Base):
    __tablename__ = "category"
    __table_args__ = (
        UniqueConstraint("dimension_id", "code", name="uq_category_dimension_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    label: Mapped[Optional[str]] = mapped_column(String(512))
    data_table_id: Mapped[int] = mapped_column(ForeignKey("datatable.id"), nullable=False)
    dimension_id: Mapped[int] = mapped_column(ForeignKey("dimension.id"), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("category.id"))

    data_table: Mapped["DataTable"] = relationship(back_populates="categories")
    dimension: Mapped["Dimension"] = relationship(back_populates="categories")
    parent: Mapped[Optional["Category"]] = relationship(
        back_populates="children",
        remote_side=[id],
    )
    children: Mapped[List["Category"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    observation_values: Mapped[List["ObservationDimensionValue"]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )


class Observation(Base):
    __tablename__ = "observation"

    id: Mapped[int] = mapped_column(primary_key=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    time_period: Mapped[Optional[str]] = mapped_column(String(32))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    data_table_id: Mapped[int] = mapped_column(ForeignKey("datatable.id"), nullable=False)

    data_table: Mapped["DataTable"] = relationship(back_populates="observations")
    dimension_values: Mapped[List["ObservationDimensionValue"]] = relationship(
        back_populates="observation", cascade="all, delete-orphan"
    )


class ObservationDimensionValue(Base):
    __tablename__ = "observation_dimension_value"
    __table_args__ = (
        UniqueConstraint("observation_id", "dimension_id", name="uq_obs_dim"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    observation_id: Mapped[int] = mapped_column(
        ForeignKey("observation.id", ondelete="CASCADE"), nullable=False
    )
    dimension_id: Mapped[int] = mapped_column(ForeignKey("dimension.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id"), nullable=False)

    observation: Mapped["Observation"] = relationship(back_populates="dimension_values")
    dimension: Mapped["Dimension"] = relationship(back_populates="observation_values")
    category: Mapped["Category"] = relationship(back_populates="observation_values")


DATABASE_PATH = Path(__file__).resolve().parent / "Class_Diagram.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_db() -> None:
    """Ensure all tables exist."""
    Base.metadata.create_all(engine, checkfirst=True)


init_db()
