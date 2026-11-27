"""
OzoneCast Data Analysis Service
Chạy định kỳ phân tích dữ liệu khí quyển, phân ô không gian (Spatial Binning),
phát hiện bất thường lỗ thủng tầng Ozone và phân rã chuỗi thời gian.
Chu kỳ mặc định: 300s (5 phút).
"""

import os
import sys
import signal
import traceback
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler

from .config import ANALYSIS_INTERVAL_SECONDS, DATABASE_API_URL, logger
from .analyzer import OzoneAnalyzer

scheduler = BlockingScheduler(timezone="UTC")


def run_analysis_job():
    """Tác vụ phân tích chuỗi thời gian & spatial binning định kỳ."""
    start_time = datetime.utcnow()
    logger.info(f"Starting scheduled data analysis job at {start_time.isoformat()}...")
    try:
        result = OzoneAnalyzer.process_granule(granule_name=None)
        logger.info(
            f"Analysis job completed: "
            f"cells_processed={result.get('cells_processed', 0)}, "
            f"anomalies_found={result.get('anomalies_found', 0)} "
            f"in {result.get('execution_duration_sec', 0)}s"
        )
    except Exception as e:
        logger.error(f"Error during analysis job: {e}")
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
    logger.info("[data-analysis] Starting Data Analysis Daemon Service")
    logger.info(f"  ANALYSIS_INTERVAL_SECONDS : {ANALYSIS_INTERVAL_SECONDS}s")
    logger.info(f"  DATABASE_API_URL          : {DATABASE_API_URL}")
    logger.info("=" * 60)

    # Đăng ký signal handler
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    # 1. Chạy ngay lượt đầu tiên khi container khởi động
    logger.info("Running initial analysis immediately upon startup...")
    run_analysis_job()

    # 2. Lên lịch lặp theo chu kỳ
    scheduler.add_job(
        run_analysis_job,
        "interval",
        seconds=ANALYSIS_INTERVAL_SECONDS,
        id="job_data_analysis",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60
    )

    logger.info(f"Scheduler configured. Next run in {ANALYSIS_INTERVAL_SECONDS}s.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
