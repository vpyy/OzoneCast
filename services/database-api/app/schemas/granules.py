from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class GranuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    file_url: Optional[str] = None
    satellite: Optional[str] = "Aura"
    instrument: Optional[str] = "OMI"
    product_level: Optional[str] = "L2G"
    orbit_number: Optional[int] = None
    file_size_bytes: Optional[int] = 0
    download_status: Optional[str] = "DOWNLOADED"
    process_status: Optional[str] = "UNPROCESSED"
    local_path: Optional[str] = None
    created_at: Optional[datetime] = None
