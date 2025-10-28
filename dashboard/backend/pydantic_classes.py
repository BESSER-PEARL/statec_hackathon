from datetime import datetime, date
from typing import List, Optional, Union, Set
from enum import Enum
from pydantic import BaseModel


############################################
# Enumerations are defined here
############################################

############################################
# Classes are defined here
############################################
class CategoryCreate(BaseModel):
    id: int
    name: str
    data_table_id: int
    code: str
    dimension_id: int
    label: str
    parent_id: int
    datatable_1: int  # N:1 Relationship
    dimension_1: int  # N:1 Relationship

class DataTableCreate(BaseModel):
    description: str
    id: int
    name: str
    created_at: datetime
    code: str
    provider: str
    updated_at: datetime

class ObservationDimensionValueCreate(BaseModel):
    id: int
    dimension_id: int
    observation_id: int
    category_id: int
    observation_1: int  # N:1 Relationship
    dimension_2: int  # N:1 Relationship
    category_2: int  # N:1 Relationship

class DimensionCreate(BaseModel):
    id: int
    label: str
    name: str
    codelist_id: str
    position: int
    data_table_id: int
    code: str
    datatable: int  # N:1 Relationship

class ObservationCreate(BaseModel):
    updated_at: datetime
    value: float
    data_table_id: int
    id: int
    time_period: str
    datatable_2: int  # N:1 Relationship

