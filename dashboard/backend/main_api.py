from __future__ import annotations

import re
from urllib.parse import unquote

from typing import Dict, List, Optional, Sequence, Tuple

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased, selectinload

try:  # pragma: no cover - allow execution as module or script
    from .sql_alchemy import (
        Base,
        Category,
        DataTable,
        Dimension,
        Observation,
        ObservationDimensionValue,
        SessionLocal,
    )
    from .pydantic_classes import (
        AggregateItem,
        AgeingInsights,
        AggregateResponse,
        CategoryRead,
        DataTableDetail,
        DataTableSummary,
        DimensionDetail,
        DimensionSummary,
        ObservationPoint,
    )
except ImportError:  # pragma: no cover
    from sql_alchemy import (
        Base,
        Category,
        DataTable,
        Dimension,
        Observation,
        ObservationDimensionValue,
        SessionLocal,
    )
    from pydantic_classes import (
        AggregateItem,
        AgeingInsights,
        AggregateResponse,
        CategoryRead,
        DataTableDetail,
        DataTableSummary,
        DimensionDetail,
        DimensionSummary,
        ObservationPoint,
    )


app = FastAPI(title="Statec Census API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db() -> Session:
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _get_datatable_by_code(db: Session, dataset_code: str) -> DataTable:
    # URL decode the dataset code in case it comes with %40 instead of @
    dataset_code = unquote(dataset_code)
    datatable = (
        db.query(DataTable)
        .filter(DataTable.code == dataset_code)
        .one_or_none()
    )
    if datatable is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_code}' not found.",
        )
    return datatable


def _counts_by_table(
    db: Session,
) -> Tuple[Dict[int, int], Dict[int, int]]:
    dimension_counts: Dict[int, int] = dict(
        db.query(Dimension.data_table_id, func.count(Dimension.id))
        .group_by(Dimension.data_table_id)
        .all()
    )
    observation_counts: Dict[int, int] = dict(
        db.query(Observation.data_table_id, func.count(Observation.id))
        .group_by(Observation.data_table_id)
        .all()
    )
    return dimension_counts, observation_counts


@app.get("/health", tags=["meta"])
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/datasets", response_model=List[DataTableSummary], tags=["datasets"])
def list_datasets(db: Session = Depends(get_db)) -> List[DataTableSummary]:
    tables = db.query(DataTable).order_by(DataTable.name).all()
    dimension_counts, observation_counts = _counts_by_table(db)
    summaries: List[DataTableSummary] = []
    for table in tables:
        summaries.append(
            DataTableSummary(
                code=table.code,
                name=table.name,
                description=table.description,
                provider=table.provider,
                updated_at=table.updated_at,
                dimension_count=dimension_counts.get(table.id, 0),
                observation_count=observation_counts.get(table.id, 0),
            )
        )
    return summaries


@app.get(
    "/datasets/{dataset_code}",
    response_model=DataTableDetail,
    tags=["datasets"],
)
def get_dataset(dataset_code: str, db: Session = Depends(get_db)) -> DataTableDetail:
    # URL decode the dataset code
    dataset_code = unquote(dataset_code)
    datatable = _get_datatable_by_code(db, dataset_code)
    dimension_counts, observation_counts = _counts_by_table(db)

    # Load only the dimensions attached to this dataset
    dimensions = (
        db.query(Dimension)
        .filter(Dimension.data_table_id == datatable.id)
        .order_by(Dimension.position, Dimension.code)
        .all()
    )

    # Count categories per dimension
    category_counts: Dict[int, int] = dict(
        db.query(Dimension.id, func.count(Category.id.distinct()))
        .join(Category, Category.dimension_id == Dimension.id)
        .filter(Dimension.data_table_id == datatable.id)
        .group_by(Dimension.id)
        .all()
    )

    dimension_summaries = [
        DimensionSummary(
            code=dimension.code,
            name=dimension.name,
            label=dimension.label,
            position=dimension.position,
            codelist_id=dimension.codelist_id,
            category_count=category_counts.get(dimension.id, 0),
        )
        for dimension in dimensions
    ]

    return DataTableDetail(
        code=datatable.code,
        name=datatable.name,
        description=datatable.description,
        provider=datatable.provider,
        updated_at=datatable.updated_at,
        dimension_count=len(dimensions),
        observation_count=observation_counts.get(datatable.id, 0),
        dimensions=dimension_summaries,
    )


