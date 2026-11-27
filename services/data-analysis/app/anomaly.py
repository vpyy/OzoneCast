"""
OzoneCast — Ozone Anomaly Detection
Phát hiện bất thường và lỗ thủng tầng Ozone theo tiêu chuẩn WMO:
- Nồng độ < 220 DU: Lỗ thủng tầng Ozone (WMO Ozone Hole definition)
- Nồng độ < 190 DU: Suy giảm đặc biệt nghiêm trọng (Severe Ozone Depletion)
- Ước tính diện tích và vị trí tâm suy giảm
"""

from typing import List, Dict, Any
import numpy as np
import pandas as pd

from .config import (
    OZONE_HOLE_THRESHOLD_DU,
    SEVERE_OZONE_HOLE_DU,
    ANTARCTIC_LAT_MIN,
    ANTARCTIC_LAT_MAX,
    logger
)


class OzoneAnomalyDetector:
    """Phát hiện và cảnh báo các vùng suy giảm tầng ozone bất thường."""

    @staticmethod
    def detect_anomalies(grid_df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Quét các ô lưới và trích xuất danh sách bất thường:
        - Phân loại Severity: Severe (Ozone Hole) vs Warning
        - Mô tả khoa học tương ứng với vị trí địa lý (Nam Cực hay Toàn cầu)
        """
        anomalies = []
        if grid_df.empty or "ozone_column_mean" not in grid_df.columns:
            return anomalies

        low_ozone_cells = grid_df[grid_df["ozone_column_mean"] < OZONE_HOLE_THRESHOLD_DU].copy()

        for _, row in low_ozone_cells.iterrows():
            lat = float(row["lat_bin"])
            lon = float(row["lon_bin"])
            ozone_val = float(row["ozone_column_mean"])

            is_antarctic = (ANTARCTIC_LAT_MIN <= lat <= ANTARCTIC_LAT_MAX)
            region_str = "Bán đảo Nam Cực" if is_antarctic else "Toàn cầu"

            if ozone_val < SEVERE_OZONE_HOLE_DU:
                severity = "Severe (Ozone Hole)"
                desc = (f"Lỗ thủng tầng Ozone nghiêm trọng tại {region_str} ({lat}°, {lon}°): "
                        f"{ozone_val:.1f} DU (Dưới ngưỡng tới hạn 190 DU)")
            else:
                severity = "Warning"
                desc = (f"Cảnh báo suy giảm nồng độ Ozone tại {region_str} ({lat}°, {lon}°): "
                        f"{ozone_val:.1f} DU (Dưới ngưỡng WMO 220 DU)")

            anomalies.append({
                "latitude": lat,
                "longitude": lon,
                "ozone_level": ozone_val,
                "severity": severity,
                "description": desc
            })

        logger.info(f"Anomaly scan: found {len(anomalies)} depleted cells below {OZONE_HOLE_THRESHOLD_DU} DU.")
        return anomalies

    @staticmethod
    def compute_anomaly_metrics(grid_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Tính toán các chỉ số thống kê về diện tích và độ sâu của lỗ thủng Ozone:
        - Tỷ lệ diện tích bị thủng (%)
        - Nồng độ cực tiểu (Minimum DU)
        - Ước tính diện tích (km²)
        """
        if grid_df.empty or "ozone_column_mean" not in grid_df.columns:
            return {
                "anomaly_cells_count": 0,
                "total_cells_count": 0,
                "depletion_rate_percent": 0.0,
                "min_ozone_du": 0.0,
                "estimated_area_km2": 0.0
            }

        total_cells = len(grid_df)
        depleted_cells = grid_df[grid_df["ozone_column_mean"] < OZONE_HOLE_THRESHOLD_DU]
        anomaly_count = len(depleted_cells)

        # Tính diện tích ô lưới tương đối dựa theo vĩ độ:
        # 1 độ vĩ ~ 111 km, 1 độ kinh ~ 111 * cos(lat) km
        # Mỗi ô 0.5° × 0.5° diện tích = (0.5 * 111) * (0.5 * 111 * cos(radians(lat)))
        if not depleted_cells.empty:
            lats_rad = np.radians(depleted_cells["lat_bin"].values)
            cell_areas = (0.5 * 111.0) * (0.5 * 111.0 * np.cos(lats_rad))
            total_area_km2 = float(np.sum(cell_areas))
            min_du = float(depleted_cells["ozone_column_mean"].min())
        else:
            total_area_km2 = 0.0
            min_du = float(grid_df["ozone_column_mean"].min())

        return {
            "anomaly_cells_count": anomaly_count,
            "total_cells_count": total_cells,
            "depletion_rate_percent": round((anomaly_count / total_cells) * 100, 2) if total_cells > 0 else 0.0,
            "min_ozone_du": round(min_du, 2),
            "estimated_area_km2": round(total_area_km2, 1)
        }
