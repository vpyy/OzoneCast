"""
OzoneCast — Spatial & Atmospheric Clustering Configuration
Cấu hình chuẩn hóa các biến số, trọng số đặc trưng và ngưỡng phân loại khí quyển.
"""

import os
import logging
from typing import Dict, List

# ── Logging Setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [CLUSTERING] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("ozonecast.clustering")

# ── API Endpoints ─────────────────────────────────────────────────────────────
DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8000")

# ── Feature Specification ─────────────────────────────────────────────────────
# 4 biến đặc trưng cốt lõi theo kiến trúc đề án:
# Latitude (Vĩ độ), Longitude (Kinh độ), Ozone (DU), Reflectivity331 (%)
FEATURE_COLUMNS: List[str] = [
    "lat_bin",
    "lon_bin",
    "ozone_column_mean",
    "reflectivity_mean"
]

# Trọng số đặc trưng (Domain Feature Weights):
# Tăng nhẹ trọng số cho Ozone (1.5) và Reflectivity (1.2) để thuật toán phân cụm
# phản ánh rõ tính chất vật lý khí quyển thay vì chỉ bị chi phối thuần túy bởi tọa độ.
FEATURE_WEIGHTS: Dict[str, float] = {
    "lat_bin": 1.0,
    "lon_bin": 0.8,
    "ozone_column_mean": 1.5,
    "reflectivity_mean": 1.2
}

# ── Default Algorithm Hyperparameters ─────────────────────────────────────────
DEFAULT_KMEANS_CLUSTERS = 4
DEFAULT_DBSCAN_EPS = 0.85
DEFAULT_DBSCAN_MIN_SAMPLES = 5

# ── Atmospheric & Regional Thresholds ─────────────────────────────────────────
# Chuẩn WMO: Ozone < 220 DU là vùng suy giảm / lỗ thủng tầng Ozone Nam Cực
OZONE_HOLE_THRESHOLD_DU = 220.0

# Độ phản xạ cao (> 50%): Vùng mây dày đối lưu hoặc băng tuyết cực
HIGH_REFLECTIVITY_THRESHOLD = 50.0

# Ranh giới địa lý khí quyển
POLAR_LAT_THRESHOLD = 55.0       # Vĩ độ vùng cực (|lat| > 55°)
EQUATORIAL_LAT_THRESHOLD = 23.5   # Vĩ độ xích đạo / nhiệt đới (|lat| < 23.5°)
