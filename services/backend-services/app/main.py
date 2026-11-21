"""
Backend Services — entrypoint duy nhất cho Analysis + Clustering + Prediction.

Kiến trúc:
  - FastAPI Server lắng nghe trên port 8004 phục vụ kích hoạt thủ công từ Frontend (Clustering, Analysis, Prediction).
  - BackgroundScheduler (APScheduler) chạy các tác vụ định kỳ:
      * Data Analysis  : mỗi ANALYSIS_INTERVAL_SECONDS   (mặc định 300 = 5 phút)
      * Prediction     : mỗi PREDICTION_INTERVAL_SECONDS  (mặc định 300 = 5 phút)
      * Clustering     : mỗi CLUSTERING_INTERVAL_SECONDS  (mặc định 86400 = 1 ngày)

Dữ liệu được đọc từ database-api và kết quả ghi lại vào database-api.
"""

import os
from datetime import datetime
from typing import Optional, Dict, Any

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from .data_analysis.analyzer import OzoneAnalyzer
from .clustering.clusterer import OzoneClusterer
from .prediction.model import OzonePredictionModel

# ── Đọc cấu hình interval từ env ───────────────────────────────────────────────
ANALYSIS_INTERVAL_SECONDS = int(os.getenv("ANALYSIS_INTERVAL_SECONDS", "300"))
PREDICTION_INTERVAL_SECONDS = int(os.getenv("PREDICTION_INTERVAL_SECONDS", "300"))
CLUSTERING_INTERVAL_SECONDS = int(os.getenv("CLUSTERING_INTERVAL_SECONDS", "86400"))

DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8000")

# ── Khởi tạo model prediction (singleton) ──────────────────────────────────────
prediction_model = OzonePredictionModel()

# ── Khởi tạo FastAPI App ───────────────────────────────────────────────────────
app = FastAPI(
    title="OzoneCast Backend Microservice (Analytics & AI)",
    version="2.0.0",
    description="Unified backend microservice for Data Mining, Spatial Clustering, and ML Prediction."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Schemas ────────────────────────────────────────────────────────────
class ClusteringRunRequest(BaseModel):
    algorithm: Optional[str] = "KMeans"
    eps: Optional[float] = 1.2
    n_clusters: Optional[int] = 4


class PredictionPointRequest(BaseModel):
    latitude: float
    longitude: float
    datetime: Optional[str] = None


# ── Job functions ───────────────────────────────────────────────────────────────

def job_analysis():
    """Data Analysis: đọc raw data → tính timeseries / trend / correlation → ghi vào DB."""
    print(f"[ANALYSIS] triggered at {datetime.utcnow().isoformat()}")
    try:
        result = OzoneAnalyzer.process_granule(granule_name=None)
        print(f"[ANALYSIS] done: cells={result.get('cells_processed')}, "
              f"anomalies={result.get('anomalies_found')}")
    except Exception as e:
        print(f"[ANALYSIS ERROR] {e}")


def job_prediction():
    """Prediction: retrain RandomForest → forecast tomorrow → cache vào DB."""
    print(f"[PREDICTION] triggered at {datetime.utcnow().isoformat()}")
    try:
        metrics = prediction_model.train_from_database()
        print(f"[PREDICTION] done: MAE={metrics.get('regression_mae_du')} DU, "
              f"R²={metrics.get('regression_r2')}, "
              f"Acc={metrics.get('classification_accuracy')}%")
    except Exception as e:
        print(f"[PREDICTION ERROR] {e}")


def job_clustering():
    """Clustering: đọc grid data → K-Means → ghi cluster results vào DB."""
    print(f"[CLUSTERING] triggered at {datetime.utcnow().isoformat()}")
    try:
        result = OzoneClusterer.run_kmeans_clustering(n_clusters=4)
        print(f"[CLUSTERING] done: {len(result)} points across 4 clusters")
    except Exception as e:
        print(f"[CLUSTERING ERROR] {e}")


# ── Warmup: chạy một lần ngay khi khởi động ────────────────────────────────────

def warmup():
    """Chạy warmup tất cả jobs ngay khi container khởi động."""
    print("[WARMUP] Running initial analysis...")
    try:
        job_analysis()
    except Exception as e:
        print(f"[WARMUP] analysis error (ignored): {e}")

    print("[WARMUP] Running initial prediction...")
    try:
        job_prediction()
    except Exception as e:
        print(f"[WARMUP] prediction error (ignored): {e}")

    print("[WARMUP] Running initial clustering...")
    try:
        job_clustering()
    except Exception as e:
        print(f"[WARMUP] clustering error (ignored): {e}")

    print("[WARMUP] Done. Scheduler now takes over.")


# ── REST API Endpoints ─────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "backend-services",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/clustering/run")
def trigger_clustering(req: ClusteringRunRequest):
    """
    Kích hoạt phân cụm không gian theo yêu cầu từ Frontend UI:
    - Thuật toán: KMeans hoặc DBSCAN
    - Tham số: n_clusters (K) hoặc eps (Epsilon)
    """
    try:
        result = OzoneClusterer.run_clustering(
            algorithm=req.algorithm or "KMeans",
            eps=float(req.eps or 1.2),
            n_clusters=int(req.n_clusters or 4)
        )
        return result
    except Exception as e:
        print(f"[API CLUSTERING ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/process")
def trigger_analysis(payload: Optional[Dict[str, Any]] = None):
    """Trigger manual data analysis."""
    granule = payload.get("granule_name") if payload else None
    return OzoneAnalyzer.process_granule(granule_name=granule)


@app.post("/api/prediction/train")
def trigger_train():
    """Trigger manual model retraining."""
    return prediction_model.train_from_database()


@app.post("/api/prediction/predict")
def trigger_predict_point(req: PredictionPointRequest):
    """Dự báo Ozone DU và nhãn rủi ro theo tọa độ và ngày chỉ định."""
    dt = None
    if req.datetime:
        try:
            dt = datetime.fromisoformat(req.datetime.replace("Z", "+00:00"))
        except Exception:
            dt = None
    return prediction_model.predict(lat=req.latitude, lon=req.longitude, dt=dt)


# ── Main: khởi động scheduler & web server ─────────────────────────────────────

scheduler = BackgroundScheduler(timezone="UTC")


def setup_scheduler():
    scheduler.add_job(
        job_analysis,
        "interval",
        seconds=ANALYSIS_INTERVAL_SECONDS,
        id="analysis_job",
        next_run_time=None,
    )
    scheduler.add_job(
        job_prediction,
        "interval",
        seconds=PREDICTION_INTERVAL_SECONDS,
        id="prediction_job",
        next_run_time=None,
    )
    scheduler.add_job(
        job_clustering,
        "interval",
        seconds=CLUSTERING_INTERVAL_SECONDS,
        id="clustering_job",
        next_run_time=None,
    )
    scheduler.start()
    print(f"[SCHEDULER] Started successfully in background.")


@app.on_event("startup")
def on_startup():
    warmup()
    setup_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    scheduler.shutdown(wait=False)
    print("[SCHEDULER] Stopped.")


def main():
    print("=" * 60)
    print("[BACKEND-SERVICES] Starting up on port 8004")
    print(f"  ANALYSIS_INTERVAL   : {ANALYSIS_INTERVAL_SECONDS}s")
    print(f"  PREDICTION_INTERVAL : {PREDICTION_INTERVAL_SECONDS}s")
    print(f"  CLUSTERING_INTERVAL : {CLUSTERING_INTERVAL_SECONDS}s")
    print(f"  DATABASE_API_URL    : {DATABASE_API_URL}")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8004, log_level="info")


if __name__ == "__main__":
    main()
