"""
ML Prediction Microservice — main entry point.

Schedule: every 5 minutes (per sơ đồ khối)
  - Reads processed ozone data from database-api
  - Re-trains RandomForest model on fresh data
  - Exposes /predict endpoint for real-time inference
"""

from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .model import OzonePredictionModel

app = FastAPI(
    title="Ozone ML Prediction Microservice",
    version="1.0.0",
    description="Every 5 min: auto-retrain RandomForest; exposes /predict endpoint",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_service = OzonePredictionModel()


# ── Scheduled job: every 5 minutes ────────────────────────────────────────────
def scheduled_retrain():
    print(f"[SCHEDULER] prediction retrain triggered at {datetime.utcnow().isoformat()}")
    metrics = model_service.train_from_database()
    print(f"[SCHEDULER] model retrained: {metrics}")


scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_retrain, "interval", minutes=5, id="retrain_job")


@app.on_event("startup")
def start_scheduler():
    scheduler.start()
    print("[STARTUP] Prediction scheduler started — retrains every 5 minutes")


@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()


# ── REST endpoints ─────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    latitude: float
    longitude: float
    datetime: Optional[datetime] = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "prediction",
        "timestamp": datetime.utcnow().isoformat(),
        "scheduler_running": scheduler.running,
        "model_trained": model_service.is_trained,
    }


@app.post("/api/prediction/train")
def train_model():
    """Manually trigger model retraining."""
    metrics = model_service.train_from_database()
    return metrics


@app.post("/api/prediction/predict")
def predict_ozone(req: PredictRequest):
    """Predict ozone value at a given lat/lon."""
    if not (-90 <= req.latitude <= 90) or not (-180 <= req.longitude <= 180):
        raise HTTPException(
            status_code=400,
            detail="Latitude must be in [-90, 90] and Longitude in [-180, 180]",
        )
    result = model_service.predict(req.latitude, req.longitude, req.datetime)
    return result
