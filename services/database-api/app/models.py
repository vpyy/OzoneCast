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
    ozone_column_raw = Column(Float, nullable=False)
    quality_flag = Column(Integer, default=0)
    time_raw = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    algorithm = Column(String(50), default="DBSCAN")
    cluster_id = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    mean_ozone = Column(Float, nullable=False)
    point_count = Column(Integer, default=1)
    tag = Column(String(50), nullable=True)

