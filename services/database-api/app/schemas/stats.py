from datetime import datetime
from pydantic import BaseModel, ConfigDict

class DashboardStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_granules: int = 0
    total_raw_measurements: int = 0
    total_grid_cells: int = 0
    avg_ozone_du: float = 290.0
    min_ozone_du: float = 180.0
    max_ozone_du: float = 450.0
    anomalies_detected: int = 0
    last_updated: datetime
