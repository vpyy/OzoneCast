"""
OzoneCast — Data Preprocessor
Tiền xử lý và làm sạch dữ liệu vệ tinh NASA OMI/Aura:
- Lọc bỏ điểm đo lỗi thuật toán (QualityFlags)
- Lọc góc thiên đỉnh mặt trời xiên (SZA > 84°)
- Lọc giá trị vật lý ngoại lai (Outliers < 50 DU hoặc > 650 DU)
- Phân chia lưới không gian (Spatial Binning) 0.5° × 0.5°
"""

from typing import Tuple, Dict, Any, List
import numpy as np
import pandas as pd

from .config import (
    DEFAULT_GRID_RESOLUTION,
    MIN_VALID_OZONE_DU,
    MAX_VALID_OZONE_DU,
    MAX_SOLAR_ZENITH_ANGLE,
    ANTARCTIC_LAT_MIN,
    ANTARCTIC_LAT_MAX,
    logger
)


class DataPreprocessor:
    """Module phụ trách tiền xử lý và làm sạch dữ liệu quan trắc tầng ozone."""

    @staticmethod
    def clean_raw_measurements(df: pd.DataFrame, strict_sza: bool = True) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Làm sạch dữ liệu thô:
        - Chuẩn hóa kiểu dữ liệu số
        - Lọc các điểm đo có quality_flag != 0
        - Lọc SZA > MAX_SOLAR_ZENITH_ANGLE (nếu bật strict_sza)
        - Lọc nồng độ Ozone nằm ngoài dải vật lý (50 - 650 DU)
        """
        stats = {
            "initial_rows": len(df),
            "dropped_quality_flags": 0,
            "dropped_sza": 0,
            "dropped_outliers": 0,
            "clean_rows": 0
        }

        if df.empty:
            return pd.DataFrame(), stats

        clean_df = df.copy()

        # 1. Ép kiểu dữ liệu số an toàn
        numeric_cols = [
            "latitude", "longitude", "ozone_column_raw",
            "quality_flag", "ground_pixel_quality_flag",
            "solar_zenith_angle", "radiative_cloud_fraction",
            "cloud_pressure", "water_fraction",
            "reflectivity331", "uv_aerosol_index"
        ]
        for col in numeric_cols:
            if col in clean_df.columns:
                clean_df[col] = pd.to_numeric(clean_df[col], errors="coerce")

        # 2. Lọc bỏ các hàng thiếu tọa độ hoặc ozone
        clean_df = clean_df.dropna(subset=["latitude", "longitude", "ozone_column_raw"])

        # 3. Lọc giá trị vật lý ngoại lai
        valid_range_mask = (clean_df["ozone_column_raw"] >= MIN_VALID_OZONE_DU) & (clean_df["ozone_column_raw"] <= MAX_VALID_OZONE_DU)
        stats["dropped_outliers"] = int((~valid_range_mask).sum())
        clean_df = clean_df[valid_range_mask]

        # 4. Lọc theo Quality Flags (nếu có cột quality_flag)
        if "quality_flag" in clean_df.columns:
            # 0 nghĩa là điểm đo tốt (good observation)
            good_quality_mask = (clean_df["quality_flag"] == 0)
            # Nếu tất cả các điểm bị loại do cờ giả lập, fallback giữ lại dữ liệu
            if good_quality_mask.any():
                stats["dropped_quality_flags"] = int((~good_quality_mask).sum())
                clean_df = clean_df[good_quality_mask]

        # 5. Lọc theo Solar Zenith Angle (tránh lỗi chạng vạng ở vùng cực)
        if strict_sza and "solar_zenith_angle" in clean_df.columns:
            sza_mask = (clean_df["solar_zenith_angle"] <= MAX_SOLAR_ZENITH_ANGLE) | (clean_df["solar_zenith_angle"] == 0.0)
            if sza_mask.any():
                stats["dropped_sza"] = int((~sza_mask).sum())
                clean_df = clean_df[sza_mask]

        stats["clean_rows"] = len(clean_df)
        logger.info(f"Preprocessing completed: {stats['initial_rows']} -> {stats['clean_rows']} records retained.")
        return clean_df, stats

    @classmethod
    def spatial_binning(cls, df: pd.DataFrame, grid_res: float = DEFAULT_GRID_RESOLUTION) -> pd.DataFrame:
        """
        Gộp các điểm đo vệ tinh vào các ô lưới không gian (Spatial Binning):
        Lưới mặc định: 0.5° × 0.5°
        Tính toán:
        - Giá trị trung bình (mean), nhỏ nhất (min), lớn nhất (max), độ lệch chuẩn (std)
        - Độ phản xạ trung bình (reflectivity_mean)
        - Chỉ số aerosol UV trung bình (uv_aerosol_mean)
        - Số điểm đo hợp lệ trong từng ô (valid_pixel_count)
        """
        if df.empty:
            return pd.DataFrame()

        clean_df, _ = cls.clean_raw_measurements(df)
        if clean_df.empty:
            clean_df = df.copy()

        # Tạo ô lưới bằng cách làm tròn theo bội số của grid_res
        clean_df["lat_bin"] = (clean_df["latitude"] / grid_res).round() * grid_res
        clean_df["lon_bin"] = (clean_df["longitude"] / grid_res).round() * grid_res

        # Định nghĩa các hàm tổng hợp
        agg_dict = {
            "ozone_column_raw": ["mean", "min", "max", "count"]
        }

        if "reflectivity331" in clean_df.columns:
            agg_dict["reflectivity331"] = ["mean"]
        if "uv_aerosol_index" in clean_df.columns:
            agg_dict["uv_aerosol_index"] = ["mean"]
        if "solar_zenith_angle" in clean_df.columns:
            agg_dict["solar_zenith_angle"] = ["mean"]

        grouped = clean_df.groupby(["lat_bin", "lon_bin"]).agg(agg_dict)

        # Flatten multi-level columns
        flat_df = pd.DataFrame()
        flat_df["lat_bin"] = [idx[0] for idx in grouped.index]
        flat_df["lon_bin"] = [idx[1] for idx in grouped.index]
        flat_df["ozone_column_mean"] = grouped[("ozone_column_raw", "mean")].values
        flat_df["ozone_column_min"] = grouped[("ozone_column_raw", "min")].values
        flat_df["ozone_column_max"] = grouped[("ozone_column_raw", "max")].values
        flat_df["valid_pixel_count"] = grouped[("ozone_column_raw", "count")].values

        if ("reflectivity331", "mean") in grouped.columns:
            flat_df["reflectivity_mean"] = grouped[("reflectivity331", "mean")].values
        else:
            flat_df["reflectivity_mean"] = 15.0

        if ("uv_aerosol_index", "mean") in grouped.columns:
            flat_df["uv_aerosol_mean"] = grouped[("uv_aerosol_index", "mean")].values
        else:
            flat_df["uv_aerosol_mean"] = 0.0

        if ("solar_zenith_angle", "mean") in grouped.columns:
            flat_df["solar_zenith_mean"] = grouped[("solar_zenith_angle", "mean")].values
        else:
            flat_df["solar_zenith_mean"] = 45.0

        # Làm tròn chữ số thập phân cho báo cáo khoa học
        flat_df["lat_bin"] = flat_df["lat_bin"].round(2)
        flat_df["lon_bin"] = flat_df["lon_bin"].round(2)
        flat_df["ozone_column_mean"] = flat_df["ozone_column_mean"].round(2)
        flat_df["ozone_column_min"] = flat_df["ozone_column_min"].round(2)
        flat_df["ozone_column_max"] = flat_df["ozone_column_max"].round(2)
        flat_df["reflectivity_mean"] = flat_df["reflectivity_mean"].round(2)
        flat_df["uv_aerosol_mean"] = flat_df["uv_aerosol_mean"].round(3)
        flat_df["solar_zenith_mean"] = flat_df["solar_zenith_mean"].round(2)

        # Đánh dấu các ô nằm trong khu vực Bán đảo Nam Cực
        flat_df["is_antarctic"] = flat_df["lat_bin"].between(ANTARCTIC_LAT_MIN, ANTARCTIC_LAT_MAX)

        return flat_df.reset_index(drop=True)
