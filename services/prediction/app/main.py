"""
OzoneCast Machine Learning Prediction Service
Chạy định kỳ dự báo nồng độ Ozone ngày mai bằng mô hình Random Forest đã huấn luyện sẵn.
Lưu kết quả dự báo và khuyến cáo bức xạ UV vào cache database-api.
Chu kỳ mặc định: 300s (5 phút).
"""

import os
import sys
import signal
import traceback
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler

from .config import PREDICTION_INTERVAL_SECONDS, DATABASE_API_URL, MODEL_DIR, logger
from .model import OzonePredictionModel

scheduler = BlockingScheduler(timezone="UTC")
prediction_model: OzonePredictionModel = None


def run_prediction_job():
    """Tác vụ dự báo ngày mai và cập nhật cache định kỳ."""
    global prediction_model
    start_time = datetime.utcnow()
    logger.info(f"Starting scheduled prediction forecast job at {start_time.isoformat()}...")
    try:
        if not (prediction_model.reg_model.is_trained and prediction_model.clf_model.is_trained):
            logger.info("Models not yet trained or loaded. Initiating training from database...")
            metrics = prediction_model.train_from_database()
            logger.info(
                f"Model training finished: MAE={metrics.get('regression_mae_du')} DU, "
                f"R²={metrics.get('regression_r2')}, Acc={metrics.get('classification_accuracy')}%"
            )

        result = prediction_model.forecast_tomorrow_and_cache()
        logger.info(
            f"Prediction forecast completed: target_date={result.get('target_date')}, "
            f"predicted_ozone={result.get('predicted_ozone_du')} DU, "
            f"status='{result.get('status_label')}'"
        )
    except Exception as e:
        logger.error(f"Error during prediction forecast job: {e}")
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
    global prediction_model
    logger.info("=" * 60)
    logger.info("[prediction] Starting ML Prediction Daemon Service")
    logger.info(f"  PREDICTION_INTERVAL_SECONDS : {PREDICTION_INTERVAL_SECONDS}s")
    logger.info(f"  MODEL_DIR                   : {MODEL_DIR}")
    logger.info(f"  DATABASE_API_URL            : {DATABASE_API_URL}")
    logger.info("=" * 60)

    # Đăng ký signal handler
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    # Khởi tạo mô hình
    prediction_model = OzonePredictionModel()

    # 1. Chạy ngay lượt đầu tiên khi container khởi động
    logger.info("Running initial prediction forecast immediately upon startup...")
    run_prediction_job()

    # 2. Lên lịch lặp theo chu kỳ
    scheduler.add_job(
        run_prediction_job,
        "interval",
        seconds=PREDICTION_INTERVAL_SECONDS,
        id="job_prediction",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60
    )

    logger.info(f"Scheduler configured. Next run in {PREDICTION_INTERVAL_SECONDS}s.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
