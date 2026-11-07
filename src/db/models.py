from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Enum, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config.settings import settings

Base = declarative_base()

class CrawlLog(Base):
    __tablename__ = "crawl_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), unique=True, nullable=False, index=True)
    file_url = Column(String(1024), nullable=False)
    satellite = Column(String(50), nullable=True)     # e.g., 'Aura-OMI', 'OMPS-N20'
    instrument = Column(String(50), nullable=True)    # e.g., 'OMI', 'OMPS'
    product_level = Column(String(20), nullable=True) # e.g., 'L2', 'L3'
    orbit_number = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    measurement_time = Column(DateTime, nullable=True)
    download_status = Column(String(30), default="PENDING")  # PENDING, DOWNLOADED, FAILED
    process_status = Column(String(30), default="UNPROCESSED")  # UNPROCESSED, PROCESSED, ERROR
    local_path = Column(String(1024), nullable=True)
    downloaded_at = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    error_message = Column(String(1024), nullable=True)

class OzoneGridSummary(Base):
    """Silver layer: Aggregated clean ozone data by geographic grid cell and timestamp"""
    __tablename__ = "ozone_grid_summary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_filename = Column(String(255), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    lat_bin = Column(Float, nullable=False)      # e.g., rounded to 0.25 deg
    lon_bin = Column(Float, nullable=False)
    ozone_column_mean = Column(Float, nullable=False)  # Dobson Units (DU)
    ozone_column_min = Column(Float, nullable=True)
    ozone_column_max = Column(Float, nullable=True)
    valid_pixel_count = Column(Integer, nullable=False)

engine = create_engine(settings.DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)

