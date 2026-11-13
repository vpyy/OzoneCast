"""
Data Ingestion Microservice — main entry point.

Schedule: every 5 minutes (per sơ đồ khối)
  - Fetches the latest granule from NASA CMR API
  - Falls back to mock data if NASA is unreachable
  - Pushes all measurements to database-api (PostgreSQL)
  - No local file storage: temp files in /tmp, deleted after upload
"""

from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .ingestion_service import IngestionService

app = FastAPI(
    title="Ozone Data Ingestion Microservice",
    version="1.0.0",
    description="Every 5 min: fetches NASA satellite data and pushes to database-api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = IngestionService()


# ── Scheduled job: every 5 minutes ────────────────────────────────────────────
def scheduled_ingest():
    print(f"[SCHEDULER] data-ingestion triggered at {datetime.utcnow().isoformat()}")
    result = service.fetch_real_from_nasa_cmr()
    if not result:
        print("[SCHEDULER] NASA not reachable — falling back to mock data")
        result = service.ingest_mock()
    print(f"[SCHEDULER] done: {result}")


scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_ingest, "interval", minutes=5, id="ingest_job")


@app.on_event("startup")
def start_scheduler():
    scheduler.start()
    print("[STARTUP] Ingestion scheduler started — runs every 5 minutes")


@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()


# ── REST endpoints (manual triggers) ──────────────────────────────────────────

class IngestRequest(BaseModel):
    source_type: str = "real"  # "real" or "mock"
    filename: Optional[str] = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "data-ingestion",
        "timestamp": datetime.utcnow().isoformat(),
        "scheduler_running": scheduler.running,
    }


@app.post("/api/ingest")
def trigger_ingest(req: IngestRequest, background_tasks: BackgroundTasks):
    """Manually trigger ingestion (real or mock)."""
    if req.source_type == "real":
        result = service.fetch_real_from_nasa_cmr()
        if not result:
            result = service.ingest_mock(req.filename)
            return {"status": "success", "mode": "fallback_mock", "result": result}
        return {"status": "success", "mode": "real_nasa", "result": result}
    else:
        result = service.ingest_mock(req.filename)
        return {"status": "success", "mode": "mock", "result": result}


@app.post("/api/ingest/real")
def ingest_real_direct():
    """Force a real NASA CMR fetch."""
    result = service.fetch_real_from_nasa_cmr()
    if result:
        return {"status": "success", "result": result}
    raise HTTPException(status_code=502, detail="Failed to fetch real data from NASA CMR.")


@app.post("/api/ingest/mock")
def ingest_mock_direct():
    """Generate and push mock data immediately."""
    result = service.ingest_mock()
    return {"status": "success", "result": result}
