import os
import pickle
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple
import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8001")
MODEL_DIR = Path("/app/models")

class OzonePredictionModel:
    def __init__(self):
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        self.model_path = MODEL_DIR / "ozone_rf_model.pkl"
        self.model = None
        self._load_if_exists()

    def _load_if_exists(self):
        if self.model_path.exists():
            try:
                with open(self.model_path, "rb") as f:
                    data = pickle.load(f)
                    self.model = data["model"]
            except Exception:
                self.model = None

    @staticmethod
    def _extract_features(df: pd.DataFrame) -> pd.DataFrame:
        df["hour"] = df["timestamp"].dt.hour
        df["day_of_year"] = df["timestamp"].dt.dayofyear
        df["month"] = df["timestamp"].dt.month
        df["sin_lon"] = np.sin(np.deg2rad(df["lon"]))
        df["cos_lon"] = np.cos(np.deg2rad(df["lon"]))
        df["sin_lat"] = np.sin(np.deg2rad(df["lat"]))
        return df[["lat", "lon", "hour", "day_of_year", "month", "sin_lon", "cos_lon", "sin_lat"]]

    def train_from_database(self) -> Dict:
        try:
            resp = requests.get(f"{DATABASE_API_URL}/api/grid-summary?limit=2000", timeout=15)
            records = resp.json() if resp.status_code == 200 else []
        except Exception:
            records = []

        if len(records) < 15:
            # Generate synthetic training baseline if database is young
            np.random.seed(42)
            n_samples = 300
            lats = np.random.uniform(-65, 65, n_samples)
            lons = np.random.uniform(-180, 180, n_samples)
            base_o3 = 290 + 75 * np.cos(np.deg2rad(lats * 1.5)) + np.random.normal(0, 10, n_samples)
            rows = [{
                "lat": float(lats[i]),
                "lon": float(lons[i]),
                "ozone_du": float(base_o3[i]),
                "timestamp": datetime.utcnow()
            } for i in range(n_samples)]
        else:
            rows = [{
                "lat": float(r["lat_bin"]),
                "lon": float(r["lon_bin"]),
                "ozone_du": float(r["ozone_column_mean"]),
                "timestamp": datetime.fromisoformat(r["timestamp"]) if "T" in str(r["timestamp"]) else datetime.utcnow()
            } for r in records]

        df = pd.DataFrame(rows)
        X = self._extract_features(df)
        y = df["ozone_du"]

        rf = RandomForestRegressor(n_estimators=80, max_depth=10, random_state=42)
        rf.fit(X, y)
        self.model = rf

        with open(self.model_path, "wb") as f:
            pickle.dump({"model": self.model}, f)

        y_pred = rf.predict(X)
        mae = float(mean_absolute_error(y, y_pred))
        r2 = float(r2_score(y, y_pred))

        return {
            "status": "trained",
            "samples": len(df),
            "mae_du": round(mae, 2),
            "r2_score": round(r2, 3),
            "timestamp": datetime.utcnow().isoformat()
        }

    def predict(self, lat: float, lon: float, dt: Optional[datetime] = None) -> Dict:
        if self.model is None:
            self.train_from_database()

        dt = dt or datetime.utcnow()
        df = pd.DataFrame([{
            "lat": lat,
            "lon": lon,
            "timestamp": dt
        }])
        X = self._extract_features(df)
        pred_du = float(self.model.predict(X)[0])

        # Evaluate risk level
        # Normal total column ozone is 280-350 DU. <220 DU is severe depletion (Ozone hole).
        if pred_du < 200:
            risk = "CRITICAL (Severe Ozone Depletion / High UV Danger)"
        elif pred_du < 250:
            risk = "WARNING (Low Ozone Layer)"
        elif pred_du > 420:
            risk = "ELEVATED (High Ozone Concentration)"
        else:
            risk = "NORMAL (Safe Global Standard)"

        return {
            "latitude": lat,
            "longitude": lon,
            "datetime": dt.isoformat(),
            "predicted_ozone_du": round(pred_du, 2),
            "risk_assessment": risk,
            "unit": "Dobson Units (DU)"
        }

