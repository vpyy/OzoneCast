import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@postgres:5432/ozone_db"
)
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "*")
if CORS_ORIGINS_RAW == "*" or not CORS_ORIGINS_RAW:
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [orig.strip() for orig in CORS_ORIGINS_RAW.split(",") if orig.strip()]

WS_POLL_INTERVAL_SECONDS = int(os.getenv("WS_POLL_INTERVAL_SECONDS", "5"))