@app.get(
    "/datasets/{dataset_code}/dimensions/{dimension_code}",
    response_model=DimensionDetail,
    tags=["dimensions"],
)
def get_dimension_detail(
    dataset_code: str,
    dimension_code: str,
    db: Session = Depends(get_db),
) -> DimensionDetail:
    # URL decode dataset code (not needed for dimension_code as it's simple)
    dataset_code = unquote(dataset_code)
    datatable = _get_datatable_by_code(db, dataset_code)
    dimension: Optional[Dimension] = (
        db.query(Dimension)
        .options(
            selectinload(Dimension.categories).selectinload(Category.parent)
        )
        .filter(
            Dimension.data_table_id == datatable.id,
            Dimension.code == dimension_code,
        )
        .one_or_none()
    )
    if dimension is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dimension '{dimension_code}' not found.",
        )

    categories = sorted(
        dimension.categories,
        key=lambda category: (category.parent_id or 0, category.code),
    )

    category_payload = [
        CategoryRead(
            code=category.code,
            name=category.name,
            label=category.label,
            parent_code=category.parent.code if category.parent else None,
        )
        for category in categories
    ]

    return DimensionDetail(
        code=dimension.code,
        name=dimension.name,
        label=dimension.label,
        position=dimension.position,
        codelist_id=dimension.codelist_id,
        category_count=len(category_payload),
        categories=category_payload,
    )


@app.get(
    "/datasets/{dataset_code}/observations",
    response_model=List[ObservationPoint],
    tags=["observations"],
)
def list_observations(
    dataset_code: str,
    limit: int = Query(100, gt=0, le=1000),
    db: Session = Depends(get_db),
) -> List[ObservationPoint]:
    dataset_code = unquote(dataset_code)
    datatable = _get_datatable_by_code(db, dataset_code)
    observations = (
        db.query(Observation)
        .filter(Observation.data_table_id == datatable.id)
        .options(
            selectinload(Observation.dimension_values)
            .selectinload(ObservationDimensionValue.dimension),
            selectinload(Observation.dimension_values)
            .selectinload(ObservationDimensionValue.category),
        )
        .order_by(Observation.id)
        .limit(limit)
        .all()
    )

    observation_payload: List[ObservationPoint] = []
    for observation in observations:
        dimensions_map: Dict[str, str] = {}
        for mapping in observation.dimension_values:
            if mapping.dimension and mapping.category:
                dimensions_map[mapping.dimension.code] = mapping.category.code
        observation_payload.append(
            ObservationPoint(
                observation_id=observation.id,
                value=float(observation.value),
                time_period=observation.time_period,
                dimensions=dimensions_map,
            )
        )
    return observation_payload


TOTAL_CATEGORY_CODES = {"_T", "TOTAL", "TOT"}


def _normalise_filter_values(
    filters: Optional[Dict[str, Sequence[str]]]
) -> Dict[str, List[str]]:
    if not filters:
        return {}
    normalised: Dict[str, List[str]] = {}
    for key, value in filters.items():
        if value is None:
            continue
        if isinstance(value, (list, tuple, set)):
            values = [str(item) for item in value if item is not None]
        else:
            values = [str(value)]
        if values:
            normalised[key.upper()] = values
    return normalised


def _default_total_filters(datatable: DataTable) -> Dict[str, str]:
    totals: Dict[str, str] = {}
    for dimension in datatable.dimensions:
        candidate = next(
            (cat.code for cat in dimension.categories if cat.code in TOTAL_CATEGORY_CODES),
            None,
        )
        if candidate is None:
            candidate = next(
                (cat.code for cat in dimension.categories if cat.code.startswith("_")),
                None,
            )
        if candidate is None and dimension.categories:
            candidate = dimension.categories[0].code
        if candidate is not None:
            totals[dimension.code] = candidate
    return totals


