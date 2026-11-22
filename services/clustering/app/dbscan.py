"""
OzoneCast — DBSCAN Density-Based Spatial Clustering
Triển khai thuật toán phân cụm dựa trên mật độ DBSCAN:
- Nhận diện các hình thái cụm không gian có hình dạng tùy ý (Arbitrary-shaped clusters)
  đặc trưng cho các khối khí quyển và dải lỗ thủng tầng Ozone.
- Tự động tách biệt các điểm dị biệt ngoại lai (Noise points: label = -1).
- Tính toán các độ đo chất lượng trên các điểm cụm hợp lệ.
"""

from typing import Tuple, Dict, Any
import numpy as np
from sklearn.cluster import DBSCAN

from .evaluation import ClusterEvaluator
from .config import DEFAULT_DBSCAN_EPS, DEFAULT_DBSCAN_MIN_SAMPLES, logger


class DBSCANClusterer:
    """Module thực thi thuật toán DBSCAN cho dữ liệu không gian vệ tinh."""

    @classmethod
    def fit_predict(
        cls,
        X: np.ndarray,
        eps: float = DEFAULT_DBSCAN_EPS,
        min_samples: int = DEFAULT_DBSCAN_MIN_SAMPLES
    ) -> Tuple[np.ndarray, DBSCAN, Dict[str, Any]]:
        """
        Huấn luyện DBSCAN và trả về (labels, model, evaluation_metrics).
        Labels = -1 tương ứng với điểm nhiễu (Noise).
        """
        # Bảo vệ tham số hợp lệ
        effective_eps = max(0.1, float(eps))
        effective_min_samples = max(2, int(min_samples))

        dbscan = DBSCAN(eps=effective_eps, min_samples=effective_min_samples, metric="euclidean")
        labels = dbscan.fit_predict(X)

        unique_labels = set(labels)
        has_noise = -1 in unique_labels
        core_clusters = [l for l in unique_labels if l != -1]
        n_clusters = len(core_clusters)

        noise_count = int(np.sum(labels == -1))
        noise_percent = round((noise_count / len(X)) * 100, 2)

        # Tính độ đo trên các điểm không phải nhiễu
        eval_metrics = ClusterEvaluator.evaluate(X, labels)
        eval_metrics["algorithm"] = "DBSCAN"
        eval_metrics["eps"] = effective_eps
        eval_metrics["min_samples"] = effective_min_samples
        eval_metrics["core_clusters_count"] = n_clusters
        eval_metrics["noise_points_count"] = noise_count
        eval_metrics["noise_percentage"] = noise_percent

        logger.info(
            f"DBSCAN completed: eps={effective_eps}, min_samples={effective_min_samples} -> "
            f"{n_clusters} clusters, {noise_count} noise points ({noise_percent}%)."
        )

        return labels, dbscan, eval_metrics
