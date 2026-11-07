import argparse
import sys
from datetime import datetime
from pathlib import Path

from src.db.models import init_db, SessionLocal, CrawlLog, OzoneGridSummary
from src.crawler.crawler_service import OzoneCrawlerService
from src.etl.parser_l2 import OzoneL2Parser
from src.pipeline.scheduler import OzonePipelineRunner
from src.utils.mock_granule import generate_sample_omi_l2_file
from src.analytics.visualizer import OzoneVisualizer
from src.ml.predictor import OzoneForecastModel
from src.etl.inspector import download_raw_file, inspect_file

def print_status():
    session = SessionLocal()
    total_files = session.query(CrawlLog).count()
    downloaded = session.query(CrawlLog).filter_by(download_status="DOWNLOADED").count()
    processed = session.query(CrawlLog).filter_by(process_status="PROCESSED").count()
    failed = session.query(CrawlLog).filter_by(download_status="FAILED").count()
    total_grid_bins = session.query(OzoneGridSummary).count()

    print("\n" + "="*50)
    print("        OZONE PIPELINE SYSTEM STATUS")
    print("="*50)
    print(f" Total granules tracked:  {total_files}")
    print(f" Downloaded (Bronze):     {downloaded}")
    print(f" Processed (Silver):      {processed}")
    print(f" Download failures:       {failed}")
    print(f" Silver grid data points: {total_grid_bins}")
    print("="*50)

