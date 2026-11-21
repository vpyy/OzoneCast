"""
OzoneCast — Clustering Data Preprocessor & Feature Engineering
Chuẩn bị ma trận đặc trưng cho các thuật toán phân cụm không gian:
- Trích xuất dữ liệu ô lưới từ Database API
- Chuẩn hóa phân phối (StandardScaler)
- Áp dụng trọng số đặc trưng vật lý khí quyển
- Cơ chế Fallback đối chứng khí quyển khi CSDL chưa có dữ liệu
"""

from typing import Tuple, Dict, Any, Optional
import numpy as np
import pandas as pd
import requests
from sklearn.preprocessing import StandardScaler

from .config import (
    DATABASE_API_URL,
    FEATURE_COLUMNS,
    FEATURE_WEIGHTS,
    logger
)


class ClusteringPreprocessor:
    """Module trích xuất và tiền xử lý dữ liệu cho phân cụm."""

    @staticmethod
    def fetch_grid_data(limit: int = 1500) -> pd.DataFrame:
        """Truy xuất dữ liệu ô lưới 0.5° × 0.5° từ Database API."""
        url = f"{DATABASE_API_URL}/api/grid-summary?limit={limit}"
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) >= 4:
                    df = pd.DataFrame(data)
                    logger.info(f"Retrieved {len(df)} grid cells from database-api for clustering.")
                    return df
            else:
                logger.warning(f"Failed to fetch grid data from {url}: status {resp.status_code}")
        except Exception as e:
            logger.warning(f"Could not connect to database-api for grid data ({e})")

        # Fallback dữ liệu mô phỏng khí quyển chuẩn WMO
        logger.info("Using standard synthetic atmospheric dataset for clustering initialization.")
        return ClusteringPreprocessor.generate_synthetic_atmospheric_grid(n_points=350)

    @classmethod
    def prepare_feature_matrix(
        cls,
        df: pd.DataFrame,
        weights: Optional[Dict[str, float]] = None
    ) -> Tuple[np.ndarray, StandardScaler, pd.DataFrame]:
        """
        Chuẩn bị ma trận đặc trưng X đã được chuẩn hóa và áp trọng số.
        Trả về (X_scaled, scaler, processed_df).
        """
        work_df = df.copy()

        # Đảm bảo có đầy đủ các cột đặc trưng cần thiết
        if "reflectivity_mean" not in work_df.columns:
            # Ước lượng độ phản xạ dựa theo vĩ độ (vùng cực băng tuyết có phản xạ cao)
            work_df["reflectivity_mean"] = 18.0 + 35.0 * (np.abs(work_df["lat_bin"]) / 70.0) ** 2
        if "lat_bin" not in work_df.columns and "latitude" in work_df.columns:
            work_df["lat_bin"] = work_df["latitude"]
        if "lon_bin" not in work_df.columns and "longitude" in work_df.columns:
            work_df["lon_bin"] = work_df["longitude"]
        if "ozone_column_mean" not in work_df.columns and "ozone_column_raw" in work_df.columns:
            work_df["ozone_column_mean"] = work_df["ozone_column_raw"]

        # Ép kiểu dữ liệu số
        for col in FEATURE_COLUMNS:
            work_df[col] = pd.to_numeric(work_df[col], errors="coerce").fillna(0.0)

        feature_matrix = work_df[FEATURE_COLUMNS].values

        # Chuẩn hóa StandardScaler (mean=0, std=1)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(feature_matrix)

        # Áp dụng trọng số đặc trưng nếu có cấu hình
        w_dict = weights or FEATURE_WEIGHTS
        weight_vector = np.array([w_dict.get(col, 1.0) for col in FEATURE_COLUMNS])
        X_weighted = X_scaled * weight_vector

        return X_weighted, scaler, work_df

    @staticmethod
    def generate_synthetic_atmospheric_grid(n_points: int = 350) -> pd.DataFrame:
        """
        Sinh bộ dữ liệu lưới không gian đại diện chân thực cho 4 vùng khí quyển:
        1. Vùng Nam Cực có lỗ thủng Ozone (Lat < -55°, Ozone < 220 DU, Refl cao)
        2. Vùng Băng tuyết Bắc Cực (Lat > 55°, Ozone cao, Refl > 50%)
        3. Vùng Xích đạo / Nhiệt đới (|Lat| < 23.5°, Ozone trung bình, Refl 10-25%)
        4. Vùng Ôn đới (|Lat| 23.5° - 55°, Ozone dày, Refl thông thường)
        """
        np.random.seed(42)
        records = []

        # Chia tỷ lệ số điểm theo 4 vùng
        n_polar_s = max(2, int(n_points * 0.23))
        n_polar_n = max(2, int(n_points * 0.20))
        n_tropics = max(2, int(n_points * 0.28))
        n_mid = max(2, n_points - (n_polar_s + n_polar_n + n_tropics))
        lat_s = np.random.uniform(-90.0, -56.0, n_polar_s)
        lon_s = np.random.uniform(-180.0, 180.0, n_polar_s)
        o3_s = np.clip(165.0 + np.random.normal(0, 18, n_polar_s), 110, 218)
        refl_s = np.clip(55.0 + np.random.normal(0, 10, n_polar_s), 35, 95)
        for i in range(n_polar_s):
            records.append({
                "lat_bin": round(float(lat_s[i]), 2),
                "lon_bin": round(float(lon_s[i]), 2),
                "ozone_column_mean": round(float(o3_s[i]), 2),
                "reflectivity_mean": round(float(refl_s[i]), 2)
            })

        # 2. Vùng Băng tuyết Bắc Cực
        lat_n = np.random.uniform(56.0, 85.0, n_polar_n)
        lon_n = np.random.uniform(-180.0, 180.0, n_polar_n)
        o3_n = np.clip(370.0 + np.random.normal(0, 25, n_polar_n), 310, 480)
        refl_n = np.clip(62.0 + np.random.normal(0, 12, n_polar_n), 45, 98)
        for i in range(n_polar_n):
            records.append({
                "lat_bin": round(float(lat_n[i]), 2),
                "lon_bin": round(float(lon_n[i]), 2),
                "ozone_column_mean": round(float(o3_n[i]), 2),
                "reflectivity_mean": round(float(refl_n[i]), 2)
            })

        # 3. Vùng Xích đạo / Nhiệt đới
        lat_t = np.random.uniform(-23.0, 23.0, n_tropics)
        lon_t = np.random.uniform(-180.0, 180.0, n_tropics)
        o3_t = np.clip(265.0 + np.random.normal(0, 12, n_tropics), 235, 290)
        refl_t = np.clip(18.0 + np.random.normal(0, 5, n_tropics), 8, 32)
        for i in range(n_tropics):
            records.append({
                "lat_bin": round(float(lat_t[i]), 2),
                "lon_bin": round(float(lon_t[i]), 2),
                "ozone_column_mean": round(float(o3_t[i]), 2),
                "reflectivity_mean": round(float(refl_t[i]), 2)
            })

        # 4. Vùng Ôn đới
        half_mid = n_mid // 2
        lat_m = np.concatenate([
            np.random.uniform(24.0, 54.0, half_mid),
            np.random.uniform(-54.0, -24.0, n_mid - half_mid)
        ])
        lon_m = np.random.uniform(-180.0, 180.0, n_mid)
        o3_m = np.clip(330.0 + np.random.normal(0, 20, n_mid), 285, 420)
        refl_m = np.clip(25.0 + np.random.normal(0, 7, n_mid), 12, 42)
        for i in range(n_mid):
            records.append({
                "lat_bin": round(float(lat_m[i]), 2),
                "lon_bin": round(float(lon_m[i]), 2),
                "ozone_column_mean": round(float(o3_m[i]), 2),
                "reflectivity_mean": round(float(refl_m[i]), 2)
            })

        return pd.DataFrame(records)
