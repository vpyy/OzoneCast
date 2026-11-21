"""
OzoneCast — K-Means Spatial & Atmospheric Clustering
Triển khai thuật toán K-Means cho phân cụm không gian dữ liệu vệ tinh:
- Khởi tạo K-Means++ tối ưu hội tụ
- Tính toán tâm cụm (Centroids) và độ biến thiên nội cụm (Inertia)
- Đánh giá chất lượng phân cụm (Silhouette, Davies-Bouldin, Calinski-Harabasz)
- Hỗ trợ dò tìm số cụm tối ưu K (Elbow & Silhouette Analysis)
"""

from typing import Tuple, Dict, Any, List
import numpy as np
from sklearn.cluster import KMeans

from .evaluation import ClusterEvaluator
from .config import DEFAULT_KMEANS_CLUSTERS, logger


class KMeansClusterer:
    """Module thực thi thuật toán K-Means cho dữ liệu vệ tinh."""

    @classmethod
    def fit_predict(
        cls,
        X: np.ndarray,
        n_clusters: int = DEFAULT_KMEANS_CLUSTERS,
        random_state: int = 42
    ) -> Tuple[np.ndarray, KMeans, Dict[str, Any]]:
        """
        Huấn luyện K-Means và trả về (labels, model, evaluation_metrics).
        """
        # Đảm bảo n_clusters hợp lệ
        n_samples = len(X)
        effective_k = min(max(2, n_clusters), max(2, n_samples - 1))

        kmeans = KMeans(
            n_clusters=effective_k,
            init="k-means++",
            n_init=10,
            max_iter=300,
            random_state=random_state
        )
        labels = kmeans.fit_predict(X)

        # Tính toán các chỉ số đánh giá
        eval_metrics = ClusterEvaluator.evaluate(X, labels)
        eval_metrics["inertia"] = round(float(kmeans.inertia_), 2)
        eval_metrics["algorithm"] = "KMeans"
        eval_metrics["n_clusters"] = effective_k

        logger.info(f"K-Means completed with K={effective_k}, Inertia={kmeans.inertia_:.2f}")
        return labels, kmeans, eval_metrics

    @classmethod
    def find_optimal_k(
        cls,
        X: np.ndarray,
        k_range: Tuple[int, int] = (2, 7)
    ) -> List[Dict[str, Any]]:
        """
        Dò tìm số lượng cụm K tối ưu thông qua phương pháp Elbow và Silhouette Score.
        """
        results = []
        min_k, max_k = k_range
        max_k = min(max_k, len(X) - 1)

        for k in range(min_k, max_k + 1):
            km = KMeans(n_clusters=k, init="k-means++", n_init=5, random_state=42)
            lbls = km.fit_predict(X)
            metrics = ClusterEvaluator.evaluate(X, lbls)
            results.append({
                "k": k,
                "inertia": round(float(km.inertia_), 2),
                "silhouette_score": metrics.get("silhouette_score")
            })

        return results
