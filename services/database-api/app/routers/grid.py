from datetime import datetime
from typing import List, Optional, Annotated, Dict, Any
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..db import get_db
from ..models import OzoneGridSummary
from ..schemas.grid import GridSummaryResponse

router = APIRouter(prefix="/api/grid-summary", tags=["Grid Summary"])


class GridSummaryCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    source_filename: Optional[str] = None
    timestamp: Optional[datetime] = None
    lat_bin: float
    lon_bin: float
    ozone_column_mean: float
    ozone_column_min: Optional[float] = None
    ozone_column_max: Optional[float] = None
    reflectivity_mean: Optional[float] = 0.0
    uv_aerosol_mean: Optional[float] = 0.0
    valid_pixel_count: Optional[int] = 1


class GridSummaryBulkCreate(BaseModel):
    items: List[GridSummaryCreate]


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def create_grid_summary_bulk(
    payload: GridSummaryBulkCreate,
    db: Annotated[Session, Depends(get_db)]
) -> Dict[str, Any]:
    """Nhận và lưu trữ hàng loạt ô lưới không gian (Spatial Binning) từ backend-services."""
    if not payload.items:
        return {"status": "ok", "inserted": 0}

    now = datetime.utcnow()
    # Nếu nạp cùng source_filename, có thể xóa cũ để thay thế phiên bản mới nhất
    sample_source = payload.items[0].source_filename
    if sample_source:
        db.query(OzoneGridSummary).filter(OzoneGridSummary.source_filename == sample_source).delete(synchronize_session=False)

    objects = [
        OzoneGridSummary(
            source_filename=it.source_filename,
            timestamp=it.timestamp or now,
            lat_bin=it.lat_bin,
            lon_bin=it.lon_bin,
            ozone_column_mean=it.ozone_column_mean,
            ozone_column_min=it.ozone_column_min,
            ozone_column_max=it.ozone_column_max,
            reflectivity_mean=it.reflectivity_mean or 0.0,
            uv_aerosol_mean=it.uv_aerosol_mean or 0.0,
            valid_pixel_count=it.valid_pixel_count or 1
        )
        for it in payload.items
    ]
    db.bulk_save_objects(objects)
    db.commit()
    return {"status": "ok", "inserted": len(objects)}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_grid_summary_single(
    payload: GridSummaryCreate,
    db: Annotated[Session, Depends(get_db)]
) -> Dict[str, Any]:
    """Lưu trữ một ô lưới không gian đơn lẻ."""
    obj = OzoneGridSummary(
        source_filename=payload.source_filename,
        timestamp=payload.timestamp or datetime.utcnow(),
        lat_bin=payload.lat_bin,
        lon_bin=payload.lon_bin,
        ozone_column_mean=payload.ozone_column_mean,
        ozone_column_min=payload.ozone_column_min,
        ozone_column_max=payload.ozone_column_max,
        reflectivity_mean=payload.reflectivity_mean or 0.0,
        uv_aerosol_mean=payload.uv_aerosol_mean or 0.0,
        valid_pixel_count=payload.valid_pixel_count or 1
    )
    db.add(obj)
    db.commit()
    return {"status": "ok", "id": obj.id}


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

    # Dynamic SQL binning 0.25° x 0.25° từ dữ liệu quan trắc Bán đảo Nam Cực trong 24h qua (hoặc toàn bộ dữ liệu sạch nếu DB tích lũy)
    sql = text("""
        SELECT 
            row_number() OVER () AS id,
            'Spatial_Grid_0.25deg' AS source_filename,
            COALESCE(MAX(created_at), NOW()) AS timestamp,
            round((latitude / 0.25)::numeric) * 0.25 AS lat_bin,
            round((longitude / 0.25)::numeric) * 0.25 AS lon_bin,
            round(avg(ozone_column_raw)::numeric, 1) AS ozone_column_mean,
            round(min(ozone_column_raw)::numeric, 1) AS ozone_column_min,
            round(max(ozone_column_raw)::numeric, 1) AS ozone_column_max,
            round(avg(reflectivity331)::numeric, 1) AS reflectivity_mean,
            round(avg(uv_aerosol_index)::numeric, 2) AS uv_aerosol_mean,
            count(*)::int AS valid_pixel_count
        FROM raw_measurements
        WHERE ozone_column_raw IS NOT NULL 
          AND ozone_column_raw > 0
          AND quality_flag = 0
          AND latitude BETWEEN -70.0 AND -63.0
          AND longitude BETWEEN -75.0 AND -55.0
        GROUP BY 4, 5
        ORDER BY lat_bin ASC, lon_bin ASC
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