def main():
    parser = argparse.ArgumentParser(description="NASA Ozone Automated Data Pipeline CLI")
    subparsers = parser.add_subparsers(dest="command", help="Pipeline commands")

    # init-db
    subparsers.add_parser("init-db", help="Initialize database tables")

    # fetch-auto (earthaccess)
    auto_parser = subparsers.add_parser("fetch-auto", help="Automatically search & download real NASA granules via earthaccess")
    auto_parser.add_argument("--products", type=str, default="OMTO3", help="Comma-separated product short names (e.g. OMTO3,NMTO3-L2)")
    auto_parser.add_argument("--all", action="store_true", help="Download all 8 standard ozone/aerosol products")
    auto_parser.add_argument("--count", type=int, default=1, help="Number of files to download per product")
    auto_parser.add_argument("--days", type=int, default=3, help="Days to look back from today")

    # fetch-real (NASA CMR API - siêu nhẹ, không cần thư viện nặng)
    subparsers.add_parser("fetch-real", help="Query NASA CMR API directly and download real satellite file without extra packages")

    # fetch-raw
    fetch_parser = subparsers.add_parser("fetch-raw", help="Download raw file from NASA into data/raw/")
    fetch_parser.add_argument("--url", type=str, default=None, help="Direct NASA granule download URL")

    # inspect-file
    inspect_parser = subparsers.add_parser("inspect-file", help="Inspect variables and structure of .he5 / .nc / .h5 file")
    inspect_parser.add_argument("file_path", type=str, help="Path to raw satellite file")

    # view-raw
    view_raw_parser = subparsers.add_parser("view-raw", help="View raw measurement rows in interactive web table and save to SQLite")
    view_raw_parser.add_argument("file_path", type=str, help="Path to raw satellite file (.he5, .nc, .h5)")

    # sync
    sync_parser = subparsers.add_parser("sync", help="Run incremental crawl from NASA")
    sync_parser.add_argument("--lookback", type=int, default=24, help="Hours to look back (default 24)")

    # import-script
    import_parser = subparsers.add_parser("import-script", help="Import URLs from NASA get cUrl script file")
    import_parser.add_argument("file_path", type=str, help="Path to .sh or .txt script file")

    # parse
    subparsers.add_parser("parse", help="Run ETL parser on downloaded files")

    # run-cycle
    subparsers.add_parser("run-cycle", help="Run 1 complete cycle (Crawl + ETL)")

    # scheduler
    subparsers.add_parser("scheduler", help="Start continuous periodic scheduler")

    # status
    subparsers.add_parser("status", help="View current pipeline & database metrics")

    # generate-mock
    mock_parser = subparsers.add_parser("generate-mock", help="Generate synthetic OMI L2 granule for offline testing")
    mock_parser.add_argument("--filename", type=str, default=None, help="Custom output filename for mock granule")

    # plot-map
    plot_parser = subparsers.add_parser("plot-map", help="Generate 2D static heatmap & interactive Leaflet HTML map")
    plot_parser.add_argument("--html-only", action="store_true", help="Generate only interactive HTML map")

    # train-model
    subparsers.add_parser("train-model", help="Train baseline ML regressor on Silver layer ozone points")

    # predict
    pred_parser = subparsers.add_parser("predict", help="Predict Ozone Dobson Units for given coordinate")
    pred_parser.add_argument("--lat", type=float, required=True, help="Latitude (-90 to 90)")
    pred_parser.add_argument("--lon", type=float, required=True, help="Longitude (-180 to 180)")

    args = parser.parse_args()

    if args.command == "init-db":
        init_db()
        print("[DB] Database initialized successfully.")
    elif args.command == "fetch-auto":
        from src.crawler.earthaccess_crawler import EarthAccessCrawler, DEFAULT_ALL_PRODUCTS
        crawler = EarthAccessCrawler()
        if args.all:
            target_products = DEFAULT_ALL_PRODUCTS
        else:
            target_products = [p.strip() for p in args.products.split(",") if p.strip()]
        
        downloaded = crawler.auto_download_products(
            products=target_products,
            days_back=args.days,
            count_per_product=args.count
        )
        if downloaded:
            first_file = downloaded[0]
            print(f"\n[GỢI Ý] Để xem chi tiết các trường và bảng dữ liệu thô vừa tải, chạy ngay:")
            print(f"  py main.py view-raw \"{first_file}\"\n")
    elif args.command == "fetch-real":
        crawler = OzoneCrawlerService()
        saved = crawler.fetch_latest_real_nasa_granule()
        if saved:
            print(f"\n[GỢI Ý] Để xem chi tiết các trường và bảng dữ liệu thô vừa tải, chạy ngay:")
            print(f"  py main.py view-raw \"{saved}\"\n")
    elif args.command == "fetch-raw":
        saved_file = download_raw_file(args.url)
        if saved_file:
            # Register into DB
            session = SessionLocal()
            fname = saved_file.name
            existing = session.query(CrawlLog).filter_by(filename=fname).first()
            if not existing:
                meta = OzoneCrawlerService.parse_filename_metadata(fname)
                granule = CrawlLog(
                    filename=fname,
                    file_url=args.url or "https://ozoneaq.gsfc.nasa.gov",
                    satellite=meta.get("satellite"),
                    instrument=meta.get("instrument"),
                    orbit_number=meta.get("orbit_number"),
                    measurement_time=meta.get("measurement_time") or datetime.utcnow(),
                    download_status="DOWNLOADED",
                    process_status="UNPROCESSED",
                    local_path=str(saved_file),
                    downloaded_at=datetime.utcnow()
                )
                session.add(granule)
                session.commit()
                print(f"[DB] Đã ghi nhận {fname} vào Database.")
    elif args.command == "inspect-file":
        inspect_file(args.file_path)
    elif args.command == "view-raw":
        from src.analytics.raw_viewer import RawDataViewer
        html_path = RawDataViewer.generate_raw_web_viewer(args.file_path)
        print(f"\n[XEM DỮ LIỆU THÔ] Đã lưu vào DB và tạo trang web xem trực quan:\n  -> Mở file: {html_path}\n")
    elif args.command == "sync":
        crawler = OzoneCrawlerService()
        crawler.sync_recent_files(lookback_hours=args.lookback)
    elif args.command == "import-script":
        crawler = OzoneCrawlerService()
        crawler.load_from_curl_script_file(args.file_path)
    elif args.command == "parse":
        etl = OzoneL2Parser()
        etl.process_pending_files()
    elif args.command == "run-cycle":
        runner = OzonePipelineRunner()
        runner.run_pipeline_cycle()
    elif args.command == "scheduler":
        runner = OzonePipelineRunner()
        runner.start_scheduler()
    elif args.command == "status":
        print_status()
    elif args.command == "generate-mock":
        path = generate_sample_omi_l2_file(args.filename)
        # Register into database as DOWNLOADED
        session = SessionLocal()
        fname = Path(path).name
        existing = session.query(CrawlLog).filter_by(filename=fname).first()
        if not existing:
            meta = OzoneCrawlerService.parse_filename_metadata(fname)
            granule = CrawlLog(
                filename=fname,
                file_url="file://" + str(path),
                satellite=meta.get("satellite"),
                instrument=meta.get("instrument"),
                orbit_number=meta.get("orbit_number") or 99999,
                measurement_time=datetime.utcnow(),
                download_status="DOWNLOADED",
                process_status="UNPROCESSED",
                local_path=str(path),
                downloaded_at=datetime.utcnow()
            )
            session.add(granule)
            session.commit()
            print(f"[DB] Đã ghi nhận {fname} vào Database. Sẵn sàng chạy 'py main.py parse'!")
    elif args.command == "plot-map":
        vis = OzoneVisualizer()
        html_path = vis.generate_interactive_html_map()
        if not args.html_only:
            png_path = vis.generate_static_plot()
            print(f"[SUCCESS] Maps created:\n  - Static Image: {png_path}\n  - Interactive HTML: {html_path}")
        else:
            print(f"[SUCCESS] Interactive HTML map created: {html_path}")
    elif args.command == "train-model":
        model = OzoneForecastModel()
        model.train()
    elif args.command == "predict":
        model = OzoneForecastModel()
        val = model.predict(args.lat, args.lon)
        print(f"\n[PREDICTION] Estimated Ozone at (Lat={args.lat}, Lon={args.lon}): {val:.2f} Dobson Units (DU)")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
