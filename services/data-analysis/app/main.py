"""
Data Analysis Microservice — main entry point.

Schedule: every 5 minutes (per sơ đồ khối)
  - Aggregates time-series data at 3 levels: Day, Week, Month
  - Calculates Line chart, Scatter plot, Histogram
  - Re-samples to extract Trend & Seasonal decomposition
  - Calculates 6x6 Correlation Matrix (Ozone, Reflectivity, UV Aerosol, SZA, Lat, Lon)
  - Pushes processed results & cache to Database API
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
    version="2.0.0",
    description="Every 5 min: Timeseries, Trend/Seasonal, Correlation Matrix & Binning",
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
    result = OzoneAnalyzer.process_granule(granule_name=None)
    print(f"[SCHEDULER] data-analysis done: {result}")

scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_analysis, "interval", minutes=5, id="analysis_job")

@app.on_event("startup")
def start_scheduler():
    scheduler.start()
    print("[STARTUP] Analysis scheduler started — runs every 5 minutes")
    # Run once at startup to warm up cache
    try:
        OzoneAnalyzer.process_granule()
    except Exception as e:
        print(f"[WARMUP ERROR] {e}")

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
    """Kích hoạt thủ công phân tích dữ liệu, tính toán chuỗi thời gian & ma trận tương quan."""
    result = OzoneAnalyzer.process_granule(req.granule_name)
    return result

@app.get("/api/analysis/overview")
def get_analysis_overview():
    return {
        "service": "data-analysis",
        "features": [
            "Timeseries: Day, Week, Month",
            "Charts: Line, Scatter, Histogram",
            "Time-Series Decomposition: Trend & Seasonal",
            "Correlation Matrix: 6 variables"
        ],
        "schedule": "every 5 minutes",
        "timestamp": datetime.utcnow().isoformat(),
    }
