import uvicorn
import os, json
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from pydantic_classes import *
from sql_alchemy import *

############################################
#
#   Initialize the database
#
############################################

def init_db():
    SQLALCHEMY_DATABASE_URL = "sqlite:///./Class_Diagram.db"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal

app = FastAPI()

# Enable CORS for all origins (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or restrict to ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database session
SessionLocal = init_db()
# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

############################################
#
#   ObservationDimensionValue functions
#
############################################
 
 
 
 
 
 

@app.get("/observationdimensionvalue/", response_model=None)
def get_all_observationdimensionvalue(database: Session = Depends(get_db)) -> list[ObservationDimensionValue]:
    observationdimensionvalue_list = database.query(ObservationDimensionValue).all()
    return observationdimensionvalue_list


@app.get("/observationdimensionvalue/{observationdimensionvalue_id}/", response_model=None)
async def get_observationdimensionvalue(observationdimensionvalue_id: int, database: Session = Depends(get_db)) -> ObservationDimensionValue:
    db_observationdimensionvalue = database.query(ObservationDimensionValue).filter(ObservationDimensionValue.id == observationdimensionvalue_id).first()
    if db_observationdimensionvalue is None:
        raise HTTPException(status_code=404, detail="ObservationDimensionValue not found")

    response_data = {
        "observationdimensionvalue": db_observationdimensionvalue,
}
    return response_data



@app.post("/observationdimensionvalue/", response_model=None)
async def create_observationdimensionvalue(observationdimensionvalue_data: ObservationDimensionValueCreate, database: Session = Depends(get_db)) -> ObservationDimensionValue:

    if observationdimensionvalue_data.observation_1 is not None:
        db_observation_1 = database.query(Observation).filter(Observation.id == observationdimensionvalue_data.observation_1).first()
        if not db_observation_1:
            raise HTTPException(status_code=400, detail="Observation not found")
    else:
        raise HTTPException(status_code=400, detail="Observation ID is required")
    if observationdimensionvalue_data.dimension_2 is not None:
        db_dimension_2 = database.query(Dimension).filter(Dimension.id == observationdimensionvalue_data.dimension_2).first()
        if not db_dimension_2:
            raise HTTPException(status_code=400, detail="Dimension not found")
    else:
        raise HTTPException(status_code=400, detail="Dimension ID is required")
    if observationdimensionvalue_data.category_2 is not None:
        db_category_2 = database.query(Category).filter(Category.id == observationdimensionvalue_data.category_2).first()
        if not db_category_2:
            raise HTTPException(status_code=400, detail="Category not found")
    else:
        raise HTTPException(status_code=400, detail="Category ID is required")

    db_observationdimensionvalue = ObservationDimensionValue(
        id=observationdimensionvalue_data.id,         dimension_id=observationdimensionvalue_data.dimension_id,         observation_id=observationdimensionvalue_data.observation_id,         category_id=observationdimensionvalue_data.category_id, observation_1=db_observation_1, dimension_2=db_dimension_2, category_2=db_category_2        )

    database.add(db_observationdimensionvalue)
    database.commit()
    database.refresh(db_observationdimensionvalue)


    
    return db_observationdimensionvalue


@app.put("/observationdimensionvalue/{observationdimensionvalue_id}/", response_model=None)
async def update_observationdimensionvalue(observationdimensionvalue_id: int, observationdimensionvalue_data: ObservationDimensionValueCreate, database: Session = Depends(get_db)) -> ObservationDimensionValue:
    db_observationdimensionvalue = database.query(ObservationDimensionValue).filter(ObservationDimensionValue.id == observationdimensionvalue_id).first()
    if db_observationdimensionvalue is None:
        raise HTTPException(status_code=404, detail="ObservationDimensionValue not found")

    setattr(db_observationdimensionvalue, 'id', observationdimensionvalue_data.id)
    setattr(db_observationdimensionvalue, 'dimension_id', observationdimensionvalue_data.dimension_id)
    setattr(db_observationdimensionvalue, 'observation_id', observationdimensionvalue_data.observation_id)
    setattr(db_observationdimensionvalue, 'category_id', observationdimensionvalue_data.category_id)
    database.commit()
    database.refresh(db_observationdimensionvalue)
    return db_observationdimensionvalue


