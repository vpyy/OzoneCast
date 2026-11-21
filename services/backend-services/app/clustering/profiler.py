"""
OzoneCast — Cluster Profiling & Atmospheric Interpretation
Nhận diện và gán nhãn đặc trưng khí quyển / bề mặt cho từng cụm phân loại.
Các từ khóa bắt buộc khớp với bộ phân loại màu Badge của giao diện Frontend:
- 'suy giảm' / 'thủng'    -> Badge Đỏ (Rose)
- 'băng tuyết' / 'mây'    -> Badge Xanh ngọc (Cyan)
- 'nhiệt đới' / 'xích đạo' -> Badge Hổ phách (Amber)
- Vùng thông thường       -> Badge Xanh lá (Emerald)
"""

from typing import Dict, Any, List
import pandas as pd

from .config import (
    OZONE_HOLE_THRESHOLD_DU,
    HIGH_REFLECTIVITY_THRESHOLD,
    POLAR_LAT_THRESHOLD,
    EQUATORIAL_LAT_THRESHOLD
)


class ClusterProfiler:
    """Module định danh và trích xuất hồ sơ khí quyển cho các cụm dữ liệu."""

    @classmethod
    def interpret_cluster(
        cls,
        mean_ozone: float,
        mean_refl: float,
        mean_lat: float,
        cluster_id: int
    ) -> Dict[str, str]:
        """
        Phân loại đặc trưng khoa học dựa trên giá trị trung tâm cụm (centroid).
        Trả về dict gồm 'tag' và 'characteristic'.
        """
        # 1. Điểm nhiễu từ thuật toán mật độ DBSCAN
        if cluster_id == -1:
            return {
                "tag": "Nhiễu / Dị biệt (Outlier Noise)",
                "characteristic": "Vùng dị biệt mật độ / Nhiễu quan trắc vệ tinh (DBSCAN Noise)"
            }

        # 2. Vùng suy giảm / Lỗ thủng tầng Ozone (< 220 DU theo chuẩn WMO)
        if mean_ozone < OZONE_HOLE_THRESHOLD_DU:
            characteristic = "Vùng suy giảm / Lỗ thủng Ozone (Ozone < 220 DU)"
            tag = f"Cụm {cluster_id + 1}: Vùng suy giảm / Lỗ thủng Ozone"
            return {"tag": tag, "characteristic": characteristic}

        # 3. Vùng mây dày đối lưu hoặc băng tuyết cực (độ phản xạ cao > 50% hoặc vùng cực phản xạ > 40%)
        if mean_refl >= HIGH_REFLECTIVITY_THRESHOLD or (abs(mean_lat) >= POLAR_LAT_THRESHOLD and mean_refl >= 35.0):
            characteristic = "Vùng mây dày / Băng tuyết cực (Độ phản xạ cao > 50%)"
            tag = f"Cụm {cluster_id + 1}: Vùng mây dày / Băng tuyết cực"
            return {"tag": tag, "characteristic": characteristic}

        # 4. Vùng nhiệt đới / Xích đạo (vĩ độ thấp |lat| < 23.5°)
        if abs(mean_lat) <= EQUATORIAL_LAT_THRESHOLD:
            characteristic = "Vùng nhiệt đới / Xích đạo (Bức xạ cao, phản xạ trung bình)"
            tag = f"Cụm {cluster_id + 1}: Vùng nhiệt đới / Xích đạo"
            return {"tag": tag, "characteristic": characteristic}

        # 5. Vùng bề mặt / Khí quyển ôn đới thông thường
        characteristic = "Vùng bề mặt / Khí quyển thông thường"
        tag = f"Cụm {cluster_id + 1}: Vùng bề mặt / Khí quyển thông thường"
        return {"tag": tag, "characteristic": characteristic}

    @classmethod
    def summarize_clusters(cls, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Tổng hợp thống kê chi tiết từng cụm phục vụ báo cáo Data Mining."""
        profiles = []
        if df.empty or "cluster_id" not in df.columns:
            return profiles

        unique_cids = sorted(df["cluster_id"].unique())
        for cid in unique_cids:
            sub = df[df["cluster_id"] == cid]
            mean_o3 = float(sub["ozone_column_mean"].mean())
            min_o3 = float(sub["ozone_column_mean"].min())
            max_o3 = float(sub["ozone_column_mean"].max())
            mean_refl = float(sub["reflectivity_mean"].mean())
            mean_lat = float(sub["lat_bin"].mean())
            mean_lon = float(sub["lon_bin"].mean())

            info = cls.interpret_cluster(mean_o3, mean_refl, mean_lat, int(cid))

            profiles.append({
                "cluster_id": int(cid),
                "point_count": len(sub),
                "percentage": round((len(sub) / len(df)) * 100, 2),
                "tag": info["tag"],
                "characteristic": info["characteristic"],
                "centroid": {
                    "latitude": round(mean_lat, 2),
                    "longitude": round(mean_lon, 2),
                    "ozone_mean_du": round(mean_o3, 2),
                    "ozone_min_du": round(min_o3, 2),
                    "ozone_max_du": round(max_o3, 2),
                    "reflectivity_mean_pct": round(mean_refl, 2)
                }
            })
        return profiles
