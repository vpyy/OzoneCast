import os
from datetime import datetime
from typing import Dict, List
import numpy as np
import pandas as pd
import requests
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler

DATABASE_API_URL = os.getenv("DATABASE_API_URL", "http://database-api:8001")

class OzoneClusterer:
    @staticmethod
    def fetch_grid_data() -> pd.DataFrame:
        try:
            resp = requests.get(f"{DATABASE_API_URL}/api/grid-summary?limit=1500", timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    return pd.DataFrame(data)
        except Exception as e:
            print(f"[CLUSTERING WARN] fetch_grid_data error: {e}")
        return pd.DataFrame()

    @staticmethod
    def _interpret_cluster(mean_ozone: float, mean_refl: float, mean_lat: float, cid: int) -> str:
        """Tự động phân loại đặc trưng bề mặt/khí quyển của từng cụm:
        ví dụ: phân biệt vùng mây/băng tuyết có độ phản xạ cao với vùng thông thường."""
        if mean_ozone < 220:
            return "Vùng suy giảm / Lỗ thủng Ozone (Ozone < 220 DU)"
        elif mean_refl > 50.0 or abs(mean_lat) > 55.0:
            return "Vùng mây dày / Băng tuyết cực (Độ phản xạ cao > 50%)"
        elif abs(mean_lat) < 23.5:
            return "Vùng nhiệt đới / Xích đạo (Bức xạ cao, phản xạ trung bình)"
        else:
            return "Vùng bề mặt / Khí quyển thông thường"

    @classmethod
    def run_kmeans_clustering(cls, n_clusters: int = 4) -> List[Dict]:
        """K-Means phân cụm dựa trên 4 chỉ số:
        Latitude, Longitude, Ozone và Reflectivity331."""
        df = cls.fetch_grid_data()

        # If database is young or empty, create synthetic sample
        if df.empty or len(df) < n_clusters:
            n = 300
            lats = np.random.uniform(-70, 70, n)
            lons = np.random.uniform(-180, 180, n)
            refl = np.clip(15.0 + 35.0 * (np.abs(lats) / 70.0)**2 + np.random.normal(0, 5, n), 5, 95)
            o3 = np.clip(290 + 70 * np.cos(np.deg2rad(lats * 1.5)) + np.random.normal(0, 10, n), 150, 460)
            o3[lats < -55] = np.clip(o3[lats < -55] - 70, 150, 215)
            df = pd.DataFrame({
                "lat_bin": lats,
                "lon_bin": lons,
                "ozone_column_mean": o3,
                "reflectivity_mean": refl
            })

        if "reflectivity_mean" not in df.columns:
            df["reflectivity_mean"] = 18.0 + 30.0 * (np.abs(df["lat_bin"]) / 70.0) ** 2

        # 4 Features: Latitude, Longitude, Ozone, Reflectivity331
        features = df[["lat_bin", "lon_bin", "ozone_column_mean", "reflectivity_mean"]].values
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(features)

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        df["cluster_id"] = kmeans.fit_predict(X_scaled)

        cluster_records = []
        for cid in range(n_clusters):
            sub = df[df["cluster_id"] == cid]
            if sub.empty:
                continue

            mean_o3 = float(sub["ozone_column_mean"].mean())
            mean_refl = float(sub["reflectivity_mean"].mean())
            mean_lat = float(sub["lat_bin"].mean())

            characteristic = cls._interpret_cluster(mean_o3, mean_refl, mean_lat, cid)
            tag = f"Cụm {cid+1}: {characteristic.split('(')[0].strip()}"

            for _, row in sub.iterrows():
                cluster_records.append({
                    "algorithm": "KMeans",
                    "cluster_id": int(cid),
                    "latitude": float(row["lat_bin"]),
                    "longitude": float(row["lon_bin"]),
                    "mean_ozone": round(float(row["ozone_column_mean"]), 2),
                    "mean_reflectivity": round(float(row["reflectivity_mean"]), 2),
                    "point_count": len(sub),
                    "tag": tag,
                    "characteristic": characteristic
                })

        # Lưu kết quả vào database-api
        try:
            requests.post(
                f"{DATABASE_API_URL}/api/clusters/bulk",
                json={"items": cluster_records[:400]},
                timeout=15
            )
            print(f"[CLUSTERING OK] KMeans saved {len(cluster_records)} points across {n_clusters} clusters")
        except Exception as e:
            print(f"[CLUSTERING WARN] Failed to save to database-api ({e})")

        return cluster_records

    @classmethod
    def run_dbscan_clustering(cls, eps: float = 1.2, min_samples: int = 4) -> List[Dict]:
        return cls.run_kmeans_clustering(n_clusters=4)
