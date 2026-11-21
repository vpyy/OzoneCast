"""
Unit Tests for OzoneCast Data Analysis Module
Chạy kiểm thử: pytest tests/test_data_analysis.py
"""

import numpy as np
import pandas as pd
import pytest

from app.data_analysis.config import (
    MIN_VALID_OZONE_DU,
    MAX_VALID_OZONE_DU,
    MAX_SOLAR_ZENITH_ANGLE,
    OZONE_HOLE_THRESHOLD_DU,
    SEVERE_OZONE_HOLE_DU,
    ANTARCTIC_LAT_MIN,
    ANTARCTIC_LAT_MAX
)
from app.data_analysis.preprocessor import DataPreprocessor
from app.data_analysis.anomaly import OzoneAnomalyDetector
from app.data_analysis.timeseries import TimeSeriesAnalyzer
from app.data_analysis.decomposition import TimeSeriesDecomposer
from app.data_analysis.correlation import CorrelationAnalyzer
from app.data_analysis.reporting import DataReporter
from app.data_analysis.analyzer import OzoneAnalyzer


@pytest.fixture
def sample_raw_dataframe():
    """Tạo bộ dữ liệu thô mẫu bao gồm cả điểm chuẩn và điểm ngoại lai."""
    return pd.DataFrame({
        "latitude": [-65.0, -65.2, 10.5, 20.0, 89.0],
        "longitude": [-64.0, -64.1, 105.0, 106.0, 0.0],
        "ozone_column_raw": [180.0, 210.0, 290.0, 750.0, 30.0],  # 750 và 30 là outliers
        "quality_flag": [0, 0, 0, 0, 1],                           # 1 là error flag
        "solar_zenith_angle": [65.0, 70.0, 30.0, 40.0, 88.0],     # 88.0 > MAX_SZA
        "reflectivity331": [35.0, 40.0, 15.0, 18.0, 60.0],
        "uv_aerosol_index": [0.4, 0.5, 0.8, 0.9, 0.1],
        "created_at": ["2026-11-18T00:00:00Z"] * 5
    })


class TestDataPreprocessor:
    def test_clean_raw_measurements_filters_outliers_and_flags(self, sample_raw_dataframe):
        clean_df, stats = DataPreprocessor.clean_raw_measurements(sample_raw_dataframe)

        # 750 (>650) và 30 (<50) phải bị loại
        assert (clean_df["ozone_column_raw"] >= MIN_VALID_OZONE_DU).all()
        assert (clean_df["ozone_column_raw"] <= MAX_VALID_OZONE_DU).all()

        # Điểm có SZA = 88.0 phải bị loại
        assert (clean_df["solar_zenith_angle"] <= MAX_SOLAR_ZENITH_ANGLE).all()

        # Điểm có quality_flag = 1 phải bị loại
        assert (clean_df["quality_flag"] == 0).all()

        assert stats["clean_rows"] == 3
        assert stats["dropped_outliers"] >= 1

    def test_spatial_binning(self, sample_raw_dataframe):
        grid_df = DataPreprocessor.spatial_binning(sample_raw_dataframe, grid_res=0.5)

        assert not grid_df.empty
        assert "lat_bin" in grid_df.columns
        assert "lon_bin" in grid_df.columns
        assert "ozone_column_mean" in grid_df.columns
        assert "valid_pixel_count" in grid_df.columns
        assert "is_antarctic" in grid_df.columns

        # Kiểm tra đánh dấu Nam Cực
        antarctic_cells = grid_df[grid_df["is_antarctic"]]
        assert len(antarctic_cells) > 0
        for lat in antarctic_cells["lat_bin"]:
            assert ANTARCTIC_LAT_MIN <= lat <= ANTARCTIC_LAT_MAX


