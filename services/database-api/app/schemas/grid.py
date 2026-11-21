from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class GridSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source_filename: Optional[str] = None
    timestamp: Optional[datetime] = None
    lat_bin: float
    lon_bin: float
    ozone_column_mean: float
    ozone_column_min: Optional[float] = None
    ozone_column_max: Optional[float] = None
    reflectivity_mean: Optional[float] = 0.0
    uv_aerosol_mean: Optional[float] = 0.0
    valid_pixel_count: Optional[int] = 1
