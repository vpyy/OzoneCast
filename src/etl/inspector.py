import os
from pathlib import Path
from typing import Optional
import h5py
from config.settings import settings
from src.crawler.nasa_client import NASAClient

RAW_DIR = Path(settings.DATA_RAW_DIR)
RAW_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SAMPLE_URL = "https://ozoneaq.gsfc.nasa.gov/data/ozone/OMI-Aura_L2-OMTO3_2026m1103t2309-o118669_v004-2026m1104t042602.he5"

def download_raw_file(url: Optional[str] = None) -> Optional[Path]:
    """
    Downloads raw satellite file (.he5, .nc, .h5) to data/raw/
    Uses NASA Earthdata SSO credentials from .env and _netrc
    """
    url = url or DEFAULT_SAMPLE_URL
    filename = url.split("/")[-1]
    save_path = RAW_DIR / filename
    
    print(f"\n[CRAWL] Đang tải file: {filename}...")
    print(f"[CRAWL] Nguồn URL: {url}")
    print(f"[CRAWL] Lưu tại: {save_path}")

    client = NASAClient()
    client.ensure_netrc_file()

    # Try curl first (handles NASA SSO redirect + cookies seamlessly)
    success = client.download_with_curl(url, str(save_path))
    if not success:
        print("[CRAWL] Đang thử lại bằng Python requests...")
        success = client.download_with_requests(url, str(save_path))

    if save_path.exists() and save_path.stat().st_size > 0:
        # Check if NASA returned an HTML error page (e.g. 404 or redirect page)
        try:
            with open(save_path, "rb") as f:
                header = f.read(200).decode("utf-8", errors="ignore")
            if "<!doctype" in header.lower() or "<html" in header.lower():
                print(f"[ERROR] Máy chủ NASA trả về trang web HTML lỗi thay vì file nhị phân HDF5/HE5.")
                print(f"[CHI TIẾT] File mẫu '{filename}' không tồn tại trên server NASA (404 Resource not found).")
                print(f"[HƯỚNG XỬ LÝ]")
                print(f"  • Cách 1 (Khuyên dùng để test ngay): Chạy 'py main.py generate-mock --filename {filename}' để sinh file chuẩn HDF-EOS5 và soi ngay!")
                print(f"  • Cách 2: Vào web https://ozoneaq.gsfc.nasa.gov/data/ozone/ chọn khung ngày thực tế -> bấm 'get cUrl script' để lấy link thật.")
                save_path.unlink(missing_ok=True)
                return None
        except Exception:
            pass

        file_size_mb = save_path.stat().st_size / (1024 * 1024)
        print(f"[SUCCESS] Đã lưu file tại: {save_path} ({file_size_mb:.2f} MB)")
        return save_path
    else:
        print(f"[ERROR] Không thể tải file từ NASA.")
        print(f"[NOTE] Bạn có thể chạy 'py main.py generate-mock --filename {filename}' để tạo file giả lập chuẩn HDF-EOS5 để test ngay!")
        return None

