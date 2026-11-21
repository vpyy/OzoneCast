from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class GranuleBase(BaseModel):
    filename: str
    file_url: Optional[str] = None
    satellite: Optional[str] = "Aura"
    instrument: Optional[str] = "OMI"
    product_level: Optional[str] = "L2"
    orbit_number: Optional[int] = None
    file_size_bytes: Optional[int] = 0
    download_status: Optional[str] = "DOWNLOADED"
    process_status: Optional[str] = "UNPROCESSED"
    local_path: Optional[str] = None

class GranuleCreate(GranuleBase):
    pass

class GranuleResponse(GranuleBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class RawMeasurementItem(BaseModel):
    point_index: int
    latitude: float
    longitude: float
    ozone_column_raw: float
    reflectivity331: Optional[float] = 0.0
    uv_aerosol_index: Optional[float] = 0.0
    solar_zenith_angle: Optional[float] = 0.0
    quality_flag: int = 0
    ground_pixel_quality_flag: Optional[int] = 0
    radiative_cloud_fraction: Optional[float] = 0.0
    cloud_pressure: Optional[float] = 500.0
    water_fraction: Optional[float] = 0.5
    seconds_in_day: Optional[float] = 0.0
    scan_line: Optional[int] = 0
    pixel_index: Optional[int] = 29
    time_raw: float = 0.0

class RawMeasurementBulkCreate(BaseModel):
    granule_name: str
    items: List[RawMeasurementItem]

class RawMeasurementResponse(BaseModel):
    id: int
    granule_name: str
    point_index: int
    latitude: float
    longitude: float
    ozone_column_raw: float
    reflectivity331: Optional[float] = 0.0
    uv_aerosol_index: Optional[float] = 0.0
    solar_zenith_angle: Optional[float] = 0.0
    quality_flag: int
    ground_pixel_quality_flag: Optional[int] = 0
    radiative_cloud_fraction: Optional[float] = 0.0
    cloud_pressure: Optional[float] = 500.0
    water_fraction: Optional[float] = 0.5
    seconds_in_day: Optional[float] = 0.0
    scan_line: Optional[int] = 0
    pixel_index: Optional[int] = 29
    time_raw: float
    created_at: datetime
    class Config:
        from_attributes = True

class GridSummaryItem(BaseModel):
    source_filename: str
    timestamp: Optional[datetime] = None
    lat_bin: float
    lon_bin: float
    ozone_column_mean: float
    ozone_column_min: Optional[float] = None
    ozone_column_max: Optional[float] = None
    reflectivity_mean: Optional[float] = 0.0
    uv_aerosol_mean: Optional[float] = 0.0
    valid_pixel_count: int = 1

class GridSummaryBulkCreate(BaseModel):
    items: List[GridSummaryItem]

class GridSummaryResponse(GridSummaryItem):
    id: int
    class Config:
        from_attributes = True

class AnomalyCreate(BaseModel):
    latitude: float
    longitude: float
    ozone_level: float
    severity: str
    description: Optional[str] = None

class ClusterItem(BaseModel):
    algorithm: str = "KMeans"
    cluster_id: int
    latitude: float
    longitude: float
    mean_ozone: float
    mean_reflectivity: Optional[float] = 0.0
    point_count: int
    tag: Optional[str] = None
    characteristic: Optional[str] = None

class ClusterBulkCreate(BaseModel):
    items: List[ClusterItem]

class CacheUpsertRequest(BaseModel):
    cache_key: str
    payload: Dict[str, Any]
