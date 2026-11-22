"""
OzoneCast — Random Forest Ozone Regressor
Mô hình hồi quy dự báo định lượng nồng độ Ozone (Dobson Units - DU):
- RandomForestRegressor với tối ưu hóa cây quyết định
- Kiểm định đánh giá nghiêm ngặt qua tập kiểm tra Hold-out (Train/Test Split 80/20)
- Trích xuất các chỉ số định lượng: MAE, RMSE, R² Score
"""

import pickle
from pathlib import Path
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from .config import RF_REGRESSOR_PARAMS, logger


class OzoneRegressor:
    """Mô hình hồi quy dự báo giá trị nồng độ Ozone liên tục."""

    def __init__(self):
        self.model: RandomForestRegressor = RandomForestRegressor(**RF_REGRESSOR_PARAMS)
        self.is_trained: bool = False
        self.metrics: Dict[str, Any] = {}

    def train(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
        """Huấn luyện mô hình và đánh giá qua kiểm thử phân tách 80/20."""
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.20, random_state=42
        )

        self.model.fit(X_train, y_train)
        self.is_trained = True

        y_pred_test = self.model.predict(X_test)
        mae = float(mean_absolute_error(y_test, y_pred_test))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
        r2 = float(r2_score(y_test, y_pred_test))

        self.metrics = {
            "test_mae_du": round(mae, 2),
            "test_rmse_du": round(rmse, 2),
            "test_r2": round(r2, 3),
            "train_samples": len(X_train),
            "test_samples": len(X_test)
        }
        logger.info(f"RandomForestRegressor trained: Test MAE={mae:.2f} DU, R²={r2:.3f}")
        return self.metrics

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Dự báo nồng độ Ozone theo đơn vị Dobson Units."""
        if not self.is_trained:
            raise RuntimeError("Mô hình hồi quy chưa được huấn luyện hoặc tải lên.")
        return self.model.predict(X)

    def save(self, file_path: Path):
        """Lưu trữ mô hình và metadata ra file pickle."""
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            pickle.dump({"model": self.model, "metrics": self.metrics}, f)
        logger.info(f"Regressor model saved to {file_path}")

    def load(self, file_path: Path) -> bool:
        """Tải mô hình đã lưu từ file pickle."""
        if not file_path.exists():
            return False
        try:
            with open(file_path, "rb") as f:
                data = pickle.load(f)
                self.model = data["model"]
                self.metrics = data.get("metrics", {})
                self.is_trained = True
                logger.info(f"Regressor model loaded successfully from {file_path}")
                return True
        except Exception as e:
            logger.warning(f"Failed to load regressor model from {file_path}: {e}")
            return False
