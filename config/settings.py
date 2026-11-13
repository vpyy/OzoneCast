import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # NASA Credentials
    NASA_USERNAME: str = os.getenv("NASA_USERNAME", "")
    NASA_PASSWORD: str = os.getenv("NASA_PASSWORD", "")

    # PostgreSQL / Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/ozone_db"
    )

    # Microservices Ports
    DATABASE_API_PORT: int = 8001
    DATA_INGESTION_PORT: int = 8002
    DATA_ANALYSIS_PORT: int = 8003
    CLUSTERING_PORT: int = 8004
    PREDICTION_PORT: int = 8005
    FRONTEND_PORT: int = 3000

    # Service Endpoints
    DATABASE_API_URL: str = os.getenv("DATABASE_API_URL", "http://localhost:8001")
    DATA_INGESTION_URL: str = os.getenv("DATA_INGESTION_URL", "http://localhost:8002")
    DATA_ANALYSIS_URL: str = os.getenv("DATA_ANALYSIS_URL", "http://localhost:8003")
    CLUSTERING_URL: str = os.getenv("CLUSTERING_URL", "http://localhost:8004")
    PREDICTION_URL: str = os.getenv("PREDICTION_URL", "http://localhost:8005")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
