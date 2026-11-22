from datetime import datetime
from typing import List, Optional, Annotated
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..db import get_db
from ..models import RawMeasurement
from ..schemas.measurements import RawMeasurementResponse, AggregatedTimeseriesResponse
from ..schemas.common import TimeseriesPoint

router = APIRouter(prefix="/api", tags=["Raw Measurements & Timeseries"])

@router.get("/raw-measurements", response_model=List[RawMeasurementResponse])
def get_raw_measurements(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    granule_name: Annotated[Optional[str], Query()] = None,
    min_lat: Annotated[Optional[float], Query(ge=-90.0, le=90.0)] = None,
    max_lat: Annotated[Optional[float], Query(ge=-90.0, le=90.0)] = None,
    min_lon: Annotated[Optional[float], Query(ge=-180.0, le=180.0)] = None,
    max_lon: Annotated[Optional[float], Query(ge=-180.0, le=180.0)] = None,
    max_sza: Annotated[Optional[float], Query(ge=0.0, le=90.0)] = None,
    valid_only: Annotated[bool, Query(description="Chỉ lấy điểm không lỗi (quality_flag=0, ozone NOT NULL)")] = False
) -> List[RawMeasurementResponse]:
    query = db.query(RawMeasurement)

    if granule_name:
        query = query.filter(RawMeasurement.granule_name == granule_name)
    if min_lat is not None:
        query = query.filter(RawMeasurement.latitude >= min_lat)
    if max_lat is not None:
        query = query.filter(RawMeasurement.latitude <= max_lat)
    if min_lon is not None:
        query = query.filter(RawMeasurement.longitude >= min_lon)
    if max_lon is not None:
        query = query.filter(RawMeasurement.longitude <= max_lon)
    if max_sza is not None:
        query = query.filter(RawMeasurement.solar_zenith_angle <= max_sza)
    if valid_only:
        query = query.filter(
            RawMeasurement.quality_flag == 0,
            RawMeasurement.ozone_column_raw.isnot(None),
            RawMeasurement.ozone_column_raw > 0
        )

    # Ưu tiên lấy các bản ghi mới nạp nhất lên đầu để hiển thị real-time
    return query.order_by(RawMeasurement.id.desc()).offset(offset).limit(limit).all()


@router.get("/aggregated/timeseries", response_model=AggregatedTimeseriesResponse)
def get_aggregated_timeseries(
    db: Annotated[Session, Depends(get_db)],
    granularity: Annotated[str, Query(pattern="^(hour|day|week|month)$")] = "day",
    start: Annotated[Optional[datetime], Query()] = None,
    end: Annotated[Optional[datetime], Query()] = None,
    limit: Annotated[int, Query(ge=1, le=10000)] = 1000
) -> AggregatedTimeseriesResponse:
    """Gộp dữ liệu chuỗi thời gian bằng SQL date_trunc (không gộp bằng Python trên dữ liệu thô)."""
    allowed_truncs = {"hour", "day", "week", "month"}
    if granularity not in allowed_truncs:
        raise HTTPException(status_code=400, detail="Invalid granularity. Allowed: hour, day, week, month")

    conditions = ["1=1"]
    params: dict = {"limit": limit}

    if start:
        conditions.append("created_at >= :start")
        params["start"] = start
    if end:
        conditions.append("created_at <= :end")
        params["end"] = end

    where_clause = " AND ".join(conditions)

    # Sử dụng date_trunc an toàn qua whitelist
    sql = text(f"""
        SELECT 
            date_trunc('{granularity}', created_at) AS t,
            ROUND(AVG(ozone_column_raw)::numeric, 2) AS val
        FROM raw_measurements
        WHERE {where_clause}
        GROUP BY 1
        ORDER BY 1 ASC
        LIMIT :limit
    """)

    rows = db.execute(sql, params).fetchall()

    series = [
        TimeseriesPoint(
            t=row._mapping["t"],
            value=float(row._mapping["val"]) if row._mapping["val"] is not None else None
        )
        for row in rows
    ]

    return AggregatedTimeseriesResponse(
        granularity=granularity,
        series=series
    )
