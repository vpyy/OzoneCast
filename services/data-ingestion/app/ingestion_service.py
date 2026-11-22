"""
Ingestion Service cho dữ liệu OMI-Aura OMTO3 (Level-2 Swath) và OMTO3G (Level-2G Gridded).
- Cắt dữ liệu chính xác theo vùng Bán đảo Nam Cực (Lat [-70, -63], Lon [-75, -55])
- Hỗ trợ cả 2 định dạng file vệ tinh chuẩn NASA:
  + OMTO3G: Level-2G Gridded toàn cầu (đọc Grid Slicing tiết kiệm RAM)
  + OMTO3: Level-2 Swath từng quỹ đạo (lọc tọa độ Geolocation lát cắt Nam Cực)
- Gán timestamp created_at chính xác theo thời điểm vệ tinh quan sát (Observation Time)
- Bulk UPSERT idempotent vào bảng raw_measurements
- Tự động Discovery API theo cửa sổ 7 ngày gần nhất (rolling 7 days) và đồng bộ seed/urls_seed.txt
"""

import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
import h5py
import numpy as np

from .nasa_client import NASAClient, OMTO3_REGEX, OMTO3G_REGEX
from .mock_granule import generate_mock_granule
from .db import db_client

TMP_DIR = "/tmp/ozone_raw"

