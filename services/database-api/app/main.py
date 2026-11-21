import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .ws.poller import ws_background_poller
from .ws.router import router as ws_router
from .routers import (
    health_router,
    stats_router,
    granules_router,
    measurements_router,
    grid_router,
    analysis_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ozone.database-api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Quản lý vòng đời ứng dụng: khởi động background poller và dọn dẹp khi tắt."""
    logger.info("[STARTUP] Starting WebSocket background poller task...")
    poller_task = asyncio.create_task(ws_background_poller())
    yield
    logger.info("[SHUTDOWN] Cancelling WebSocket background poller task...")
    poller_task.cancel()
    try:
        await poller_task
    except asyncio.CancelledError:
        pass
    logger.info("[SHUTDOWN] Clean shutdown complete.")

app = FastAPI(
    title="OzoneCast Database API",
    version="2.0.0",
    description="Central Read-Only Gateway & WebSocket Stream for OzoneCast PostgreSQL Database",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các Router REST API (Chỉ đọc - SELECT ONLY)
app.include_router(health_router)
app.include_router(stats_router)
app.include_router(granules_router)
app.include_router(measurements_router)
app.include_router(grid_router)
app.include_router(analysis_router)

# Đăng ký WebSocket Router (/ws/stream, /ws/{channel})
app.include_router(ws_router)
