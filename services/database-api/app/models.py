from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index, Text
from .database import Base

class Granule(Base):
    __tablename__ = "granules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), unique=True, nullable=False, index=True)
    file_url = Column(String(1024), nullable=True)
    satellite = Column(String(50), default="Aura")
    instrument = Column(String(50), default="OMI")
    product_level = Column(String(20), default="L2")
    orbit_number = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, default=0)
    download_status = Column(String(30), default="DOWNLOADED")
    process_status = Column(String(30), default="UNPROCESSED")
    local_path = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class RawMeasurement(Base):
    __tablename__ = "raw_measurements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    granule_name = Column(String(255), index=True)
    point_index = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    ozone_column_raw = Column(Float, nullable=False)          # ColumnAmountO3 (DU)
    reflectivity331 = Column(Float, default=0.0)              # Độ phản xạ 331nm (%)
    uv_aerosol_index = Column(Float, default=0.0)             # Chỉ số UV Aerosol Index
    solar_zenith_angle = Column(Float, default=0.0)           # Góc thiên đỉnh mặt trời (độ)
    quality_flag = Column(Integer, default=0)
    ground_pixel_quality_flag = Column(Integer, default=0)    # GroundPixelQualityFlags
    radiative_cloud_fraction = Column(Float, default=0.0)     # RadiativeCloudFraction (0–1)
    cloud_pressure = Column(Float, default=500.0)             # CloudPressure (hPa)
    water_fraction = Column(Float, default=0.5)               # WaterFraction (0=băng, 1=biển)
    seconds_in_day = Column(Float, default=0.0)               # SecondsInDay (s) — dùng vẽ orbit track
    scan_line = Column(Integer, default=0)                    # Chỉ số dòng quét along-track
    pixel_index = Column(Integer, default=29)                 # 0–59 cross-track (29/30=nadir)
    time_raw = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class OzoneGridSummary(Base):
    __tablename__ = "ozone_grid_summary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_filename = Column(String(255), index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    lat_bin = Column(Float, nullable=False)
    lon_bin = Column(Float, nullable=False)
    ozone_column_mean = Column(Float, nullable=False)
    ozone_column_min = Column(Float, nullable=True)
    ozone_column_max = Column(Float, nullable=True)
    reflectivity_mean = Column(Float, default=0.0)
    uv_aerosol_mean = Column(Float, default=0.0)
    valid_pixel_count = Column(Integer, default=1)

class OzoneAnomaly(Base):
    __tablename__ = "ozone_anomalies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    ozone_level = Column(Float, nullable=False)
    severity = Column(String(50), default="Moderate") # Warning, Severe (Ozone hole < 220 DU)
    description = Column(String(255), nullable=True)

class ClusterResult(Base):
    __tablename__ = "cluster_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_timestamp = Column(DateTime, default=datetime.utcnow)
    algorithm = Column(String(50), default="KMeans")
    cluster_id = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    mean_ozone = Column(Float, nullable=False)
    mean_reflectivity = Column(Float, default=0.0)
    point_count = Column(Integer, default=1)
    tag = Column(String(50), nullable=True)
    characteristic = Column(String(255), nullable=True) # Mô tả vùng: Mây/băng tuyết, vùng thông thường, vùng suy giảm

class SystemAnalysisCache(Base):
    """Lưu trữ kết quả phân tích chuỗi thời gian, tương quan và dự báo cho Front End đọc trực tiếp."""
    __tablename__ = "system_analysis_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cache_key = Column(String(100), unique=True, index=True) # e.g. 'timeseries_day', 'correlation_matrix', 'prediction_tomorrow'
    payload_json = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)
