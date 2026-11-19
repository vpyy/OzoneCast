import os
import subprocess
from pathlib import Path
from typing import Optional
import requests
from requests.auth import HTTPBasicAuth

class NASAClient:
    def __init__(self, username: Optional[str] = None, password: Optional[str] = None):
        self.username = username or os.getenv("NASA_USERNAME", "")
        self.password = password or os.getenv("NASA_PASSWORD", "")
        self.cookie_file = os.getenv("COOKIE_JAR_PATH", "/tmp/.urs_cookies")

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

    def download_file(self, url: str, target_path: str) -> bool:
        """Tải file HDF5/HE5 từ URL trực tiếp hoặc NASA Earthdata."""
        # 1. Thử tải bằng curl (hỗ trợ redirect -L, retry)
        cmd = ["curl.exe" if os.name == "nt" else "curl", "-L", "--retry", "2", "--retry-delay", "2"]
        if self.username and self.password:
            self.ensure_netrc_file()
            cmd.extend(["-n", "-c", self.cookie_file, "-b", self.cookie_file])
        cmd.extend(["-o", target_path, url])

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            p = Path(target_path)
            if p.exists() and p.stat().st_size > 10000:
                return True
        except Exception as e:
            print(f"[NASA CLIENT] curl failed ({e}), trying python requests...")

        # 2. Fallback sang requests session
        try:
            session = requests.Session()
            if self.username and self.password:
                session.auth = HTTPBasicAuth(self.username, self.password)
            with session.get(url, stream=True, timeout=15, allow_redirects=True) as resp:
                if resp.status_code == 200:
                    with open(target_path, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=1024 * 1024):
                            if chunk:
                                f.write(chunk)
                    p = Path(target_path)
                    return p.exists() and p.stat().st_size > 10000
                else:
                    print(f"[NASA CLIENT ERROR] HTTP status {resp.status_code} for {url}")
        except Exception as e:
            print(f"[NASA CLIENT ERROR] requests download failed: {e}")

        return False
