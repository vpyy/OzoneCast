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
        user_home = Path.home()
        netrc_path = user_home / "_netrc" if os.name == "nt" else user_home / ".netrc"
        entry = f"machine urs.earthdata.nasa.gov login {self.username} password {self.password}\n"
        if not netrc_path.exists():
            if self.username and self.password:
                with open(netrc_path, "w", encoding="utf-8") as f:
                    f.write(entry)
        else:
            with open(netrc_path, "r", encoding="utf-8") as f:
                content = f.read()
            if "urs.earthdata.nasa.gov" not in content and self.username and self.password:
                with open(netrc_path, "a", encoding="utf-8") as f:
                    f.write("\n" + entry)

    def download_file(self, url: str, target_path: str) -> bool:
        self.ensure_netrc_file()
        cmd = [
            "curl.exe" if os.name == "nt" else "curl",
            "-n", "-c", self.cookie_file, "-b", self.cookie_file,
            "-L", "--retry", "3", "--retry-delay", "3",
            "-o", target_path, url
        ]
        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            p = Path(target_path)
            return p.exists() and p.stat().st_size > 100000
        except Exception:
            # Fallback to requests
            try:
                session = requests.Session()
                session.auth = HTTPBasicAuth(self.username, self.password)
                with session.get(url, stream=True, timeout=60, allow_redirects=True) as resp:
                    if resp.status_code == 200:
                        with open(target_path, "wb") as f:
                            for chunk in resp.iter_content(chunk_size=1024*1024):
                                if chunk:
                                    f.write(chunk)
                        return Path(target_path).stat().st_size > 100000
            except Exception:
                return False
        return False

