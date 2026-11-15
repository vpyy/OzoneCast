"""
ML Prediction Microservice — main entry point.

Schedule: every 5 minutes (per sơ đồ khối)
  - Regression: Trains RandomForest model forecasting Ozone (DU) for tomorrow
  - Classification: Classifies tomorrow's risk status (Bình thường / Cảnh báo UV cao / Bất thường)
  - Pushes tomorrow's forecast cache to Database API
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
    version="2.0.0",
    description="Every 5 min: Regression & Classification forecast for tomorrow",
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
    print(f"[SCHEDULER] prediction retrain & forecast triggered at {datetime.utcnow().isoformat()}")
    metrics = model_service.train_from_database()
    print(f"[SCHEDULER] models updated: {metrics}")

scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_retrain, "interval", minutes=5, id="retrain_job")

@app.on_event("startup")
def start_scheduler():
    scheduler.start()
    print("[STARTUP] Prediction scheduler started — retrains & forecasts every 5 minutes")
    try:
        model_service.train_from_database()
    except Exception as e:
        print(f"[PREDICTION WARMUP ERROR] {e}")

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
        "models_ready": model_service.reg_model is not None and model_service.clf_model is not None,
    }

@app.post("/api/prediction/train")
def train_model():
    """Kích hoạt thủ công huấn luyện cả 2 mô hình (Hồi quy + Phân loại)."""
    metrics = model_service.train_from_database()
    return metrics

@app.post("/api/prediction/predict")
def predict_ozone(req: PredictRequest):
    """Dự báo chỉ số Ozone và phân loại nhãn cảnh báo tại vị trí chỉ định."""
    if not (-90 <= req.latitude <= 90) or not (-180 <= req.longitude <= 180):
        raise HTTPException(
            status_code=400,
            detail="Latitude must be in [-90, 90] and Longitude in [-180, 180]",
        )
    result = model_service.predict(req.latitude, req.longitude, req.datetime)
    return result

@app.get("/api/prediction/tomorrow")
def get_tomorrow_forecast():
    """Lấy trực tiếp thẻ dự báo ngày mai (Regression DU + Classification Label)."""
    return model_service.forecast_tomorrow_and_cache()
