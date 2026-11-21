"""
Data Ingestion Microservice — Main Entry Point.
Nhiệm vụ:
  - Tải file HDF5/HE5 từ URL NASA (hoặc NASA CMR, hoặc mock)
  - Trích xuất đầy đủ 10 trường dữ liệu (Ozone, Tọa độ, Thời gian, Cờ lỗi, Mây, Góc MT, Nước/Băng)
  - Lưu trực tiếp vào cơ sở dữ liệu PostgreSQL (có cơ chế retry kết nối)
  - Chạy theo chu kỳ định kỳ cấu hình qua INGESTION_INTERVAL_SECONDS (mặc định 300s = 5 phút)
"""

import os
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .ingestion_service import IngestionService, DEFAULT_DATA_URL
from .db import db_client

app = FastAPI(
    title="Ozone Data Ingestion Microservice",
    version="2.0.0",
    description="Microservice nạp & trích xuất 10 trường dữ liệu OMI HDF5/HE5 từ NASA vào PostgreSQL",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = IngestionService()

# ── Scheduled job: Chu kỳ chạy định kỳ ─────────────────────────────────────────
def scheduled_ingest():
    print(f"[SCHEDULER] data-ingestion triggered at {datetime.utcnow().isoformat()}")
    result = service.scheduled_run()
    print(f"[SCHEDULER] Ingest complete: {result.get('filename')} (saved: {result.get('saved_to_db', 0)} points)")


_INTERVAL_SECONDS = int(os.getenv("INGESTION_INTERVAL_SECONDS", "300"))
scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_ingest, "interval", seconds=_INTERVAL_SECONDS, id="ingest_job")


@app.on_event("startup")
def startup_event():
    # 1. Chờ kết nối tới PostgreSQL
    db_client.wait_for_db(max_retries=10, delay_sec=2)

    # 2. Bắt đầu scheduler
    scheduler.start()
    print(f"[STARTUP] Ingestion scheduler started — runs every {_INTERVAL_SECONDS}s (INGESTION_INTERVAL_SECONDS)")

    # 3. Chạy nạp thử nghiệm ban đầu trong background thread để không chặn Event Loop của Uvicorn
    import threading
    def _warmup():
        try:
            print("[STARTUP WARMUP] Triggering initial data ingestion in background...")
            service.scheduled_run()
        except Exception as e:
            print(f"[STARTUP WARMUP ERROR] {e}")

    threading.Thread(target=_warmup, daemon=True).start()


@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()


# ── REST Endpoints (Trigger & Kiểm tra thủ công) ───────────────────────────────

class IngestRequest(BaseModel):
    source_type: str = "url"  # "url" | "mock"
    file_url: Optional[str] = None
    filename: Optional[str] = None

class IngestUrlRequest(BaseModel):
    file_url: Optional[str] = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "data-ingestion",
        "timestamp": datetime.utcnow().isoformat(),
        "scheduler_running": scheduler.running,
        "default_target_url": DEFAULT_DATA_URL,
        "supported_fields": [
            "ColumnAmountO3", "Latitude", "Longitude", "SecondsInDay",
            "QualityFlags", "GroundPixelQualityFlags", "SolarZenithAngle",
            "RadiativeCloudFraction", "CloudPressure", "WaterFraction"
        ]
    }


@app.post("/api/ingest/url")
def ingest_from_custom_url(req: IngestUrlRequest):
    """Nạp và trích xuất dữ liệu trực tiếp từ URL file HDF5/HE5 do người dùng cung cấp."""
    target_url = req.file_url or DEFAULT_DATA_URL
    result = service.ingest_from_url(target_url)
    if not result or "error" in result:
        detail_msg = result.get("error") if result else f"Không thể tải hoặc đọc file từ {target_url}"
        raise HTTPException(status_code=502, detail=detail_msg)
    return {"status": "success", "mode": "custom_url", "result": result}


@app.post("/api/ingest/mock")
def ingest_mock_direct(filename: Optional[str] = None):
    """Tạo granule giả lập có đủ 10 trường và ghi trực tiếp vào PostgreSQL."""
    result = service.ingest_mock(filename)
    return {"status": "success", "mode": "mock", "result": result}


@app.post("/api/ingest")
def trigger_ingest(req: IngestRequest, background_tasks: BackgroundTasks):
    """Kích hoạt nạp dữ liệu thủ công."""
    if req.source_type == "url":
        target = req.file_url or DEFAULT_DATA_URL
        result = service.ingest_from_url(target)
        if not result or "error" in result:
            result = service.ingest_mock(req.filename)
            return {"status": "success", "mode": "fallback_mock", "result": result}
        return {"status": "success", "mode": "url", "result": result}
    else:
        result = service.ingest_mock(req.filename)
        return {"status": "success", "mode": "mock", "result": result}
