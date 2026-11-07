import os
import h5py
import numpy as np
from datetime import datetime
from pathlib import Path
from config.settings import settings

DEFAULT_FILENAME = "OMI-Aura_L2-OMTO3_2026m1103t2309-o118669_v004-2026m1104t042602.he5"

def generate_sample_omi_l2_file(output_filename: str = None) -> str:
    """
    Generates a realistic synthetic OMI Level-2 HDF-EOS5 (.he5) file for offline testing.
    Emulates the structure of NASA OMI-Aura_L2-OMTO3 products:
    - Group: HDFEOS/SWATHS/OMI Total Column Amount O3
    - Datasets:
        - Geolocation Fields/Latitude (-90 to +90)
        - Geolocation Fields/Longitude (-180 to +180)
        - Geolocation Fields/Time (UTC seconds since 1993)
        - Data Fields/ColumnAmountO3 (typical 200 - 450 DU)
        - Data Fields/QualityFlags (0 for good quality)
    """
    output_filename = output_filename or DEFAULT_FILENAME
    output_path = os.path.join(settings.DATA_RAW_DIR, output_filename)
    os.makedirs(settings.DATA_RAW_DIR, exist_ok=True)

    # Granule dimensions (along-track scans x across-track pixels)
    n_scans = 120
    n_pixels = 60

    # Synthetic coordinates
    lats = np.linspace(-60, 60, n_scans)[:, None] + np.random.normal(0, 0.5, (n_scans, n_pixels))
    lons = np.linspace(-180, 180, n_pixels)[None, :] + np.random.normal(0, 0.5, (n_scans, n_pixels))
    
    # Synthetic Time (along-track scan seconds)
    times = np.linspace(1036368000, 1036371600, n_scans)[:, None] * np.ones((n_scans, n_pixels))

    # Synthetic Ozone Column (Dobson Units):
    base_ozone = 280 + 80 * np.cos(np.deg2rad(lats * 1.5))
    noise = np.random.normal(0, 10, (n_scans, n_pixels))
    ozone_data = np.clip(base_ozone + noise, 150, 500).astype(np.float32)

    # Synthetic quality flags (95% good = 0, 5% bad = 1)
    quality_flags = np.random.choice([0, 1], size=(n_scans, n_pixels), p=[0.95, 0.05]).astype(np.int16)

    # Inject some missing values / fill values
    ozone_data[quality_flags == 1] = -1.2676506e+30

    with h5py.File(output_path, "w") as h5:
        # Create HDF-EOS5 structure
        hdfeos = h5.create_group("HDFEOS")
        swaths = hdfeos.create_group("SWATHS")
        omi_swath = swaths.create_group("OMI Total Column Amount O3")

        geo = omi_swath.create_group("Geolocation Fields")
        data = omi_swath.create_group("Data Fields")

        # Datasets
        ds_lat = geo.create_dataset("Latitude", data=lats.astype(np.float32))
        ds_lat.attrs["Units"] = "degrees_north"

        ds_lon = geo.create_dataset("Longitude", data=lons.astype(np.float32))
        ds_lon.attrs["Units"] = "degrees_east"

        ds_time = geo.create_dataset("Time", data=times.astype(np.float64))
        ds_time.attrs["Units"] = "seconds since 1993-01-01 00:00:00 UTC"

        ds_o3 = data.create_dataset("ColumnAmountO3", data=ozone_data)
        ds_o3.attrs["Units"] = "Dobson Units (DU)"
        ds_o3.attrs["_FillValue"] = -1.2676506e+30

        ds_qf = data.create_dataset("QualityFlags", data=quality_flags)
        ds_qf.attrs["Description"] = "0 = Good quality, 1 = Error / Low quality"

    print(f"[MOCK] Đã tạo file granule giả lập: {output_path}")
    return output_path

if __name__ == "__main__":
    generate_sample_omi_l2_file()
