import os
import re
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any
import requests
from requests.auth import HTTPBasicAuth

# Biểu thức chính quy kiểm tra định dạng tên file OMTO3 (L2 Swath) và OMTO3G (L2G Gridded) chuẩn NASA
OMTO3_REGEX = re.compile(r"^OMI-Aura_L2-OMTO3_\d{4}m\d{4}t\d{4}-o\d+_v\d+.*\.he5$")
OMTO3G_REGEX = re.compile(r"^OMI-Aura_L2G-OMTO3G_\d{4}m\d{4}_v\d+.*\.he5$")

class NASAClient:
    """Client tương tác với NASA Earthdata và cổng dữ liệu OzoneAQ."""

    def __init__(self, username: Optional[str] = None, password: Optional[str] = None):
        self.username = username or os.getenv("NASA_USERNAME", "")
        self.password = password or os.getenv("NASA_PASSWORD", "")
        self.cookie_file = os.getenv("COOKIE_JAR_PATH", "/tmp/.urs_cookies")
        self.api_base_url = "https://ozoneaq.gsfc.nasa.gov/api/data/"
        # Chỉ quét Product 26 (OMTO3 Level-2 Swath) theo đúng yêu cầu portal ozoneaq.gsfc.nasa.gov/#prods=26
        self.product_ids = [26]

    def ensure_netrc_file(self):
        """Tạo file .netrc nếu có thông tin đăng nhập NASA Earthdata."""
        if not (self.username and self.password):
            return
        user_home = Path.home()
        netrc_path = user_home / "_netrc" if os.name == "nt" else user_home / ".netrc"
        entry = f"machine urs.earthdata.nasa.gov login {self.username} password {self.password}\n"
        if not netrc_path.exists():
            with open(netrc_path, "w", encoding="utf-8") as f:
                f.write(entry)
        else:
            with open(netrc_path, "r", encoding="utf-8") as f:
                content = f.read()
            if "urs.earthdata.nasa.gov" not in content:
                with open(netrc_path, "a", encoding="utf-8") as f:
                    f.write("\n" + entry)

    @staticmethod
    def parse_granule_info(url: str, time_str: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Phân tích URL để lấy tên file, ngày quan sát và thời điểm chính xác của vệ tinh:
        - OMTO3  (L2 Swath): OMI-Aura_L2-OMTO3_2026m1121t2315-o118932_v004-2026m1122t041952.he5
        - OMTO3G (L2G Grid): OMI-Aura_L2G-OMTO3G_2026m1116_v004-2026m1117t052851.he5
        """
        clean_url = url.strip()
        filename = clean_url.split("/")[-1].split("?")[0]

        is_omto3 = "L2-OMTO3_" in filename or bool(OMTO3_REGEX.search(filename))
        is_omto3g = "L2G-OMTO3G_" in filename or bool(OMTO3G_REGEX.search(filename))

        product_type = "OMTO3" if is_omto3 else "OMTO3G"
        obs_date = None
        obs_datetime = None
        obs_date_midnight = None

        if is_omto3:
            # OMTO3: _2026m1121t2315- -> 2026-11-21 23:15 UTC
            m_obs = re.search(r"_(\d{4})m(\d{2})(\d{2})t(\d{2})(\d{2})-?", filename)
            if m_obs:
                y, mo, d, hh, mm = int(m_obs.group(1)), int(m_obs.group(2)), int(m_obs.group(3)), int(m_obs.group(4)), int(m_obs.group(5))
                obs_date = f"{y:04d}-{mo:02d}-{d:02d}"
                try:
                    obs_datetime = datetime(y, mo, d, hh, mm, 0, tzinfo=timezone.utc)
                    obs_date_midnight = datetime(y, mo, d, 0, 0, 0, tzinfo=timezone.utc)
                except ValueError:
                    pass
        elif is_omto3g:
            # OMTO3G: _2026m1116_ -> 2026-11-16 00:00 UTC
            m_obs = re.search(r"_(\d{4})m(\d{2})(\d{2})_", filename)
            if m_obs:
                y, mo, d = int(m_obs.group(1)), int(m_obs.group(2)), int(m_obs.group(3))
                obs_date = f"{y:04d}-{mo:02d}-{d:02d}"
                try:
                    obs_datetime = datetime(y, mo, d, 0, 0, 0, tzinfo=timezone.utc)
                    obs_date_midnight = datetime(y, mo, d, 0, 0, 0, tzinfo=timezone.utc)
                except ValueError:
                    pass

        # Fallback regex tìm ngày trong tên file dạng YYYYmMMDD hoặc YYYY-MM-DD
        if not obs_date:
            m_gen = re.search(r"(\d{4})[-_m](\d{2})[-_m](\d{2})", filename)
            if m_gen:
                y, mo, d = int(m_gen.group(1)), int(m_gen.group(2)), int(m_gen.group(3))
                obs_date = f"{y:04d}-{mo:02d}-{d:02d}"
                try:
                    obs_datetime = datetime(y, mo, d, 0, 0, 0, tzinfo=timezone.utc)
                    obs_date_midnight = datetime(y, mo, d, 0, 0, 0, tzinfo=timezone.utc)
                except ValueError:
                    pass

        if not obs_date and time_str:
            obs_date = time_str.split(" ")[0]

        if not obs_date_midnight and obs_date:
            try:
                obs_parts = [int(p) for p in obs_date.split("-")]
                obs_date_midnight = datetime(obs_parts[0], obs_parts[1], obs_parts[2], 0, 0, 0, tzinfo=timezone.utc)
                if not obs_datetime:
                    obs_datetime = obs_date_midnight
            except Exception:
                pass

        if not obs_datetime:
            obs_datetime = obs_date_midnight or datetime.now(timezone.utc)
        if not obs_date_midnight:
            obs_date_midnight = obs_datetime.replace(hour=0, minute=0, second=0, microsecond=0)

        # Thời điểm sản xuất file sau dấu "-": 2026m1122t041952 -> 2026-11-22 04:19:52 UTC
        produced_at = None
        m_prod = re.search(r"-(\d{4})m(\d{2})(\d{2})t(\d{2})(\d{2})(\d{2})", filename)
        if m_prod:
            try:
                produced_at = datetime(
                    int(m_prod.group(1)), int(m_prod.group(2)), int(m_prod.group(3)),
                    int(m_prod.group(4)), int(m_prod.group(5)), int(m_prod.group(6)),
                    tzinfo=timezone.utc
                )
            except ValueError:
                produced_at = datetime.now(timezone.utc)
        else:
            produced_at = datetime.now(timezone.utc)

        return {
            "filename": filename,
            "url": clean_url,
            "observation_date": obs_date or obs_datetime.strftime("%Y-%m-%d"),
            "observation_datetime": obs_datetime,
            "observation_midnight": obs_date_midnight,
            "produced_at": produced_at,
            "product_type": product_type
        }

    def search_api(self, start_date: str, end_date: str, product_ids: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        """
        Gọi API trực tiếp từ trang NASA OzoneAQ để tìm các granule.
        API URL: https://ozoneaq.gsfc.nasa.gov/api/data/?products={id}&start=YYYY-MM-DD&end=YYYY-MM-DD
        """
        pids = product_ids or self.product_ids
        headers = {
            "User-Agent": "OzoneCast-Ingestion/2.1 (NASA Research Agent; Python/requests)"
        }
        granules = []
        seen_filenames = set()

        for pid in pids:
            params = {
                "products": pid,
                "start": start_date,
                "end": end_date
            }
            try:
                resp = requests.get(self.api_base_url, params=params, headers=headers, timeout=25)
                if resp.status_code == 200 and resp.text:
                    lines = resp.text.strip().split("\n")
                    count_for_pid = 0
                    for line in lines[1:]:
                        parts = line.strip().split(",")
                        if len(parts) >= 3:
                            time_str = parts[0].strip()
                            file_url = parts[2].strip()
                            info = self.parse_granule_info(file_url, time_str)
                            if info and info["filename"] not in seen_filenames:
                                seen_filenames.add(info["filename"])
                                granules.append(info)
                                count_for_pid += 1
                    print(f"[NASA API] Product {pid}: Tìm thấy {count_for_pid} file từ {start_date} đến {end_date}.")
                else:
                    print(f"[NASA API WARN] Product {pid} HTTP {resp.status_code}")
            except Exception as e:
                print(f"[NASA API ERROR] Lỗi khi gọi API tìm kiếm Product {pid}: {e}")

        return granules

    def sync_seed_urls(self, discovered_granules: List[Dict[str, Any]], seed_file_path: Optional[str] = None) -> int:
        """
        Ghi hoặc cập nhật các URL mới tìm được vào file seed/urls_seed.txt để người dùng
        có thể tái sử dụng hoặc chạy lại toàn bộ quy trình nạp bất kỳ lúc nào.
        """
        path = Path(seed_file_path or os.path.join(os.path.dirname(__file__), "..", "seed", "urls_seed.txt"))
        path.parent.mkdir(parents=True, exist_ok=True)

        existing_urls = set()
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    u = line.strip()
                    if u and not u.startswith("#"):
                        existing_urls.add(u)

        new_urls = []
        for g in discovered_granules:
            u = g["url"]
            if u not in existing_urls:
                new_urls.append(u)
                existing_urls.add(u)

        if new_urls:
            with open(path, "a", encoding="utf-8") as f:
                for u in new_urls:
                    f.write(f"{u}\n")
            print(f"[SEED SYNC] Đã bổ sung {len(new_urls)} URL mới vào {path}")

        return len(new_urls)

    def read_seed_urls(self, seed_file_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """Phương án dự phòng: Đọc danh sách URL từ file seed/urls_seed.txt."""
        path = Path(seed_file_path or os.path.join(os.path.dirname(__file__), "..", "seed", "urls_seed.txt"))
        if not path.exists():
            return []
        granules = []
        seen = set()
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                url = line.strip()
                if not url or url.startswith("#"):
                    continue
                info = self.parse_granule_info(url)
                if info and info["filename"] not in seen:
                    seen.add(info["filename"])
                    granules.append(info)
        print(f"[SEED] Đọc được {len(granules)} URL OMTO3/OMTO3G hợp lệ từ {path}.")
        return granules

    def discover_granules(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Tìm kiếm URL mới kết hợp ưu tiên API trong cửa sổ 7 ngày gần nhất (rolling 7 days),
        sau đó đồng bộ vào seed/urls_seed.txt và fallback nếu cần.
        """
        now = datetime.now(timezone.utc)
        e_date = end_date or now.strftime("%Y-%m-%d")
        s_date = start_date or (now - timedelta(days=7)).strftime("%Y-%m-%d")

        print(f"[DISCOVERY] Đang quét NASA OzoneAQ API từ {s_date} đến {e_date} (7 ngày gần nhất)...")
        results = self.search_api(s_date, e_date)

        if results:
            self.sync_seed_urls(results)
        else:
            print("[DISCOVERY FALLBACK] API không trả về file, kiểm tra file seed/urls_seed.txt...")
            results = self.read_seed_urls()

        return results

    def download_file(self, url: str, target_path: str, timeout_sec: int = 600) -> bool:
        """
        Tải file HDF5/HE5 stream vào thư mục tạm.
        Áp dụng timeout 600s, retry 3 lần và xử lý lỗi 403/404 rõ ràng.
        """
        Path(target_path).parent.mkdir(parents=True, exist_ok=True)

        headers = {
            "User-Agent": "OzoneCast-Ingestion/2.1 (NASA Research Client; curl/requests)"
        }

        # 1. Thử tải bằng curl (nhanh, tối ưu bộ đệm lớn và hỗ trợ redirect)
        cmd = [
            "curl.exe" if os.name == "nt" else "curl",
            "-L", "--retry", "3", "--retry-delay", "3",
            "--max-time", str(timeout_sec),
            "-A", headers["User-Agent"]
        ]
        if self.username and self.password:
            self.ensure_netrc_file()
            cmd.extend(["-n", "-c", self.cookie_file, "-b", self.cookie_file])
        cmd.extend(["-o", target_path, url])

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec + 30)
            p = Path(target_path)
            if p.exists() and p.stat().st_size > 1000000:  # File hợp lệ > 1MB
                return True
        except Exception as e:
            print(f"[NASA CLIENT] curl failed ({e}), thử tiếp bằng python requests stream...")

        # 2. Fallback sang requests streaming với chunk lớn (4MB)
        for attempt in range(1, 4):
            try:
                session = requests.Session()
                if self.username and self.password:
                    session.auth = HTTPBasicAuth(self.username, self.password)

                with session.get(url, stream=True, timeout=timeout_sec, headers=headers, allow_redirects=True) as resp:
                    if resp.status_code == 200:
                        with open(target_path, "wb") as f:
                            for chunk in resp.iter_content(chunk_size=4 * 1024 * 1024):
                                if chunk:
                                    f.write(chunk)
                        p = Path(target_path)
                        if p.exists() and p.stat().st_size > 1000000:
                            return True
                    elif resp.status_code in [403, 404]:
                        print(f"[NASA CLIENT ERROR] HTTP {resp.status_code} ({url}) — URL hết hạn hoặc không tồn tại.")
                        return False
                    else:
                        print(f"[NASA CLIENT WARN] HTTP {resp.status_code} (lần {attempt}/3) cho {url}")
            except Exception as e:
                print(f"[NASA CLIENT ERROR] Lỗi tải file qua requests (lần {attempt}/3): {e}")

        return False
