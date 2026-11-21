from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from .common import TimeseriesPoint

class RawMeasurementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    granule_name: str
    point_index: int
    latitude: float
    longitude: float
    seconds_in_day: Optional[float] = 0.0
    time_raw: Optional[float] = 0.0
    ozone_column_raw: Optional[float] = None
    quality_flag: Optional[int] = 0
    ground_pixel_quality_flag: Optional[int] = 0
    solar_zenith_angle: Optional[float] = 0.0
    radiative_cloud_fraction: Optional[float] = 0.0
    cloud_pressure: Optional[float] = 0.0
    water_fraction: Optional[float] = 0.0
    reflectivity331: Optional[float] = 0.0
    uv_aerosol_index: Optional[float] = 0.0
    created_at: Optional[datetime] = None

class AggregatedTimeseriesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    granularity: str
    series: List[TimeseriesPoint]
