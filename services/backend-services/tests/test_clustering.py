"""
Unit Tests for OzoneCast Spatial & Atmospheric Clustering Module
Chạy kiểm thử: pytest tests/test_clustering.py
"""

import numpy as np
import pandas as pd
import pytest

from app.clustering.config import (
    FEATURE_COLUMNS,
    DEFAULT_KMEANS_CLUSTERS,
    OZONE_HOLE_THRESHOLD_DU
)
from app.clustering.preprocessor import ClusteringPreprocessor
from app.clustering.profiler import ClusterProfiler
from app.clustering.evaluation import ClusterEvaluator
from app.clustering.kmeans import KMeansClusterer
from app.clustering.dbscan import DBSCANClusterer
from app.clustering.clusterer import OzoneClusterer


@pytest.fixture
def sample_grid_dataframe():
    """Tạo bộ dữ liệu ô lưới mẫu mô phỏng 4 vùng khí quyển chính."""
    return ClusteringPreprocessor.generate_synthetic_atmospheric_grid(n_points=120)


class TestClusteringPreprocessor:
    def test_generate_synthetic_atmospheric_grid(self, sample_grid_dataframe):
        df = sample_grid_dataframe
        assert not df.empty
        assert len(df) == 120
        for col in FEATURE_COLUMNS:
            assert col in df.columns

        # Kiểm tra sự hiện diện của vùng lỗ thủng ozone Nam Cực (< 220 DU)
        antarctic_depleted = df[(df["lat_bin"] < -55.0) & (df["ozone_column_mean"] < OZONE_HOLE_THRESHOLD_DU)]
        assert len(antarctic_depleted) > 0

    def test_prepare_feature_matrix(self, sample_grid_dataframe):
        X, scaler, work_df = ClusteringPreprocessor.prepare_feature_matrix(sample_grid_dataframe)

        assert X.shape == (120, 4)
        assert len(work_df) == 120
        # Kiểm tra scaler đã chuẩn hóa
        assert scaler.mean_.shape == (4,)
        assert scaler.scale_.shape == (4,)


class TestClusterProfiler:
    def test_interpret_cluster_categories(self):
        # 1. Noise
        noise = ClusterProfiler.interpret_cluster(mean_ozone=280.0, mean_refl=20.0, mean_lat=10.0, cluster_id=-1)
        assert "Nhiễu" in noise["tag"]

        # 2. Lỗ thủng ozone (< 220 DU)
        depleted = ClusterProfiler.interpret_cluster(mean_ozone=180.0, mean_refl=45.0, mean_lat=-65.0, cluster_id=0)
        assert "suy giảm" in depleted["characteristic"].lower() or "thủng" in depleted["characteristic"].lower()

        # 3. Mây dày / Băng tuyết cực (> 50% refl hoặc cực phản xạ cao)
        cloud_ice = ClusterProfiler.interpret_cluster(mean_ozone=350.0, mean_refl=65.0, mean_lat=70.0, cluster_id=1)
        assert "băng tuyết" in cloud_ice["characteristic"].lower() or "mây" in cloud_ice["characteristic"].lower()

        # 4. Nhiệt đới / Xích đạo
        tropics = ClusterProfiler.interpret_cluster(mean_ozone=260.0, mean_refl=18.0, mean_lat=5.0, cluster_id=2)
        assert "nhiệt đới" in tropics["characteristic"].lower() or "xích đạo" in tropics["characteristic"].lower()

        # 5. Thông thường
        normal = ClusterProfiler.interpret_cluster(mean_ozone=320.0, mean_refl=25.0, mean_lat=35.0, cluster_id=3)
        assert "thông thường" in normal["characteristic"].lower()

    def test_summarize_clusters(self, sample_grid_dataframe):
        df = sample_grid_dataframe.copy()
        df["cluster_id"] = np.random.choice([0, 1, 2, 3], size=len(df))

        profiles = ClusterProfiler.summarize_clusters(df)
        assert len(profiles) == 4
        for p in profiles:
            assert "cluster_id" in p
            assert "point_count" in p
            assert "percentage" in p
            assert "centroid" in p
            assert "ozone_mean_du" in p["centroid"]


class TestClusterEvaluator:
    def test_evaluate_valid_clustering(self):
        # Tạo 2 cụm phân tách rất rõ
        X = np.vstack([
            np.random.normal(loc=-5.0, scale=0.5, size=(50, 4)),
            np.random.normal(loc=5.0, scale=0.5, size=(50, 4))
        ])
        labels = np.array([0] * 50 + [1] * 50)

        metrics = ClusterEvaluator.evaluate(X, labels)
        assert metrics["silhouette_score"] is not None
        assert metrics["silhouette_score"] > 0.5  # Phân tách rất rõ
        assert metrics["davies_bouldin_index"] is not None
        assert metrics["calinski_harabasz_index"] is not None
        assert metrics["cluster_count"] == 2

    def test_evaluate_single_cluster_edge_case(self):
        X = np.random.normal(size=(20, 4))
        labels = np.zeros(20, dtype=int)

        metrics = ClusterEvaluator.evaluate(X, labels)
        assert metrics["silhouette_score"] is None
        assert "Không đủ điều kiện" in metrics["evaluation_rating"]


class TestKMeansClusterer:
    def test_fit_predict(self, sample_grid_dataframe):
        X, _, _ = ClusteringPreprocessor.prepare_feature_matrix(sample_grid_dataframe)
        labels, model, metrics = KMeansClusterer.fit_predict(X, n_clusters=4)

        assert len(labels) == len(sample_grid_dataframe)
        assert len(np.unique(labels)) == 4
        assert metrics["algorithm"] == "KMeans"
        assert metrics["inertia"] > 0
        assert metrics["silhouette_score"] is not None

    def test_find_optimal_k(self, sample_grid_dataframe):
        X, _, _ = ClusteringPreprocessor.prepare_feature_matrix(sample_grid_dataframe)
        opt_results = KMeansClusterer.find_optimal_k(X, k_range=(2, 4))

        assert len(opt_results) == 3
        for item in opt_results:
            assert "k" in item
            assert "inertia" in item
            assert "silhouette_score" in item


class TestDBSCANClusterer:
    def test_fit_predict(self, sample_grid_dataframe):
        X, _, _ = ClusteringPreprocessor.prepare_feature_matrix(sample_grid_dataframe)
        labels, model, metrics = DBSCANClusterer.fit_predict(X, eps=0.9, min_samples=4)

        assert len(labels) == len(sample_grid_dataframe)
        assert metrics["algorithm"] == "DBSCAN"
        assert "core_clusters_count" in metrics
        assert "noise_points_count" in metrics


class TestOzoneClustererFacade:
    def test_run_kmeans_clustering(self):
        records = OzoneClusterer.run_kmeans_clustering(n_clusters=4)

        assert len(records) > 0
        first = records[0]
        required_keys = [
            "algorithm", "cluster_id", "latitude", "longitude",
            "mean_ozone", "mean_reflectivity", "point_count", "tag", "characteristic"
        ]
        for key in required_keys:
            assert key in first

    def test_run_dbscan_clustering(self):
        records = OzoneClusterer.run_dbscan_clustering(eps=1.1, min_samples=4)
        assert len(records) > 0

    def test_run_clustering_api(self):
        res = OzoneClusterer.run_clustering(algorithm="KMeans", n_clusters=4)
        assert res["status"] == "success"
        assert res["algorithm"] == "KMeans"
        assert res["total_points_clustered"] > 0
        assert res["cluster_count"] > 0
        assert len(res["sample_points"]) > 0
