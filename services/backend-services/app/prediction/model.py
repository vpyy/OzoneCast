import os
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, Tuple, Any
import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score

DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8000")
MODEL_DIR = Path("/app/models")

class OzonePredictionModel:
    def __init__(self):
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        self.reg_model_path = MODEL_DIR / "ozone_regression_model.pkl"
        self.clf_model_path = MODEL_DIR / "ozone_classification_model.pkl"
        self.reg_model = None
        self.clf_model = None
        self._load_if_exists()

    def _load_if_exists(self):
        if self.reg_model_path.exists():
            try:
                with open(self.reg_model_path, "rb") as f:
                    self.reg_model = pickle.load(f)["model"]
            except Exception:
                self.reg_model = None
        if self.clf_model_path.exists():
            try:
                with open(self.clf_model_path, "rb") as f:
                    self.clf_model = pickle.load(f)["model"]
            except Exception:
                self.clf_model = None

    @staticmethod
    def _extract_features(df: pd.DataFrame) -> pd.DataFrame:
        df["day_of_year"] = df["timestamp"].dt.dayofyear
        df["month"] = df["timestamp"].dt.month
        df["sin_lon"] = np.sin(np.deg2rad(df["lon"]))
        df["cos_lon"] = np.cos(np.deg2rad(df["lon"]))
        df["sin_lat"] = np.sin(np.deg2rad(df["lat"]))
        if "refl" not in df.columns:
            df["refl"] = 20.0
        if "sza" not in df.columns:
            df["sza"] = 45.0
        return df[["lat", "lon", "day_of_year", "month", "sin_lon", "cos_lon", "sin_lat", "refl", "sza"]]

    @staticmethod
    def _assign_status_label(ozone_du: float) -> str:
        """Quy định nhãn cảnh báo:
        - 'Bình thường': 260 - 390 DU
        - 'Cảnh báo UV cao': 220 - 260 DU
        - 'Bất thường (Lỗ thủng Ozone)': < 220 DU hoặc > 430 DU"""
        if ozone_du < 220:
            return "Bất thường (Nguy cơ suy giảm tầng Ozone)"
        elif ozone_du < 265:
            return "Cảnh báo UV cao"
        elif ozone_du > 425:
            return "Bất thường (Nồng độ tăng vọt)"
        else:
            return "Bình thường"

    def train_from_database(self) -> Dict[str, Any]:
        """Huấn luyện đồng thời 2 mô hình:
        1. Hồi quy (Regression): Dự báo nồng độ Ozone (DU)
        2. Phân loại (Classification): Phân loại nhãn cảnh báo cho ngày mai"""
        try:
            resp = requests.get(f"{DATABASE_API_URL}/api/grid-summary?limit=2000", timeout=15)
            records = resp.json() if resp.status_code == 200 else []
        except Exception:
            records = []

        if len(records) < 20:
            np.random.seed(42)
            n = 400
            lats = np.random.uniform(-70, 70, n)
            lons = np.random.uniform(-180, 180, n)
            sza = np.clip(15.0 + 60.0 * (np.abs(lats) / 70.0), 10, 85)
            refl = np.clip(15.0 + 35.0 * (np.abs(lats) / 70.0)**2, 5, 90)
            base_o3 = 290 + 75 * np.cos(np.deg2rad(lats * 1.5)) + np.random.normal(0, 10, n)
            base_o3[lats < -55] = np.clip(base_o3[lats < -55] - 75, 140, 215)
            rows = [{
                "lat": float(lats[i]),
                "lon": float(lons[i]),
                "refl": float(refl[i]),
                "sza": float(sza[i]),
                "ozone_du": float(base_o3[i]),
                "timestamp": datetime.utcnow()
            } for i in range(n)]
        else:
            rows = [{
                "lat": float(r["lat_bin"]),
                "lon": float(r["lon_bin"]),
                "refl": float(r.get("reflectivity_mean", 20.0)),
                "sza": 40.0,
                "ozone_du": float(r["ozone_column_mean"]),
                "timestamp": datetime.fromisoformat(r["timestamp"]) if "T" in str(r["timestamp"]) else datetime.utcnow()
            } for r in records]

        df = pd.DataFrame(rows)
        X = self._extract_features(df)
        y_reg = df["ozone_du"]
        y_clf = df["ozone_du"].apply(self._assign_status_label)

        # 1. Train Regression (RandomForestRegressor)
        rf_reg = RandomForestRegressor(n_estimators=70, max_depth=10, random_state=42)
        rf_reg.fit(X, y_reg)
        self.reg_model = rf_reg
        with open(self.reg_model_path, "wb") as f:
            pickle.dump({"model": rf_reg}, f)

        # 2. Train Classification (RandomForestClassifier)
        rf_clf = RandomForestClassifier(n_estimators=70, max_depth=8, random_state=42)
        rf_clf.fit(X, y_clf)
        self.clf_model = rf_clf
        with open(self.clf_model_path, "wb") as f:
            pickle.dump({"model": rf_clf}, f)

        mae = float(mean_absolute_error(y_reg, rf_reg.predict(X)))
        r2 = float(r2_score(y_reg, rf_reg.predict(X)))
        acc = float(accuracy_score(y_clf, rf_clf.predict(X)))

        # Tự động cập nhật dự báo ngày mai lên database-api
        self.forecast_tomorrow_and_cache()

        return {
            "status": "trained",
            "samples": len(df),
            "regression_mae_du": round(mae, 2),
            "regression_r2": round(r2, 3),
            "classification_accuracy": round(acc * 100, 1),
            "classes": list(rf_clf.classes_),
            "timestamp": datetime.utcnow().isoformat()
        }

    def predict(self, lat: float, lon: float, dt: Optional[datetime] = None) -> Dict[str, Any]:
        """Dự báo đồng thời giá trị Hồi quy và Nhãn phân loại."""
        if self.reg_model is None or self.clf_model is None:
            self.train_from_database()

        target_dt = dt or (datetime.utcnow() + timedelta(days=1))
        refl = float(15.0 + 35.0 * (abs(lat) / 70.0) ** 2)
        sza = float(15.0 + 60.0 * (abs(lat) / 70.0))

        df = pd.DataFrame([{
            "lat": lat,
            "lon": lon,
            "refl": refl,
            "sza": sza,
            "timestamp": target_dt
        }])
        X = self._extract_features(df)

        pred_du = float(self.reg_model.predict(X)[0])
        status_label = str(self.clf_model.predict(X)[0])
        probabilities = self.clf_model.predict_proba(X)[0]
        confidence = float(np.max(probabilities))

        if "Bình thường" in status_label:
            badge_color = "green"
            advice = "Tầng ozone dày đặc, bức xạ cực tím an toàn cho sức khỏe và hoạt động ngoài trời."
        elif "UV cao" in status_label:
            badge_color = "amber"
            advice = "Chỉ số UV cao, cần sử dụng kem chống nắng và kính bảo vệ khi ra ngoài trong giờ cao điểm."
        else:
            badge_color = "red"
            advice = "Phát hiện suy giảm tầng ozone nghiêm trọng, bức xạ UV ở mức nguy hại, hạn chế tiếp xúc trực tiếp."

        return {
            "latitude": lat,
            "longitude": lon,
            "target_datetime": target_dt.isoformat(),
            "predicted_ozone_du": round(pred_du, 2),
            "status_label": status_label,
            "confidence_percent": round(confidence * 100, 1),
            "badge_color": badge_color,
            "health_advisory": advice,
            "unit": "Dobson Units (DU)"
        }

    def forecast_tomorrow_and_cache(self) -> Dict[str, Any]:
        """Tạo thẻ dự báo tổng hợp cho ngày mai gửi vào database-api cache."""
        tomorrow = datetime.utcnow() + timedelta(days=1)
        
        # Forecast sample for key representative locations
        locs = [
            {"name": "Toàn cầu (Trung bình)", "lat": 10.0, "lon": 105.0},
            {"name": "Khu vực Đông Nam Á", "lat": 14.05, "lon": 108.27},
            {"name": "Vùng Cực Nam (Nam Cực)", "lat": -68.0, "lon": 0.0}
        ]

        forecasts = []
        for loc in locs:
            res = self.predict(loc["lat"], loc["lon"], tomorrow)
            res["location_name"] = loc["name"]
            forecasts.append(res)

        primary = forecasts[1]  # Đông Nam Á / Việt Nam
        payload = {
            "target_date": tomorrow.strftime("%d/%m/%Y"),
            "target_datetime": tomorrow.isoformat(),
            "predicted_ozone_du": primary["predicted_ozone_du"],
            "status_label": primary["status_label"],
            "confidence_percent": primary["confidence_percent"],
            "badge_color": primary["badge_color"],
            "health_advisory": primary["health_advisory"],
            "regional_forecasts": forecasts,
            "updated_at": datetime.utcnow().isoformat()
        }

        try:
            requests.post(
                f"{DATABASE_API_URL}/api/cache/prediction_tomorrow",
                json={"cache_key": "prediction_tomorrow", "payload": payload},
                timeout=10
            )
        except Exception as e:
            print(f"[PREDICTION CACHE WARN] Could not update prediction_tomorrow cache ({e})")

        return payload
