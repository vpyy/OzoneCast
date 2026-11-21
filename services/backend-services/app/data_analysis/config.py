"""
OzoneCast — Data Analysis Configuration
Quy chuẩn các tham số khí quyển, ngưỡng chất lượng vệ tinh NASA OMI và WMO.
"""

import os
import logging

# ── Logging Setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [DATA-ANALYSIS] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("ozonecast.data_analysis")

# ── API Endpoints ─────────────────────────────────────────────────────────────
DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8000")

# ── Lưới không gian (Spatial Binning) ──────────────────────────────────────────
DEFAULT_GRID_RESOLUTION = 0.5  # độ (0.5° × 0.5° tương đương ~55km ở xích đạo)

# ── Ngưỡng lọc dữ liệu vật lý (Physical Validity Bounds) ──────────────────────
# Nồng độ Ozone theo Dobson Units (DU):
# Thông thường: 200 - 500 DU; Lỗ thủng Nam Cực: ~100-150 DU; Cực đại vùng cực: ~550 DU.
MIN_VALID_OZONE_DU = 50.0
MAX_VALID_OZONE_DU = 650.0

# Góc thiên đỉnh Mặt Trời (Solar Zenith Angle - SZA):
# Ở góc > 84°, đường quang học qua khí quyển bị kéo dài cực độ tại vùng chạng vạng cực (twilight),
# thuật toán OMI khuyến nghị loại bỏ các điểm đo này để tránh sai số tán xạ Rayleigh.
MAX_SOLAR_ZENITH_ANGLE = 84.0

# ── Chuẩn cảnh báo lỗ thủng tầng Ozone (WMO Standard) ────────────────────────
# Theo Tổ chức Khí tượng Thế giới (WMO), vùng có nồng độ < 220 DU được định nghĩa là Lỗ thủng Ozone.
OZONE_HOLE_THRESHOLD_DU = 220.0
SEVERE_OZONE_HOLE_DU = 190.0

# ── Vùng trọng điểm Bán đảo Nam Cực (Antarctic Peninsula) ─────────────────────
ANTARCTIC_LAT_MIN = -90.0
ANTARCTIC_LAT_MAX = -55.0
