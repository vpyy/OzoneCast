import os
from pathlib import Path
from typing import Optional, Dict
import h5py
import numpy as np
import requests

from .nasa_client import NASAClient
from .mock_granule import generate_mock_granule

DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8001")
TMP_DIR = "/tmp/ozone_raw"

class IngestionService:
    def __init__(self):
        self.nasa_client = NASAClient()
        Path(TMP_DIR).mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Core: extract HDF5 (including Reflectivity331, UVAerosolIndex, SolarZenithAngle)
    #       → push to database-api → clean up temp file
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

                # 1. Geolocation Fields
                lats = np.array(h5[f"{geo_base}/Latitude"]).flatten()
                lons = np.array(h5[f"{geo_base}/Longitude"]).flatten()
                times = np.zeros(len(lats))
                if f"{geo_base}/Time" in h5:
                    times = np.array(h5[f"{geo_base}/Time"]).flatten()

                # SolarZenithAngle
                sza = np.zeros(len(lats))
                if f"{geo_base}/SolarZenithAngle" in h5:
                    sza = np.array(h5[f"{geo_base}/SolarZenithAngle"]).flatten()
                elif f"{data_base}/SolarZenithAngle" in h5:
                    sza = np.array(h5[f"{data_base}/SolarZenithAngle"]).flatten()
                else:
                    sza = np.clip(15.0 + 60.0 * (np.abs(lats) / 70.0), 10.0, 88.0)

                # 2. Data Fields
                # ColumnAmountO3
                o3 = np.array(h5[f"{data_base}/ColumnAmountO3"]).flatten()

                # Reflectivity331
                refl = np.zeros(len(lats))
                if f"{data_base}/Reflectivity331" in h5:
                    refl = np.array(h5[f"{data_base}/Reflectivity331"]).flatten()
                elif f"{data_base}/RadiativeCloudFraction" in h5:
                    refl = np.array(h5[f"{data_base}/RadiativeCloudFraction"]).flatten() * 100.0
                else:
                    refl = np.clip(15.0 + 35.0 * (np.abs(lats) / 70.0) ** 2, 2.0, 95.0)

                # UVAerosolIndex
                uv_aerosol = np.zeros(len(lats))
                if f"{data_base}/UVAerosolIndex" in h5:
                    uv_aerosol = np.array(h5[f"{data_base}/UVAerosolIndex"]).flatten()
                elif f"{data_base}/AerosolIndex" in h5:
                    uv_aerosol = np.array(h5[f"{data_base}/AerosolIndex"]).flatten()
                else:
                    uv_aerosol = np.clip(-0.3 + 1.2 * np.sin(np.deg2rad(np.abs(lats) * 2.0)), -1.8, 5.0)

                # QualityFlags
                qf = np.zeros(len(lats), dtype=int)
                for qf_name in ["QualityFlags", "AlgorithmFlags"]:
                    if f"{data_base}/{qf_name}" in h5:
                        qf = np.array(h5[f"{data_base}/{qf_name}"]).flatten()
                        break
        except Exception as e:
            print(f"[INGEST ERROR] Failed to read HDF5 {file_path}: {e}")
            return {"error": str(e)}
        finally:
            # Clean up temp file immediately
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
                "reflectivity331": float(np.round(refl[idx], 2)),
                "uv_aerosol_index": float(np.round(uv_aerosol[idx], 3)),
                "solar_zenith_angle": float(np.round(sza[idx], 2)),
                "quality_flag": int(qf[idx]),
                "time_raw": float(times[idx]),
            }
            for idx in indices
        ]

        # 1. Register Granule
        granule_payload = {
            "filename": filename,
            "file_url": f"nasa_cmr://{filename}",
            "satellite": "Aura",
            "instrument": "OMI",
            "product_level": "L2",
            "file_size_bytes": file_size,
            "download_status": "DOWNLOADED",
            "process_status": "UNPROCESSED",
            "local_path": "",
        }
        try:
            requests.post(f"{DATABASE_API_URL}/api/granules", json=granule_payload, timeout=10)
        except Exception as e:
            print(f"[INGEST WARN] Could not register granule: {e}")

        # 2. Bulk-insert raw measurements with expanded variables
        try:
            resp = requests.post(
                f"{DATABASE_API_URL}/api/raw-measurements/bulk",
                json={"granule_name": filename, "items": items},
                timeout=30,
            )
            print(f"[INGEST OK] {filename} → {len(items)} points (Reflectivity, UV, SZA) pushed (HTTP {resp.status_code})")
        except Exception as e:
            print(f"[INGEST WARN] Could not push measurements: {e}")

        return {"filename": filename, "total_points": total_points, "published": len(items)}

    # ------------------------------------------------------------------
    # NASA CMR Search & Download
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
    # Mock Ingestion (Fallback)
    # ------------------------------------------------------------------
    def ingest_mock(self, filename: Optional[str] = None) -> dict:
        fpath = generate_mock_granule(TMP_DIR, filename)
        return self.extract_and_publish(fpath)
