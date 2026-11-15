import os
import h5py
import numpy as np
from datetime import datetime
from pathlib import Path

def generate_mock_granule(output_dir: str = "/tmp/ozone_raw", filename: str = None) -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    if not filename:
        now_str = datetime.utcnow().strftime("%Ym%m%dt%H%M")
        filename = f"OMI-Aura_L2-OMTO3_{now_str}-o118669_v883.he5"

    output_path = os.path.join(output_dir, filename)

    n_scans = 100
    n_pixels = 50

    # Geolocation: Latitude, Longitude, Time
    lats = np.linspace(-70, 70, n_scans)[:, None] + np.random.normal(0, 0.4, (n_scans, n_pixels))
    lons = np.linspace(-180, 180, n_pixels)[None, :] + np.random.normal(0, 0.4, (n_scans, n_pixels))
    times = np.linspace(1036368000, 1036371600, n_scans)[:, None] * np.ones((n_scans, n_pixels))

    # Base Ozone (DU)
    base_ozone = 290 + 75 * np.cos(np.deg2rad(lats * 1.5))
    noise = np.random.normal(0, 8, (n_scans, n_pixels))
    ozone_data = np.clip(base_ozone + noise, 130, 480).astype(np.float32)

    # Simulated ozone depletion around southern high latitudes (Antarctic spring/winter)
    ozone_data[lats < -55] = np.clip(ozone_data[lats < -55] - 75, 140, 215)

    # 1. Reflectivity331 (%) - Higher over ice/snow at high latitudes and cloudy regions (50-85%), lower elsewhere (8-25%)
    reflectivity = 15.0 + 35.0 * (np.abs(lats) / 70.0) ** 2 + np.random.normal(0, 4.0, (n_scans, n_pixels))
    reflectivity[np.abs(lats) > 55] += np.random.uniform(20.0, 35.0, size=reflectivity[np.abs(lats) > 55].shape)
    reflectivity = np.clip(reflectivity, 2.0, 95.0).astype(np.float32)

    # 2. UVAerosolIndex - Range -1.5 to 4.5. Elevated near desert/subtropical belts
    uv_aerosol = -0.3 + 1.2 * np.sin(np.deg2rad(np.abs(lats) * 2.0)) + np.random.normal(0, 0.35, (n_scans, n_pixels))
    uv_aerosol = np.clip(uv_aerosol, -1.8, 5.0).astype(np.float32)

    # 3. SolarZenithAngle (deg) - 15° to 85° based on latitude
    sza = 15.0 + 60.0 * (np.abs(lats) / 70.0) + np.random.normal(0, 1.5, (n_scans, n_pixels))
    sza = np.clip(sza, 10.0, 88.0).astype(np.float32)

    quality_flags = np.random.choice([0, 1], size=(n_scans, n_pixels), p=[0.96, 0.04]).astype(np.int16)
    ozone_data[quality_flags == 1] = -1.2676506e+30

    with h5py.File(output_path, "w") as h5:
        hdfeos = h5.create_group("HDFEOS")
        swaths = hdfeos.create_group("SWATHS")
        omi_swath = swaths.create_group("OMI Total Column Amount O3")
        geo = omi_swath.create_group("Geolocation Fields")
        data = omi_swath.create_group("Data Fields")

        # Geolocation Fields
        ds_lat = geo.create_dataset("Latitude", data=lats.astype(np.float32))
        ds_lat.attrs["Units"] = "degrees_north"

        ds_lon = geo.create_dataset("Longitude", data=lons.astype(np.float32))
        ds_lon.attrs["Units"] = "degrees_east"

        ds_time = geo.create_dataset("Time", data=times.astype(np.float64))
        ds_time.attrs["Units"] = "seconds since 1993-01-01 00:00:00 UTC"

        ds_sza = geo.create_dataset("SolarZenithAngle", data=sza)
        ds_sza.attrs["Units"] = "deg"

        # Data Fields
        ds_o3 = data.create_dataset("ColumnAmountO3", data=ozone_data)
        ds_o3.attrs["Units"] = "Dobson Units (DU)"
        ds_o3.attrs["_FillValue"] = -1.2676506e+30

        ds_refl = data.create_dataset("Reflectivity331", data=reflectivity)
        ds_refl.attrs["Units"] = "percent"

        ds_uv = data.create_dataset("UVAerosolIndex", data=uv_aerosol)
        ds_uv.attrs["Units"] = "NoUnits"

        ds_qf = data.create_dataset("QualityFlags", data=quality_flags)

    return output_path