def inspect_file(file_path: str):
    """
    Inspects internal structure, datasets, dimensions, and attributes of .he5 / .nc / .h5 files
    Uses xarray and h5py to provide clear view of Latitude, Longitude, ColumnAmountO3, Quality Flags.
    """
    p = Path(file_path)
    if not p.exists():
        print(f"[ERROR] File không tồn tại: {file_path}")
        return

    file_size_mb = p.stat().st_size / (1024 * 1024)
    print(f"\n{'='*65}")
    print(f"       INSPECT FILE: {p.name} ({file_size_mb:.2f} MB)")
    print(f"{'='*65}")

    # Check if file is HTML
    try:
        with open(p, "rb") as f:
            head = f.read(200).decode("utf-8", errors="ignore")
        if "<!doctype" in head.lower() or "<html" in head.lower():
            print(f"[CẢNH BÁO] File '{p.name}' thực chất là trang web HTML lỗi 404 từ NASA (không phải file nhị phân HDF5/NetCDF).")
            print(f"[GIẢI PHÁP] Chạy ngay lệnh sau để sinh file chuẩn HDF-EOS5 có dữ liệu thật sự và soi:")
            print(f"   py main.py generate-mock --filename \"{p.name}\"")
            print(f"   py main.py inspect-file \"{file_path}\"")
            return
    except Exception:
        pass

    # 1. Thử đọc bằng xarray (chuẩn NetCDF4)
    xarray_success = False
    try:
        import xarray as xr
        ds = xr.open_dataset(file_path)
        xarray_success = True
        print("\n--- [CÁC BIẾN DỮ LIỆU ĐO ĐẠC (Data Variables)] ---")
        for var in ds.data_vars:
            print(f"  • {var}: dims={ds[var].dims} | shape={ds[var].shape}")

        print("\n--- [TỌA ĐỘ VÀ THỜI GIAN (Coordinates)] ---")
        for coord in ds.coords:
            val_sample = ds[coord].values.flatten()[:3]
            print(f"  • {coord}: {val_sample}...")

        print("\n--- [THÔNG TIN CHUNG (Global Attributes)] ---")
        for attr, val in list(ds.attrs.items())[:5]:
            print(f"  • {attr}: {val}")
    except Exception as e:
        print(f"[XARRAY NOTICE] Chuyển sang dùng h5py để soi cấu trúc cây HDF5/HDF-EOS5: {e}")

    # 2. Đọc chi tiết bằng h5py (Đặc biệt cho cấu trúc Swath HDF-EOS5)
    try:
        with h5py.File(file_path, "r") as f:
            print("\n--- [CẤU TRÚC NHÁNH DỮ LIỆU CHÍNH (HDF5 / HDF-EOS5 Groups)] ---")
            for group_name in f.keys():
                print(f"  [Group] /{group_name}")

            print("\n--- [DANH SÁCH TẤT CẢ CÁC DATASET TRONG FILE] ---")
            datasets_found = []
            def visitor(name, obj):
                if isinstance(obj, h5py.Dataset):
                    datasets_found.append((name, obj.shape, obj.dtype))
                    print(f"  • Dataset: {name} | Shape: {obj.shape} | Type: {obj.dtype}")
            f.visititems(visitor)

            # Phân tích 4 nhóm thông tin cốt lõi
            print("\n" + "="*65)
            print("   4 NHÓM THÔNG TIN CỐT LÕI ĐƯỢC PHÁT HIỆN:")
            print("="*65)

            lat_lon_found = [d for d in datasets_found if any(k in d[0].lower() for k in ["latitude", "longitude", "lat", "lon"])]
            time_found = [d for d in datasets_found if any(k in d[0].lower() for k in ["time", "utc", "orbit"])]
            o3_found = [d for d in datasets_found if any(k in d[0].lower() for k in ["columnamounto3", "ozone", "o3"])]
            quality_found = [d for d in datasets_found if any(k in d[0].lower() for k in ["quality", "flag", "error"])]

            print(" 1. Latitude / Longitude (Tọa độ):")
            for d in lat_lon_found:
                print(f"    -> {d[0]} (Shape: {d[1]})")

            print(" 2. Time / UTC (Thời gian):")
            for d in time_found:
                print(f"    -> {d[0]} (Shape: {d[1]})")

            print(" 3. ColumnAmountO3 / Ozone (Nồng độ Ozone):")
            for d in o3_found:
                print(f"    -> {d[0]} (Shape: {d[1]})")

            print(" 4. Quality Flags / Quality Check (Chỉ số tin cậy):")
            for d in quality_found:
                print(f"    -> {d[0]} (Shape: {d[1]})")

            print("="*65 + "\n")

    except Exception as e:
        print(f"[ERROR] Không thể đọc file bằng h5py: {e}")