@app.delete("/observationdimensionvalue/{observationdimensionvalue_id}/", response_model=None)
async def delete_observationdimensionvalue(observationdimensionvalue_id: int, database: Session = Depends(get_db)):
    db_observationdimensionvalue = database.query(ObservationDimensionValue).filter(ObservationDimensionValue.id == observationdimensionvalue_id).first()
    if db_observationdimensionvalue is None:
        raise HTTPException(status_code=404, detail="ObservationDimensionValue not found")
    database.delete(db_observationdimensionvalue)
    database.commit()
    return db_observationdimensionvalue



############################################
#
#   Observation functions
#
############################################
 
 
 
 

@app.get("/observation/", response_model=None)
def get_all_observation(database: Session = Depends(get_db)) -> list[Observation]:
    observation_list = database.query(Observation).all()
    return observation_list


@app.get("/observation/{observation_id}/", response_model=None)
async def get_observation(observation_id: int, database: Session = Depends(get_db)) -> Observation:
    db_observation = database.query(Observation).filter(Observation.id == observation_id).first()
    if db_observation is None:
        raise HTTPException(status_code=404, detail="Observation not found")

    response_data = {
        "observation": db_observation,
}
    return response_data



@app.post("/observation/", response_model=None)
async def create_observation(observation_data: ObservationCreate, database: Session = Depends(get_db)) -> Observation:

    if observation_data.datatable_2 is not None:
        db_datatable_2 = database.query(DataTable).filter(DataTable.id == observation_data.datatable_2).first()
        if not db_datatable_2:
            raise HTTPException(status_code=400, detail="DataTable not found")
    else:
        raise HTTPException(status_code=400, detail="DataTable ID is required")

    db_observation = Observation(
        updated_at=observation_data.updated_at,         value=observation_data.value,         data_table_id=observation_data.data_table_id,         id=observation_data.id,         time_period=observation_data.time_period, datatable_2=db_datatable_2        )

    database.add(db_observation)
    database.commit()
    database.refresh(db_observation)


    
    return db_observation


@app.put("/observation/{observation_id}/", response_model=None)
async def update_observation(observation_id: int, observation_data: ObservationCreate, database: Session = Depends(get_db)) -> Observation:
    db_observation = database.query(Observation).filter(Observation.id == observation_id).first()
    if db_observation is None:
        raise HTTPException(status_code=404, detail="Observation not found")

    setattr(db_observation, 'updated_at', observation_data.updated_at)
    setattr(db_observation, 'value', observation_data.value)
    setattr(db_observation, 'data_table_id', observation_data.data_table_id)
    setattr(db_observation, 'id', observation_data.id)
    setattr(db_observation, 'time_period', observation_data.time_period)
    database.commit()
    database.refresh(db_observation)
    return db_observation


@app.delete("/observation/{observation_id}/", response_model=None)
async def delete_observation(observation_id: int, database: Session = Depends(get_db)):
    db_observation = database.query(Observation).filter(Observation.id == observation_id).first()
    if db_observation is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    database.delete(db_observation)
    database.commit()
    return db_observation



############################################
#
#   Category functions
#
############################################
 
 
 
 
 
 

@app.get("/category/", response_model=None)
def get_all_category(database: Session = Depends(get_db)) -> list[Category]:
    category_list = database.query(Category).all()
    return category_list


@app.get("/category/{category_id}/", response_model=None)
async def get_category(category_id: int, database: Session = Depends(get_db)) -> Category:
    db_category = database.query(Category).filter(Category.id == category_id).first()
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    response_data = {
        "category": db_category,
}
    return response_data



