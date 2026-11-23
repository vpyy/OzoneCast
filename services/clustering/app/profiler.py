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

    CLUSTER_CUSTOM_PROFILES = {
        0: {
            "tag": "Cụm 1: Vùng rìa suy giảm Ozone / Thềm băng lạnh sâu",
            "characteristic": (
                "Vùng rìa suy giảm Ozone / Thềm băng lạnh sâu (Ozone thấp nhất,"
                " sát ngưỡng thủng)"
            ),
        },
        1: {
            "tag": "Cụm 2: Vùng hoàn lưu chuyển tiếp ven biển",
            "characteristic": (
                "Vùng hoàn lưu chuyển tiếp ven biển (Ven bờ đá lộ thiên / rìa"
                " ngoài bán đảo)"
            ),
        },
        2: {
            "tag": "Cụm 3: Vùng lõi thềm băng vĩnh cửu",
            "characteristic": (
                "Vùng lõi thềm băng vĩnh cửu (Độ phủ tuyết trắng cao nhất, nồng"
                " độ ozone trung bình)"
            ),
        },
        3: {
            "tag": "Cụm 4: Vùng Ozone dày / Khí quyển ổn định ven biển",
            "characteristic": (
                "Vùng Ozone dày / Khí quyển ổn định ven biển (Ozone cao nhất,"
                " khí quyển ổn định an toàn)"
            ),
        },
    }

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

        # 2. Định danh cụm chuyên biệt cho Bán đảo Nam Cực
        if cluster_id in cls.CLUSTER_CUSTOM_PROFILES:
            return cls.CLUSTER_CUSTOM_PROFILES[cluster_id]

        # 3. Phân loại theo giá trị Ozone & Độ phản xạ (Dynamic fallback)
        if mean_ozone < 255.0:
            return {
                "tag": f"Cụm {cluster_id + 1}: Vùng rìa suy giảm Ozone / Thềm băng lạnh sâu",
                "characteristic": "Vùng rìa suy giảm Ozone / Thềm băng lạnh sâu (Ozone thấp nhất, sát ngưỡng thủng)"
            }
        elif mean_ozone > 275.0:
            return {
                "tag": f"Cụm {cluster_id + 1}: Vùng Ozone dày / Khí quyển ổn định ven biển",
                "characteristic": "Vùng Ozone dày / Khí quyển ổn định ven biển (Ozone cao nhất, khí quyển ổn định an toàn)"
            }
        elif mean_refl >= 75.0:
            return {
                "tag": f"Cụm {cluster_id + 1}: Vùng lõi thềm băng vĩnh cửu",
                "characteristic": "Vùng lõi thềm băng vĩnh cửu (Độ phủ tuyết trắng cao nhất, nồng độ ozone trung bình)"
            }
        else:
            return {
                "tag": f"Cụm {cluster_id + 1}: Vùng hoàn lưu chuyển tiếp ven biển",
                "characteristic": "Vùng hoàn lưu chuyển tiếp ven biển (Ven bờ đá lộ thiên / rìa ngoài bán đảo)"
            }

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