class TestOzoneAnomalyDetector:
    def test_detect_anomalies(self):
        grid_df = pd.DataFrame({
            "lat_bin": [-65.0, -70.0, 15.0],
            "lon_bin": [-60.0, -60.0, 105.0],
            "ozone_column_mean": [175.0, 205.0, 310.0]  # 175: Severe, 205: Warning, 310: Bình thường
        })

        anomalies = OzoneAnomalyDetector.detect_anomalies(grid_df)
        assert len(anomalies) == 2

        severes = [a for a in anomalies if a["severity"] == "Severe (Ozone Hole)"]
        warnings = [a for a in anomalies if a["severity"] == "Warning"]

        assert len(severes) == 1
        assert severes[0]["ozone_level"] == 175.0
        assert len(warnings) == 1
        assert warnings[0]["ozone_level"] == 205.0

    def test_compute_anomaly_metrics(self):
        grid_df = pd.DataFrame({
            "lat_bin": [-65.0, -70.0, 15.0, 20.0],
            "lon_bin": [-60.0, -60.0, 105.0, 106.0],
            "ozone_column_mean": [170.0, 210.0, 300.0, 320.0]
        })

        metrics = OzoneAnomalyDetector.compute_anomaly_metrics(grid_df)
        assert metrics["total_cells_count"] == 4
        assert metrics["anomaly_cells_count"] == 2
        assert metrics["depletion_rate_percent"] == 50.0
        assert metrics["min_ozone_du"] == 170.0
        assert metrics["estimated_area_km2"] > 0


class TestTimeSeriesAnalyzer:
    def test_compute_analytics_structure(self, sample_raw_dataframe):
        results = TimeSeriesAnalyzer.compute_analytics(sample_raw_dataframe)

        for p in ["day", "week", "month"]:
            assert p in results
            pdata = results[p]
            assert "line_chart" in pdata
            assert "scatter_plot" in pdata
            assert "histogram" in pdata

            # Line chart structure
            line_points = pdata["line_chart"]
            assert len(line_points) >= 3
            first_point = line_points[0]
            assert "label" in first_point
            assert "ozone_mean" in first_point
            assert "ozone_min" in first_point
            assert "ozone_max" in first_point

            # Histogram structure
            hist_bars = pdata["histogram"]
            assert len(hist_bars) > 0
            assert "bin_start" in hist_bars[0]
            assert "bin_end" in hist_bars[0]
            assert "count" in hist_bars[0]


class TestTimeSeriesDecomposer:
    def test_decompose_mathematical_consistency(self, sample_raw_dataframe):
        decomp = TimeSeriesDecomposer.decompose(sample_raw_dataframe, n_steps=12)

        assert "series" in decomp
        assert "trend_slope_per_step" in decomp
        assert "seasonal_amplitude_du" in decomp
        assert len(decomp["series"]) == 12

        # Kiểm tra tính chất quan trắc = trend + seasonal + residual
        for pt in decomp["series"]:
            obs = pt["observed"]
            model_sum = pt["trend"] + pt["seasonal"] + pt["residual"]
            assert abs(obs - model_sum) < 0.05


class TestCorrelationAnalyzer:
    def test_compute_matrix_properties(self, sample_raw_dataframe):
        corr_result = CorrelationAnalyzer.compute_matrix(sample_raw_dataframe)

        assert "matrix" in corr_result
        assert "variables" in corr_result
        assert "insights" in corr_result

        matrix = corr_result["matrix"]
        assert len(matrix) == 6  # 6 biến

        for i, row in enumerate(matrix):
            vals = row["values"]
            assert len(vals) == 6
            # Đường chéo chính luôn bằng 1.0
            assert abs(vals[i] - 1.0) < 1e-4

        # Tính đối xứng M_ij == M_ji
        for i in range(6):
            for j in range(6):
                assert abs(matrix[i]["values"][j] - matrix[j]["values"][i]) < 1e-3


class TestDataReporter:
    def test_generate_executive_report(self, sample_raw_dataframe):
        grid_df = DataPreprocessor.spatial_binning(sample_raw_dataframe)
        anomalies = OzoneAnomalyDetector.detect_anomalies(grid_df)
        report = DataReporter.generate_executive_report(
            sample_raw_dataframe, grid_df, anomalies, {"clean_rows": 3, "initial_rows": 5}
        )

        assert "summary_metrics" in report
        assert "descriptive_statistics" in report
        assert "regional_breakdown" in report
        assert report["descriptive_statistics"]["mean_du"] > 0
        assert "p50" in report["descriptive_statistics"]["percentiles"]
