"""
OzoneCast Spatial Clustering Service
Chạy định kỳ phân cụm không gian (K-Means / DBSCAN) dựa trên dữ liệu ô lưới vệ tinh.
Chu kỳ mặc định: 86400s (1 ngày).
"""

import os
import sys
import signal
import traceback
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler

from .config import CLUSTERING_INTERVAL_SECONDS, DEFAULT_KMEANS_CLUSTERS, DATABASE_API_URL, logger
from .clusterer import OzoneClusterer

scheduler = BlockingScheduler(timezone="UTC")


def run_clustering_job():
    """Tác vụ phân cụm không gian K-Means định kỳ."""
    start_time = datetime.utcnow()
    logger.info(f"Starting scheduled clustering job at {start_time.isoformat()}...")
    try:
        results = OzoneClusterer.run_kmeans_clustering(n_clusters=DEFAULT_KMEANS_CLUSTERS)
        unique_clusters = len(set(r.get("cluster_id") for r in results if r.get("cluster_id") != -1))
        logger.info(f"Clustering job completed: {len(results)} points clustered into {unique_clusters} clusters.")
    except Exception as e:
        logger.error(f"Error during clustering job: {e}")
        logger.error(traceback.format_exc())
        logger.info("Waiting for next scheduled run without crashing.")


def handle_sigterm(signum, frame):
    """Bắt tín hiệu SIGTERM / SIGINT để dừng scheduler gọn gàng khi docker stop."""
    logger.info(f"Received signal {signum}, shutting down scheduler gracefully...")
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    sys.exit(0)


def main():
    logger.info("=" * 60)
    logger.info("[clustering] Starting Spatial Clustering Daemon Service")
    logger.info(f"  CLUSTERING_INTERVAL_SECONDS : {CLUSTERING_INTERVAL_SECONDS}s")
    logger.info(f"  DATABASE_API_URL            : {DATABASE_API_URL}")
    logger.info("=" * 60)

    # Đăng ký signal handler
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    # 1. Chạy ngay lượt đầu tiên khi container khởi động
    logger.info("Running initial clustering immediately upon startup...")
    run_clustering_job()

    # 2. Lên lịch lặp theo chu kỳ
    scheduler.add_job(
        run_clustering_job,
        "interval",
        seconds=CLUSTERING_INTERVAL_SECONDS,
        id="job_clustering",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300
    )

    logger.info(f"Scheduler configured. Next run in {CLUSTERING_INTERVAL_SECONDS}s.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
