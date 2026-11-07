import time
from apscheduler.schedulers.blocking import BlockingScheduler
from config.settings import settings
from src.crawler.crawler_service import OzoneCrawlerService
from src.etl.parser_l2 import OzoneL2Parser

class OzonePipelineRunner:
    def __init__(self):
        self.crawler = OzoneCrawlerService()

    def run_pipeline_cycle(self):
        """Runs one full cycle: Incremental Crawl -> Bronze -> Silver ETL Clean"""
        print(f"\n{'='*50}\n[PIPELINE] Starting cycle at {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Step 1: Incremental Crawl
        try:
            downloaded = self.crawler.sync_recent_files(lookback_hours=settings.LOOKBACK_HOURS)
            print(f"[PIPELINE] Downloaded {len(downloaded)} new files.")
        except Exception as e:
            print(f"[PIPELINE ERROR in Crawl]: {e}")

        # Step 2: Silver ETL
        try:
            from src.etl.parser_l2 import OzoneL2Parser
            parser = OzoneL2Parser()
            parser.process_pending_files()
        except Exception as e:
            print(f"[PIPELINE ERROR in ETL]: {e}")

        print(f"[PIPELINE] Completed cycle.\n{'='*50}\n")

    def start_scheduler(self):
        scheduler = BlockingScheduler()
        hours = settings.CRAWL_INTERVAL_HOURS
        print(f"[SCHEDULER] Ozone Data Pipeline scheduled to run every {hours} hour(s).")
        
        # Run first cycle immediately
        self.run_pipeline_cycle()
        
        scheduler.add_job(self.run_pipeline_cycle, "interval", hours=hours)
        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            print("[SCHEDULER] Stopped.")

if __name__ == "__main__":
    runner = OzonePipelineRunner()
    runner.start_scheduler()

