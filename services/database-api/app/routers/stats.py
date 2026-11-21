from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..db import get_db
from ..schemas.stats import DashboardStatsResponse

router = APIRouter(prefix="/api", tags=["Stats"])

@router.get("/stats", response_model=DashboardStatsResponse)
def get_system_stats(db: Annotated[Session, Depends(get_db)]) -> DashboardStatsResponse:
    stats_query = text("""
        SELECT 
            (SELECT count(*) FROM granules) AS total_granules,
            (SELECT count(*) FROM raw_measurements) AS total_raw_measurements,
            (SELECT count(*) FROM ozone_grid_summary) AS total_grid_cells,
            COALESCE((SELECT round(avg(ozone_column_raw)::numeric, 2) FROM raw_measurements WHERE ozone_column_raw IS NOT NULL), 290.0) AS avg_ozone_du,
            COALESCE((SELECT round(min(ozone_column_raw)::numeric, 2) FROM raw_measurements WHERE ozone_column_raw IS NOT NULL), 180.0) AS min_ozone_du,
            COALESCE((SELECT round(max(ozone_column_raw)::numeric, 2) FROM raw_measurements WHERE ozone_column_raw IS NOT NULL), 450.0) AS max_ozone_du,
            (SELECT count(*) FROM ozone_anomalies) AS anomalies_detected
    """)
    row = db.execute(stats_query).fetchone()

    return DashboardStatsResponse(
        total_granules=int(row.total_granules or 0) if row else 0,
        total_raw_measurements=int(row.total_raw_measurements or 0) if row else 0,
        total_grid_cells=int(row.total_grid_cells or 0) if row else 0,
        avg_ozone_du=float(row.avg_ozone_du or 290.0) if row else 290.0,
        min_ozone_du=float(row.min_ozone_du or 180.0) if row else 180.0,
        max_ozone_du=float(row.max_ozone_du or 450.0) if row else 450.0,
        anomalies_detected=int(row.anomalies_detected or 0) if row else 0,
        last_updated=datetime.utcnow()
    )
