"""
OzoneCast — Prediction Pipeline Test Suite
Kiểm thử toàn diện hệ thống AI dự báo Ozone và đánh giá rủi ro bức xạ:
1. Feature Engineering: Mã hóa chu kỳ lượng giác sin/cos, tọa độ cầu, proxy vật lý khí quyển.
2. Advisory Engine: Phân loại rủi ro WMO, khuyến cáo y tế sinh thái, mã màu cảnh báo.
3. Regressor & Classifier: Huấn luyện với kiểm định Hold-out 80/20, tính toán MAE, RMSE, R2, Accuracy, Proba.
4. Model Trainer: Phối hợp nạp/sinh dữ liệu chuẩn WMO và huấn luyện kép.
5. Facade OzonePredictionModel: Tính tương thích kép với PredictionPanel.jsx và TomorrowPredictionCard.jsx.
"""

import math
from datetime import datetime
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

from app.prediction.config import (
    FEATURE_NAMES,
    LABEL_DEPLETION,
    LABEL_HIGH_UV,
    LABEL_NORMAL,
    LABEL_HIGH_OZONE,
)
from app.prediction.features import FeatureEngineer
from app.prediction.advisory import AdvisoryEngine
from app.prediction.regressor import OzoneRegressor
from app.prediction.classifier import OzoneClassifier
from app.prediction.trainer import ModelTrainer
from app.prediction.model import OzonePredictionModel


# ==============================================================================
# 1. Feature Engineering Tests
# ==============================================================================

class TestFeatureEngineering:
    """Kiểm thử pipeline trích xuất và biến đổi đặc trưng khí quyển."""

    def test_extract_features_shape_and_columns(self):
        df = pd.DataFrame([
            {"lat": 10.82, "lon": 106.63, "refl": 18.5, "sza": 22.1, "timestamp": "2026-06-15T12:00:00Z"},
            {"lat": -68.5, "lon": 0.0, "refl": 45.0, "sza": 72.0, "timestamp": "2026-10-01T08:00:00Z"},
        ])
        features = FeatureEngineer.extract_features(df)

        assert features.shape == (2, len(FEATURE_NAMES))
        assert list(features.columns) == FEATURE_NAMES
        for col in FEATURE_NAMES:
            assert not features[col].isnull().any(), f"Column {col} contains NaN values."

    def test_cyclic_and_trigonometric_bounds(self):
        df = pd.DataFrame([
            {"lat": -90.0, "lon": -180.0, "timestamp": "2026-01-01T00:00:00Z"},
            {"lat": 0.0, "lon": 0.0, "timestamp": "2026-07-01T00:00:00Z"},
            {"lat": 90.0, "lon": 180.0, "timestamp": "2026-12-31T23:59:59Z"},
        ])
        features = FeatureEngineer.extract_features(df)

        # Trigonometric bounding checks: [-1.0, 1.0]
        trig_cols = ["sin_lat", "cos_lat", "sin_lon", "cos_lon", "sin_doy", "cos_doy"]
        for col in trig_cols:
            assert np.all(features[col] >= -1.0 - 1e-5), f"{col} below -1.0"
            assert np.all(features[col] <= 1.0 + 1e-5), f"{col} above 1.0"

        # abs_lat check: [0, 90]
        assert (features["abs_lat"] >= 0).all() and (features["abs_lat"] <= 90).all()

    def test_fallback_imputation_refl_sza(self):
        # Dataframe lacking refl and sza columns
        df = pd.DataFrame([
            {"lat": 0.0, "lon": 105.0},
            {"lat": 70.0, "lon": 30.0},
        ])
        features = FeatureEngineer.extract_features(df)

        assert "refl" in features.columns
        assert "sza" in features.columns
        # Equator (lat 0) should have lower SZA than Arctic (lat 70)
        assert features.loc[0, "sza"] < features.loc[1, "sza"]
        assert features.loc[0, "refl"] < features.loc[1, "refl"]


# ==============================================================================
# 2. Advisory Engine Tests
# ==============================================================================

