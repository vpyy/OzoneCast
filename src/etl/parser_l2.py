import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import numpy as np
import pandas as pd
import h5py

from config.settings import settings
from src.db.models import SessionLocal, CrawlLog, OzoneGridSummary

class OzoneL2Parser:
    """Silver Layer ETL: Extracts, cleans, and aggregates Level-2 Ozone swaths"""

    def __init__(self):
        self.db = SessionLocal()

    def inspect_file_structure(self, file_path: str) -> List[str]:
        """Utility to inspect internal HDF5/NetCDF dataset keys"""
        keys = []
        with h5py.File(file_path, "r") as h5:
            def visitor(name, obj):
                if isinstance(obj, h5py.Dataset):
                    keys.append(f"{name} -> shape: {obj.shape}, dtype: {obj.dtype}")
            h5.visititems(visitor)
        return keys

    def parse_and_clean_omi_he5(self, file_path: str, grid_resolution: float = 0.5) -> pd.DataFrame:
        """
        Parses OMI Level-2 OMTO3 HDF-EOS5 file.
        Extracts Latitude, Longitude, ColumnAmountO3, and filters valid quality flags.
        """
        with h5py.File(file_path, "r") as h5:
            # Locate swath root path
            swaths_root = "HDFEOS/SWATHS"
            if swaths_root not in h5:
                raise ValueError(f"Not a recognized HDF-EOS5 swath file: {file_path}")
            
            # Sub-swath name (typically 'OMI Total Column Amount O3' or 'O3')
            subswath = list(h5[swaths_root].keys())[0]
            swath_base = f"{swaths_root}/{subswath}"
            
            geo_base = f"{swath_base}/Geolocation Fields"
            data_base = f"{swath_base}/Data Fields"
            
            lats = np.array(h5[f"{geo_base}/Latitude"])
            lons = np.array(h5[f"{geo_base}/Longitude"])
            
            # Ozone column amount in Dobson Units (DU)
            ozone = np.array(h5[f"{data_base}/ColumnAmountO3"])
            
            # Quality flag check (0 = high quality / no flags)
            quality = None
            for qflag_name in ["QualityFlags", "AlgorithmFlags", "ProcessingFlags"]:
                if f"{data_base}/{qflag_name}" in h5:
                    quality = np.array(h5[f"{data_base}/{qflag_name}"])
                    break
                    
            # Handle FillValue / Missing value attributes
            fill_val = h5[f"{data_base}/ColumnAmountO3"].attrs.get("_FillValue", -1.2676506e+30)

        # Flatten arrays
        lats_flat = lats.flatten()
        lons_flat = lons.flatten()
        o3_flat = ozone.flatten()
        
        # Filtering mask: Valid ranges for Ozone (typically 100 - 600 Dobson Units)
        valid_mask = (o3_flat > 50) & (o3_flat < 700) & (o3_flat != fill_val) & ~np.isnan(o3_flat)
        
        if quality is not None:
            q_flat = quality.flatten()
            # Most NASA standard algorithms consider 0 or even flags as high quality
            valid_mask = valid_mask & ((q_flat == 0) | (q_flat % 2 == 0))

        clean_lats = lats_flat[valid_mask]
        clean_lons = lons_flat[valid_mask]
        clean_o3 = o3_flat[valid_mask]

        df = pd.DataFrame({
            "lat": clean_lats,
            "lon": clean_lons,
            "ozone_du": clean_o3
        })

        if df.empty:
            return df

        # Spatial aggregation (Binning into regular geographic grid)
        df["lat_bin"] = (df["lat"] / grid_resolution).round() * grid_resolution
        df["lon_bin"] = (df["lon"] / grid_resolution).round() * grid_resolution

        grid_summary = df.groupby(["lat_bin", "lon_bin"]).agg(
            ozone_column_mean=("ozone_du", "mean"),
            ozone_column_min=("ozone_du", "min"),
            ozone_column_max=("ozone_du", "max"),
            valid_pixel_count=("ozone_du", "count")
        ).reset_index()

        return grid_summary

    def process_pending_files(self):
        """Processes all downloaded bronze files into silver layer summaries"""
        pending = self.db.query(CrawlLog).filter_by(download_status="DOWNLOADED", process_status="UNPROCESSED").all()
        print(f"[ETL] Found {len(pending)} pending granules to process.")

        for item in pending:
            resolved_path = item.local_path
            if not resolved_path or not os.path.exists(resolved_path):
                alt_path = os.path.join(settings.DATA_RAW_DIR, item.filename)
                if os.path.exists(alt_path):
                    resolved_path = alt_path
                else:
                    print(f"[WARN] File missing on disk: {item.filename}")
                    continue

            try:
                print(f"[ETL] Processing {item.filename}...")
                summary_df = self.parse_and_clean_omi_he5(resolved_path)
                
                # Timestamp for the granule
                timestamp = item.measurement_time or datetime.utcnow()
                
                # Save to database (Silver Layer)
                records = []
                for _, row in summary_df.iterrows():
                    records.append(OzoneGridSummary(
                        source_filename=item.filename,
                        timestamp=timestamp,
                        lat_bin=row["lat_bin"],
                        lon_bin=row["lon_bin"],
                        ozone_column_mean=row["ozone_column_mean"],
                        ozone_column_min=row["ozone_column_min"],
                        ozone_column_max=row["ozone_column_max"],
                        valid_pixel_count=int(row["valid_pixel_count"])
                    ))
                
                # Also save cleaned Parquet file for fast ML / Analytics reading
                parquet_out = Path(settings.DATA_SILVER_DIR) / f"{Path(item.filename).stem}.parquet"
                summary_df.to_parquet(parquet_out, index=False)

                self.db.bulk_save_objects(records)
                item.process_status = "PROCESSED"
                item.processed_at = datetime.utcnow()
                self.db.commit()
                print(f"[ETL] Successfully processed {item.filename} -> {len(records)} grid bins saved.")

            except Exception as e:
                self.db.rollback()
                item.process_status = "ERROR"
                item.error_message = str(e)
                self.db.commit()
                print(f"[ERROR] Failed processing {item.filename}: {e}")