def _apply_dimension_filter(query, dim_code: str, values: Sequence[str]):
    dim_alias = aliased(Dimension)
    cat_alias = aliased(Category)
    odv_alias = aliased(ObservationDimensionValue)
    query = query.join(odv_alias, Observation.dimension_values)
    query = query.join(dim_alias, odv_alias.dimension)
    query = query.filter(dim_alias.code == dim_code)
    query = query.join(cat_alias, odv_alias.category)
    if len(values) == 1:
        query = query.filter(cat_alias.code == values[0])
    else:
        query = query.filter(cat_alias.code.in_(list(values)))
    return query


def _aggregate_dimension(
    db: Session,
    datatable: DataTable,
    dimension_code: str,
    filters: Optional[Dict[str, Sequence[str]]] = None,
    order: str = "desc",
    limit: Optional[int] = None,
) -> Tuple[List[AggregateItem], float, float]:
    dimension_code = dimension_code.upper()
    filt = _normalise_filter_values(filters)

    agg_dimension = (
        db.query(Dimension)
        .options(selectinload(Dimension.categories))
        .filter(
            Dimension.data_table_id == datatable.id,
            Dimension.code == dimension_code,
        )
        .one_or_none()
    )
    if agg_dimension is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dimension '{dimension_code}' not available.",
        )

    agg_odv = aliased(ObservationDimensionValue)
    agg_cat = aliased(Category)
    agg_dim = aliased(Dimension)
    value_expr = func.sum(Observation.value)

    query = (
        db.query(
            agg_cat.code.label("category_code"),
            agg_cat.label.label("category_label"),
            agg_cat.name.label("category_name"),
            value_expr.label("value"),
        )
        .select_from(Observation)
        .join(agg_odv, Observation.id == agg_odv.observation_id)
        .join(agg_dim, agg_odv.dimension_id == agg_dim.id)
        .join(agg_cat, agg_odv.category_id == agg_cat.id)
        .filter(Observation.data_table_id == datatable.id)
        .filter(agg_dim.id == agg_dimension.id)
    )

    for filter_dim_code, values in filt.items():
        if filter_dim_code == "TIME_PERIOD":
            query = query.filter(Observation.time_period.in_(values))
            continue
        if filter_dim_code == dimension_code:
            if len(values) == 1:
                query = query.filter(agg_cat.code == values[0])
            else:
                query = query.filter(agg_cat.code.in_(list(values)))
            continue
        # Skip filters with only "_T" value (means "all categories")
        if len(values) == 1 and values[0] in TOTAL_CATEGORY_CODES:
            continue
        query = _apply_dimension_filter(query, filter_dim_code, values)

    query = query.group_by(agg_cat.code, agg_cat.label, agg_cat.name)

    if order.lower() == "asc":
        query = query.order_by(value_expr.asc())
    else:
        query = query.order_by(value_expr.desc())

    if limit:
        query = query.limit(limit)

    rows = query.all()
    if not rows:
        return [], 0.0, 0.0

    non_total_sum = sum(
        float(row.value or 0.0)
        for row in rows
        if row.category_code not in TOTAL_CATEGORY_CODES
    )
    total_row_value = next(
        (
            float(row.value or 0.0)
            for row in rows
            if row.category_code in TOTAL_CATEGORY_CODES
        ),
        0.0,
    )
    reference_total = non_total_sum if non_total_sum else total_row_value

    results: List[AggregateItem] = []
    for row in rows:
        value = float(row.value or 0.0)
        if row.category_code in TOTAL_CATEGORY_CODES:
            share = 100.0 if value else 0.0
        elif reference_total:
            share = round((value / reference_total) * 100, 2)
        else:
            share = None
        label = row.category_label or row.category_name or row.category_code
        results.append(
            AggregateItem(
                category_code=row.category_code,
                category_label=label,
                value=value,
                share=share,
            )
        )

    return results, reference_total, total_row_value


