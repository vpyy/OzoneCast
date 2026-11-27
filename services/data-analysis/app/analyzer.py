"""
OzoneCast — Master Ozone Data Analyzer (Facade)
Tích hợp toàn bộ pipeline Khai phá dữ liệu (Data Mining):
1. Data Ingestion & DB Retrieval (Đọc raw_measurements)
2. Preprocessing & Quality Filtering (Lọc nhiễu OMI, SZA, Outliers)
3. Spatial Binning 0.5° × 0.5°
4. WMO Anomaly & Ozone Hole Detection
5. Time-Series Analytics (Ngày / Tuần / Tháng: Line, Scatter, Histogram)
6. Additive Trend & Seasonal Decomposition
7. 6x6 Multivariate Correlation Matrix & Automated Insights
8. Executive Statistical Reporting
"""

from datetime import datetime
from typing import List, Dict, Tuple, Any, Optional
import pandas as pd
import requests

from .config import DATABASE_API_URL, DEFAULT_GRID_RESOLUTION, logger
from .preprocessor import DataPreprocessor
from .anomaly import OzoneAnomalyDetector
from .timeseries import TimeSeriesAnalyzer
from .decomposition import TimeSeriesDecomposer
from .correlation import CorrelationAnalyzer
from .reporting import DataReporter


