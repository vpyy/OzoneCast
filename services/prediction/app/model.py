"""
OzoneCast — Master Ozone AI Prediction Model (Facade)
Tích hợp toàn diện pipeline Học máy & Trí tuệ nhân tạo (Machine Learning Pipeline):
1. Trích xuất đặc trưng không - thời gian và khí quyển (Feature Engineering)
2. Mô hình Hồi quy rừng ngẫu nhiên (Random Forest Regressor)
3. Mô hình Phân loại rủi ro tia cực tím (Random Forest Classifier)
4. Động cơ đánh giá rủi ro & khuyến cáo y tế sinh thái (Advisory Engine)
5. Bộ điều phối huấn luyện kiểm thử kép (Dual-Model Trainer)
6. Tự động sinh thẻ dự báo ngày mai và lưu trữ vào Cache API
"""

from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List
import numpy as np
import pandas as pd
import requests

from .config import (
    MODEL_DIR,
    DATABASE_API_URL,
    logger
)
from .features import FeatureEngineer
from .advisory import AdvisoryEngine
from .regressor import OzoneRegressor
from .classifier import OzoneClassifier
from .trainer import ModelTrainer


class OzonePredictionModel:
    """Facade orchestrator điều phối toàn bộ nghiệp vụ dự báo máy học tầng Ozone."""

    def __init__(self):
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        self.reg_model_path = MODEL_DIR / "ozone_regression_model.pkl"
        self.clf_model_path = MODEL_DIR / "ozone_classification_model.pkl"

        self.reg_model = OzoneRegressor()
        self.clf_model = OzoneClassifier()
        self._load_if_exists()

    def _load_if_exists(self):
        """Khởi nạp mô hình từ đĩa nếu đã tồn tại file lưu trữ."""
        loaded_reg = self.reg_model.load(self.reg_model_path)
        loaded_clf = self.clf_model.load(self.clf_model_path)
        if not (loaded_reg and loaded_clf):
            logger.info("One or more models not loaded from disk. Will train on demand.")

    @staticmethod
    def _extract_features(df: pd.DataFrame) -> pd.DataFrame:
        """Trích xuất ma trận đặc trưng đầu vào (tương thích backward compatibility)."""
        return FeatureEngineer.extract_features(df)

    @staticmethod
    def _assign_status_label(ozone_du: float) -> str:
        """Gán nhãn cảnh báo dựa trên nồng độ Ozone (tương thích backward compatibility)."""
        return ModelTrainer.assign_status_label(ozone_du)

    def train_from_database(self) -> Dict[str, Any]:
        """
        Huấn luyện đồng thời cả 2 mô hình:
        1. Hồi quy nồng độ Ozone (DU)
        2. Phân loại nhãn cảnh báo rủi ro
        Tự động cập nhật thẻ dự báo ngày mai vào Cache API.
        """
        metrics = ModelTrainer.train_models(
            regressor=self.reg_model,
            classifier=self.clf_model,
            reg_path=self.reg_model_path,
            clf_path=self.clf_model_path
        )

        # Cập nhật dự báo ngày mai sau khi hoàn tất huấn luyện
        try:
            self.forecast_tomorrow_and_cache()
        except Exception as e:
            logger.warning(f"Auto-update tomorrow forecast failed after training: {e}")

        return metrics

    def predict(self, lat: float, lon: float, dt: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Dự báo đồng thời giá trị Hồi quy và Nhãn phân loại theo tọa độ địa lý.
        Trả về dictionary tương thích 100% với cả PredictionPanel.jsx và TomorrowPredictionCard.jsx.
        """
        if not (self.reg_model.is_trained and self.clf_model.is_trained):
            logger.info("Models not yet trained. Initiating automatic training from database...")
            self.train_from_database()

        target_dt = dt or (datetime.utcnow() + timedelta(days=1))
        refl = float(15.0 + 35.0 * (abs(lat) / 70.0) ** 2)
        sza = float(15.0 + 60.0 * (abs(lat) / 70.0))

        input_df = pd.DataFrame([{
            "lat": float(lat),
            "lon": float(lon),
            "refl": refl,
            "sza": sza,
            "timestamp": target_dt
        }])

        X = FeatureEngineer.extract_features(input_df)

        pred_du = float(self.reg_model.predict(X)[0])
        status_label = str(self.clf_model.predict(X)[0])
        probabilities = self.clf_model.predict_proba(X)[0]
        confidence = float(np.max(probabilities))

        # Phân tích rủi ro và khuyến cáo
        risk_profile = AdvisoryEngine.get_risk_profile(status_label, pred_du)

        return {
            "latitude": round(float(lat), 3),
            "longitude": round(float(lon), 3),
            # Khóa datetime cho PredictionPanel.jsx
            "datetime": target_dt.isoformat(),
            # Khóa target_datetime cho TomorrowPredictionCard.jsx
            "target_datetime": target_dt.isoformat(),
            "predicted_ozone_du": round(pred_du, 2),
            "status_label": status_label,
            # Khóa risk_assessment cho PredictionPanel.jsx
            "risk_assessment": risk_profile["risk_assessment"],
            "confidence_percent": round(confidence * 100, 1),
            "badge_color": risk_profile["badge_color"],
            "health_advisory": risk_profile["health_advisory"],
            "unit": "Dobson Units (DU)"
        }

    def forecast_tomorrow_and_cache(self) -> Dict[str, Any]:
        """
        Tạo thẻ dự báo tổng hợp cho ngày mai gửi vào Database API cache:
        - 2 thẻ to chính (Regression & Classification): Tính trung bình cộng của lưới mẫu đại diện
          phủ kín toàn bộ vùng nghiên cứu Bán đảo Nam Cực (-70° đến -63° vĩ Nam, -75° đến -55° kinh Tây).
        - Giữ nguyên danh sách các trạm khu vực trong regional_forecasts theo yêu cầu.
        """
        tomorrow = datetime.utcnow() + timedelta(days=1)

        # 1. Dự báo cho các trạm quan trắc khu vực (giữ nguyên regional_forecasts)
        locs = [
            {"name": "Toàn cầu (Trung bình)", "lat": 10.0, "lon": 105.0},
            {"name": "Khu vực Đông Nam Á (Việt Nam)", "lat": 14.05, "lon": 108.27},
            {"name": "Vùng Cực Nam (Nam Cực)", "lat": -68.0, "lon": 0.0}
        ]

        forecasts = []
        for loc in locs:
            res = self.predict(loc["lat"], loc["lon"], tomorrow)
            res["location_name"] = loc["name"]
            forecasts.append(res)

        # 2. Tạo lưới mẫu đại diện phủ kín toàn bộ Bán đảo Nam Cực (-70° đến -63° Lat, -75° đến -55° Lon)
        # Lưới bước nhảy 1.0° để dự báo nhanh và đại diện toàn vùng
        peninsula_lats = np.arange(-70.0, -62.5, 1.0)
        peninsula_lons = np.arange(-75.0, -54.5, 2.0)

        grid_points = []
        for plat in peninsula_lats:
            for plon in peninsula_lons:
                refl = float(15.0 + 35.0 * (abs(plat) / 70.0) ** 2)
                sza = float(15.0 + 60.0 * (abs(plat) / 70.0))
                grid_points.append({
                    "lat": float(plat),
                    "lon": float(plon),
                    "refl": refl,
                    "sza": sza,
                    "timestamp": tomorrow
                })

        grid_df = pd.DataFrame(grid_points)
        grid_X = FeatureEngineer.extract_features(grid_df)

        # Chạy dự báo cho toàn bộ các điểm trên Bán đảo Nam Cực
        grid_pred_du = self.reg_model.predict(grid_X)
        grid_clf_probs = self.clf_model.predict_proba(grid_X)

        # Tính trung bình cộng nồng độ Ozone (DU) của toàn bộ vùng Bán đảo Nam Cực
        mean_peninsula_du = round(float(np.mean(grid_pred_du)), 2)

        # Phân loại rủi ro tổng thể dựa trên phân phối xác suất và nồng độ trung bình
        avg_probs = np.mean(grid_clf_probs, axis=0)
        clf_classes = getattr(self.clf_model.model, "classes_", None)
        if clf_classes is not None and len(clf_classes) == len(avg_probs):
            best_idx = int(np.argmax(avg_probs))
            status_label = str(clf_classes[best_idx])
            confidence = float(avg_probs[best_idx])
        else:
            status_label = ModelTrainer.assign_status_label(mean_peninsula_du)
            confidence = float(np.max(avg_probs))

        # Phân tích rủi ro và khuyến cáo cho toàn vùng Bán đảo Nam Cực
        risk_profile = AdvisoryEngine.get_risk_profile(status_label, mean_peninsula_du)

        payload = {
            "target_date": tomorrow.strftime("%d/%m/%Y"),
            "target_datetime": tomorrow.isoformat(),
            "predicted_ozone_du": mean_peninsula_du,
            "status_label": status_label,
            "risk_assessment": risk_profile["risk_assessment"],
            "confidence_percent": round(confidence * 100, 1),
            "badge_color": risk_profile["badge_color"],
            "health_advisory": risk_profile["health_advisory"],
            "regional_forecasts": forecasts,
            "updated_at": datetime.utcnow().isoformat()
        }

        try:
            resp = requests.post(
                f"{DATABASE_API_URL}/api/cache/prediction_tomorrow",
                json=payload,
                timeout=10
            )
            if resp.status_code == 200:
                logger.info("Tomorrow prediction cache updated successfully.")
        except Exception as e:
            logger.warning(f"Could not update prediction_tomorrow cache ({e})")

        return payload
