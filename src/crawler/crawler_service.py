import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional
import requests

from config.settings import settings
from src.db.models import SessionLocal, CrawlLog, init_db
from src.crawler.nasa_client import NASAClient

class OzoneCrawlerService:
    """Manages incremental file discovery, status tracking, and downloading"""

    def __init__(self):
        init_db()
        self.nasa_client = NASAClient()
        self.db = SessionLocal()

    def discover_files_by_date_range(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """
        Discovers available granules from NASA Ozone GSFC portal.
        Example endpoints:
        - OMI Total Ozone (OMTO3 Level-2): https://ozoneaq.gsfc.nasa.gov/data/ozone/
        - OMPS Ozone (Level-2 NMTO3): https://ozoneaq.gsfc.nasa.gov/data/omps/
        """
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        
        # NASA GSFC endpoint query (can also load a pre-saved curl script / file list)
        search_url = f"https://ozoneaq.gsfc.nasa.gov/data/ozone/search/?start={start_str}&end={end_str}"
        print(f"[CRAWLER] Querying NASA directory: {search_url}")
        
        found_files = []
        try:
            resp = requests.get(search_url, timeout=30)
            if resp.status_code == 200:
                # Regex match for standard NetCDF/HDF5 satellite files
                matches = re.findall(r'href=[\'"]([^\'"]+\.(?:he5|h5|nc))[\'"]', resp.text, re.IGNORECASE)
                for rel_url in set(matches):
                    full_url = rel_url if rel_url.startswith("http") else f"https://ozoneaq.gsfc.nasa.gov{rel_url}"
                    filename = full_url.split("/")[-1]
                    found_files.append({
                        "filename": filename,
                        "url": full_url,
                        "metadata": self.parse_filename_metadata(filename)
                    })
        except Exception as e:
            print(f"[WARN] Failed fetching from dynamic endpoint ({e}). Checking local batch script or fallback...")
            
        return found_files

    def fetch_latest_real_nasa_granule(self) -> Optional[str]:
        """
        Uses NASA CMR (Common Metadata Repository) public search API
        to find the latest real OMTO3 / Aura granule URL and downloads it.
        """
        cmr_url = "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=OMTO3&page_size=5&sort_key=-start_date"
        print(f"[NASA CMR API] Đang truy vấn kho dữ liệu vệ tinh thật của NASA: {cmr_url}")
        try:
            resp = requests.get(cmr_url, timeout=30)
            if resp.status_code != 200:
                cmr_url = "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=OMTO3&page_size=5"
                resp = requests.get(cmr_url, timeout=30)

            if resp.status_code == 200:
                data = resp.json()
                entries = data.get("feed", {}).get("entry", [])
                if not entries:
                    # Fallback without sort_key if needed
                    resp = requests.get("https://cmr.earthdata.nasa.gov/search/granules.json?short_name=OMTO3&page_size=5", timeout=30)
                    entries = resp.json().get("feed", {}).get("entry", [])

                for entry in entries:
                    links = entry.get("links", [])
                    for l in links:
                        href = l.get("href", "")
                        if (".he5" in href or ".nc" in href) and not href.endswith(".xml") and not href.endswith(".dmr.html"):
                            filename = href.split("/")[-1]
                            print(f"[NASA CMR API] Tìm thấy file thật: {filename}")
                            print(f"[NASA CMR API] Link tải: {href}")
                            target_path = os.path.join(settings.DATA_RAW_DIR, filename)
                            
                            success = self.nasa_client.download_with_curl(href, target_path)
                            if not success:
                                success = self.nasa_client.download_with_requests(href, target_path)
                                
                            if success and os.path.exists(target_path) and os.path.getsize(target_path) > 100000:
                                print(f"[SUCCESS] Đã tải thành công file thật từ NASA: {target_path} ({os.path.getsize(target_path)/(1024*1024):.2f} MB)")
                                return target_path
                            else:
                                print("[WARN] Thử link/file tiếp theo...")
        except Exception as e:
            print(f"[ERROR] Lỗi khi gọi NASA CMR API: {e}")
        return None

    @staticmethod
    def parse_filename_metadata(filename: str) -> Dict:
        """
        Extracts satellite, instrument, timestamp, and orbit number from filename.
        Example: OMI-Aura_L2-OMTO3_2026m1103t2309-o118669_v883-2026m1104t051214.he5
        """
        meta = {
            "satellite": "Unknown",
            "instrument": "Unknown",
            "orbit_number": None,
            "measurement_time": None
        }
        
        if "OMI-Aura" in filename:
            meta["satellite"] = "Aura"
            meta["instrument"] = "OMI"
        elif "OMPS" in filename:
            meta["satellite"] = "Suomi-NPP" if "NPP" in filename else "NOAA-20"
            meta["instrument"] = "OMPS"
            
        # Extract orbit number e.g. -o118669_
        orbit_match = re.search(r'-o(\d+)', filename)
        if orbit_match:
            meta["orbit_number"] = int(orbit_match.group(1))

        # Extract timestamp e.g. 2026m1103t2309
        time_match = re.search(r'(\d{4})m(\d{2})(\d{2})t(\d{4})', filename)
        if time_match:
            y, m, d, hm = time_match.groups()
            meta["measurement_time"] = datetime(int(y), int(m), int(d), int(hm[:2]), int(hm[2:]))

        return meta

    def sync_recent_files(self, lookback_hours: int = 24) -> List[str]:
        """
        Incremental fetch: Query NASA for recent files, check database, download new ones.
        """
        now = datetime.utcnow()
        start = now - timedelta(hours=lookback_hours)
        files = self.discover_files_by_date_range(start, now)
        
        # Also fetch any pending files previously recorded or imported via script
        pending_records = self.db.query(CrawlLog).filter_by(download_status="PENDING").all()
        for rec in pending_records:
            if not any(f["filename"] == rec.filename for f in files):
                files.append({
                    "filename": rec.filename,
                    "url": rec.file_url,
                    "metadata": {
                        "satellite": rec.satellite,
                        "instrument": rec.instrument,
                        "orbit_number": rec.orbit_number,
                        "measurement_time": rec.measurement_time
                    }
                })

        downloaded = []
        for item in files:
            fname = item["filename"]
            record = self.db.query(CrawlLog).filter_by(filename=fname).first()
            
            if not record:
                # New file found!
                record = CrawlLog(
                    filename=fname,
                    file_url=item["url"],
                    satellite=item["metadata"].get("satellite"),
                    instrument=item["metadata"].get("instrument"),
                    orbit_number=item["metadata"].get("orbit_number"),
                    measurement_time=item["metadata"].get("measurement_time"),
                    download_status="PENDING",
                    process_status="UNPROCESSED"
                )
                self.db.add(record)
                self.db.commit()

            if record.download_status != "DOWNLOADED":
                target_path = os.path.join(settings.DATA_BRONZE_DIR, fname)
                print(f"[CRAWLER] Downloading new granule: {fname}")
                
                success = self.nasa_client.download_with_curl(item["url"], target_path)
                if not success:
                    success = self.nasa_client.download_with_requests(item["url"], target_path)
                    
                if success:
                    record.download_status = "DOWNLOADED"
                    record.local_path = target_path
                    record.downloaded_at = datetime.utcnow()
                    record.file_size_bytes = os.path.getsize(target_path)
                    downloaded.append(target_path)
                else:
                    record.download_status = "FAILED"
                    record.error_message = "Download failed via curl and requests"
                    
                self.db.commit()

        print(f"[CRAWLER] Finished incremental sync. Downloaded {len(downloaded)} new files.")
        return downloaded

    def load_from_curl_script_file(self, script_path: str):
        """
        Helper: Import download URLs from a NASA 'get cUrl script' downloaded manually (.sh or .bat)
        """
        with open(script_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        count = 0
        for line in lines:
            match = re.search(r'https?://[^\s"\']+\.(?:he5|h5|nc)', line)
            if match:
                url = match.group(0)
                filename = url.split("/")[-1]
                exists = self.db.query(CrawlLog).filter_by(filename=filename).first()
                if not exists:
                    meta = self.parse_filename_metadata(filename)
                    record = CrawlLog(
                        filename=filename,
                        file_url=url,
                        satellite=meta.get("satellite"),
                        instrument=meta.get("instrument"),
                        orbit_number=meta.get("orbit_number"),
                        measurement_time=meta.get("measurement_time"),
                        download_status="PENDING"
                    )
                    self.db.add(record)
                    count += 1
        self.db.commit()
        print(f"[IMPORT] Imported {count} URLs into crawl_logs from {script_path}")

