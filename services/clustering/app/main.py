"""
Spatial Clustering Microservice — main entry point.

Schedule: every 1 day (per sơ đồ khối)
  - Reads processed ozone measurements from database-api
  - Runs DBSCAN / KMeans spatial clustering
  - Writes cluster results back to database-api
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
    version="1.0.0",
    description="Every 1 day: DBSCAN & KMeans spatial-temporal clustering",
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
    result = OzoneClusterer.run_dbscan_clustering()
    print(f"[SCHEDULER] DBSCAN done: {len(result)} points clustered")


scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_clustering, "interval", days=1, id="clustering_job")


@app.on_event("startup")
def start_scheduler():
    scheduler.start()
    print("[STARTUP] Clustering scheduler started — runs every 1 day")


@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()


# ── REST endpoints ─────────────────────────────────────────────────────────────

class ClusteringRequest(BaseModel):
    algorithm: str = "DBSCAN"   # "DBSCAN" or "KMeans"
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
    """Manually trigger clustering."""
    if req.algorithm.upper() == "KMEANS":
        results = OzoneClusterer.run_kmeans_clustering(n_clusters=req.n_clusters or 4)
    else:
        results = OzoneClusterer.run_dbscan_clustering(eps=req.eps or 1.2)

    unique_clusters = len(set(r["cluster_id"] for r in results))
    return {
        "status": "success",
        "algorithm": req.algorithm,
        "total_points_clustered": len(results),
        "cluster_count": unique_clusters,
        "sample_points": results[:100],
    }