@app.post("/category/", response_model=None)
async def create_category(category_data: CategoryCreate, database: Session = Depends(get_db)) -> Category:

    if category_data.datatable_1 is not None:
        db_datatable_1 = database.query(DataTable).filter(DataTable.id == category_data.datatable_1).first()
        if not db_datatable_1:
            raise HTTPException(status_code=400, detail="DataTable not found")
    else:
        raise HTTPException(status_code=400, detail="DataTable ID is required")
    if category_data.dimension_1 is not None:
        db_dimension_1 = database.query(Dimension).filter(Dimension.id == category_data.dimension_1).first()
        if not db_dimension_1:
            raise HTTPException(status_code=400, detail="Dimension not found")
    else:
        raise HTTPException(status_code=400, detail="Dimension ID is required")

    db_category = Category(
        id=category_data.id,         name=category_data.name,         data_table_id=category_data.data_table_id,         code=category_data.code,         dimension_id=category_data.dimension_id,         label=category_data.label,         parent_id=category_data.parent_id, datatable_1=db_datatable_1, dimension_1=db_dimension_1        )

    database.add(db_category)
    database.commit()
    database.refresh(db_category)


    
    return db_category


@app.put("/category/{category_id}/", response_model=None)
async def update_category(category_id: int, category_data: CategoryCreate, database: Session = Depends(get_db)) -> Category:
    db_category = database.query(Category).filter(Category.id == category_id).first()
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    setattr(db_category, 'id', category_data.id)
    setattr(db_category, 'name', category_data.name)
    setattr(db_category, 'data_table_id', category_data.data_table_id)
    setattr(db_category, 'code', category_data.code)
    setattr(db_category, 'dimension_id', category_data.dimension_id)
    setattr(db_category, 'label', category_data.label)
    setattr(db_category, 'parent_id', category_data.parent_id)
    database.commit()
    database.refresh(db_category)
    return db_category


@app.delete("/category/{category_id}/", response_model=None)
async def delete_category(category_id: int, database: Session = Depends(get_db)):
    db_category = database.query(Category).filter(Category.id == category_id).first()
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    database.delete(db_category)
    database.commit()
    return db_category



############################################
#
#   Dimension functions
#
############################################
 
 
 
 
 
 

@app.get("/dimension/", response_model=None)
def get_all_dimension(database: Session = Depends(get_db)) -> list[Dimension]:
    dimension_list = database.query(Dimension).all()
    return dimension_list


@app.get("/dimension/{dimension_id}/", response_model=None)
async def get_dimension(dimension_id: int, database: Session = Depends(get_db)) -> Dimension:
    db_dimension = database.query(Dimension).filter(Dimension.id == dimension_id).first()
    if db_dimension is None:
        raise HTTPException(status_code=404, detail="Dimension not found")

    response_data = {
        "dimension": db_dimension,
}
    return response_data



@app.post("/dimension/", response_model=None)
async def create_dimension(dimension_data: DimensionCreate, database: Session = Depends(get_db)) -> Dimension:

    if dimension_data.datatable is not None:
        db_datatable = database.query(DataTable).filter(DataTable.id == dimension_data.datatable).first()
        if not db_datatable:
            raise HTTPException(status_code=400, detail="DataTable not found")
    else:
        raise HTTPException(status_code=400, detail="DataTable ID is required")

    db_dimension = Dimension(
        id=dimension_data.id,         label=dimension_data.label,         name=dimension_data.name,         codelist_id=dimension_data.codelist_id,         position=dimension_data.position,         data_table_id=dimension_data.data_table_id,         code=dimension_data.code, datatable=db_datatable        )

    database.add(db_dimension)
    database.commit()
    database.refresh(db_dimension)


    
    return db_dimension