@app.get(
    "/datasets/{dataset_code}/aggregates",
    response_model=AggregateResponse,
    tags=["observations"],
)
def aggregate_dataset(
    dataset_code: str,
    request: Request,
    dimension: str = Query(..., min_length=1),
    limit: Optional[int] = Query(None, gt=0, le=500),
    order: str = Query("desc", pattern="^(?i)(asc|desc)$"),
    db: Session = Depends(get_db),
) -> AggregateResponse:
    dataset_code = unquote(dataset_code)
    datatable = _get_datatable_by_code(db, dataset_code)
    dimension_code = dimension.upper()

    raw_filters: Dict[str, List[str]] = {}
    for key, value in request.query_params.multi_items():
        key_upper = key.upper()
        if key_upper in {"DIMENSION", "LIMIT", "ORDER"}:
            continue
        raw_filters.setdefault(key_upper, []).append(value)

    results, _, _ = _aggregate_dimension(
        db,
        datatable,
        dimension_code,
        filters=raw_filters,
        order=order,
        limit=limit,
    )

    return AggregateResponse(
        dataset_code=datatable.code,
        dimension_code=dimension_code,
        filters={key: values[-1] for key, values in raw_filters.items()},
        results=results,
    )


@app.get(
    "/datasets/{dataset_code}/insights/ageing",
    response_model=AgeingInsights,
    tags=["insights"],
)
def ageing_insights(
    dataset_code: str,
    db: Session = Depends(get_db),
) -> AgeingInsights:
    dataset_code = unquote(dataset_code)
    datatable = _get_datatable_by_code(db, dataset_code)

    latest_period = (
        db.query(Observation.time_period)
        .filter(Observation.data_table_id == datatable.id)
        .filter(Observation.time_period.isnot(None))
        .order_by(Observation.time_period.desc())
        .limit(1)
        .scalar()
    )
    if latest_period is None:
        raise HTTPException(
            status_code=404,
            detail=f"No observations available for dataset '{dataset_code}'.",
        )

    base_filters: Dict[str, Sequence[str]] = {
        "TIME_PERIOD": [latest_period],
        "MEASURE": ["POP"],
        "UNIT_MEASURE": ["PERS"],
        "FREQ": ["A10"],
    }

    default_totals = _default_total_filters(datatable)

    def with_default_totals(
        filters: Dict[str, Sequence[str]],
        skip: Sequence[str] = (),
    ) -> Dict[str, Sequence[str]]:
        merged: Dict[str, Sequence[str]] = dict(filters)
        skip_set = {code.upper() for code in skip}
        for dim_code, category_code in default_totals.items():
            if dim_code in skip_set:
                continue
            if dim_code not in merged:
                if isinstance(category_code, (list, tuple, set)):
                    merged[dim_code] = [str(value) for value in category_code]  # type: ignore[assignment]
                else:
                    merged[dim_code] = [category_code]
        return merged

    age_filters = with_default_totals(base_filters, skip=("AGE",))

    age_results, _, total_value = _aggregate_dimension(
        db,
        datatable,
        "AGE",
        filters=age_filters,
        order="desc",
    )

    population_total = total_value or sum(item.value for item in age_results)

    age_lookup = {item.category_code: item for item in age_results}

    bucket_order = ["Y_LT15", "Y15T29", "Y30T49", "Y50T64", "Y65T84", "Y_GE85"]
    age_buckets: List[AggregateItem] = []
    for code in bucket_order:
        item = age_lookup.get(code)
        if not item:
            continue
        share = (
            round((item.value / population_total) * 100, 2)
            if population_total
            else None
        )
        age_buckets.append(
            AggregateItem(
                category_code=code,
                category_label=item.category_label,
                value=item.value,
                share=share,
            )
        )

    def parse_age_bounds(code: str) -> Tuple[Optional[int], Optional[int]]:
        if not code or not code.startswith("Y"):
            return None, None
        body = code[1:]
        if body.startswith("LT"):
            match = re.search(r"\d+", body)
            return None, int(match.group()) if match else None
        if body.startswith("GE"):
            match = re.search(r"\d+", body)
            return int(match.group()) if match else None, None
        if "T" in body:
            low, high = body.split("T", 1)
            if low.isdigit() and high.isdigit():
                return int(low), int(high)
        if body.isdigit():
            age = int(body)
            return age, age
        return None, None

    seniors_codes: List[str] = []
    for code, item in age_lookup.items():
        lower, upper = parse_age_bounds(code)
        if lower is None and upper is None:
            continue
        if lower is not None and lower >= 65:
            if upper is None or upper - lower <= 5:
                seniors_codes.append(code)
        elif upper is not None and upper >= 65 and lower is None:
            seniors_codes.append(code)

    if not seniors_codes and "Y65T84" in age_lookup:
        seniors_codes.append("Y65T84")
    if not seniors_codes and "_T" in age_lookup:
        seniors_codes.append("_T")

    seniors_population = sum(
        age_lookup[code].value for code in seniors_codes if code in age_lookup
    )

    children_population = (
        age_lookup.get("Y_LT15").value if "Y_LT15" in age_lookup else 0.0
    )
    working_age_population = max(
        population_total - children_population - seniors_population,
        0.0,
    )

    share_children = (
        round((children_population / population_total) * 100, 2)
        if population_total
        else 0.0
    )
    share_seniors = (
        round((seniors_population / population_total) * 100, 2)
        if population_total
        else 0.0
    )

    eighty_plus_codes: List[str] = []
    for code in seniors_codes:
        lower, upper = parse_age_bounds(code)
        bound = lower if lower is not None else upper
        if bound is not None and bound >= 80:
            eighty_plus_codes.append(code)

    share_80_plus = 0.0
    if population_total and eighty_plus_codes:
        eighty_plus_value = sum(
            age_lookup[code].value for code in eighty_plus_codes if code in age_lookup
        )
        share_80_plus = round((eighty_plus_value / population_total) * 100, 2)

    old_age_dependency_ratio = 0.0
    if working_age_population:
        old_age_dependency_ratio = round(
            (seniors_population / working_age_population) * 100,
            2,
        )

    senior_filters_for_sex = with_default_totals(
        {
            **base_filters,
            "AGE": seniors_codes,
        },
        skip=("SEX",),
    )

    seniors_by_sex, _, _ = _aggregate_dimension(
        db,
        datatable,
        "SEX",
        filters=senior_filters_for_sex,
        order="desc",
    )

    senior_filters_for_marital = with_default_totals(
        {
            **base_filters,
            "AGE": seniors_codes,
            "SEX": ["_T"],
        },
        skip=("LMS",),
    )

    seniors_by_marital, _, _ = _aggregate_dimension(
        db,
        datatable,
        "LMS",
        filters=senior_filters_for_marital,
        order="desc",
    )

    return AgeingInsights(
        dataset_code=datatable.code,
        time_period=latest_period,
        population_total=population_total,
        children_population=children_population,
        working_age_population=working_age_population,
        seniors_population=seniors_population,
        share_children=share_children,
        share_seniors=share_seniors,
        share_80_plus=share_80_plus,
        old_age_dependency_ratio=old_age_dependency_ratio,
        age_buckets=age_buckets,
        seniors_by_sex=seniors_by_sex,
        seniors_by_marital_status=seniors_by_marital,
        senior_age_codes=seniors_codes,
    )

__all__ = ["app"]

if __name__ == "__main__":
    import json
    import os
    import uvicorn

    openapi_schema = app.openapi()
    output_dir = os.path.join(os.getcwd(), "output_backend")
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "openapi_specs.json")
    print(f"Writing OpenAPI schema to {output_file}")
    print("Swagger UI available at http://0.0.0.0:8000/docs")
    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(openapi_schema, file, indent=2)
    uvicorn.run(app, host="0.0.0.0", port=8000)
