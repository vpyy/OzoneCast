import os
import pickle
from datetime import datetime
from pathlib import Path
from typing import Dict, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from config.settings import settings
from src.db.models import SessionLocal, OzoneGridSummary

class OzoneForecastModel:
    """Gold Layer ML: Time-series & Spatial Regressor for Ozone column prediction"""

    def __init__(self, model_dir: Optional[str] = None):
        self.db = SessionLocal()
        self.model_dir = Path(model_dir or settings.BASE_DIR / "models")
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.model_path = self.model_dir / "ozone_predictor.pkl"
        self.model = None

    def load_training_data(self) -> pd.DataFrame:
        """Loads processed silver layer spatial summaries from DB"""
        records = self.db.query(OzoneGridSummary).all()
        if not records:
            return pd.DataFrame()

        rows = [{
            "lat": r.lat_bin,
            "lon": r.lon_bin,
            "ozone_du": r.ozone_column_mean,
            "timestamp": r.timestamp
        } for r in records]

        df = pd.DataFrame(rows)
        # Feature Engineering: Temporal and Spatial cyclic features
        df["hour"] = df["timestamp"].dt.hour
        df["day_of_year"] = df["timestamp"].dt.dayofyear
        df["month"] = df["timestamp"].dt.month
        
        # Spatial Sin/Cos encoding for periodic coordinates
        df["sin_lon"] = np.sin(np.deg2rad(df["lon"]))
        df["cos_lon"] = np.cos(np.deg2rad(df["lon"]))
        df["sin_lat"] = np.sin(np.deg2rad(df["lat"]))
        
        return df

    def train(self, test_size: float = 0.2) -> Dict[str, float]:
        """Trains Random Forest model on engineered spatial-temporal features"""
        df = self.load_training_data()
        if len(df) < 20:
            raise ValueError(f"Insufficient data for training: only {len(df)} samples available. Need at least 20.")

        feature_cols = ["lat", "lon", "hour", "day_of_year", "month", "sin_lon", "cos_lon", "sin_lat"]
        X = df[feature_cols]
        y = df["ozone_du"]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)

        print(f"[ML] Training Ozone Regressor on {len(X_train)} samples...")
        self.model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
        self.model.fit(X_train, y_train)

        # Evaluation
        y_pred = self.model.predict(X_test)
        metrics = {
            "MAE": float(mean_absolute_error(y_test, y_pred)),
            "RMSE": float(np.sqrt(mean_squared_error(y_test, y_pred))),
            "R2": float(r2_score(y_test, y_pred))
        }

        # Save model
        with open(self.model_path, "wb") as f:
            pickle.dump({"model": self.model, "features": feature_cols, "metrics": metrics}, f)

        print(f"[ML] Training completed. Saved to {self.model_path}")
        print(f"[ML] Metrics: MAE={metrics['MAE']:.2f} DU | RMSE={metrics['RMSE']:.2f} DU | R²={metrics['R2']:.3f}")
        return metrics

    def predict(self, lat: float, lon: float, dt: Optional[datetime] = None) -> float:
        """Predicts Ozone column (DU) for a target coordinate and timestamp"""
        if self.model is None:
            if not self.model_path.exists():
                raise FileNotFoundError("Model not trained yet. Run 'python main.py train-model' first.")
            with open(self.model_path, "rb") as f:
                checkpoint = pickle.load(f)
                self.model = checkpoint["model"]

        dt = dt or datetime.utcnow()
        features = pd.DataFrame([{
            "lat": lat,
            "lon": lon,
            "hour": dt.hour,
            "day_of_year": dt.timetuple().tm_yday,
            "month": dt.month,
            "sin_lon": np.sin(np.deg2rad(lon)),
            "cos_lon": np.cos(np.deg2rad(lon)),
            "sin_lat": np.sin(np.deg2rad(lat))
        }])

        pred = self.model.predict(features)[0]
        return float(pred)

