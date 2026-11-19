"""
mock_granule.py — Sinh file HDF5/HE5 giả lập dữ liệu OMI Aura L2
Mô phỏng đầy đủ 10 trường chính + 2 trường bonus, tập trung vùng Bán đảo Nam Cực [-90°, -55°]
Cấu trúc: 400 scan lines × 60 cross-track pixels (đúng như OMI thực tế)
"""

import os
import h5py
import numpy as np
from datetime import datetime
from pathlib import Path


def generate_mock_granule(output_dir: str = "/tmp/ozone_raw", filename: str = None) -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    if not filename:
        now_str = datetime.utcnow().strftime("%Ym%m%dt%H%M")
        filename = f"OMI-Aura_L2-OMTO3_{now_str}-o118669_v883-2026m1119t120000.he5"

    output_path = os.path.join(output_dir, filename)

    # ── Cấu trúc swath OMI thực tế ──────────────────────────────────────────
    n_scans  = 400   # along-track: số dòng quét khi bay qua Nam Cực
    n_pixels = 60    # cross-track: số pixel mỗi dòng (0=trái, 29/30=nadir, 59=phải)

    # pixel_index dùng để xác định nadir (29/30) và mép swath (0, 59)
    pixel_idx = np.arange(n_pixels)                                 # shape (60,)
    scan_idx  = np.arange(n_scans)                                  # shape (400,)

    # ── Toạ độ: quỹ đạo nghiêng qua Bán đảo Nam Cực ────────────────────────
    # Along-track: từ -40° xuống -90° rồi lên lại -55°  → hình vòng cung
    lat_center = -65.0 + 25.0 * np.sin(np.pi * scan_idx / (n_scans - 1))  # (400,)
    # Thêm độ nghiêng quỹ đạo theo kinh độ
    lon_center = -60.0 + 120.0 * (scan_idx / (n_scans - 1))               # (400,) → −60° → +60°

    # Cross-track: dải quét ~2600 km → ≈ ±13° vĩ độ, ±23° kinh độ ở vùng cực
    pixel_lat_offset = np.linspace(-13.0, 13.0, n_pixels)   # (60,)
    pixel_lon_offset = np.linspace(-23.0, 23.0, n_pixels)   # (60,)

    lats = (lat_center[:, None] + pixel_lat_offset[None, :] +
            np.random.normal(0, 0.3, (n_scans, n_pixels))).astype(np.float32)
    lons = (lon_center[:, None] + pixel_lon_offset[None, :] +
            np.random.normal(0, 0.3, (n_scans, n_pixels))).astype(np.float32)

    # Clamp kinh / vĩ
    lats = np.clip(lats, -90.0, -40.0)
    lons = np.clip(lons, -180.0, 180.0)

    # ── seconds_in_day: thời gian UTC mỗi dòng quét (sắp xếp tăng dần) ─────
    # Vệ tinh bay qua trong ~40 phút (2400 giây), bắt đầu từ 50400 s (14:00 UTC)
    sid_per_scan = np.linspace(50400.0, 52800.0, n_scans)   # shape (400,)
    seconds_in_day = (sid_per_scan[:, None] * np.ones((n_scans, n_pixels))).astype(np.float64)

    # ── ColumnAmountO3 (DU) ─────────────────────────────────────────────────
    # Hiệu ứng lỗ ozone mùa xuân Nam Cực: thấp ở vĩ độ < -65°
    base_ozone = 300.0 + 40.0 * np.cos(np.deg2rad(lats * 1.5))
    noise = np.random.normal(0, 10.0, (n_scans, n_pixels))
    ozone_data = np.clip(base_ozone + noise, 130.0, 500.0).astype(np.float32)
    # Vùng lỗ ozone
    ozone_data[lats < -70] = np.clip(ozone_data[lats < -70] - 100.0, 140.0, 220.0)
    ozone_data[lats < -80] = np.clip(ozone_data[lats < -80] - 50.0,  130.0, 190.0)

    # ── SolarZenithAngle (deg) ──────────────────────────────────────────────
    # Ở vùng cực góc thiên đỉnh lớn (60°–84°), lọc > 84° sẽ bỏ
    sza_base = 60.0 + 22.0 * (np.abs(lats) - 55.0) / 35.0
    sza = np.clip(sza_base + np.random.normal(0, 1.5, (n_scans, n_pixels)),
                  55.0, 87.0).astype(np.float32)

    # ── QualityFlags ────────────────────────────────────────────────────────
    quality_flags = np.random.choice([0, 0, 0, 0, 1], size=(n_scans, n_pixels)).astype(np.int16)

    # ── GroundPixelQualityFlags ─────────────────────────────────────────────
    ground_pq = np.zeros((n_scans, n_pixels), dtype=np.int16)
    # Một số pixel có lỗi địa chất (ven biển, băng vỡ)
    ground_pq[np.random.rand(n_scans, n_pixels) < 0.05] = 1

    # ── RadiativeCloudFraction (0–1) ────────────────────────────────────────
    # Mây nhiều ở ven biển (vĩ độ -60° đến -65°), ít hơn trên băng lục địa
    cloud_base = 0.3 + 0.4 * np.exp(-((lats + 62.0) / 5.0) ** 2)
    radiative_cf = np.clip(cloud_base + np.random.normal(0, 0.08, (n_scans, n_pixels)),
                           0.0, 1.0).astype(np.float32)

    # ── CloudPressure (hPa) ─────────────────────────────────────────────────
    # Áp suất đỉnh mây: thấp (mây cao) khi CF > 0.5, cao (mây thấp) khi CF < 0.2
    cloud_pressure = np.clip(900.0 - 600.0 * radiative_cf +
                             np.random.normal(0, 30.0, (n_scans, n_pixels)),
                             100.0, 950.0).astype(np.float32)

    # ── WaterFraction (0–1) ─────────────────────────────────────────────────
    # 0 = băng/đất liền, 1 = đại dương; vĩ độ < -75° → chủ yếu băng lục địa
    water_frac = np.clip(0.9 - 0.012 * (np.abs(lats) - 55.0) +
                         np.random.normal(0, 0.07, (n_scans, n_pixels)),
                         0.0, 1.0).astype(np.float32)
    water_frac[lats < -75] = np.clip(water_frac[lats < -75] - 0.5, 0.0, 0.3)

    # ── Reflectivity331 (%) ─────────────────────────────────────────────────
    reflectivity = np.clip(15.0 + 55.0 * (1.0 - water_frac) +
                           5.0 * radiative_cf +
                           np.random.normal(0, 4.0, (n_scans, n_pixels)),
                           2.0, 95.0).astype(np.float32)

    # ── UVAerosolIndex ──────────────────────────────────────────────────────
    uv_aerosol = np.clip(-0.5 + 0.8 * np.sin(np.deg2rad(np.abs(lats) * 2.0)) +
                         np.random.normal(0, 0.3, (n_scans, n_pixels)),
                         -2.0, 5.0).astype(np.float32)

    # ── Áp dụng fill value cho pixel lỗi ───────────────────────────────────
    FILL = np.float32(-1.2676506e+30)
    bad_mask = (quality_flags == 1) | (ground_pq == 1)
    ozone_data[bad_mask] = FILL

    # ── Ghi file HDF-EOS5 ───────────────────────────────────────────────────
    with h5py.File(output_path, "w") as h5:
        hdfeos   = h5.create_group("HDFEOS")
        swaths   = hdfeos.create_group("SWATHS")
        omi_sw   = swaths.create_group("OMI Total Column Amount O3")
        geo      = omi_sw.create_group("Geolocation Fields")
        data_grp = omi_sw.create_group("Data Fields")

        # --- Geolocation Fields ---
        ds_lat = geo.create_dataset("Latitude", data=lats)
        ds_lat.attrs["Units"] = "degrees_north"

        ds_lon = geo.create_dataset("Longitude", data=lons)
        ds_lon.attrs["Units"] = "degrees_east"

        ds_sid = geo.create_dataset("SecondsInDay", data=seconds_in_day)
        ds_sid.attrs["Units"] = "s"

        ds_sza = geo.create_dataset("SolarZenithAngle", data=sza)
        ds_sza.attrs["Units"] = "deg"

        # --- Data Fields ---
        ds_o3 = data_grp.create_dataset("ColumnAmountO3", data=ozone_data)
        ds_o3.attrs["Units"]      = "DU"
        ds_o3.attrs["_FillValue"] = FILL

        ds_qf = data_grp.create_dataset("QualityFlags", data=quality_flags)
        ds_qf.attrs["Units"] = "NoUnits"

        ds_gpq = data_grp.create_dataset("GroundPixelQualityFlags", data=ground_pq)
        ds_gpq.attrs["Units"] = "NoUnits"

        ds_rcf = data_grp.create_dataset("RadiativeCloudFraction", data=radiative_cf)
        ds_rcf.attrs["Units"] = "NoUnits"

        ds_cp = data_grp.create_dataset("CloudPressure", data=cloud_pressure)
        ds_cp.attrs["Units"] = "hPa"

        ds_wf = data_grp.create_dataset("WaterFraction", data=water_frac)
        ds_wf.attrs["Units"] = "NoUnits"

        ds_refl = data_grp.create_dataset("Reflectivity331", data=reflectivity)
        ds_refl.attrs["Units"] = "percent"

        ds_uv = data_grp.create_dataset("UVAerosolIndex", data=uv_aerosol)
        ds_uv.attrs["Units"] = "NoUnits"

    print(f"[MOCK] Generated: {output_path}  shape=({n_scans}×{n_pixels})")
    return output_path