@app.put("/dimension/{dimension_id}/", response_model=None)
async def update_dimension(dimension_id: int, dimension_data: DimensionCreate, database: Session = Depends(get_db)) -> Dimension:
    db_dimension = database.query(Dimension).filter(Dimension.id == dimension_id).first()
    if db_dimension is None:
        raise HTTPException(status_code=404, detail="Dimension not found")

    setattr(db_dimension, 'id', dimension_data.id)
    setattr(db_dimension, 'label', dimension_data.label)
    setattr(db_dimension, 'name', dimension_data.name)
    setattr(db_dimension, 'codelist_id', dimension_data.codelist_id)
    setattr(db_dimension, 'position', dimension_data.position)
    setattr(db_dimension, 'data_table_id', dimension_data.data_table_id)
    setattr(db_dimension, 'code', dimension_data.code)
    database.commit()
    database.refresh(db_dimension)
    return db_dimension


@app.delete("/dimension/{dimension_id}/", response_model=None)
async def delete_dimension(dimension_id: int, database: Session = Depends(get_db)):
    db_dimension = database.query(Dimension).filter(Dimension.id == dimension_id).first()
    if db_dimension is None:
        raise HTTPException(status_code=404, detail="Dimension not found")
    database.delete(db_dimension)
    database.commit()
    return db_dimension



############################################
#
#   DataTable functions
#
############################################
 
 
 
 
 
 

@app.get("/datatable/", response_model=None)
def get_all_datatable(database: Session = Depends(get_db)) -> list[DataTable]:
    datatable_list = database.query(DataTable).all()
    return datatable_list


@app.get("/datatable/{datatable_id}/", response_model=None)
async def get_datatable(datatable_id: int, database: Session = Depends(get_db)) -> DataTable:
    db_datatable = database.query(DataTable).filter(DataTable.id == datatable_id).first()
    if db_datatable is None:
        raise HTTPException(status_code=404, detail="DataTable not found")

    response_data = {
        "datatable": db_datatable,
}
    return response_data



@app.post("/datatable/", response_model=None)
async def create_datatable(datatable_data: DataTableCreate, database: Session = Depends(get_db)) -> DataTable:


    db_datatable = DataTable(
        description=datatable_data.description,         id=datatable_data.id,         name=datatable_data.name,         created_at=datatable_data.created_at,         code=datatable_data.code,         provider=datatable_data.provider,         updated_at=datatable_data.updated_at        )

    database.add(db_datatable)
    database.commit()
    database.refresh(db_datatable)


    
    return db_datatable


@app.put("/datatable/{datatable_id}/", response_model=None)
async def update_datatable(datatable_id: int, datatable_data: DataTableCreate, database: Session = Depends(get_db)) -> DataTable:
    db_datatable = database.query(DataTable).filter(DataTable.id == datatable_id).first()
    if db_datatable is None:
        raise HTTPException(status_code=404, detail="DataTable not found")

    setattr(db_datatable, 'description', datatable_data.description)
    setattr(db_datatable, 'id', datatable_data.id)
    setattr(db_datatable, 'name', datatable_data.name)
    setattr(db_datatable, 'created_at', datatable_data.created_at)
    setattr(db_datatable, 'code', datatable_data.code)
    setattr(db_datatable, 'provider', datatable_data.provider)
    setattr(db_datatable, 'updated_at', datatable_data.updated_at)
    database.commit()
    database.refresh(db_datatable)
    return db_datatable


@app.delete("/datatable/{datatable_id}/", response_model=None)
async def delete_datatable(datatable_id: int, database: Session = Depends(get_db)):
    db_datatable = database.query(DataTable).filter(DataTable.id == datatable_id).first()
    if db_datatable is None:
        raise HTTPException(status_code=404, detail="DataTable not found")
    database.delete(db_datatable)
    database.commit()
    return db_datatable





############################################
# Maintaining the server
############################################
if __name__ == "__main__":
    import uvicorn
    openapi_schema = app.openapi()
    output_dir = os.path.join(os.getcwd(), 'output_backend')
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, 'openapi_specs.json')
    print(f"Writing OpenAPI schema to {output_file}")
    print("Swagger UI available at 0.0.0.0:8000/docs")
    with open(output_file, 'w') as file:
        json.dump(openapi_schema, file)
    uvicorn.run(app, host="0.0.0.0", port= 8000)



