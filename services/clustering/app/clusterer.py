import os
from datetime import datetime
from typing import Dict, List
import numpy as np
import pandas as pd
import requests
from sklearn.cluster import DBSCAN, KMeans

DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8001")

class OzoneClusterer:
    @staticmethod
    def fetch_grid_data() -> pd.DataFrame:
        try:
            resp = requests.get(f"{DATABASE_API_URL}/api/grid-summary?limit=1000", timeout=15)
            if resp.status_code == 200:
                return pd.DataFrame(resp.json())
        except Exception:
            pass
        return pd.DataFrame()

    @classmethod
    def run_dbscan_clustering(cls, eps: float = 8.0, min_samples: int = 4) -> List[Dict]:
        df = cls.fetch_grid_data()
        if df.empty or len(df) < 5:
            return []

        # Features for clustering: normalized lat, lon, and ozone level
        coords = df[["lat_bin", "lon_bin"]].values
        ozone = df["ozone_column_mean"].values.reshape(-1, 1)

        # Scale features
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        X = scaler.fit_transform(np.hstack([coords, ozone]))

        dbscan = DBSCAN(eps=eps, min_samples=min_samples)
        df["cluster_id"] = dbscan.fit_predict(X)

        cluster_records = []
        for cid in sorted(df["cluster_id"].unique()):
            sub = df[df["cluster_id"] == cid]
            mean_o3 = float(sub["ozone_column_mean"].mean())
            tag = "Noise" if cid == -1 else ("Depleted (Ozone Hole Area)" if mean_o3 < 230 else "Standard Concentration")

            for _, row in sub.iterrows():
                cluster_records.append({
                    "algorithm": "DBSCAN",
                    "cluster_id": int(cid),
                    "latitude": float(row["lat_bin"]),
                    "longitude": float(row["lon_bin"]),
                    "mean_ozone": round(float(row["ozone_column_mean"]), 2),
                    "point_count": len(sub),
                    "tag": tag
                })

        # Send to database-api
        try:
            requests.post(
                f"{DATABASE_API_URL}/api/clusters/bulk",
                json={"items": cluster_records[:400]},
                timeout=15
            )
        except Exception as e:
            print(f"[CLUSTERING WARN] Failed to save to database-api ({e})")

        return cluster_records

    @classmethod
    def run_kmeans_clustering(cls, n_clusters: int = 4) -> List[Dict]:
        df = cls.fetch_grid_data()
        if df.empty or len(df) < n_clusters:
            return []

        X = df[["lat_bin", "lon_bin", "ozone_column_mean"]].values
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        df["cluster_id"] = kmeans.fit_predict(X)

        cluster_records = []
        for cid in range(n_clusters):
            sub = df[df["cluster_id"] == cid]
            if sub.empty:
                continue
            mean_o3 = float(sub["ozone_column_mean"].mean())
            tag = f"Cluster-{cid} (Mean: {mean_o3:.1f} DU)"

            for _, row in sub.iterrows():
                cluster_records.append({
                    "algorithm": "KMeans",
                    "cluster_id": int(cid),
                    "latitude": float(row["lat_bin"]),
                    "longitude": float(row["lon_bin"]),
                    "mean_ozone": round(float(row["ozone_column_mean"]), 2),
                    "point_count": len(sub),
                    "tag": tag
                })

        return cluster_records

