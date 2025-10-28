from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class CategoryRead(BaseModel):
    code: str
    name: str
    label: Optional[str] = None
    parent_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DimensionSummary(BaseModel):
    code: str
    name: str
    label: str
    position: int
    codelist_id: Optional[str] = None
    category_count: int

    model_config = ConfigDict(from_attributes=True)


class DimensionDetail(DimensionSummary):
    categories: List[CategoryRead]


class DataTableSummary(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    provider: Optional[str] = None
    updated_at: Optional[datetime] = None
    dimension_count: int
    observation_count: int

    model_config = ConfigDict(from_attributes=True)


class DataTableDetail(DataTableSummary):
    dimensions: List[DimensionSummary]


class ObservationPoint(BaseModel):
    observation_id: int
    value: float
    time_period: Optional[str] = None
    dimensions: Dict[str, str]


class AggregateItem(BaseModel):
    category_code: str
    category_label: str
    value: float
    share: Optional[float] = None


class AggregateResponse(BaseModel):
    dataset_code: str
    dimension_code: str
    filters: Dict[str, str]
    results: List[AggregateItem]


class AgeingInsights(BaseModel):
    dataset_code: str
    time_period: str
    population_total: float
    children_population: float
    working_age_population: float
    seniors_population: float
    share_children: float
    share_seniors: float
    share_80_plus: float
    old_age_dependency_ratio: float
    age_buckets: List[AggregateItem]
    seniors_by_sex: List[AggregateItem]
    seniors_by_marital_status: List[AggregateItem]
    senior_age_codes: List[str]