class TestAdvisoryEngine:
    """Kiểm thử module quy đổi nồng độ Ozone thành khuyến cáo y tế và chỉ số nguy hại."""

    def test_depletion_risk_profile(self):
        profile = AdvisoryEngine.get_risk_profile(LABEL_DEPLETION, 180.0)
        assert profile["badge_color"] == "red"
        assert "Nguy hại cao" in profile["risk_level"]
        assert "Critical" in profile["risk_assessment"]
        assert "Ozone Hole" in profile["health_advisory"]

    def test_high_uv_risk_profile(self):
        profile = AdvisoryEngine.get_risk_profile(LABEL_HIGH_UV, 240.0)
        assert profile["badge_color"] == "amber"
        assert "Cảnh báo UV cao" in profile["risk_level"]
        assert "Elevated UV" in profile["risk_assessment"]
        assert "kem chống nắng" in profile["health_advisory"]

    def test_normal_risk_profile(self):
        profile = AdvisoryEngine.get_risk_profile(LABEL_NORMAL, 320.0)
        assert profile["badge_color"] == "green"
        assert "An toàn bình thường" in profile["risk_level"]
        assert "Standard Healthy" in profile["risk_assessment"]

    def test_high_ozone_risk_profile(self):
        profile = AdvisoryEngine.get_risk_profile(LABEL_HIGH_OZONE, 450.0)
        assert profile["badge_color"] == "purple"
        assert "Bất thường tăng cao" in profile["risk_level"]


# ==============================================================================
# 3. Regressor & Classifier Tests
# ==============================================================================

class TestModels:
    """Kiểm thử mô hình Hồi quy và Phân loại độc lập."""

    @pytest.fixture
    def synthetic_data(self):
        df = ModelTrainer._generate_realistic_training_dataset(n_samples=120)
        X = FeatureEngineer.extract_features(df)
        y_reg = df["ozone_du"]
        y_clf = df["ozone_du"].apply(ModelTrainer.assign_status_label)
        return X, y_reg, y_clf

    def test_regressor_training_and_metrics(self, synthetic_data, tmp_path):
        X, y_reg, _ = synthetic_data
        reg = OzoneRegressor()
        assert not reg.is_trained

        metrics = reg.train(X, y_reg)
        assert reg.is_trained
        assert "test_mae_du" in metrics
        assert "test_rmse_du" in metrics
        assert "test_r2" in metrics
        assert metrics["test_mae_du"] >= 0.0

        # Predict single point
        preds = reg.predict(X.iloc[[0]])
        assert len(preds) == 1
        assert 100.0 <= preds[0] <= 600.0

        # Persistence test
        model_file = tmp_path / "reg_test.pkl"
        reg.save(model_file)
        assert model_file.exists()

        new_reg = OzoneRegressor()
        assert new_reg.load(model_file)
        assert new_reg.is_trained
        assert new_reg.metrics["test_mae_du"] == metrics["test_mae_du"]

    def test_classifier_training_and_probabilities(self, synthetic_data, tmp_path):
        X, _, y_clf = synthetic_data
        clf = OzoneClassifier()
        assert not clf.is_trained

        metrics = clf.train(X, y_clf)
        assert clf.is_trained
        assert "test_accuracy" in metrics
        assert 0.0 <= metrics["test_accuracy"] <= 100.0
        assert len(metrics["classes"]) >= 2

        # Predict labels and probabilities
        preds = clf.predict(X.iloc[[0]])
        probs = clf.predict_proba(X.iloc[[0]])
        assert len(preds) == 1
        assert preds[0] in metrics["classes"]
        assert probs.shape == (1, len(metrics["classes"]))
        assert math.isclose(float(np.sum(probs)), 1.0, rel_tol=1e-3)

        # Persistence test
        clf_file = tmp_path / "clf_test.pkl"
        clf.save(clf_file)
        assert clf_file.exists()

        new_clf = OzoneClassifier()
        assert new_clf.load(clf_file)
        assert new_clf.is_trained
        assert new_clf.metrics["test_accuracy"] == metrics["test_accuracy"]


# ==============================================================================
# 4. Model Trainer Tests
# ==============================================================================

