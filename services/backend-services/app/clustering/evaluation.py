"""
OzoneCast — Cluster Validation & Quality Metrics
Đánh giá chất lượng mô hình phân cụm theo các chỉ số thống kê Data Mining:
1. Silhouette Coefficient: Đo lường độ chặt chẽ nội cụm và phân tách ngoại cụm (-1 đến +1).
2. Davies-Bouldin Index: Đánh giá độ tương đồng giữa các cụm (càng thấp càng tốt).
3. Calinski-Harabasz Index (Variance Ratio Criterion): Tỷ lệ phương sai liên cụm / nội cụm (càng cao càng tốt).
"""

from typing import Dict, Any
import numpy as np
from sklearn.metrics import (
    silhouette_score,
    davies_bouldin_score,
    calinski_harabasz_score
)

from .config import logger


class ClusterEvaluator:
    """Module tính toán các độ đo kiểm định chất lượng phân cụm."""

    @staticmethod
    def evaluate(X: np.ndarray, labels: np.ndarray) -> Dict[str, Any]:
        """
        Tính toán bộ 3 chỉ số kiểm định chất lượng phân cụm.
        Xử lý an toàn các trường hợp biên: chỉ có 1 cụm hoặc toàn bộ là nhiễu DBSCAN.
        """
        # Lọc bỏ nhiễu (-1) khi tính toán chỉ số cho DBSCAN
        non_noise_mask = (labels != -1)
        valid_labels = labels[non_noise_mask]
        valid_X = X[non_noise_mask]

        unique_labels = np.unique(valid_labels)
        n_clusters = len(unique_labels)
        n_samples = len(valid_X)

        # Điều kiện tối thiểu để tính toán các độ đo: ít nhất 2 cụm và số điểm > số cụm
        if n_clusters < 2 or n_samples <= n_clusters:
            return {
                "silhouette_score": None,
                "davies_bouldin_index": None,
                "calinski_harabasz_index": None,
                "cluster_count": int(n_clusters),
                "evaluation_rating": "Không đủ điều kiện kiểm định (Số cụm < 2)",
                "note": "Cần tối thiểu 2 cụm phân tách hợp lệ."
            }

        try:
            sil = float(silhouette_score(valid_X, valid_labels))
            db = float(davies_bouldin_score(valid_X, valid_labels))
            ch = float(calinski_harabasz_score(valid_X, valid_labels))

            # Đánh giá định tính khoa học
            if sil >= 0.50:
                rating = "Tuyệt vời (Cụm phân tách rất rõ và chặt chẽ)"
            elif sil >= 0.35:
                rating = "Tốt (Cấu trúc phân cụm ổn định, ý nghĩa vật lý rõ)"
            elif sil >= 0.20:
                rating = "Khá (Có sự giao thoa nhẹ giữa các vùng chuyển tiếp)"
            else:
                rating = "Yếu (Cần tinh chỉnh siêu tham số K hoặc Epsilon)"

            metrics = {
                "silhouette_score": round(sil, 4),
                "davies_bouldin_index": round(db, 4),
                "calinski_harabasz_index": round(ch, 2),
                "cluster_count": int(n_clusters),
                "valid_points_evaluated": int(n_samples),
                "evaluation_rating": rating
            }
            logger.info(f"Clustering evaluation: Silhouette={sil:.4f}, Davies-Bouldin={db:.4f}, Rating={rating}")
            return metrics

        except Exception as e:
            logger.warning(f"Error computing clustering evaluation metrics: {e}")
            return {
                "silhouette_score": None,
                "davies_bouldin_index": None,
                "calinski_harabasz_index": None,
                "cluster_count": int(n_clusters),
                "evaluation_rating": "Lỗi tính toán độ đo",
                "note": str(e)
            }
