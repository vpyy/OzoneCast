"""
OzoneCast — Executive Data Mining & Statistical Reporting
Tổng hợp báo cáo thống kê mô tả (Descriptive Statistics) và KPIs tầng Ozone:
- Các phân vị (Percentiles: P10, P25, P50, P75, P90, IQR)
- So sánh đối chứng vùng Bán đảo Nam Cực vs Toàn cầu
- Tỷ lệ suy giảm và chỉ số sức khỏe tầng Ozone
"""

from datetime import datetime
from typing import Dict, Any, List
import numpy as np
import pandas as pd

from .config import (
    OZONE_HOLE_THRESHOLD_DU,
    ANTARCTIC_LAT_MIN,
    ANTARCTIC_LAT_MAX,
    logger
)


class DataReporter:
    """Tạo báo cáo thống kê mô tả chuyên sâu phục vụ nghiên cứu và đánh giá."""

    @staticmethod
    def generate_executive_report(
        raw_df: pd.DataFrame,
        grid_df: pd.DataFrame,
        anomalies: List[Dict[str, Any]],
        preprocessing_stats: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Tạo báo cáo KPI tổng hợp từ dữ liệu quan trắc."""
        o3_series = raw_df["ozone_column_raw"] if not raw_df.empty and "ozone_column_raw" in raw_df.columns else pd.Series([290.0])

        # Tính toán phân vị
        p10 = float(np.percentile(o3_series, 10))
        p25 = float(np.percentile(o3_series, 25))
        p50 = float(np.percentile(o3_series, 50))
        p75 = float(np.percentile(o3_series, 75))
        p90 = float(np.percentile(o3_series, 90))
        iqr = round(p75 - p25, 2)

        # Phân tích theo vùng Nam Cực
        antarctic_cells = grid_df[grid_df["lat_bin"].between(ANTARCTIC_LAT_MIN, ANTARCTIC_LAT_MAX)] if not grid_df.empty else pd.DataFrame()
        antarctic_mean = round(float(antarctic_cells["ozone_column_mean"].mean()), 2) if not antarctic_cells.empty else 0.0

        # Đánh giá mức độ an toàn sức khỏe
        if antarctic_mean > 0 and antarctic_mean < OZONE_HOLE_THRESHOLD_DU:
            overall_status = "CẢNH BÁO LỖ THỦNG OZONE NAM CỰC"
            status_level = "critical"
        else:
            overall_status = "ỔN ĐỊNH BÌNH THƯỜNG"
            status_level = "normal"

        report = {
            "title": "Báo cáo Khai phá Dữ liệu & Giám sát Khí quyển OzoneCast",
            "timestamp": datetime.utcnow().isoformat(),
            "status": overall_status,
            "status_level": status_level,
            "summary_metrics": {
                "total_raw_points": len(raw_df),
                "total_grid_cells": len(grid_df),
                "anomalies_detected": len(anomalies),
                "clean_retention_rate": round(
                    (preprocessing_stats.get("clean_rows", 0) / preprocessing_stats.get("initial_rows", 1)) * 100, 1
                ) if preprocessing_stats.get("initial_rows", 0) > 0 else 100.0
            },
            "descriptive_statistics": {
                "mean_du": round(float(o3_series.mean()), 2),
                "std_dev_du": round(float(o3_series.std()), 2) if len(o3_series) > 1 else 0.0,
                "median_du": round(p50, 2),
                "min_du": round(float(o3_series.min()), 2),
                "max_du": round(float(o3_series.max()), 2),
                "iqr_du": iqr,
                "percentiles": {
                    "p10": round(p10, 2),
                    "p25": round(p25, 2),
                    "p50": round(p50, 2),
                    "p75": round(p75, 2),
                    "p90": round(p90, 2)
                }
            },
            "regional_breakdown": {
                "antarctic_cells_count": len(antarctic_cells),
                "antarctic_mean_ozone_du": antarctic_mean,
                "antarctic_is_depleted": bool(antarctic_mean < OZONE_HOLE_THRESHOLD_DU and antarctic_mean > 0)
            }
        }

        logger.info("Executive statistical report generated.")
        return report
