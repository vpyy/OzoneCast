from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

class AnomalyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timestamp: Optional[datetime] = None
    latitude: float
    longitude: float
    ozone_level: float
    severity: Optional[str] = "Moderate"
    description: Optional[str] = None

class ClusterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    run_timestamp: Optional[datetime] = None
    algorithm: Optional[str] = "KMeans"
    cluster_id: int
    latitude: float
    longitude: float
    mean_ozone: float
    mean_reflectivity: Optional[float] = 0.0
    point_count: Optional[int] = 1
    tag: Optional[str] = None
    characteristic: Optional[str] = None
