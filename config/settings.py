import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    NASA_USERNAME: str = ""
    NASA_PASSWORD: str = ""
    
    DATA_RAW_DIR: str = str(BASE_DIR / "data" / "raw")
    DATA_BRONZE_DIR: str = str(BASE_DIR / "data" / "raw")
    DATA_SILVER_DIR: str = str(BASE_DIR / "data" / "silver_processed")
    
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'data' / 'ozone_pipeline.db'}"
    
    CRAWL_INTERVAL_HOURS: int = 2
    LOOKBACK_HOURS: int = 24
    
    COOKIE_JAR_PATH: str = str(BASE_DIR / "data" / ".urs_cookies")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure required directories exist
os.makedirs(settings.DATA_BRONZE_DIR, exist_ok=True)
os.makedirs(settings.DATA_SILVER_DIR, exist_ok=True)
os.makedirs(Path(settings.DATABASE_URL.replace("sqlite:///", "")).parent, exist_ok=True)

