import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from config.settings import settings
from src.db.models import SessionLocal, CrawlLog, init_db

DEFAULT_ALL_PRODUCTS = [
    "OMTO3", "OMDOAO3", "OMTO3G", "OMDOAO3G", 
    "NMTO3-L2", "NPBUVO3-L2", "NMEV-L1B", "NPEV-L1B"
]

class EarthAccessCrawler:
    """Automated granule search & download using NASA's official earthaccess library"""

    def __init__(self):
        init_db()
        self.db = SessionLocal()
        self.raw_dir = Path(settings.DATA_RAW_DIR)
        self.raw_dir.mkdir(parents=True, exist_ok=True)

    def login(self):
        """Authenticates with NASA Earthdata using credentials from .env"""
        import earthaccess

        # Map settings to earthaccess environment variables
        if settings.NASA_USERNAME and settings.NASA_PASSWORD:
            os.environ["EARTHDATA_USERNAME"] = settings.NASA_USERNAME
            os.environ["EARTHDATA_PASSWORD"] = settings.NASA_PASSWORD

        try:
            auth = earthaccess.login(strategy="environment")
            if not auth.authenticated:
                auth = earthaccess.login(strategy="netrc")
            print(f"[AUTH] Đăng nhập NASA Earthdata: {'THÀNH CÔNG' if auth.authenticated else 'CHƯA XÁC THỰC'}")
            return auth.authenticated
        except Exception as e:
            print(f"[AUTH WARNING] Lỗi đăng nhập earthaccess ({e}). Thử tiếp tục...")
            return False

    def auto_download_products(
        self,
        products: Optional[List[str]] = None,
        days_back: int = 2,
        count_per_product: int = 1
    ) -> List[str]:
        """
        Searches NASA CMR for real data files and downloads them to data/raw/
        """
        import earthaccess

        self.login()
        products = products or ["OMTO3"]

        now = datetime.utcnow()
        start = now - timedelta(days=days_back)
        temporal = (start.strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d"))

        print(f"\n{'='*65}")
        print(f" NASA AUTOMATED CRAWLER (earthaccess)")
        print(f"{'='*65}")
        print(f" Sản phẩm quét: {products}")
        print(f" Khoảng thời gian: {temporal[0]} -> {temporal[1]}")
        print(f" Thư mục lưu: {self.raw_dir}")
        print(f"{'='*65}\n")

        downloaded_paths = []

        for prod in products:
            print(f"[QUERY] Đang tìm kiếm sản phẩm '{prod}' từ NASA...")
            try:
                results = earthaccess.search_data(
                    short_name=prod,
                    temporal=temporal,
                    count=count_per_product
                )
                print(f"[QUERY] Tìm thấy {len(results)} file thật cho sản phẩm '{prod}'.")

                if not results:
                    # If last 2 days have latency, try last 7 days for historical product
                    fallback_temporal = ((now - timedelta(days=7)).strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d"))
                    print(f"[QUERY FALLBACK] Thử mở rộng thời gian 7 ngày qua: {fallback_temporal}...")
                    results = earthaccess.search_data(
                        short_name=prod,
                        temporal=fallback_temporal,
                        count=count_per_product
                    )
                    print(f"[QUERY FALLBACK] Tìm thấy {len(results)} file.")

                if results:
                    print(f"[DOWNLOAD] Đang tải {len(results)} file về {self.raw_dir}...")
                    downloaded_files = earthaccess.download(results, str(self.raw_dir))
                    
                    for fpath in downloaded_files:
                        p = Path(fpath)
                        if p.exists() and p.stat().st_size > 0:
                            downloaded_paths.append(str(p))
                            fname = p.name
                            print(f"[SUCCESS] Tải thành công: {fname} ({p.stat().st_size / (1024*1024):.2f} MB)")

                            # Register to Database
                            existing = self.db.query(CrawlLog).filter_by(filename=fname).first()
                            if not existing:
                                record = CrawlLog(
                                    filename=fname,
                                    file_url="earthaccess://" + fname,
                                    satellite="Aura" if "OMI" in prod else "Suomi-NPP",
                                    instrument="OMI" if "OM" in prod else "OMPS",
                                    product_level="L2" if "L2" in prod or prod == "OMTO3" else "L1B",
                                    download_status="DOWNLOADED",
                                    process_status="UNPROCESSED",
                                    local_path=str(p),
                                    downloaded_at=datetime.utcnow(),
                                    file_size_bytes=p.stat().st_size
                                )
                                self.db.add(record)
                    self.db.commit()

            except Exception as e:
                print(f"[ERROR] Lỗi khi tải sản phẩm '{prod}': {e}")

        print(f"\n[HOÀN TẤT] Tổng số file thật đã tải về: {len(downloaded_paths)}")
        return downloaded_paths