class TestModelTrainer:
    """Kiểm thử bộ điều phối huấn luyện và sinh dữ liệu chuẩn WMO."""

    def test_assign_status_label_boundaries(self):
        assert ModelTrainer.assign_status_label(200.0) == LABEL_DEPLETION
        assert ModelTrainer.assign_status_label(219.9) == LABEL_DEPLETION
        assert ModelTrainer.assign_status_label(220.0) == LABEL_HIGH_UV
        assert ModelTrainer.assign_status_label(264.9) == LABEL_HIGH_UV
        assert ModelTrainer.assign_status_label(265.0) == LABEL_NORMAL
        assert ModelTrainer.assign_status_label(424.9) == LABEL_NORMAL
        assert ModelTrainer.assign_status_label(425.1) == LABEL_HIGH_OZONE

    def test_realistic_dataset_synthesis(self):
        df = ModelTrainer._generate_realistic_training_dataset(n_samples=200)
        assert len(df) == 200
        assert {"lat", "lon", "refl", "sza", "ozone_du", "timestamp"}.issubset(df.columns)

        # Verify polar depletion presence
        depletion_samples = df[df["ozone_du"] < 220.0]
        assert len(depletion_samples) > 0, "Synthesized data must contain depletion samples (Antarctica)"

    def test_train_models_pipeline(self, tmp_path, monkeypatch):
        # Mock fetch_or_synthesize_data to use fast 80 samples
        monkeypatch.setattr(
            ModelTrainer,
            "fetch_or_synthesize_data",
            lambda limit=2000: ModelTrainer._generate_realistic_training_dataset(n_samples=80)
        )

        reg = OzoneRegressor()
        clf = OzoneClassifier()
        reg_path = tmp_path / "reg.pkl"
        clf_path = tmp_path / "clf.pkl"

        res = ModelTrainer.train_models(reg, clf, reg_path, clf_path)
        assert res["status"] == "trained"
        # Support both keys for UI compatibility
        assert "mae_du" in res and "regression_mae_du" in res
        assert "r2_score" in res and "regression_r2" in res
        assert "classification_accuracy" in res
        assert reg_path.exists()
        assert clf_path.exists()


# ==============================================================================
# 5. OzonePredictionModel Facade & UI Contract Tests
# ==============================================================================

class TestOzonePredictionModelFacade:
    """Kiểm thử Facade API đảm bảo tính tương thích với cả hai màn hình giao diện."""

    @pytest.fixture
    def trained_facade(self, tmp_path, monkeypatch):
        # Override model paths to isolated test directory
        monkeypatch.setattr("app.prediction.model.MODEL_DIR", tmp_path)
        # Mock fast synthesis
        monkeypatch.setattr(
            ModelTrainer,
            "fetch_or_synthesize_data",
            lambda limit=2000: ModelTrainer._generate_realistic_training_dataset(n_samples=80)
        )
        # Mock requests.post for caching
        class MockResponse:
            status_code = 200
            def json(self): return {"status": "ok"}

        monkeypatch.setattr("requests.post", lambda *args, **kwargs: MockResponse())

        model = OzonePredictionModel()
        model.reg_model_path = tmp_path / "ozone_regression_model.pkl"
        model.clf_model_path = tmp_path / "ozone_classification_model.pkl"
        model.train_from_database()
        return model

    def test_predict_contract_compatibility(self, trained_facade):
        # Lat/lon for Ho Chi Minh City, Vietnam
        res = trained_facade.predict(lat=10.82, lon=106.63)

        # 1. PredictionPanel.jsx required fields:
        assert "latitude" in res and res["latitude"] == 10.82
        assert "longitude" in res and res["longitude"] == 106.63
        assert "datetime" in res
        assert "risk_assessment" in res
        assert "predicted_ozone_du" in res

        # 2. TomorrowPredictionCard.jsx required fields:
        assert "target_datetime" in res
        assert "status_label" in res
        assert "confidence_percent" in res
        assert "health_advisory" in res
        assert "badge_color" in res

        # Logical ranges
        assert 100.0 <= res["predicted_ozone_du"] <= 600.0
        assert 0.0 <= res["confidence_percent"] <= 100.0

    def test_forecast_tomorrow_and_cache(self, trained_facade):
        card_data = trained_facade.forecast_tomorrow_and_cache()

        assert "target_date" in card_data
        assert "target_datetime" in card_data
        assert "predicted_ozone_du" in card_data
        assert "status_label" in card_data
        assert "health_advisory" in card_data
        assert "regional_forecasts" in card_data
        assert len(card_data["regional_forecasts"]) == 3

        # Primary region is Vietnam / South East Asia
        vietnam_forecast = card_data["regional_forecasts"][1]
        assert "Việt Nam" in vietnam_forecast["location_name"]
        assert vietnam_forecast["latitude"] == 14.05
