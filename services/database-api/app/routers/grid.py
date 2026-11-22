from typing import List, Optional, Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..db import get_db
from ..models import OzoneGridSummary
from ..schemas.grid import GridSummaryResponse

router = APIRouter(prefix="/api/grid-summary", tags=["Grid Summary"])

@router.get("", response_model=List[GridSummaryResponse])
def get_grid_summary(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=10000)] = 500,
    offset: Annotated[int, Query(ge=0)] = 0,
    source_filename: Annotated[Optional[str], Query()] = None,
    min_lat: Annotated[Optional[float], Query(ge=-90.0, le=90.0)] = None,
    max_lat: Annotated[Optional[float], Query(ge=-90.0, le=90.0)] = None
) -> List[GridSummaryResponse]:
    query = db.query(OzoneGridSummary)

    if source_filename:
        query = query.filter(OzoneGridSummary.source_filename == source_filename)
    if min_lat is not None:
        query = query.filter(OzoneGridSummary.lat_bin >= min_lat)
    if max_lat is not None:
        query = query.filter(OzoneGridSummary.lat_bin <= max_lat)

    results = query.order_by(OzoneGridSummary.timestamp.desc()).offset(offset).limit(limit).all()
    if results:
        return results

    # Dynamic SQL binning từ dữ liệu thô khi bảng tổng hợp chưa chạy
    sql = text("""
        SELECT 
            row_number() OVER () AS id,
            'Dynamic_SQL_Binning' AS source_filename,
            COALESCE(MAX(created_at), NOW()) AS timestamp,
            round((latitude / 0.5)::numeric) * 0.5 AS lat_bin,
            round((longitude / 0.5)::numeric) * 0.5 AS lon_bin,
            round(avg(ozone_column_raw)::numeric, 1) AS ozone_column_mean,
            round(min(ozone_column_raw)::numeric, 1) AS ozone_column_min,
            round(max(ozone_column_raw)::numeric, 1) AS ozone_column_max,
            round(avg(reflectivity331)::numeric, 1) AS reflectivity_mean,
            round(avg(uv_aerosol_index)::numeric, 2) AS uv_aerosol_mean,
            count(*)::int AS valid_pixel_count
        FROM raw_measurements
        WHERE ozone_column_raw IS NOT NULL
        GROUP BY 4, 5
        LIMIT :limit OFFSET :offset
    """)
    rows = db.execute(sql, {"limit": limit, "offset": offset}).fetchall()
    return [
        GridSummaryResponse(
            id=int(r._mapping["id"]),
            source_filename=r._mapping["source_filename"],
            timestamp=r._mapping["timestamp"],
            lat_bin=float(r._mapping["lat_bin"]),
            lon_bin=float(r._mapping["lon_bin"]),
            ozone_column_mean=float(r._mapping["ozone_column_mean"]),
            ozone_column_min=float(r._mapping["ozone_column_min"]) if r._mapping["ozone_column_min"] is not None else None,
            ozone_column_max=float(r._mapping["ozone_column_max"]) if r._mapping["ozone_column_max"] is not None else None,
            reflectivity_mean=float(r._mapping["reflectivity_mean"] or 0.0),
            uv_aerosol_mean=float(r._mapping["uv_aerosol_mean"] or 0.0),
            valid_pixel_count=int(r._mapping["valid_pixel_count"] or 1)
        )
        for r in rows
    ]
