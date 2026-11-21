"""
Database Client cho Data Ingestion Service.
Kết nối trực tiếp vào PostgreSQL và lưu dữ liệu trích xuất từ file HDF5.
Có cơ chế retry khi Database chưa sẵn sàng.
"""

import os
import time
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/ozone_db")

class DatabaseClient:
    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or DATABASE_URL
        self._engine: Optional[Engine] = None

    def get_engine(self) -> Engine:
        if self._engine is None:
            url = self.db_url
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
            self._engine = create_engine(
                url,
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

    def save_raw_measurements_bulk(self, granule_name: str, items: List[Dict[str, Any]]) -> int:
        """Bulk insert danh sách điểm đo (đầy đủ 10 trường + pixel_index + scan_line) vào bảng raw_measurements."""
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
                pixel_index, scan_line
            ) VALUES (
                :granule_name, :point_index, :latitude, :longitude,
                :seconds_in_day, :time_raw, :ozone_column_raw,
                :quality_flag, :ground_pixel_quality_flag,
                :solar_zenith_angle, :radiative_cloud_fraction,
                :cloud_pressure, :water_fraction,
                :reflectivity331, :uv_aerosol_index,
                :pixel_index, :scan_line
            );
        """)

        # Gán thêm granule_name vào từng item nếu chưa có
        prepared = []
        for it in items:
            row = dict(it)
            row["granule_name"] = granule_name
            # Điền giá trị mặc định cho an toàn
            row.setdefault("seconds_in_day", 0.0)
            row.setdefault("time_raw", 0.0)
            row.setdefault("quality_flag", 0)
            row.setdefault("ground_pixel_quality_flag", 0)
            row.setdefault("solar_zenith_angle", 0.0)
            row.setdefault("radiative_cloud_fraction", 0.0)
            row.setdefault("cloud_pressure", 500.0)
            row.setdefault("water_fraction", 0.5)
            row.setdefault("reflectivity331", 0.0)
            row.setdefault("uv_aerosol_index", 0.0)
            row.setdefault("pixel_index", 29)
            row.setdefault("scan_line", 0)
            prepared.append(row)

        try:
            with self.get_engine().begin() as conn:
                conn.execute(stmt, prepared)
            return len(prepared)
        except Exception as e:
            print(f"[DB ERROR] save_raw_measurements_bulk failed: {e}")
            return 0

db_client = DatabaseClient()
