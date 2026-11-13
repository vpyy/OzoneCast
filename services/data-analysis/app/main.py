"""
Data Analysis Microservice — main entry point.

Schedule: every 5 minutes (per sơ đồ khối)
  - Reads raw measurements from database-api
  - Applies QC filtering, spatial binning, anomaly detection
  - Writes processed results back to database-api
"""

from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .analyzer import OzoneAnalyzer

app = FastAPI(
    title="Ozone Data Analysis Microservice",
    version="1.0.0",
    description="Every 5 min: QC filtering, spatial binning & anomaly detection",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Scheduled job: every 5 minutes ────────────────────────────────────────────
def scheduled_analysis():
    print(f"[SCHEDULER] data-analysis triggered at {datetime.utcnow().isoformat()}")
    result = OzoneAnalyzer.process_granule(granule_name=None)  # process latest unprocessed
    print(f"[SCHEDULER] done: {result}")


scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_analysis, "interval", minutes=5, id="analysis_job")


@app.on_event("startup")
def start_scheduler():
    scheduler.start()
    print("[STARTUP] Analysis scheduler started — runs every 5 minutes")


@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()


# ── REST endpoints ─────────────────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    granule_name: Optional[str] = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "data-analysis",
        "timestamp": datetime.utcnow().isoformat(),
        "scheduler_running": scheduler.running,
    }


@app.post("/api/analysis/process")
def run_analysis(req: AnalysisRequest):
    """Manually trigger analysis for a specific granule (or latest if None)."""
    result = OzoneAnalyzer.process_granule(req.granule_name)
    return result


@app.get("/api/analysis/overview")
def get_analysis_overview():
    return {
        "service": "data-analysis",
        "description": "Calculates Level-3 grid summary and ozone depletion anomalies",
        "schedule": "every 5 minutes",
        "timestamp": datetime.utcnow().isoformat(),
    }
