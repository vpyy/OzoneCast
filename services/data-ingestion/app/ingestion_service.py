import os
import tempfile
from pathlib import Path
from typing import Optional
import h5py
import numpy as np
import requests

from .nasa_client import NASAClient
from .mock_granule import generate_mock_granule

DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8001")

# Use /tmp inside the container — no shared volume, no data/ folder
TMP_DIR = "/tmp/ozone_raw"


class IngestionService:
    def __init__(self):
        self.nasa_client = NASAClient()
        Path(TMP_DIR).mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Core: extract HDF5 → push to database-api → clean up temp file
    # ------------------------------------------------------------------
    def extract_and_publish(self, file_path: str, max_points: int = 2500) -> dict:
        filename = Path(file_path).name
        file_size = os.path.getsize(file_path)

        try:
            with h5py.File(file_path, "r") as h5:
                swaths_root = "HDFEOS/SWATHS"
                subswath = list(h5[swaths_root].keys())[0]
                swath_base = f"{swaths_root}/{subswath}"
                geo_base = f"{swath_base}/Geolocation Fields"
                data_base = f"{swath_base}/Data Fields"

                lats = np.array(h5[f"{geo_base}/Latitude"]).flatten()
                lons = np.array(h5[f"{geo_base}/Longitude"]).flatten()
                o3 = np.array(h5[f"{data_base}/ColumnAmountO3"]).flatten()

                times = np.zeros(len(lats))
                if f"{geo_base}/Time" in h5:
                    times = np.array(h5[f"{geo_base}/Time"]).flatten()

                qf = np.zeros(len(lats), dtype=int)
                for qf_name in ["QualityFlags", "AlgorithmFlags"]:
                    if f"{data_base}/{qf_name}" in h5:
                        qf = np.array(h5[f"{data_base}/{qf_name}"]).flatten()
                        break
        except Exception as e:
            print(f"[INGEST ERROR] Failed to read HDF5 {file_path}: {e}")
            return {"error": str(e)}
        finally:
            # Always clean up the temp file — no data persisted on disk
            try:
                os.remove(file_path)
            except OSError:
                pass

        total_points = len(lats)
        step = max(1, total_points // max_points)
        indices = np.arange(0, total_points, step)[:max_points]

        items = [
            {
                "point_index": int(idx),
                "latitude": float(np.round(lats[idx], 4)),
                "longitude": float(np.round(lons[idx], 4)),
                "ozone_column_raw": float(np.round(o3[idx], 2)),
                "quality_flag": int(qf[idx]),
                "time_raw": float(times[idx]),
            }
            for idx in indices
        ]

        # 1) Register granule in database-api
        granule_payload = {
            "filename": filename,
            "file_url": f"nasa_cmr://{filename}",
            "satellite": "Aura",
            "instrument": "OMI",
            "product_level": "L2",
            "file_size_bytes": file_size,
            "download_status": "DOWNLOADED",
            "process_status": "UNPROCESSED",
            "local_path": "",  # no local path — stored in DB only
        }
        try:
            requests.post(f"{DATABASE_API_URL}/api/granules", json=granule_payload, timeout=10)
        except Exception as e:
            print(f"[INGEST WARN] Could not register granule: {e}")

        # 2) Bulk-insert raw measurements
        try:
            resp = requests.post(
                f"{DATABASE_API_URL}/api/raw-measurements/bulk",
                json={"granule_name": filename, "items": items},
                timeout=30,
            )
            print(f"[INGEST OK] {filename} → {len(items)} points pushed (HTTP {resp.status_code})")
        except Exception as e:
            print(f"[INGEST WARN] Could not push measurements: {e}")

        return {"filename": filename, "total_points": total_points, "published": len(items)}

    # ------------------------------------------------------------------
    # Real NASA data via CMR API
    # ------------------------------------------------------------------
    def fetch_real_from_nasa_cmr(self) -> Optional[dict]:
        cmr_url = (
            "https://cmr.earthdata.nasa.gov/search/granules.json"
            "?short_name=OMTO3&page_size=5&sort_key=-start_date"
        )
        try:
            resp = requests.get(cmr_url, timeout=20)
            if resp.status_code == 200:
                entries = resp.json().get("feed", {}).get("entry", [])
                for entry in entries:
                    for link in entry.get("links", []):
                        href = link.get("href", "")
                        if (
                            (".he5" in href or ".nc" in href)
                            and not href.endswith(".xml")
                            and not href.endswith(".dmr.html")
                        ):
                            filename = href.split("/")[-1]
                            target_path = os.path.join(TMP_DIR, filename)
                            if self.nasa_client.download_file(href, target_path):
                                return self.extract_and_publish(target_path)
        except Exception as e:
            print(f"[INGEST ERROR] NASA CMR error: {e}")
        return None

    # ------------------------------------------------------------------
    # Mock data (used when NASA is not reachable)
    # ------------------------------------------------------------------
    def ingest_mock(self, filename: Optional[str] = None) -> dict:
        fpath = generate_mock_granule(TMP_DIR, filename)
        return self.extract_and_publish(fpath)
