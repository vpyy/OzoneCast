import os
import h5py
import numpy as np
from datetime import datetime
from pathlib import Path

def generate_mock_granule(output_dir: str = "/data/raw", filename: str = None) -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    if not filename:
        now_str = datetime.utcnow().strftime("%Ym%m%dt%H%M")
        filename = f"OMI-Aura_L2-OMTO3_{now_str}-o118669_v883.he5"

    output_path = os.path.join(output_dir, filename)

    n_scans = 100
    n_pixels = 50

    lats = np.linspace(-65, 65, n_scans)[:, None] + np.random.normal(0, 0.4, (n_scans, n_pixels))
    lons = np.linspace(-180, 180, n_pixels)[None, :] + np.random.normal(0, 0.4, (n_scans, n_pixels))
    times = np.linspace(1036368000, 1036371600, n_scans)[:, None] * np.ones((n_scans, n_pixels))

    base_ozone = 290 + 75 * np.cos(np.deg2rad(lats * 1.5))
    noise = np.random.normal(0, 8, (n_scans, n_pixels))
    ozone_data = np.clip(base_ozone + noise, 130, 480).astype(np.float32)

    # Synthetic ozone depletion / anomaly around southern high latitudes
    ozone_data[lats < -55] = np.clip(ozone_data[lats < -55] - 70, 140, 220)

    quality_flags = np.random.choice([0, 1], size=(n_scans, n_pixels), p=[0.96, 0.04]).astype(np.int16)
    ozone_data[quality_flags == 1] = -1.2676506e+30

    with h5py.File(output_path, "w") as h5:
        hdfeos = h5.create_group("HDFEOS")
        swaths = hdfeos.create_group("SWATHS")
        omi_swath = swaths.create_group("OMI Total Column Amount O3")
        geo = omi_swath.create_group("Geolocation Fields")
        data = omi_swath.create_group("Data Fields")

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

    return output_path

