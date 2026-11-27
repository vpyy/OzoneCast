from datetime import datetime
from fastapi import APIRouter
from ..db import check_db_health
from ..schemas.common import HealthResponse

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    db_ok = check_db_health()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        service="database-api",
        database="connected" if db_ok else "disconnected",
        timestamp=datetime.utcnow()
    )
