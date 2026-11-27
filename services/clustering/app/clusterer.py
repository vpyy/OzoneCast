"""
OzoneCast — Master Spatial & Atmospheric Clusterer (Facade)
Tích hợp toàn diện quy trình Phân cụm Khai phá Dữ liệu (Spatial Data Mining):
1. Thu thập & Chuẩn bị dữ liệu ô lưới vệ tinh NASA
2. Chuẩn hóa & Áp trọng số đặc trưng vật lý khí quyển
3. Thuật toán K-Means (Phân cụm tâm đại diện)
4. Thuật toán DBSCAN (Phân cụm mật độ không gian & lọc nhiễu)
5. Đánh giá chất lượng phân cụm (Silhouette, Davies-Bouldin, Calinski-Harabasz)
6. Định danh & Trích xuất hồ sơ khí quyển (Atmospheric Profiling)
7. Đồng bộ kết quả vào Database API & Hệ thống Cache
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
import pandas as pd
import requests

from .config import (
    DATABASE_API_URL,
    DEFAULT_KMEANS_CLUSTERS,
    DEFAULT_DBSCAN_EPS,
    DEFAULT_DBSCAN_MIN_SAMPLES,
    logger
)
from .preprocessor import ClusteringPreprocessor
from .profiler import ClusterProfiler
from .kmeans import KMeansClusterer
from .dbscan import DBSCANClusterer


class OzoneClusterer:
    """Facade orchestrator điều phối toàn bộ nghiệp vụ phân cụm không gian tầng Ozone."""

    @staticmethod
    def fetch_grid_data() -> pd.DataFrame:
        """Truy xuất dữ liệu ô lưới từ Database API (có fallback mô phỏng chuẩn WMO)."""
        return ClusteringPreprocessor.fetch_grid_data(limit=1500)

    @staticmethod
    def _interpret_cluster(mean_ozone: float, mean_refl: float, mean_lat: float, cid: int) -> str:
        """Hàm diễn giải đặc trưng cụm (giữ nguyên signature để tương thích 100%)."""
        info = ClusterProfiler.interpret_cluster(mean_ozone, mean_refl, mean_lat, cid)
        return info["characteristic"]

    @classmethod
    def run_kmeans_clustering(cls, n_clusters: int = DEFAULT_KMEANS_CLUSTERS) -> List[Dict[str, Any]]:
        """
        Thực thi phân cụm K-Means:
        - Đọc dữ liệu từ DB
        - Chuẩn hóa và áp trọng số vật lý khí quyển
        - Huấn luyện K-Means
        - Gán nhãn đặc trưng khí quyển
        - Lưu kết quả vào DB và Cache
        """
        df = cls.fetch_grid_data()
        X_scaled, _, work_df = ClusteringPreprocessor.prepare_feature_matrix(df)

        labels, _, eval_metrics = KMeansClusterer.fit_predict(X_scaled, n_clusters=n_clusters)
        work_df["cluster_id"] = labels

        # Re-index cluster labels theo nồng độ Ozone trung bình tăng dần
        # → C-0 luôn = vùng Ozone thấp nhất (nguy cơ cao nhất), C-3 = Ozone dày nhất (an toàn)
        ozone_col = "ozone_column_mean"
        cluster_means = work_df.groupby("cluster_id")[ozone_col].mean().sort_values()
        label_mapping = {old_id: new_idx for new_idx, old_id in enumerate(cluster_means.index)}
        work_df["cluster_id"] = work_df["cluster_id"].map(label_mapping)
        logger.info(f"KMeans re-index mapping (by ozone asc): {label_mapping}")

        cluster_records, summary_payload = cls._format_and_persist_results(
            work_df=work_df,
            algorithm="KMeans",
            eval_metrics=eval_metrics
        )
        return cluster_records

    @classmethod
    def run_dbscan_clustering(
        cls,
        eps: float = DEFAULT_DBSCAN_EPS,
        min_samples: int = DEFAULT_DBSCAN_MIN_SAMPLES
    ) -> List[Dict[str, Any]]:
        """
        Thực thi phân cụm mật độ DBSCAN:
        - Tự động phát hiện các dải khí quyển dị thường có hình thái bất kỳ
        - Tách biệt điểm nhiễu quan trắc vệ tinh (cluster_id = -1)
        - Lưu kết quả vào DB và Cache
        """
        df = cls.fetch_grid_data()
        X_scaled, _, work_df = ClusteringPreprocessor.prepare_feature_matrix(df)

        labels, _, eval_metrics = DBSCANClusterer.fit_predict(
            X_scaled,
            eps=eps,
            min_samples=min_samples
        )
        work_df["cluster_id"] = labels

        # Re-index DBSCAN cluster labels theo Ozone tăng dần (bỏ qua nhiễu cluster_id=-1)
        ozone_col = "ozone_column_mean"
        valid_mask = work_df["cluster_id"] != -1
        if valid_mask.sum() > 0:
            cluster_means = work_df.loc[valid_mask].groupby("cluster_id")[ozone_col].mean().sort_values()
            label_mapping = {old_id: new_idx for new_idx, old_id in enumerate(cluster_means.index)}
            work_df.loc[valid_mask, "cluster_id"] = work_df.loc[valid_mask, "cluster_id"].map(label_mapping)
            logger.info(f"DBSCAN re-index mapping (by ozone asc): {label_mapping}")

        cluster_records, summary_payload = cls._format_and_persist_results(
            work_df=work_df,
            algorithm="DBSCAN",
            eval_metrics=eval_metrics
        )
        return cluster_records

    @classmethod
    def run_clustering(
        cls,
        algorithm: str = "KMeans",
        eps: float = DEFAULT_DBSCAN_EPS,
        n_clusters: int = DEFAULT_KMEANS_CLUSTERS
    ) -> Dict[str, Any]:
        """
        Entrypoint tổng quát hỗ trợ kích hoạt thủ công từ Frontend hoặc REST API.
        Trả về payload đầy đủ cấu trúc mà UI React mong đợi.
        """
        algo_upper = algorithm.upper()
        if "DBSCAN" in algo_upper:
            records = cls.run_dbscan_clustering(eps=eps, min_samples=4)
            chosen_algo = "DBSCAN"
        else:
            records = cls.run_kmeans_clustering(n_clusters=n_clusters)
            chosen_algo = "KMeans"

        unique_clusters = len(set(r["cluster_id"] for r in records if r["cluster_id"] != -1))
        logger.info(f"Manual clustering request executed: algo={chosen_algo}, points={len(records)}, clusters={unique_clusters}")

        return {
            "status": "success",
            "algorithm": chosen_algo,
            "total_points_clustered": len(records),
            "cluster_count": unique_clusters,
            "sample_points": records[:100],
            "timestamp": datetime.utcnow().isoformat()
        }

    @classmethod
    def _format_and_persist_results(
        cls,
        work_df: pd.DataFrame,
        algorithm: str,
        eval_metrics: Dict[str, Any]
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Định dạng bản ghi, lưu trữ vào Database API và cập nhật Cache."""
        cluster_records: List[Dict[str, Any]] = []
        cluster_profiles = ClusterProfiler.summarize_clusters(work_df)
        profile_map = {p["cluster_id"]: p for p in cluster_profiles}

        for _, row in work_df.iterrows():
            cid = int(row["cluster_id"])
            p_info = profile_map.get(cid, {})

            cluster_records.append({
                "algorithm": algorithm,
                "cluster_id": cid,
                "latitude": float(row["lat_bin"]),
                "longitude": float(row["lon_bin"]),
                "mean_ozone": round(float(row["ozone_column_mean"]), 2),
                "mean_reflectivity": round(float(row.get("reflectivity_mean", 20.0)), 2),
                "point_count": int(p_info.get("point_count", 1)),
                "tag": p_info.get("tag", f"Cụm {cid + 1}"),
                "characteristic": p_info.get("characteristic", "Vùng bề mặt / Khí quyển thông thường")
            })

        # Lưu dữ liệu điểm vào CSDL qua Database API (lưu toàn bộ các ô lưới, tối đa 1000 ô)
        try:
            resp = requests.post(
                f"{DATABASE_API_URL}/api/clusters/bulk",
                json={"items": cluster_records[:1000]},
                timeout=15
            )
            if resp.status_code in (200, 201):
                logger.info(f"Persisted {min(len(cluster_records), 1000)} cluster records to database.")
            else:
                logger.warning(f"Could not persist clusters: status {resp.status_code} - {resp.text}")
        except Exception as e:
            logger.warning(f"Could not persist clusters to database-api ({e})")

        # Lưu báo cáo tổng kết phân cụm vào Cache API
        summary_payload = {
            "algorithm": algorithm,
            "total_points": len(work_df),
            "cluster_count": len([p for p in cluster_profiles if p["cluster_id"] != -1]),
            "evaluation_metrics": eval_metrics,
            "cluster_profiles": cluster_profiles,
            "updated_at": datetime.utcnow().isoformat()
        }
        try:
            requests.post(
                f"{DATABASE_API_URL}/api/cache/clustering_summary",
                json=summary_payload,
                timeout=10
            )
            logger.info("Clustering summary cache updated.")
        except Exception as e:
            logger.warning(f"Could not update clustering cache ({e})")

        return cluster_records, summary_payload
