import os
from datetime import datetime
from typing import List, Dict, Tuple
import numpy as np
import pandas as pd
import requests

DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8001")

class OzoneAnalyzer:
    @staticmethod
    def fetch_raw_data_from_db(granule_name: str = None, limit: int = 2000) -> pd.DataFrame:
        url = f"{DATABASE_API_URL}/api/raw-measurements?limit={limit}"
        if granule_name:
            url += f"&granule_name={granule_name}"
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return pd.DataFrame(resp.json())
        return pd.DataFrame()

    @classmethod
    def clean_and_bin_data(cls, df: pd.DataFrame, grid_res: float = 0.5) -> Tuple[pd.DataFrame, List[Dict]]:
        if df.empty:
            return pd.DataFrame(), []

        # Filter: Positive valid DU (typically 100 - 550 DU), exclude FillValues (<0 or >700)
        valid = df[
            (df["ozone_column_raw"] > 50) &
            (df["ozone_column_raw"] < 650) &
            (df["quality_flag"] == 0)
        ].copy()

        if valid.empty:
            # Fallback if quality flags were non-zero
            valid = df[(df["ozone_column_raw"] > 50) & (df["ozone_column_raw"] < 650)].copy()

        # Spatial binning
        valid["lat_bin"] = (valid["latitude"] / grid_res).round() * grid_res
        valid["lon_bin"] = (valid["longitude"] / grid_res).round() * grid_res

        grouped = valid.groupby(["lat_bin", "lon_bin"]).agg(
            ozone_column_mean=("ozone_column_raw", "mean"),
            ozone_column_min=("ozone_column_raw", "min"),
            ozone_column_max=("ozone_column_raw", "max"),
            valid_pixel_count=("ozone_column_raw", "count")
        ).reset_index()

        grouped["lat_bin"] = grouped["lat_bin"].round(2)
        grouped["lon_bin"] = grouped["lon_bin"].round(2)
        grouped["ozone_column_mean"] = grouped["ozone_column_mean"].round(2)
        grouped["ozone_column_min"] = grouped["ozone_column_min"].round(2)
        grouped["ozone_column_max"] = grouped["ozone_column_max"].round(2)

        # Anomaly detection (WMO definition: Ozone Hole is area with DU < 220)
        anomalies = []
        low_ozone = grouped[grouped["ozone_column_mean"] < 220]
        for _, row in low_ozone.iterrows():
            anomalies.append({
                "latitude": float(row["lat_bin"]),
                "longitude": float(row["lon_bin"]),
                "ozone_level": float(row["ozone_column_mean"]),
                "severity": "Severe (Ozone Hole)" if row["ozone_column_mean"] < 190 else "Warning",
                "description": f"Ozone depletion detected: {row['ozone_column_mean']} DU"
            })

        return grouped, anomalies

    @classmethod
    def process_granule(cls, granule_name: str = None) -> Dict:
        df = cls.fetch_raw_data_from_db(granule_name, limit=5000)
        if df.empty:
            return {"status": "no_data", "cells_processed": 0, "anomalies_found": 0}

        grid_df, anomalies = cls.clean_and_bin_data(df)

        # Push to database-api
        if not grid_df.empty:
            source_file = granule_name or (df["granule_name"].iloc[0] if "granule_name" in df.columns else "unknown")
            items = []
            for _, row in grid_df.iterrows():
                items.append({
                    "source_filename": source_file,
                    "timestamp": datetime.utcnow().isoformat(),
                    "lat_bin": float(row["lat_bin"]),
                    "lon_bin": float(row["lon_bin"]),
                    "ozone_column_mean": float(row["ozone_column_mean"]),
                    "ozone_column_min": float(row["ozone_column_min"]),
                    "ozone_column_max": float(row["ozone_column_max"]),
                    "valid_pixel_count": int(row["valid_pixel_count"])
                })

            requests.post(
                f"{DATABASE_API_URL}/api/grid-summary/bulk",
                json={"items": items},
                timeout=30
            )

            # Push anomalies
            for anom in anomalies:
                requests.post(f"{DATABASE_API_URL}/api/anomalies", json=anom, timeout=5)

            # Update granule status
            if source_file != "unknown":
                requests.patch(
                    f"{DATABASE_API_URL}/api/granules/{source_file}/status?process_status=PROCESSED",
                    timeout=5
                )

        return {
            "status": "success",
            "cells_processed": len(grid_df),
            "anomalies_found": len(anomalies)
        }

