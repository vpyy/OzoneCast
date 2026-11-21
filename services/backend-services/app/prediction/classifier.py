"""
OzoneCast — Random Forest Ozone Classifier
Mô hình phân loại cấp độ cảnh báo rủi ro bức xạ Ozone:
- RandomForestClassifier với cân bằng trọng số các lớp (class_weight='balanced')
- Đánh giá độ chính xác (Accuracy) và phân phối xác suất lớp
- Đo lường độ tin cậy của dự báo (Confidence Percent)
"""

import pickle
from pathlib import Path
from typing import Dict, Any, List
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from .config import RF_CLASSIFIER_PARAMS, logger


class OzoneClassifier:
    """Mô hình phân loại cảnh báo trạng thái tầng ozone."""

    def __init__(self):
        self.model: RandomForestClassifier = RandomForestClassifier(**RF_CLASSIFIER_PARAMS)
        self.is_trained: bool = False
        self.metrics: Dict[str, Any] = {}

    def train(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
        """Huấn luyện mô hình phân loại và đánh giá trên tập kiểm tra."""
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.20, random_state=42
        )

        self.model.fit(X_train, y_train)
        self.is_trained = True

        y_pred_test = self.model.predict(X_test)
        acc = float(accuracy_score(y_test, y_pred_test))

        self.metrics = {
            "test_accuracy": round(acc * 100, 1),
            "classes": list(self.model.classes_),
            "train_samples": len(X_train),
            "test_samples": len(X_test)
        }
        logger.info(f"RandomForestClassifier trained: Test Accuracy={acc * 100:.1f}%, Classes={self.model.classes_}")
        return self.metrics

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Dự báo nhãn trạng thái phân loại."""
        if not self.is_trained:
            raise RuntimeError("Mô hình phân loại chưa được huấn luyện.")
        return self.model.predict(X)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Dự báo phân phối xác suất trên các lớp phân loại."""
        if not self.is_trained:
            raise RuntimeError("Mô hình phân loại chưa được huấn luyện.")
        return self.model.predict_proba(X)

    def save(self, file_path: Path):
        """Lưu trữ mô hình phân loại và metadata ra file pickle."""
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            pickle.dump({"model": self.model, "metrics": self.metrics}, f)
        logger.info(f"Classifier model saved to {file_path}")

    def load(self, file_path: Path) -> bool:
        """Tải mô hình phân loại đã lưu từ file pickle."""
        if not file_path.exists():
            return False
        try:
            with open(file_path, "rb") as f:
                data = pickle.load(f)
                self.model = data["model"]
                self.metrics = data.get("metrics", {})
                self.is_trained = True
                logger.info(f"Classifier model loaded successfully from {file_path}")
                return True
        except Exception as e:
            logger.warning(f"Failed to load classifier model from {file_path}: {e}")
            return False