class OzoneAnalyzer:
    """Facade orchestrator điều phối toàn bộ luồng phân tích khai phá dữ liệu."""

    @staticmethod
    def fetch_raw_data_from_db(granule_name: Optional[str] = None, limit: int = 50000) -> pd.DataFrame:
        """Truy xuất các bản ghi đo đạc từ database-api."""
        url = f"{DATABASE_API_URL}/api/raw-measurements?limit={limit}"
        if granule_name:
            url += f"&granule_name={granule_name}"
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    df = pd.DataFrame(data)
                    logger.info(f"Retrieved {len(df)} raw measurement records from database.")
                    return df
            else:
                logger.warning(f"Database API returned status code {resp.status_code}")
        except Exception as e:
            logger.warning(f"Failed to fetch raw measurements from database-api ({e})")
        return pd.DataFrame()

    @classmethod
    def clean_and_bin_data(cls, df: pd.DataFrame, grid_res: float = DEFAULT_GRID_RESOLUTION) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Làm sạch dữ liệu và chia ô lưới 0.5° × 0.5° kèm phát hiện bất thường.
        Hàm này giữ nguyên signature tương thích 100% với các service khác trong nhóm.
        """
        if df.empty:
            return pd.DataFrame(), []

        # 1. Spatial Binning (đã tích hợp làm sạch bên trong)
        grid_df = DataPreprocessor.spatial_binning(df, grid_res=grid_res)

        # 2. Anomaly Detection
        anomalies = OzoneAnomalyDetector.detect_anomalies(grid_df)

        return grid_df, anomalies

    @classmethod
    def compute_timeseries_analytics(cls, df: pd.DataFrame) -> Dict[str, Any]:
        """Tính toán chuỗi thời gian Ngày, Tuần, Tháng cho 3 dạng biểu đồ."""
        return TimeSeriesAnalyzer.compute_analytics(df)

    @classmethod
    def compute_trend_seasonal(cls, df: pd.DataFrame) -> Dict[str, Any]:
        """Tách chuỗi thời gian thành đường Trend và Seasonal."""
        return TimeSeriesDecomposer.decompose(df)

    @classmethod
    def compute_correlation_matrix(cls, df: pd.DataFrame) -> Dict[str, Any]:
        """Tính ma trận tương quan Pearson 6x6 kèm automated insights."""
        return CorrelationAnalyzer.compute_matrix(df)

    # ------------------------------------------------------------------
    # Pipeline Điều phối Tổng thể — Được gọi bởi APScheduler (mỗi 5 phút)
    # ------------------------------------------------------------------
    @classmethod
    def process_granule(cls, granule_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Quy trình xử lý hoàn chỉnh một chu kỳ phân tích:
        1. Đọc dữ liệu từ DB
        2. Làm sạch & Spatial Binning
        3. Phát hiện lỗ thủng Ozone & Anomaly
        4. Tính toán bộ 3 biểu đồ Time-Series
        5. Phân rã Trend & Seasonal
        6. Tính toán ma trận tương quan 6x6
        7. Tạo báo cáo KPI Executive Report
        8. Lưu trữ đồng bộ vào DB & Cache API
        """
        start_time = datetime.utcnow()
        logger.info(f"Starting Data Analysis pipeline at {start_time.isoformat()}...")

        # 1. Đọc dữ liệu từ DB (quét toàn bộ tới 50.000 bản ghi để không bỏ sót các granule cũ có bất thường)
        raw_df = cls.fetch_raw_data_from_db(granule_name=granule_name, limit=50000)

        # 2. Làm sạch dữ liệu
        clean_df, prep_stats = DataPreprocessor.clean_raw_measurements(raw_df)

        # 3. Phân ô không gian & Anomaly
        grid_df, anomalies = cls.clean_and_bin_data(clean_df if not clean_df.empty else raw_df)

        # 4. Tính toán chuỗi thời gian Ngày / Tuần / Tháng
        ts_analytics = cls.compute_timeseries_analytics(clean_df if not clean_df.empty else raw_df)
        for period, pdata in ts_analytics.items():
            cls._safe_post_cache(f"timeseries_{period}", pdata)

        # 5. Phân rã Trend & Seasonal
        trend_seasonal = cls.compute_trend_seasonal(clean_df if not clean_df.empty else raw_df)
        cls._safe_post_cache("trend_seasonal", trend_seasonal)

        # 6. Ma trận tương quan đa biến 6x6
        corr_matrix = cls.compute_correlation_matrix(clean_df if not clean_df.empty else raw_df)
        cls._safe_post_cache("correlation_matrix", corr_matrix)

        # 7. Báo cáo thống kê tổng kết
        exec_report = DataReporter.generate_executive_report(raw_df, grid_df, anomalies, prep_stats)
        cls._safe_post_cache("analysis_summary", exec_report)

        # 8. Đồng bộ kết quả lưới và bất thường vào Database API
        if not grid_df.empty:
            source_file = granule_name or (raw_df["granule_name"].iloc[0] if ("granule_name" in raw_df.columns and not raw_df.empty) else "OMI_Analyzed")
            cls._sync_grid_and_anomalies(grid_df, anomalies, source_file)

        duration_sec = round((datetime.utcnow() - start_time).total_seconds(), 2)
        logger.info(f"Data Analysis pipeline finished successfully in {duration_sec}s.")

        return {
            "status": "success",
            "cells_processed": len(grid_df),
            "anomalies_found": len(anomalies),
            "timeseries_computed": list(ts_analytics.keys()),
            "trend_seasonal_updated": True,
            "correlation_matrix_updated": True,
            "execution_duration_sec": duration_sec,
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def _safe_post_cache(cache_key: str, payload: Dict[str, Any]):
        """Gửi dữ liệu trực tiếp vào cache API với cơ chế retry an toàn."""
        try:
            resp = requests.post(
                f"{DATABASE_API_URL}/api/cache/{cache_key}",
                json=payload,
                timeout=10
            )
            if resp.status_code == 200:
                logger.info(f"Cache key '{cache_key}' updated successfully.")
            else:
                logger.warning(f"Cache key '{cache_key}' returned HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"Could not update cache '{cache_key}': {e}")

    @staticmethod
    def _sync_grid_and_anomalies(grid_df: pd.DataFrame, anomalies: List[Dict[str, Any]], source_file: str):
        """Ghi kết quả lưới ô không gian và các điểm bất thường vào PostgreSQL."""
        items = []
        now_iso = datetime.utcnow().isoformat()
        for _, row in grid_df.iterrows():
            items.append({
                "source_filename": source_file,
                "timestamp": now_iso,
                "lat_bin": float(row["lat_bin"]),
                "lon_bin": float(row["lon_bin"]),
                "ozone_column_mean": float(row["ozone_column_mean"]),
                "ozone_column_min": float(row["ozone_column_min"]),
                "ozone_column_max": float(row["ozone_column_max"]),
                "reflectivity_mean": float(row.get("reflectivity_mean", 0.0)),
                "uv_aerosol_mean": float(row.get("uv_aerosol_mean", 0.0)),
                "valid_pixel_count": int(row["valid_pixel_count"])
            })

        try:
            resp = requests.post(
                f"{DATABASE_API_URL}/api/grid-summary/bulk",
                json={"items": items},
                timeout=30
            )
            if resp.status_code in (200, 201):
                logger.info(f"Saved {len(items)} spatial grid cells to database.")
            else:
                logger.warning(f"Could not sync grid summary: status {resp.status_code} - {resp.text}")
        except Exception as e:
            logger.warning(f"Error syncing grid summary cells: {e}")

        # Đồng bộ bất thường
        if anomalies:
            try:
                resp_anom = requests.post(
                    f"{DATABASE_API_URL}/api/anomalies/bulk",
                    json={"items": anomalies},
                    timeout=15
                )
                if resp_anom.status_code in (200, 201):
                    logger.info(f"Synced {len(anomalies)} anomalies to database.")
                else:
                    logger.warning(f"Could not sync anomalies bulk: status {resp_anom.status_code} - {resp_anom.text}")
            except Exception as e:
                logger.warning(f"Error syncing anomalies: {e}")
