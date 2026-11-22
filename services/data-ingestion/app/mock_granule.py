"""
Tạo file HDF5/HE5 giả lập định dạng OMI-Aura OMTO3G (Level-2G Gridded).
Giả lập vùng Bán đảo Nam Cực (Antarctic Peninsula) với đầy đủ cấu trúc lưới và 10 trường dữ liệu.
"""

import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import h5py
import numpy as np

def generate_mock_granule(
    output_dir: str = "/tmp/ozone_raw", 
    filename: Optional[str] = None, 
    target_date: Optional[str] = None
) -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # Xác định ngày quan sát: ưu tiên target_date, sau đó trích xuất từ filename, cuối cùng mới dùng now
    obs_date_obj = None
    if target_date:
        t_clean = target_date.strip().replace("-", "").replace("m", "")
        if len(t_clean) >= 8 and t_clean[:8].isdigit():
            y, m, d = int(t_clean[:4]), int(t_clean[4:6]), int(t_clean[6:8])
            obs_date_obj = datetime(y, m, d, 0, 0, 0, tzinfo=timezone.utc)

    if not obs_date_obj and filename:
        m = re.search(r"(\d{4})[-_m](\d{2})[-_m](\d{2})", filename)
        if m:
            y, m, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            obs_date_obj = datetime(y, m, d, 0, 0, 0, tzinfo=timezone.utc)

    if not obs_date_obj:
        obs_date_obj = datetime.now(timezone.utc)

    date_str = obs_date_obj.strftime("%Ym%m%d")
    now_str = obs_date_obj.strftime("%Ym%m%dt120000")

    if not filename:
        filename = f"OMI-Aura_L2G-OMTO3G_{date_str}_v004-{now_str}.he5"
    else:
        # Đảm bảo tên file chứa chuỗi ngày date_str
        if date_str not in filename:
            filename = f"OMI-Aura_L2G-OMTO3G_{date_str}_v004-{filename}"

    output_path = os.path.join(output_dir, filename)

    # Vùng Bán đảo Nam Cực: Lat [-70, -63], Lon [-75, -55]
    # Độ phân giải lưới 0.25 độ: 28 hàng vĩ độ x 80 cột kinh độ
    n_rows = 28  # Latitudes
    n_cols = 80  # Longitudes
    n_obs = 3    # Chiều số lần quan sát (observations per grid cell trong 1 ngày)

    lats_1d = np.linspace(-70.0 + 0.125, -63.0 - 0.125, n_rows).astype(np.float32)
    lons_1d = np.linspace(-75.0 + 0.125, -55.0 - 0.125, n_cols).astype(np.float32)

    # Lưới tọa độ 2D
    lats_2d = np.tile(lats_1d[:, None], (1, n_cols))
    lons_2d = np.tile(lons_1d[None, :], (n_rows, 1))

    # Tọa độ 3D theo số lần quan sát
    lats = np.tile(lats_2d[:, :, None], (1, 1, n_obs))
    lons = np.tile(lons_2d[:, :, None], (1, 1, n_obs))

    # Thời gian trong ngày (SecondsInDay: ~36000s đến 64000s)
    base_secs = np.linspace(36000.0, 60000.0, n_obs)
    secs_in_day = np.tile(base_secs[None, None, :], (n_rows, n_cols, 1)) + np.random.uniform(-180, 180, (n_rows, n_cols, n_obs))
    times = secs_in_day + 1036368000.0

    # Ozone (DU) tại Nam Cực: Lỗ thủng ozone dao động mạnh 150 - 240 DU
    base_ozone = 185.0 + 35.0 * np.cos(np.deg2rad((lats + 66.5) * 15.0))
    noise = np.random.normal(0, 5.0, (n_rows, n_cols, n_obs))
    ozone_data = np.clip(base_ozone + noise, 135.0, 290.0).astype(np.float32)

    # Góc thiên đỉnh mặt trời (SolarZenithAngle) tại cực: 60° đến 82°
    sza = 60.0 + 20.0 * (np.abs(lats) - 63.0) / 7.0 + np.random.normal(0, 1.0, (n_rows, n_cols, n_obs))
    sza = np.clip(sza, 45.0, 85.0).astype(np.float32)

    # Phản xạ bề mặt Reflectivity331 (%) - Bán đảo Nam Cực có băng tuyết (60-90%)
    refl = 65.0 + 20.0 * np.random.rand(n_rows, n_cols, n_obs)
    refl = np.clip(refl, 10.0, 95.0).astype(np.float32)

    # Tỷ lệ mây bức xạ (RadiativeCloudFraction: 0.1 - 0.7)
    rcf = np.clip(np.random.beta(2, 4, size=(n_rows, n_cols, n_obs)), 0.0, 1.0).astype(np.float32)

    # Áp suất đỉnh mây (CloudPressure: 550 - 850 hPa)
    cp = np.clip(850.0 - 300.0 * rcf + np.random.normal(0, 20.0, (n_rows, n_cols, n_obs)), 300.0, 1013.0).astype(np.float32)

    # Tỷ lệ nước/đất/băng (WaterFraction: 0.1 - 0.9)
    wf = np.clip(np.random.uniform(0.1, 0.8, size=(n_rows, n_cols, n_obs)), 0.0, 1.0).astype(np.float32)

    # Chỉ số UV Aerosol Index (-1.5 đến 1.5)
    uv_aerosol = np.random.normal(0.1, 0.4, (n_rows, n_cols, n_obs)).astype(np.float32)

    # Cờ chất lượng thuật toán & pixel (95% là 0 hợp lệ, 5% cờ xấu)
    quality_flags = np.random.choice([0, 1], size=(n_rows, n_cols, n_obs), p=[0.96, 0.04]).astype(np.int16)
    ground_pixel_flags = np.random.choice([0, 1], size=(n_rows, n_cols, n_obs), p=[0.97, 0.03]).astype(np.int16)

    # Giá trị rỗng (FillValue NASA: -1.2676506e+30) cho các vị trí lỗi
    fill_mask = (quality_flags != 0) | (np.random.rand(n_rows, n_cols, n_obs) < 0.03)
    ozone_data[fill_mask] = -1.2676506e+30

    with h5py.File(output_path, "w") as h5:
        # Cấu trúc HDF-EOS5 Grids chuẩn OMTO3G
        hdfeos = h5.create_group("HDFEOS")
        grids = hdfeos.create_group("GRIDS")
        omi_grid = grids.create_group("OMI Column Amount O3")

        # Thuộc tính lưới (Grid Attributes)
        omi_grid.attrs["GCTPProjectionCode"] = 0  # Geographic Projection
        omi_grid.attrs["GridLength"] = n_rows
        omi_grid.attrs["GridWidth"] = n_cols
        omi_grid.attrs["NumberOfObservations"] = n_obs
        omi_grid.attrs["UpperLeftPointMtrs"] = [-75.0 * 1e6, -63.0 * 1e6]
        omi_grid.attrs["LowerRightPointMtrs"] = [-55.0 * 1e6, -70.0 * 1e6]

        data = omi_grid.create_group("Data Fields")

        def add_ds(name, arr, units, fill=None):
            data_arr = np.transpose(arr, (2, 0, 1)) if arr.ndim == 3 else arr
            ds = data.create_dataset(name, data=data_arr)
            ds.attrs["Units"] = units
            if fill is not None:
                ds.attrs["_FillValue"] = fill
            return ds

        add_ds("ColumnAmountO3", ozone_data, "Dobson Units (DU)", fill=-1.2676506e+30)
        add_ds("Latitude", lats, "degrees_north")
        add_ds("Longitude", lons, "degrees_east")
        add_ds("SecondsInDay", secs_in_day.astype(np.float32), "seconds")
        add_ds("Time", times, "seconds since 1993-01-01 00:00:00 UTC")
        add_ds("SolarZenithAngle", sza, "degrees")
        add_ds("RadiativeCloudFraction", rcf, "NoUnits")
        add_ds("CloudPressure", cp, "hPa")
        add_ds("WaterFraction", wf, "NoUnits")
        add_ds("Reflectivity331", refl, "percent")
        add_ds("UVAerosolIndex", uv_aerosol, "NoUnits")
        add_ds("QualityFlags", quality_flags, "NoUnits")
        add_ds("GroundPixelQualityFlags", ground_pixel_flags, "NoUnits")

    return output_path
