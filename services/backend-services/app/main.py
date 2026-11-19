"""
Backend Services — entrypoint duy nhất cho Analysis + Clustering + Prediction.

Scheduler (APScheduler):
  - Data Analysis  : mỗi ANALYSIS_INTERVAL_SECONDS   (mặc định 300 = 5 phút)
  - Prediction     : mỗi PREDICTION_INTERVAL_SECONDS  (mặc định 300 = 5 phút)
  - Clustering     : mỗi CLUSTERING_INTERVAL_SECONDS  (mặc định 86400 = 1 ngày)

Service này KHÔNG mở HTTP API cho frontend.
Dữ liệu được đọc từ database-api và kết quả ghi lại vào database-api.
"""

import os
import time
from datetime import datetime, timedelta

from apscheduler.schedulers.blocking import BlockingScheduler

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


# ── Main: khởi động scheduler ──────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("[BACKEND-SERVICES] Starting up")
    print(f"  ANALYSIS_INTERVAL   : {ANALYSIS_INTERVAL_SECONDS}s")
    print(f"  PREDICTION_INTERVAL : {PREDICTION_INTERVAL_SECONDS}s")
    print(f"  CLUSTERING_INTERVAL : {CLUSTERING_INTERVAL_SECONDS}s")
    print(f"  DATABASE_API_URL    : {DATABASE_API_URL}")
    print("=" * 60)

    warmup()

    now = datetime.utcnow()
    scheduler = BlockingScheduler(timezone="UTC")

    scheduler.add_job(
        job_analysis,
        "interval",
        seconds=ANALYSIS_INTERVAL_SECONDS,
        id="analysis_job",
        next_run_time=now + timedelta(seconds=10),
    )
    scheduler.add_job(
        job_prediction,
        "interval",
        seconds=PREDICTION_INTERVAL_SECONDS,
        id="prediction_job",
        next_run_time=now + timedelta(seconds=15),
    )
    scheduler.add_job(
        job_clustering,
        "interval",
        seconds=CLUSTERING_INTERVAL_SECONDS,
        id="clustering_job",
        next_run_time=now + timedelta(seconds=20),
    )

    print(f"[SCHEDULER] Analysis  every {ANALYSIS_INTERVAL_SECONDS}s")
    print(f"[SCHEDULER] Prediction every {PREDICTION_INTERVAL_SECONDS}s")
    print(f"[SCHEDULER] Clustering every {CLUSTERING_INTERVAL_SECONDS}s")
    print("[SCHEDULER] Running... (Ctrl+C to stop)")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("[SCHEDULER] Shutting down gracefully.")


if __name__ == "__main__":
    main()
