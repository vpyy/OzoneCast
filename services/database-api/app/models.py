from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from .db import Base

class Granule(Base):
    __tablename__ = "granules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), unique=True, nullable=False, index=True)
    file_url = Column(String(1024), nullable=True)
    satellite = Column(String(50), default="Aura")
    instrument = Column(String(50), default="OMI")
    product_level = Column(String(20), default="L2G")
    orbit_number = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, default=0)
    download_status = Column(String(30), default="DOWNLOADED")
    process_status = Column(String(30), default="UNPROCESSED")
    local_path = Column(String(1024), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

class RawMeasurement(Base):
    __tablename__ = "raw_measurements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    granule_name = Column(String(255), index=True, nullable=False)
    point_index = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    seconds_in_day = Column(Float, default=0.0)
    time_raw = Column(Float, default=0.0)
    ozone_column_raw = Column(Float, nullable=True)               # DU (NULL if missing)
    quality_flag = Column(Integer, default=0)
    ground_pixel_quality_flag = Column(Integer, default=0)
    solar_zenith_angle = Column(Float, default=0.0)               # deg
    radiative_cloud_fraction = Column(Float, default=0.0)         # 0.0 - 1.0
    cloud_pressure = Column(Float, default=0.0)                   # hPa
    water_fraction = Column(Float, default=0.0)                   # 0.0 - 1.0
    reflectivity331 = Column(Float, default=0.0)                  # %
    uv_aerosol_index = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

class OzoneGridSummary(Base):
    __tablename__ = "ozone_grid_summary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_filename = Column(String(255), index=True, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
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
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    ozone_level = Column(Float, nullable=False)
    severity = Column(String(50), default="Moderate")             # Warning, Severe (< 220 DU)
    description = Column(String(255), nullable=True)

class ClusterResult(Base):
    __tablename__ = "cluster_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    algorithm = Column(String(50), default="KMeans")
    cluster_id = Column(Integer, nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    mean_ozone = Column(Float, nullable=False)
    mean_reflectivity = Column(Float, default=0.0)
    point_count = Column(Integer, default=1)
    tag = Column(String(100), nullable=True)
    characteristic = Column(String(255), nullable=True)

class SystemAnalysisCache(Base):
    __tablename__ = "system_analysis_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cache_key = Column(String(100), unique=True, index=True, nullable=False)
    payload_json = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)
