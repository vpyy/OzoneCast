"""
Spatial Clustering Microservice — main entry point.

Schedule: every 1 day (per sơ đồ khối)
  - Reads Ozone, Reflectivity331, Latitude, Longitude from database-api
  - Runs K-Means spatial clustering to group similar atmospheric/surface zones
  - Writes cluster results & characteristics back to database-api
"""

from datetime import datetime
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .clusterer import OzoneClusterer

app = FastAPI(
    title="Ozone Spatial Clustering Microservice",
    version="2.0.0",
    description="Every 1 day: K-Means clustering (Lat, Lon, Ozone, Reflectivity331)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Scheduled job: every 1 day ─────────────────────────────────────────────────
def scheduled_clustering():
    print(f"[SCHEDULER] clustering triggered at {datetime.utcnow().isoformat()}")
    result = OzoneClusterer.run_kmeans_clustering(n_clusters=4)
    print(f"[SCHEDULER] KMeans done: {len(result)} points clustered")

scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_clustering, "interval", days=1, id="clustering_job")

@app.on_event("startup")
def start_scheduler():
    scheduler.start()
    print("[STARTUP] Clustering scheduler started — runs every 1 day")
    # Warm up clustering on boot
    try:
        OzoneClusterer.run_kmeans_clustering(n_clusters=4)
    except Exception as e:
        print(f"[CLUSTERING WARMUP ERROR] {e}")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()

# ── REST endpoints ─────────────────────────────────────────────────────────────
class ClusteringRequest(BaseModel):
    algorithm: str = "KMeans"
    eps: Optional[float] = 1.2
    n_clusters: Optional[int] = 4

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "clustering",
        "timestamp": datetime.utcnow().isoformat(),
        "scheduler_running": scheduler.running,
    }

@app.post("/api/clustering/run")
def trigger_clustering(req: ClusteringRequest):
    """Kích hoạt thủ công phân cụm K-Means hoặc DBSCAN."""
    results = OzoneClusterer.run_kmeans_clustering(n_clusters=req.n_clusters or 4)
    unique_clusters = len(set(r["cluster_id"] for r in results))
    return {
        "status": "success",
        "algorithm": req.algorithm,
        "total_points_clustered": len(results),
        "cluster_count": unique_clusters,
        "sample_points": results[:100],
    }
