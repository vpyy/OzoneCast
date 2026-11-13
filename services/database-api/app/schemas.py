from datetime import datetime
from typing import List, Optional
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
    quality_flag: int = 0
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
    quality_flag: int
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
    algorithm: str
    cluster_id: int
    latitude: float
    longitude: float
    mean_ozone: float
    point_count: int
    tag: Optional[str] = None

class ClusterBulkCreate(BaseModel):
    items: List[ClusterItem]

