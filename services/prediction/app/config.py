"""
OzoneCast — Machine Learning Prediction Configuration
Cấu hình đường dẫn mô hình, siêu tham số thuật toán và ngưỡng phân loại rủi ro.
"""

import os
import logging
from pathlib import Path
from typing import List, Dict

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# ── Logging Setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] [%(levelname)s] [prediction] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("ozonecast.prediction")

# ── API Endpoints & Intervals ─────────────────────────────────────────────────
DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8000")
PREDICTION_INTERVAL_SECONDS = int(os.getenv("PREDICTION_INTERVAL_SECONDS", "300"))

# ── Model Storage Path ────────────────────────────────────────────────────────
# Sử dụng /app/models trong container Docker hoặc fallback ./models khi chạy local
_default_model_dir = Path("/app/models") if os.path.exists("/app") else Path("./models")
MODEL_DIR = Path(os.getenv("MODEL_DIR", str(_default_model_dir)))

# ── Feature Engineering Specification ─────────────────────────────────────────
FEATURE_NAMES: List[str] = [
    "lat",
    "lon",
    "abs_lat",
    "sin_lat",
    "cos_lat",
    "sin_lon",
    "cos_lon",
    "day_of_year",
    "month",
    "sin_doy",
    "cos_doy",
    "refl",
    "sza"
]

# ── Risk Classification Thresholds (WMO Standards) ───────────────────────────
# Ngưỡng nồng độ Ozone (Dobson Units - DU):
# < 220 DU: Lỗ thủng tầng Ozone / Nguy cơ suy giảm nghiêm trọng
# 220 - 265 DU: Tầng ozone mỏng, chỉ số cực tím UV cao
# 265 - 425 DU: Nồng độ tiêu chuẩn an toàn cho sinh thái
# > 425 DU: Nồng độ ozone tăng cao bất thường do tích tụ động lực học
LABEL_DEPLETION = "Bất thường (Nguy cơ suy giảm tầng Ozone)"
LABEL_HIGH_UV = "Cảnh báo UV cao"
LABEL_NORMAL = "Bình thường"
LABEL_HIGH_OZONE = "Bất thường (Nồng độ tăng vọt)"

# ── Model Hyperparameters ─────────────────────────────────────────────────────
RF_REGRESSOR_PARAMS: Dict = {
    "n_estimators": 100,
    "max_depth": 14,
    "min_samples_split": 3,
    "min_samples_leaf": 2,
    "random_state": 42,
    "n_jobs": -1
}

RF_CLASSIFIER_PARAMS: Dict = {
    "n_estimators": 100,
    "max_depth": 12,
    "min_samples_split": 3,
    "min_samples_leaf": 2,
    "random_state": 42,
    "n_jobs": -1
}
