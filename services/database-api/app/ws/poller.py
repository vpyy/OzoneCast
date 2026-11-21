import asyncio
import logging
from datetime import datetime
from sqlalchemy import text
from ..config import WS_POLL_INTERVAL_SECONDS
from ..db import SessionLocal
from .manager import manager

logger = logging.getLogger("ozone.ws.poller")

def get_db_snapshot() -> dict:
    """Đọc snapshot mới nhất từ PostgreSQL (chỉ SELECT)."""
    db = SessionLocal()
    try:
        stats_query = text("""
            SELECT 
                (SELECT count(*) FROM granules) AS total_granules,
                (SELECT count(*) FROM raw_measurements) AS total_raw_measurements,
                (SELECT count(*) FROM ozone_grid_summary) AS total_grid_cells,
                COALESCE((SELECT round(avg(ozone_column_raw)::numeric, 2) FROM raw_measurements WHERE ozone_column_raw IS NOT NULL), 290.0) AS avg_ozone_du,
                COALESCE((SELECT round(min(ozone_column_raw)::numeric, 2) FROM raw_measurements WHERE ozone_column_raw IS NOT NULL), 180.0) AS min_ozone_du,
                COALESCE((SELECT round(max(ozone_column_raw)::numeric, 2) FROM raw_measurements WHERE ozone_column_raw IS NOT NULL), 450.0) AS max_ozone_du,
                (SELECT count(*) FROM ozone_anomalies) AS anomalies_detected,
                (SELECT max(id) FROM raw_measurements) AS last_raw_id,
                (SELECT max(timestamp) FROM ozone_grid_summary) AS last_grid_time
        """)
        row = db.execute(stats_query).fetchone()
        if not row:
            return {}

        return {
            "total_granules": int(row.total_granules or 0),
            "total_raw_measurements": int(row.total_raw_measurements or 0),
            "total_grid_cells": int(row.total_grid_cells or 0),
            "avg_ozone_du": float(row.avg_ozone_du or 290.0),
            "min_ozone_du": float(row.min_ozone_du or 180.0),
            "max_ozone_du": float(row.max_ozone_du or 450.0),
            "anomalies_detected": int(row.anomalies_detected or 0),
            "last_raw_id": int(row.last_raw_id or 0),
            "last_grid_time": row.last_grid_time.isoformat() if row.last_grid_time else None,
            "last_updated": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"[WS POLLER DB ERROR] {e}")
        return {}
    finally:
        db.close()


async def ws_background_poller():
    """Vòng lặp nền kiểm tra dữ liệu mới trong DB và phát WebSocket tới client."""
    logger.info(f"[WS POLLER] Started background poller with interval {WS_POLL_INTERVAL_SECONDS}s")
    last_known_raw_id = -1
    last_known_grid_time = None

    # Lấy trạng thái ban đầu
    initial_snapshot = get_db_snapshot()
    last_known_raw_id = initial_snapshot.get("last_raw_id", 0)
    last_known_grid_time = initial_snapshot.get("last_grid_time")

    while True:
        try:
            await asyncio.sleep(WS_POLL_INTERVAL_SECONDS)
            snapshot = get_db_snapshot()
            current_raw_id = snapshot.get("last_raw_id", 0)
            current_grid_time = snapshot.get("last_grid_time")

            has_new_data = (
                current_raw_id > last_known_raw_id or
                current_grid_time != last_known_grid_time
            )

            if has_new_data:
                logger.info(f"[WS POLLER] New data detected (raw_id: {last_known_raw_id}->{current_raw_id}) — broadcasting...")
                last_known_raw_id = current_raw_id
                last_known_grid_time = current_grid_time

                message = {
                    "type": "update",
                    "channel": "stream",
                    "data": snapshot,
                    "server_time": datetime.utcnow().isoformat()
                }
                await manager.broadcast_all(message)
            else:
                # Gửi heartbeat định kỳ để giữ kết nối không bị timeout bởi proxy/NAT
                heartbeat = {
                    "type": "heartbeat",
                    "channel": "stream",
                    "server_time": datetime.utcnow().isoformat()
                }
                await manager.broadcast_all(heartbeat)

        except asyncio.CancelledError:
            logger.info("[WS POLLER] Background poller cancelled.")
            break
        except Exception as e:
            logger.error(f"[WS POLLER ERROR] {e}")
            await asyncio.sleep(5)
