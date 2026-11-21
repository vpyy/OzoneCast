"""
OzoneCast — Dual-Model Training Orchestrator
Điều phối thu thập dữ liệu huấn luyện, tiền xử lý và huấn luyện đồng thời 2 mô hình:
1. Mô hình Hồi quy (Regression: RandomForestRegressor)
2. Mô hình Phân loại (Classification: RandomForestClassifier)
"""

from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
import requests

from .config import (
    DATABASE_API_URL,
    LABEL_DEPLETION,
    LABEL_HIGH_UV,
    LABEL_NORMAL,
    LABEL_HIGH_OZONE,
    logger
)
from .features import FeatureEngineer
from .regressor import OzoneRegressor
from .classifier import OzoneClassifier


class ModelTrainer:
    """Module điều phối quy trình huấn luyện cho bộ đôi mô hình AI."""

    @staticmethod
    def assign_status_label(ozone_du: float) -> str:
        """Quy định nhãn cảnh báo phân loại theo nồng độ Ozone (WMO):"""
        if ozone_du < 220.0:
            return LABEL_DEPLETION
        elif ozone_du < 265.0:
            return LABEL_HIGH_UV
        elif ozone_du > 425.0:
            return LABEL_HIGH_OZONE
        else:
            return LABEL_NORMAL

    @classmethod
    def fetch_or_synthesize_data(cls, limit: int = 2000) -> pd.DataFrame:
        """
        Truy xuất dữ liệu ô lưới từ Database API.
        Nếu dữ liệu chưa đủ phong phú, tăng cường dữ liệu khí quyển mô phỏng chuẩn.
        """
        records = []
        try:
            resp = requests.get(f"{DATABASE_API_URL}/api/grid-summary?limit={limit}", timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) >= 30:
                    records = data
                    logger.info(f"Fetched {len(records)} grid summary records for ML training.")
        except Exception as e:
            logger.warning(f"Could not fetch grid data for training ({e})")

        if len(records) >= 30:
            rows = []
            for r in records:
                lat = float(r["lat_bin"])
                lon = float(r["lon_bin"])
                ts_str = str(r.get("timestamp", ""))
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                except Exception:
                    ts = datetime.utcnow()

                refl = float(r.get("reflectivity_mean") or (15.0 + 35.0 * (abs(lat) / 70.0) ** 2))
                sza = 15.0 + 60.0 * (abs(lat) / 70.0)
                o3 = float(r["ozone_column_mean"])
                rows.append({"lat": lat, "lon": lon, "refl": refl, "sza": sza, "ozone_du": o3, "timestamp": ts})
            return pd.DataFrame(rows)

        # Tạo bộ dữ liệu khí quyển vật lý chuẩn WMO (500 mẫu đại diện toàn cầu)
        logger.info("Synthesizing realistic global atmospheric dataset for initial ML model training.")
        return cls._generate_realistic_training_dataset(n_samples=500)

    @classmethod
    def train_models(
        cls,
        regressor: OzoneRegressor,
        classifier: OzoneClassifier,
        reg_path: Path,
        clf_path: Path
    ) -> Dict[str, Any]:
        """Huấn luyện cả hai mô hình Hồi quy & Phân loại và lưu ra đĩa."""
        df = cls.fetch_or_synthesize_data(limit=2000)
        X = FeatureEngineer.extract_features(df)
        y_reg = df["ozone_du"]
        y_clf = df["ozone_du"].apply(cls.assign_status_label)

        # 1. Huấn luyện Hồi quy
        reg_metrics = regressor.train(X, y_reg)
        regressor.save(reg_path)

        # 2. Huấn luyện Phân loại
        clf_metrics = classifier.train(X, y_clf)
        classifier.save(clf_path)

        # Trả về payload tương thích với cả PredictionPanel.jsx và TomorrowPredictionCard.jsx
        mae = reg_metrics["test_mae_du"]
        r2 = reg_metrics["test_r2"]
        acc = clf_metrics["test_accuracy"]

        return {
            "status": "trained",
            "samples": len(df),
            # Khóa cho PredictionPanel.jsx
            "mae_du": mae,
            "r2_score": r2,
            # Khóa truyền thống cho các service khác
            "regression_mae_du": mae,
            "regression_r2": r2,
            "classification_accuracy": acc,
            "classes": clf_metrics["classes"],
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def _generate_realistic_training_dataset(n_samples: int = 500) -> pd.DataFrame:
        """Sinh dữ liệu khí quyển vật lý phủ khắp các vùng địa lý và điều kiện thời tiết."""
        np.random.seed(42)
        lats = np.random.uniform(-75.0, 75.0, n_samples)
        lons = np.random.uniform(-180.0, 180.0, n_samples)

        sza = np.clip(15.0 + 55.0 * (np.abs(lats) / 75.0) + np.random.normal(0, 3, n_samples), 10.0, 85.0)
        refl = np.clip(15.0 + 35.0 * (np.abs(lats) / 75.0) ** 2 + np.random.normal(0, 4, n_samples), 5.0, 95.0)

        # Nồng độ Ozone theo vĩ độ và bức xạ mặt trời
        base_o3 = 295.0 + 70.0 * np.cos(np.deg2rad(lats * 1.4)) + np.random.normal(0, 9, n_samples)
        # Giảm sâu ở vùng Nam Cực tạo lỗ thủng ozone
        antarctic_mask = (lats < -55.0)
        base_o3[antarctic_mask] = np.clip(base_o3[antarctic_mask] - 85.0, 120.0, 215.0)

        now = datetime.utcnow()
        rows = []
        for i in range(n_samples):
            rows.append({
                "lat": float(lats[i]),
                "lon": float(lons[i]),
                "refl": float(refl[i]),
                "sza": float(sza[i]),
                "ozone_du": round(float(base_o3[i]), 2),
                "timestamp": now
            })
        return pd.DataFrame(rows)
