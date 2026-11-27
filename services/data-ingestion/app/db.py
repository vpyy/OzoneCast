"""
Database Client cho Data Ingestion Service.
Kết nối trực tiếp vào PostgreSQL và lưu dữ liệu trích xuất từ file HDF5.
Hỗ trợ quản lý bảng ingested_granules, lưu điểm đo L2G và tổng hợp ozone_daily.
"""

import os
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/ozone_db")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

class DatabaseClient:
    def __init__(self, db_url: Optional[str] = None):
        url = db_url or DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        self.db_url = url
        self._engine: Optional[Engine] = None

    def get_engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine(
                self.db_url,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10
            )
        return self._engine

    def wait_for_db(self, max_retries: int = 10, delay_sec: int = 3) -> bool:
        """Thử kết nối tới PostgreSQL với cơ chế retry khi DB đang khởi động."""
        print(f"[DB] Checking connection to PostgreSQL at {self.db_url}...")
        for attempt in range(1, max_retries + 1):
            try:
                engine = self.get_engine()
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                print(f"[DB OK] Connected to PostgreSQL on attempt {attempt}")
                return True
            except Exception as e:
                print(f"[DB WAIT] Attempt {attempt}/{max_retries} failed ({e}). Retrying in {delay_sec}s...")
                time.sleep(delay_sec)
        print("[DB WARN] Database not reachable after all retries. Ingestion will attempt anyway.")
        return False

    def save_granule(self, payload: Dict[str, Any]) -> bool:
        """Lưu hoặc cập nhật thông tin granule tải về."""
        stmt = text("""
            INSERT INTO granules (
                filename, file_url, satellite, instrument, product_level,
                file_size_bytes, download_status, process_status, local_path
            ) VALUES (
                :filename, :file_url, :satellite, :instrument, :product_level,
                :file_size_bytes, :download_status, :process_status, :local_path
            )
            ON CONFLICT (filename) DO UPDATE SET
                download_status = EXCLUDED.download_status,
                process_status = EXCLUDED.process_status,
                file_size_bytes = EXCLUDED.file_size_bytes;
        """)
        try:
            with self.get_engine().begin() as conn:
                conn.execute(stmt, payload)
            return True
        except Exception as e:
            print(f"[DB ERROR] save_granule failed: {e}")
            return False

    # -------------------------------------------------------------------------
    # QUẢN LÝ HÀNG ĐỢI GRANULE: ingested_granules
    # -------------------------------------------------------------------------
    def record_discovered_granule(self, payload: Dict[str, Any]) -> bool:
        """Ghi nhận granule mới phát hiện vào bảng ingested_granules với status pending."""
        stmt = text("""
            INSERT INTO ingested_granules (
                filename, observation_date, produced_at, url, status
            ) VALUES (
                :filename, :observation_date, :produced_at, :url, 'pending'
            )
            ON CONFLICT (filename) DO UPDATE SET
                produced_at = EXCLUDED.produced_at,
                url = EXCLUDED.url
            WHERE ingested_granules.status != 'done';
        """)
        try:
            with self.get_engine().begin() as conn:
                conn.execute(stmt, payload)
            return True
        except Exception as e:
            print(f"[DB ERROR] record_discovered_granule failed: {e}")
            return False

    def get_pending_granules(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Lấy danh sách granule đang pending hoặc failed dưới 3 lần để xử lý."""
        stmt = text("""
            SELECT filename, observation_date, produced_at, url, status, attempts
            FROM ingested_granules
            WHERE status = 'pending' OR (status = 'failed' AND attempts < 3)
            ORDER BY observation_date ASC, filename ASC
            LIMIT :limit;
        """)
        try:
            with self.get_engine().connect() as conn:
                result = conn.execute(stmt, {"limit": limit})
                rows = [dict(r._mapping) for r in result.fetchall()]
            return rows
        except Exception as e:
            print(f"[DB ERROR] get_pending_granules failed: {e}")
            return []

    def update_granule_status(
        self,
        filename: str,
        status: str,
        rows_inserted: int = 0,
        error: Optional[str] = None
    ) -> bool:
        """Cập nhật trạng thái xử lý của granule (done, failed, no_data_in_region)."""
        stmt = text("""
            UPDATE ingested_granules SET
                status = :status,
                rows_inserted = :rows_inserted,
                attempts = attempts + 1,
                error = :error,
                processed_at = NOW()
            WHERE filename = :filename;
        """)
        try:
            with self.get_engine().begin() as conn:
                conn.execute(stmt, {
                    "filename": filename,
                    "status": status,
                    "rows_inserted": rows_inserted,
                    "error": error
                })
            return True
        except Exception as e:
            print(f"[DB ERROR] update_granule_status failed: {e}")
            return False

    # -------------------------------------------------------------------------
    # BULK UPSERT ĐIỂM ĐO L2G VÀO raw_measurements (IDEMPOTENT)
    # -------------------------------------------------------------------------
    def save_raw_measurements_l2g_bulk(self, granule_name: str, items: List[Dict[str, Any]]) -> int:
        """Bulk UPSERT danh sách điểm đo (OMTO3/OMTO3G) đầy đủ các trường và timestamp chính xác vào raw_measurements."""
        if not items:
            return 0

        stmt = text("""
            INSERT INTO raw_measurements (
                granule_name, point_index, latitude, longitude,
                seconds_in_day, time_raw, ozone_column_raw,
                quality_flag, ground_pixel_quality_flag,
                solar_zenith_angle, radiative_cloud_fraction,
                cloud_pressure, water_fraction,
                reflectivity331, uv_aerosol_index,
                row_index, col_index, observation_index,
                created_at
            ) VALUES (
                :granule_name, :point_index, :latitude, :longitude,
                :seconds_in_day, :time_raw, :ozone_column_raw,
                :quality_flag, :ground_pixel_quality_flag,
                :solar_zenith_angle, :radiative_cloud_fraction,
                :cloud_pressure, :water_fraction,
                :reflectivity331, :uv_aerosol_index,
                :row_index, :col_index, :observation_index,
                :created_at
            )
            ON CONFLICT (granule_name, row_index, col_index, observation_index) DO UPDATE SET
                ozone_column_raw = EXCLUDED.ozone_column_raw,
                quality_flag = EXCLUDED.quality_flag,
                ground_pixel_quality_flag = EXCLUDED.ground_pixel_quality_flag,
                solar_zenith_angle = EXCLUDED.solar_zenith_angle,
                radiative_cloud_fraction = EXCLUDED.radiative_cloud_fraction,
                cloud_pressure = EXCLUDED.cloud_pressure,
                water_fraction = EXCLUDED.water_fraction,
                reflectivity331 = EXCLUDED.reflectivity331,
                uv_aerosol_index = EXCLUDED.uv_aerosol_index,
                created_at = EXCLUDED.created_at;
        """)

        prepared = []
        for it in items:
            row = dict(it)
            row["granule_name"] = granule_name
            row.setdefault("seconds_in_day", 0.0)
            row.setdefault("time_raw", 0.0)
            row.setdefault("quality_flag", 0)
            row.setdefault("ground_pixel_quality_flag", 0)
            row.setdefault("solar_zenith_angle", 0.0)
            row.setdefault("radiative_cloud_fraction", 0.0)
            row.setdefault("cloud_pressure", 0.0)
            row.setdefault("water_fraction", 0.0)
            row.setdefault("reflectivity331", 0.0)
            row.setdefault("uv_aerosol_index", 0.0)
            row.setdefault("row_index", 0)
            row.setdefault("col_index", 0)
            row.setdefault("observation_index", 0)
            row.setdefault("created_at", datetime.now(timezone.utc))
            prepared.append(row)

        try:
            with self.get_engine().begin() as conn:
                conn.execute(stmt, prepared)
            return len(prepared)
        except Exception as e:
            print(f"[DB ERROR] save_raw_measurements_l2g_bulk failed: {e}")
            return 0

    # -------------------------------------------------------------------------
    # TỔNG HỢP OZONE HÀNG NGÀY: ozone_daily
    # -------------------------------------------------------------------------
    def update_ozone_daily(self, observation_date_str: str) -> bool:
        """Tổng hợp ozone trung bình, min, max, số quan sát theo ngày vào ozone_daily."""
        # Trích xuất date từ observation_date_str: YYYY-MM-DD
        # granule_name có dạng: OMI-Aura_L2G-OMTO3G_2026m1116...
        parts = observation_date_str.split("-")
        if len(parts) == 3:
            pattern = f"%{parts[0]}m{parts[1]}{parts[2]}%"
        else:
            pattern = f"%{observation_date_str}%"

        stmt = text("""
            INSERT INTO ozone_daily (
                observation_date, avg_ozone, min_ozone, max_ozone,
                valid_observations, granules_count, updated_at
            )
            SELECT
                CAST(:obs_date AS DATE),
                ROUND(AVG(ozone_column_raw)::numeric, 2),
                ROUND(MIN(ozone_column_raw)::numeric, 2),
                ROUND(MAX(ozone_column_raw)::numeric, 2),
                COUNT(*),
                COUNT(DISTINCT granule_name),
                NOW()
            FROM raw_measurements
            WHERE (DATE(created_at) = CAST(:obs_date AS DATE) OR granule_name LIKE :pattern)
              AND row_index IS NOT NULL
              AND ozone_column_raw IS NOT NULL
              AND ozone_column_raw > 0 AND ozone_column_raw < 1000
            HAVING COUNT(*) > 0
            ON CONFLICT (observation_date) DO UPDATE SET
                avg_ozone = EXCLUDED.avg_ozone,
                min_ozone = EXCLUDED.min_ozone,
                max_ozone = EXCLUDED.max_ozone,
                valid_observations = EXCLUDED.valid_observations,
                granules_count = EXCLUDED.granules_count,
                updated_at = NOW();
        """)
        try:
            with self.get_engine().begin() as conn:
                conn.execute(stmt, {
                    "obs_date": observation_date_str,
                    "pattern": pattern
                })
            print(f"[DB OK] Đã cập nhật bảng ozone_daily cho ngày {observation_date_str}")
            return True
        except Exception as e:
            print(f"[DB ERROR] update_ozone_daily failed: {e}")
            return False

db_client = DatabaseClient()
