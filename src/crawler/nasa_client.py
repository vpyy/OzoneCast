import os
import re
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
import requests
from requests.auth import HTTPBasicAuth

from config.settings import settings

class NASAClient:
    """Client for interacting with NASA Earthdata & Ozone GSFC portal"""

    def __init__(self, username: Optional[str] = None, password: Optional[str] = None):
        self.username = username or settings.NASA_USERNAME
        self.password = password or settings.NASA_PASSWORD
        self.cookie_file = settings.COOKIE_JAR_PATH

    def ensure_netrc_file(self):
        """
        Creates or validates ~/.netrc (or ~/_netrc on Windows) for curl authentication.
        """
        user_home = Path.home()
        # Windows supports both _netrc and .netrc for curl
        netrc_path = user_home / "_netrc" if os.name == "nt" else user_home / ".netrc"
        
        entry = f"machine urs.earthdata.nasa.gov login {self.username} password {self.password}\n"
        
        if not netrc_path.exists():
            if self.username and self.password:
                with open(netrc_path, "w", encoding="utf-8") as f:
                    f.write(entry)
                print(f"[AUTH] Created credentials file at {netrc_path}")
        else:
            with open(netrc_path, "r", encoding="utf-8") as f:
                content = f.read()
            if "urs.earthdata.nasa.gov" not in content and self.username and self.password:
                with open(netrc_path, "a", encoding="utf-8") as f:
                    f.write("\n" + entry)
                print(f"[AUTH] Appended Earthdata credentials to {netrc_path}")

    def download_with_curl(self, url: str, target_path: str) -> bool:
        """
        Downloads a file using system curl with Earthdata SSO redirect & cookie persistence.
        """
        self.ensure_netrc_file()
        
        cmd = [
            "curl.exe" if os.name == "nt" else "curl",
            "-n",
            "-c", self.cookie_file,
            "-b", self.cookie_file,
            "-L",
            "--retry", "3",
            "--retry-delay", "5",
            "-o", target_path,
            url
        ]
        
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return Path(target_path).exists() and Path(target_path).stat().st_size > 0
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Failed downloading {url}: {e.stderr}")
            return False

    def download_with_requests(self, url: str, target_path: str) -> bool:
        """
        Alternative pure Python download stream with Earthdata login session.
        """
        session = requests.Session()
        session.auth = HTTPBasicAuth(self.username, self.password)
        
        try:
            with session.get(url, stream=True, timeout=60, allow_redirects=True) as resp:
                if resp.status_code == 200:
                    with open(target_path, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=1024 * 1024):
                            if chunk:
                                f.write(chunk)
                    return True
                else:
                    print(f"[ERROR] HTTP {resp.status_code} for URL: {url}")
                    return False
        except Exception as e:
            print(f"[ERROR] Requests download error: {e}")
            return False

