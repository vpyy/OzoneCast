"""
OzoneCast — Atmospheric Feature Engineering
Trích xuất và mã hóa đặc trưng không gian, thời gian và khí quyển:
- Mã hóa chu kỳ thời gian (Cyclic Encoding: sin/cos Day of Year)
- Chuyển đổi tọa độ cầu địa lý (sin/cos/abs Latitude & Longitude)
- Ước tính proxy vật lý cho Góc thiên đỉnh mặt trời (SZA) và Độ phản xạ (Reflectivity)
"""

from typing import Optional
import numpy as np
import pandas as pd

from .config import FEATURE_NAMES


class FeatureEngineer:
    """Module trích xuất ma trận đặc trưng cho các mô hình AI dự báo."""

    @classmethod
    def extract_features(cls, df: pd.DataFrame) -> pd.DataFrame:
        """
        Trích xuất đầy đủ 13 đặc trưng đầu vào phục vụ mô hình máy học.
        """
        work_df = df.copy()

        # 1. Tọa độ địa lý cơ bản
        lats = work_df["lat"].values
        lons = work_df["lon"].values

        work_df["abs_lat"] = np.abs(lats)
        work_df["sin_lat"] = np.sin(np.deg2rad(lats))
        work_df["cos_lat"] = np.cos(np.deg2rad(lats))
        work_df["sin_lon"] = np.sin(np.deg2rad(lons))
        work_df["cos_lon"] = np.cos(np.deg2rad(lons))

        # 2. Xử lý thời gian và mã hóa chu kỳ ngày trong năm (Cyclic encoding)
        if "timestamp" in work_df.columns:
            ts_series = pd.to_datetime(work_df["timestamp"], errors="coerce")
        else:
            ts_series = pd.Series([pd.Timestamp.now()] * len(work_df), index=work_df.index)

        doy = getattr(ts_series.dt, "day_of_year", None)
        if doy is None:
            doy = ts_series.dt.dayofyear
        work_df["day_of_year"] = doy.fillna(180).astype(int)
        work_df["month"] = ts_series.dt.month.fillna(6).astype(int)

        # Chu kỳ năm 365.25 ngày: Ngày 31/12 và 01/01 liền kề nhau trên đường tròn lượng giác
        doy_rad = (2.0 * np.pi * work_df["day_of_year"].values) / 365.25
        work_df["sin_doy"] = np.sin(doy_rad)
        work_df["cos_doy"] = np.cos(doy_rad)

        # 3. Ước tính hoặc gán đặc trưng phản xạ và góc mặt trời nếu thiếu
        if "refl" not in work_df.columns:
            # Độ phản xạ tăng dần về phía băng tuyết 2 cực
            work_df["refl"] = np.clip(15.0 + 35.0 * (np.abs(lats) / 70.0) ** 2, 5.0, 95.0)

        if "sza" not in work_df.columns:
            # Góc thiên đỉnh mặt trời tăng cao ở vùng vĩ độ cao
            work_df["sza"] = np.clip(15.0 + 60.0 * (np.abs(lats) / 70.0), 10.0, 85.0)

        return work_df[FEATURE_NAMES]
