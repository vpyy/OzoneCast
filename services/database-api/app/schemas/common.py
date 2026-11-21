from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class TimeseriesPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    t: datetime
    value: Optional[float] = None

class HealthResponse(BaseModel):
    status: str
    service: str
    database: str
    timestamp: datetime
