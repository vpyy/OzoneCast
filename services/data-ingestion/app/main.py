"""
Data Ingestion Microservice — Main Entry Point.
Nhiệm vụ:
  - Tự động Discovery các granule OMTO3G mới từ NASA OzoneAQ API (mỗi 2 giờ)
  - Xử lý hàng đợi pending granules: Tải stream, cắt vùng Bán đảo Nam Cực, lọc chất lượng
  - Ghi idempotent vào raw_measurements và tổng hợp hàng ngày vào ozone_daily
  - Quản lý trạng thái qua bảng ingested_granules
"""

import os
from datetime import datetime, date
from typing import Optional, Dict, Any

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .ingestion_service import IngestionService
from .db import db_client

app = FastAPI(
    title="Ozone Data Ingestion Microservice",
    version="2.1.0",
    description="Microservice tự động thu thập và trích xuất dữ liệu OMI OMTO3G Bán đảo Nam Cực vào PostgreSQL",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = IngestionService()

# ── Scheduler Jobs ────────────────────────────────────────────────────────────
scheduler = BackgroundScheduler()

_DISCOVERY_INTERVAL = int(os.getenv("DISCOVERY_INTERVAL_SECONDS", "7200"))
_INGESTION_INTERVAL = int(os.getenv("INGESTION_INTERVAL_SECONDS", "300"))


def scheduled_discovery_job():
    """Job định kỳ quét tìm file OMTO3G mới từ NASA OzoneAQ."""
    print(f"\n[SCHEDULER DISCOVERY] Bắt đầu quét tìm granule OMTO3G lúc {datetime.utcnow().isoformat()}")
    try:
        count = service.run_discovery()
        print(f"[SCHEDULER DISCOVERY] Hoàn tất quét. Tìm thấy {count} granule mới.")
    except Exception as e:
        print(f"[SCHEDULER DISCOVERY ERROR] Lỗi khi chạy discovery job: {e}")


def scheduled_queue_job():
    """Job định kỳ xử lý các granule đang ở trạng thái pending trong hàng đợi."""
    print(f"[SCHEDULER QUEUE] Kiểm tra hàng đợi nạp dữ liệu lúc {datetime.utcnow().isoformat()}")
    try:
        processed = service.process_pending_queue(batch_size=2)
        if processed > 0:
            print(f"[SCHEDULER QUEUE] Đã xử lý {processed} granule trong đợt này.")
        else:
            print("[SCHEDULER QUEUE] Không có granule nào cần xử lý.")
    except Exception as e:
        print(f"[SCHEDULER QUEUE ERROR] Lỗi khi xử lý hàng đợi: {e}")


scheduler.add_job(scheduled_discovery_job, "interval", seconds=_DISCOVERY_INTERVAL, id="discovery_job")
scheduler.add_job(scheduled_queue_job, "interval", seconds=_INGESTION_INTERVAL, id="queue_job")


@app.on_event("startup")
def startup_event():
    # 1. Chờ kết nối tới PostgreSQL
    db_client.wait_for_db(max_retries=10, delay_sec=3)

    # 2. Bắt đầu scheduler
    scheduler.start()
    print(f"[STARTUP] Ingestion Schedulers started: Discovery={_DISCOVERY_INTERVAL}s, Queue={_INGESTION_INTERVAL}s")

    # 3. Chạy Discovery & nạp thử nghiệm ban đầu (Warmup) trong background thread để không chặn startup
    import threading
    def initial_warmup():
        try:
            print("[STARTUP WARMUP] Chạy Discovery lần đầu khi khởi động...")
            scheduled_discovery_job()
            print("[STARTUP WARMUP] Xử lý granule đầu tiên trong hàng đợi...")
            scheduled_queue_job()
        except Exception as e:
            print(f"[STARTUP WARMUP ERROR] {e}")

    threading.Thread(target=initial_warmup, daemon=True).start()


@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()


# ── REST Endpoints ────────────────────────────────────────────────────────────

class IngestUrlRequest(BaseModel):
    file_url: Optional[str] = None

class IngestMockRequest(BaseModel):
    target_date: Optional[str] = None
    filename: Optional[str] = None

class DiscoveryRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "data-ingestion",
        "timestamp": datetime.utcnow().isoformat(),
        "scheduler_running": scheduler.running,
        "region": {
            "lat_min": service.lat_min,
            "lat_max": service.lat_max,
            "lon_min": service.lon_min,
            "lon_max": service.lon_max,
        },
        "discovery_settings": {
            "interval_seconds": _DISCOVERY_INTERVAL,
            "start_date": service.discovery_start_date
        }
    }


@app.post("/api/discovery/trigger")
def trigger_discovery(req: Optional[DiscoveryRequest] = None):
    """Kích hoạt thủ công job quét file OMTO3G từ NASA."""
    start_d = req.start_date if req and req.start_date else None
    end_d = req.end_date if req and req.end_date else None
    new_count = service.run_discovery(start_date=start_d, end_date=end_d)
    return {"status": "ok", "new_granules_discovered": new_count}


@app.post("/api/ingest/queue/process")
def trigger_queue_process():
    """Kích hoạt thủ công xử lý các granule pending trong hàng đợi."""
    processed = service.process_pending_queue(batch_size=5)
    return {"status": "ok", "processed_count": processed}


@app.post("/api/ingest/url")
def ingest_from_custom_url(req: IngestUrlRequest):
    """Nạp trực tiếp từ 1 URL cụ thể do người dùng chỉ định."""
    res = service.ingest_from_url(req.file_url)
    if not res:
        raise HTTPException(status_code=400, detail="Không thể tải hoặc xử lý file từ URL đã cung cấp")
    return res


@app.post("/api/ingest/mock")
def ingest_mock_granule(req: Optional[IngestMockRequest] = None):
    """Tạo và nạp file giả lập L2G chuẩn vùng Bán đảo Nam Cực theo ngày chỉ định."""
    t_date = req.target_date if req else None
    f_name = req.filename if req else None
    res = service.ingest_mock(target_date=t_date, filename=f_name)
    return res


@app.get("/api/granules/status")
def get_granules_status():
    """Lấy thống kê trạng thái của các granule trong hệ thống."""
    with db_client.get_engine().connect() as conn:
        from sqlalchemy import text
        res = conn.execute(text("""
            SELECT status, count(*) as count 
            FROM ingested_granules 
            GROUP BY status;
        """)).fetchall()
        daily_res = conn.execute(text("""
            SELECT observation_date, avg_ozone, min_ozone, max_ozone, valid_observations, granules_count
            FROM ozone_daily
            ORDER BY observation_date DESC
            LIMIT 10;
        """)).fetchall()

    return {
        "granule_statuses": {r._mapping["status"]: r._mapping["count"] for r in res},
        "recent_daily_summary": [dict(r._mapping) for r in daily_res]
    }