class IngestionService:
    def __init__(self):
        self.nasa_client = NASAClient()
        Path(TMP_DIR).mkdir(parents=True, exist_ok=True)

        # Cấu hình vùng mục tiêu: Bán đảo Nam Cực
        self.lat_min = float(os.getenv("REGION_LAT_MIN", "-70.0"))
        self.lat_max = float(os.getenv("REGION_LAT_MAX", "-63.0"))
        self.lon_min = float(os.getenv("REGION_LON_MIN", "-75.0"))
        self.lon_max = float(os.getenv("REGION_LON_MAX", "-55.0"))

        # Cấu hình quét tìm file (Discovery)
        self.discovery_start_date = os.getenv("DISCOVERY_START_DATE", "2026-11-16")
        self.default_data_url = os.getenv(
            "NASA_DATA_URL",
            "https://omisips1.omisips.eosdis.nasa.gov/data/10da43cd73977b549e32cd346b9f2a2f/OMI-Aura_L2G-OMTO3G_2026m1116_v004-2026m1117t052851.he5"
        )

    def calculate_grid_indices(self) -> Tuple[int, int, int, int]:
        """
        Tính chỉ số hàng và cột từ tọa độ lưới toàn cầu 0.25° x 0.25° cho OMTO3G:
        - Lat: -90.0 đến +90.0 (720 hàng, YDim)
        - Lon: -180.0 đến +180.0 (1440 cột, XDim)
        """
        row_start = max(0, int(np.floor((self.lat_min - (-90.0)) / 0.25)))  # ~80
        row_end = min(720, int(np.ceil((self.lat_max - (-90.0)) / 0.25)))   # ~108

        col_start = max(0, int(np.floor((self.lon_min - (-180.0)) / 0.25))) # ~420
        col_end = min(1440, int(np.ceil((self.lon_max - (-180.0)) / 0.25)))  # ~500

        return row_start, row_end, col_start, col_end

    # -------------------------------------------------------------------------
    # TRÍCH XUẤT FILE HDF5 (BÁN ĐẢO NAM CỰC)
    # -------------------------------------------------------------------------
    def extract_and_publish(self, file_path: str) -> dict:
        filename = Path(file_path).name
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

        # Phân tích thông tin vệ tinh và thời gian quan sát từ tên file
        info = self.nasa_client.parse_granule_info(f"source://{filename}")
        obs_date_str = info["observation_date"] if info and info.get("observation_date") else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        obs_midnight = info["observation_midnight"] if info and info.get("observation_midnight") else None
        base_obs_dt = info["observation_datetime"] if info and info.get("observation_datetime") else datetime.now(timezone.utc)
        if not obs_midnight:
            obs_midnight = base_obs_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        product_type = info["product_type"] if info else ("OMTO3" if "L2-OMTO3_" in filename else "OMTO3G")

        print(f"[EXTRACT] Bắt đầu trích xuất: {filename} ({file_size / (1024*1024):.1f} MB, Loại: {product_type}, Ngày: {obs_date_str})")

        extracted_items = []
        discarded_count = 0

        try:
            with h5py.File(file_path, "r") as h5:
                # =============================================================
                # TRƯỜNG HỢP 1: OMTO3 LEVEL-2 SWATH
                # =============================================================
                if "HDFEOS/SWATHS" in h5:
                    swath_group = None
                    for sw_name in ["OMI Column Amount O3", "OMI Total Column Amount O3"]:
                        cand = f"HDFEOS/SWATHS/{sw_name}"
                        if cand in h5:
                            swath_group = h5[cand]
                            break
                    if swath_group is None:
                        sw_keys = list(h5["HDFEOS/SWATHS"].keys())
                        if sw_keys:
                            swath_group = h5[f"HDFEOS/SWATHS/{sw_keys[0]}"]

                    if swath_group is None:
                        raise ValueError(f"Không tìm thấy cấu trúc SWATHS trong file {filename}")

                    geo = swath_group.get("Geolocation Fields", {})
                    data = swath_group.get("Data Fields", {})

                    if "Latitude" not in geo or "Longitude" not in geo or "ColumnAmountO3" not in data:
                        raise ValueError(f"Thiếu trường bắt buộc Latitude/Longitude/ColumnAmountO3 trong Swath {filename}")

                    lats = np.array(geo["Latitude"])
                    lons = np.array(geo["Longitude"])

                    # Tìm các pixel nằm trong vùng Bán đảo Nam Cực
                    mask = (
                        (lats >= self.lat_min - 0.1) & (lats <= self.lat_max + 0.1) &
                        (lons >= self.lon_min - 0.1) & (lons <= self.lon_max + 0.1)
                    )

                    if not np.any(mask):
                        print(f"[EXTRACT SWATH] Quỹ đạo vệ tinh không đi qua vùng Bán đảo Nam Cực (no_data_in_region).")
                        db_client.update_granule_status(filename, "no_data_in_region", 0, "Orbit swath does not intersect Antarctic region")
                        return {"status": "no_data_in_region", "filename": filename, "saved_to_db": 0}

                    # Đọc các mảng dữ liệu
                    o3_arr = np.array(data["ColumnAmountO3"])
                    sza_arr = np.array(geo["SolarZenithAngle"]) if "SolarZenithAngle" in geo else None
                    qf_arr = np.array(data["QualityFlags"]) if "QualityFlags" in data else None
                    gqf_arr = np.array(geo["GroundPixelQualityFlags"]) if "GroundPixelQualityFlags" in geo else None
                    rcf_arr = np.array(data["RadiativeCloudFraction"]) if "RadiativeCloudFraction" in data else None
                    cp_arr = np.array(data["CloudPressure"]) if "CloudPressure" in data else None
                    refl_arr = np.array(data["Reflectivity331"]) if "Reflectivity331" in data else None
                    uv_arr = np.array(data["UVAerosolIndex"]) if "UVAerosolIndex" in data else None
                    wf_arr = np.array(geo["WaterFraction"]) if "WaterFraction" in geo else None
                    sec_arr = np.array(geo["SecondsInDay"]) if "SecondsInDay" in geo else None
                    t_arr = np.array(geo["Time"]) if "Time" in geo else None

                    t_idx_list, x_idx_list = np.where(mask)
                    pt_counter = 0

                    for t_idx, x_idx in zip(t_idx_list, x_idx_list):
                        raw_o3 = float(o3_arr[t_idx, x_idx])
                        if raw_o3 <= 0 or raw_o3 > 1000.0 or np.isnan(raw_o3):
                            discarded_count += 1
                            continue

                        qf = int(qf_arr[t_idx, x_idx]) if qf_arr is not None else 0
                        if (qf & 1) != 0 or qf == 65535:
                            discarded_count += 1
                            continue

                        sza = float(sza_arr[t_idx, x_idx]) if sza_arr is not None else 0.0
                        if sza > 88.0:
                            discarded_count += 1
                            continue
                        if sza < 0 or sza > 180.0 or np.isnan(sza):
                            sza = 0.0

                        gqf = int(gqf_arr[t_idx, x_idx]) if gqf_arr is not None else 0
                        rcf = float(rcf_arr[t_idx, x_idx]) if rcf_arr is not None else 0.0
                        rcf = 0.0 if (rcf < 0 or rcf > 1.0 or np.isnan(rcf)) else round(rcf, 4)

                        cp = float(cp_arr[t_idx, x_idx]) if cp_arr is not None else 0.0
                        cp = 0.0 if (cp < 0 or cp > 1100.0 or np.isnan(cp)) else round(cp, 2)

                        wf = float(wf_arr[t_idx, x_idx]) if wf_arr is not None else 0.0
                        if wf > 1.0 and wf <= 100.0:
                            wf = round(wf / 100.0, 3)
                        elif wf < 0 or wf > 100.0 or np.isnan(wf):
                            wf = 0.0

                        refl = float(refl_arr[t_idx, x_idx]) if refl_arr is not None else 0.0
                        refl = 0.0 if (refl < 0 or refl > 100.0 or np.isnan(refl)) else round(refl, 2)

                        uv_ai = float(uv_arr[t_idx, x_idx]) if uv_arr is not None else 0.0
                        uv_ai = 0.0 if (abs(uv_ai) > 30.0 or np.isnan(uv_ai)) else round(uv_ai, 3)

                        sec = float(sec_arr[t_idx]) if (sec_arr is not None and sec_arr.ndim == 1) else float(sec_arr[t_idx, x_idx]) if sec_arr is not None else 0.0
                        if sec < 0 or sec > 86400.0 or np.isnan(sec):
                            sec = 0.0

                        t_val = float(t_arr[t_idx]) if (t_arr is not None and t_arr.ndim == 1) else float(t_arr[t_idx, x_idx]) if t_arr is not None else sec

                        # Timestamp chính xác từ vệ tinh: SecondsInDay tính từ 00:00:00 UTC của ngày quan sát
                        if sec > 0 and sec < 86400:
                            point_dt = obs_midnight + timedelta(seconds=sec)
                        else:
                            point_dt = base_obs_dt

                        pt_counter += 1
                        extracted_items.append({
                            "point_index": pt_counter,
                            "latitude": round(float(lats[t_idx, x_idx]), 4),
                            "longitude": round(float(lons[t_idx, x_idx]), 4),
                            "seconds_in_day": round(sec, 2),
                            "time_raw": round(t_val, 2),
                            "ozone_column_raw": round(raw_o3, 2),
                            "quality_flag": qf,
                            "ground_pixel_quality_flag": gqf,
                            "solar_zenith_angle": round(sza, 2),
                            "radiative_cloud_fraction": rcf,
                            "cloud_pressure": cp,
                            "water_fraction": wf,
                            "reflectivity331": refl,
                            "uv_aerosol_index": uv_ai,
                            "row_index": int(t_idx),
                            "col_index": int(x_idx),
                            "observation_index": 0,
                            "created_at": point_dt
                        })

                # =============================================================
                # TRƯỜNG HỢP 2: OMTO3G LEVEL-2G GRIDDED
                # =============================================================
                else:
                    grid_fields = None
                    for base in [
                        "HDFEOS/GRIDS/OMI Column Amount O3/Data Fields",
                        "HDFEOS/GRIDS/Ozone L2G Grid/Data Fields",
                    ]:
                        if base in h5:
                            grid_fields = h5[base]
                            break

                    if grid_fields is None and "HDFEOS/GRIDS" in h5:
                        for gname in h5["HDFEOS/GRIDS"].keys():
                            cand = f"HDFEOS/GRIDS/{gname}/Data Fields"
                            if cand in h5:
                                grid_fields = h5[cand]
                                break

                    if grid_fields is None:
                        raise ValueError(f"Không tìm thấy cấu trúc HDFEOS/GRIDS/Data Fields trong file {filename}")

                    row_start, row_end, col_start, col_end = self.calculate_grid_indices()

                    def read_slice(ds_name: str) -> Optional[np.ndarray]:
                        if ds_name in grid_fields:
                            ds = grid_fields[ds_name]
                            if len(ds.shape) == 3:
                                # Nếu mảng đã đúng kích thước vùng cắt (như file mock), dùng trực tiếp
                                if ds.shape[1] == (row_end - row_start) and ds.shape[2] == (col_end - col_start):
                                    return ds[:]
                                return ds[:, row_start:row_end, col_start:col_end]
                            elif len(ds.shape) == 2:
                                if ds.shape[0] == (row_end - row_start) and ds.shape[1] == (col_end - col_start):
                                    return ds[None, :, :]
                                arr_2d = ds[row_start:row_end, col_start:col_end]
                                return arr_2d[None, :, :]
                        return None

                    o3_slice = read_slice("ColumnAmountO3")
                    lat_slice = read_slice("Latitude")
                    lon_slice = read_slice("Longitude")
                    sec_slice = read_slice("SecondsInDay")
                    time_slice = read_slice("Time")
                    qf_slice = read_slice("QualityFlags")
                    gqf_slice = read_slice("GroundPixelQualityFlags")
                    sza_slice = read_slice("SolarZenithAngle")
                    rcf_slice = read_slice("RadiativeCloudFraction")
                    cp_slice = read_slice("CloudPressure")
                    wf_slice = read_slice("WaterFraction")
                    refl_slice = read_slice("Reflectivity331")
                    uv_slice = read_slice("UVAerosolIndex")

                    if o3_slice is None:
                        raise ValueError(f"Trường bắt buộc ColumnAmountO3 không tồn tại trong file {filename}")

                    n_cand, n_r, n_c = o3_slice.shape
                    pt_counter = 0

                    for cand_idx in range(n_cand):
                        for r_offset in range(n_r):
                            r_actual = row_start + r_offset
                            cell_lat_center = round(-90.0 + (r_actual + 0.5) * 0.25, 4)

                            for c_offset in range(n_c):
                                c_actual = col_start + c_offset
                                cell_lon_center = round(-180.0 + (c_actual + 0.5) * 0.25, 4)

                                raw_o3 = float(o3_slice[cand_idx, r_offset, c_offset])
                                if raw_o3 <= 0 or raw_o3 > 1000.0 or np.isnan(raw_o3):
                                    discarded_count += 1
                                    continue

                                pt_lat = float(lat_slice[cand_idx, r_offset, c_offset]) if lat_slice is not None else cell_lat_center
                                pt_lon = float(lon_slice[cand_idx, r_offset, c_offset]) if lon_slice is not None else cell_lon_center

                                if pt_lat < -90.0 or pt_lat > 90.0 or np.isnan(pt_lat):
                                    pt_lat = cell_lat_center
                                if pt_lon < -180.0 or pt_lon > 180.0 or np.isnan(pt_lon):
                                    pt_lon = cell_lon_center

                                if not (self.lat_min - 0.1 <= pt_lat <= self.lat_max + 0.1 and self.lon_min - 0.1 <= pt_lon <= self.lon_max + 0.1):
                                    discarded_count += 1
                                    continue

                                qf = int(qf_slice[cand_idx, r_offset, c_offset]) if qf_slice is not None else 0
                                gqf = int(gqf_slice[cand_idx, r_offset, c_offset]) if gqf_slice is not None else 0

                                if (qf & 1) != 0 or qf == 65535 or gqf == 65535:
                                    discarded_count += 1
                                    continue

                                sza = float(sza_slice[cand_idx, r_offset, c_offset]) if sza_slice is not None else 0.0
                                if sza > 88.0:
                                    discarded_count += 1
                                    continue
                                if sza < 0 or sza > 180.0 or np.isnan(sza):
                                    sza = 0.0

                                rcf = float(rcf_slice[cand_idx, r_offset, c_offset]) if rcf_slice is not None else 0.0
                                rcf = 0.0 if (rcf < 0 or rcf > 1.0 or np.isnan(rcf)) else round(rcf, 4)

                                cp = float(cp_slice[cand_idx, r_offset, c_offset]) if cp_slice is not None else 0.0
                                cp = 0.0 if (cp < 0 or cp > 1100.0 or np.isnan(cp)) else round(cp, 2)

                                wf = float(wf_slice[cand_idx, r_offset, c_offset]) if wf_slice is not None else 0.0
                                if wf > 1.0 and wf <= 100.0:
                                    wf = round(wf / 100.0, 3)
                                elif wf < 0 or wf > 100.0 or np.isnan(wf):
                                    wf = 0.0

                                refl = float(refl_slice[cand_idx, r_offset, c_offset]) if refl_slice is not None else 0.0
                                refl = 0.0 if (refl < 0 or refl > 100.0 or np.isnan(refl)) else round(refl, 2)

                                uv_ai = float(uv_slice[cand_idx, r_offset, c_offset]) if uv_slice is not None else 0.0
                                uv_ai = 0.0 if (abs(uv_ai) > 30.0 or np.isnan(uv_ai)) else round(uv_ai, 3)

                                sec = float(sec_slice[cand_idx, r_offset, c_offset]) if sec_slice is not None else 0.0
                                if sec < 0 or sec > 86400.0 or np.isnan(sec):
                                    sec = 0.0

                                t_raw = float(time_slice[cand_idx, r_offset, c_offset]) if time_slice is not None else 0.0
                                if t_raw < 0 or np.isnan(t_raw):
                                    t_raw = sec

                                # Timestamp chính xác từ vệ tinh: SecondsInDay tính từ 00:00:00 UTC của ngày quan sát
                                if sec > 0 and sec < 86400:
                                    point_dt = obs_midnight + timedelta(seconds=sec)
                                else:
                                    point_dt = base_obs_dt

                                pt_counter += 1
                                extracted_items.append({
                                    "point_index": pt_counter,
                                    "latitude": round(pt_lat, 4),
                                    "longitude": round(pt_lon, 4),
                                    "seconds_in_day": round(sec, 2),
                                    "time_raw": round(t_raw, 2),
                                    "ozone_column_raw": round(raw_o3, 2),
                                    "quality_flag": qf,
                                    "ground_pixel_quality_flag": gqf,
                                    "solar_zenith_angle": round(sza, 2),
                                    "radiative_cloud_fraction": rcf,
                                    "cloud_pressure": cp,
                                    "water_fraction": wf,
                                    "reflectivity331": refl,
                                    "uv_aerosol_index": uv_ai,
                                    "row_index": r_actual,
                                    "col_index": c_actual,
                                    "observation_index": cand_idx,
                                    "created_at": point_dt
                                })

        except Exception as e:
            print(f"[EXTRACT ERROR] Lỗi khi xử lý file {filename}: {e}")
            db_client.update_granule_status(filename, "failed", 0, str(e))
            return {"error": str(e), "filename": filename}
        finally:
            # Xóa file tạm ngay sau khi trích xuất xong để giải phóng ổ cứng
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"[CLEANUP] Đã xóa file tạm {file_path}")
            except OSError:
                pass

        # Kiểm tra kết quả trích xuất
        if not extracted_items:
            print(f"[EXTRACT WARN] Không tìm thấy điểm đo hợp lệ nào trong vùng Bán đảo Nam Cực (no_data_in_region).")
            db_client.update_granule_status(filename, "no_data_in_region", 0, "No valid observations in Antarctic region")
            return {
                "filename": filename,
                "status": "no_data_in_region",
                "saved_to_db": 0,
                "discarded_count": discarded_count
            }

        # Ghi vào PostgreSQL (Idempotent UPSERT)
        db_client.save_granule({
            "filename": filename,
            "file_url": f"nasa_source://{filename}",
            "satellite": "Aura",
            "instrument": "OMI",
            "product_level": "L2" if product_type == "OMTO3" else "L2G",
            "file_size_bytes": file_size,
            "download_status": "DOWNLOADED",
            "process_status": "PROCESSED",
            "local_path": "",
        })

        saved_count = db_client.save_raw_measurements_l2g_bulk(filename, extracted_items)
        db_client.update_ozone_daily(obs_date_str)
        db_client.update_granule_status(filename, "done", saved_count, None)

        print(f"[EXTRACT SUCCESS] Đã lưu {saved_count} điểm đo Bán đảo Nam Cực từ {filename} vào DB (Observation: {obs_date_str}). Bỏ {discarded_count} quan sát ngoài vùng/lỗi.")

        return {
            "filename": filename,
            "observation_date": obs_date_str,
            "saved_to_db": saved_count,
            "discarded_count": discarded_count,
            "status": "done"
        }

    # -------------------------------------------------------------------------
    # TỰ ĐỘNG DISCOVERY CÁC GRANULE MỚI TỪ NASA API TRONG 7 NGÀY GẦN NHẤT
    # -------------------------------------------------------------------------
    def run_discovery(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> int:
        """Quét tìm các URL file OMTO3 / OMTO3G từ NASA và lưu vào ingested_granules với status pending."""
        now = datetime.now(timezone.utc)
        e_date = end_date or now.strftime("%Y-%m-%d")
        s_date = start_date or (now - timedelta(days=7)).strftime("%Y-%m-%d")

        print(f"[DISCOVERY] Đang quét các file NASA từ {s_date} đến {e_date} (7 ngày gần nhất)...")
        discovered = self.nasa_client.discover_granules(s_date, e_date)

        # Bổ sung thêm URL seed mặc định nếu chưa có
        if self.default_data_url:
            info = self.nasa_client.parse_granule_info(self.default_data_url)
            if info:
                discovered.append(info)

        new_count = 0
        for item in discovered:
            ok = db_client.record_discovered_granule(item)
            if ok:
                new_count += 1

        print(f"[DISCOVERY] Hoàn tất. Ghi nhận {new_count} granule mới vào hàng đợi.")
        return new_count

    # -------------------------------------------------------------------------
    # XỬ LÝ HÀNG ĐỢI GRANULE PENDING
    # -------------------------------------------------------------------------
    def process_pending_queue(self, batch_size: int = 2) -> int:
        """Lấy các granule đang pending từ DB, tải stream và trích xuất."""
        pending_list = db_client.get_pending_granules(limit=batch_size)
        if not pending_list:
            return 0

        processed_count = 0
        for item in pending_list:
            filename = item["filename"]
            url = item["url"]
            print(f"\n[QUEUE] Bắt đầu xử lý granule: {filename}")
            db_client.update_granule_status(filename, "processing", 0, None)
            target_path = os.path.join(TMP_DIR, filename)

            success = self.nasa_client.download_file(url, target_path, timeout_sec=600)
            if not success:
                print(f"[QUEUE ERROR] Không thể tải file {filename}. Đánh dấu failed.")
                db_client.update_granule_status(filename, "failed", 0, "Download failed or timed out")
                if os.path.exists(target_path):
                    os.remove(target_path)
                continue

            res = self.extract_and_publish(target_path)
            if res.get("status") in ["done", "no_data_in_region"]:
                processed_count += 1

        return processed_count

    # -------------------------------------------------------------------------
    # CÁC HÀM NẠP THỦ CÔNG HOẶC GIẢ LẬP
    # -------------------------------------------------------------------------
    def ingest_from_url(self, file_url: Optional[str] = None) -> Optional[dict]:
        target_url = (file_url or self.default_data_url).strip()
        info = self.nasa_client.parse_granule_info(target_url)
        filename = info["filename"] if info else target_url.split("/")[-1].split("?")[0]
        target_path = os.path.join(TMP_DIR, filename)

        print(f"[INGEST URL] Đang tải từ {target_url}...")
        if self.nasa_client.download_file(target_url, target_path, timeout_sec=600):
            return self.extract_and_publish(target_path)
        return None

    def ingest_mock(self, target_date: Optional[str] = None, filename: Optional[str] = None) -> dict:
        mock_file = generate_mock_granule(TMP_DIR, filename=filename, target_date=target_date)
        print(f"[INGEST MOCK] Đã tạo file mock L2G Bán đảo Nam Cực: {mock_file} (Ngày: {target_date or 'mặc định'})")
        return self.extract_and_publish(mock_file)
