# NASA Ozone Automated Data Pipeline (ETL & Analytics)

Hệ thống tự động hóa thu thập, làm sạch và xử lý dữ liệu Ozone vệ tinh (Aura/OMI, Suomi-NPP/OMPS) từ NASA Goddard Space Flight Center (GSFC) theo kiến trúc Medallion (Bronze - Silver - Gold).

---

## 1. Kiến trúc Tổng thể (Architecture)

```
[NASA GSFC Server]
      │
      ▼ (Incremental Crawler - 1-2h/lần, cUrl / HTTP)
[Tầng 1: Bronze Layer - Raw Storage]
      ├─ Tải file thô (.he5 / .nc) vào data/bronze_raw/
      └─ Ghi log trạng thái vào bảng crawl_logs (SQLite / PostgreSQL)
      │
      ▼ (ETL Worker - h5py, numpy, pandas)
[Tầng 2: Silver Layer - Cleaned Data]
      ├─ Trích xuất Vĩ độ (Lat), Kinh độ (Lon), Nồng độ Ozone (DU)
      ├─ Lọc Quality Flags, khử nhiễu và Missing Value (-1.26e+30)
      ├─ Gom cụm lưới không gian (Spatial Binning: 0.5° x 0.5°)
      └─ Lưu vào bảng ozone_grid_summary & định dạng data/silver_processed/*.parquet
      │
      ▼
[Tầng 3: Gold Layer - ML & Analytics]
      ├─ Xuất báo cáo, biểu đồ bản đồ nhiệt (Heatmap / Choropleth)
      └─ Feature Engineering chuỗi thời gian đưa vào mô hình AI (LSTM / XGBoost)
```

---

## 2. Hướng dẫn Cài đặt & Chuẩn bị Môi trường

### Bước 1: Chuẩn bị tài khoản NASA Earthdata
1. Đăng ký tài khoản miễn phí tại: [NASA Earthdata Login](https://urs.earthdata.nasa.gov/).
2. Cấp quyền truy cập ứng dụng (Authorize Applications) cho `NASA GESDISC DATA ARCHIVE` và `Earthdata Search` trong hồ sơ tài khoản.

### Bước 2: Thiết lập file xác thực NASA trên Windows / Linux
`curl` cần file credentials để tự động bypass đăng nhập SSO:
- **Trên Windows**: Tạo file `_netrc` tại thư mục người dùng `C:\Users\<Tên_User>\_netrc` (hoặc `.netrc`):
  ```text
  machine urs.earthdata.nasa.gov login <YOUR_USERNAME> password <YOUR_PASSWORD>
  ```
- **Trên Linux / macOS / WSL**: Tạo file `~/.netrc` và cấp quyền `chmod 600 ~/.netrc`.

*(Lưu ý: Hệ thống cũng hỗ trợ tự động sinh file này nếu bạn điền thông tin vào `.env`)*.

### Bước 3: Cài đặt thư viện Python
```bash
# Khuyến nghị tạo virtual environment
python -m venv venv
venv\Scripts\activate      # Trên Windows
# source venv/bin/activate # Trên Linux/Mac

pip install -r requirements.txt
```

Sao chép file `.env.example` thành `.env`:
```bash
copy .env.example .env
```
Cập nhật `NASA_USERNAME` và `NASA_PASSWORD` trong file `.env`.

---

## 3. Hướng dẫn Sử dụng CLI

Hệ thống tích hợp sẵn công cụ dòng lệnh qua `main.py`:

### 1. Tự động Tìm & Tải Dữ liệu Thật từ NASA (Bằng thư viện chính thức `earthaccess`):
Không cần lên web lấy link tay, lệnh sẽ tự động xác thực Earthdata, quét danh sách mã sản phẩm và tải file thật về `data/raw/`:
```bash
# Tải 1 file thật của sản phẩm OMTO3 (Ozone L2) gần nhất:
py main.py fetch-auto

# Hoặc tải nhiều sản phẩm cùng lúc (OMTO3, OMDOAO3, NMTO3-L2):
py main.py fetch-auto --products "OMTO3,NMTO3-L2" --count 1

# Hoặc quét và tải tất cả 8 sản phẩm Ozone/Aerosol:
py main.py fetch-auto --all --count 1
```

### 2. Xem Dữ liệu Thô Nguyên Bản trên Database SQLite & Giao diện Web:
Lưu toàn bộ các điểm quét thô vào bảng `raw_measurements` trong SQLite và tự động tạo giao diện web bảng dữ liệu + bản đồ điểm quét:
```bash
py main.py view-raw data/raw/ten_file_vua_tai.he5
```
*(Mở file `data/raw_data_viewer.html` để xem trực tiếp).*

### 3. Khởi tạo Cơ sở Dữ liệu:
```bash
python main.py init-db
```

### 2. Chạy Cào Tăng tiến (Incremental Crawl):
Tải các file đo đạc mới nhất chưa có trong hệ thống (mặc định kiểm tra 24h qua):
```bash
python main.py sync --lookback 24
```

### 3. Nhập danh sách file từ file cUrl script của NASA:
Nếu bạn đã bấm **Get cUrl script** trên giao diện web của NASA và lưu thành file `.sh` hoặc `.txt`:
```bash
python main.py import-script path/to/nasa_script.sh
python main.py sync
```

### 4. Xử lý làm sạch (ETL Silver Layer):
Giải nén các file `.he5`, lọc Quality Flags, tính trung bình theo lưới tọa độ và lưu vào DB & file Parquet:
```bash
python main.py parse
```

### 5. Chạy chu trình trọn gói (Crawl + ETL):
```bash
python main.py run-cycle
```

### 6. Bật Chế độ Tự động Chạy định kỳ (Scheduler):
Chạy liên tục chu trình cào và làm sạch định kỳ mỗi 2 giờ (hoặc theo cấu hình trong `.env`):
```bash
python main.py scheduler
```

### 7. Kiểm tra Thống kê & Trạng thái Hệ thống:
```bash
python main.py status
```

### 8. Tạo Dữ liệu Mẫu Vệ tinh (Mock Granule) để Test Offline:
Nếu chưa có mạng hoặc muốn kiểm tra quy trình làm sạch & vẽ biểu đồ ngay:
```bash
python main.py generate-mock
python main.py parse
```

### 9. Xuất Bản đồ & Biểu đồ Nhiệt Ozone (Static & Interactive Map):
Tạo bản đồ nhiệt tĩnh (`data/ozone_spatial_map.png`) và bản đồ tương tác nền Leaflet (`data/ozone_interactive_map.html` có thể mở trực tiếp bằng trình duyệt):
```bash
python main.py plot-map
```

### 10. Huấn luyện Mô hình AI/ML & Chạy Dự đoán (Gold Layer):
```bash
# Huấn luyện mô hình Random Forest trên dữ liệu sạch
python main.py train-model

# Dự đoán nồng độ Ozone (DU) tại tọa độ cụ thể (ví dụ tại TP.HCM: Lat 10.8, Lon 106.6)
python main.py predict --lat 10.8 --lon 106.6
```

---

## 4. Cấu trúc Thư mục Dự án

```
d:\UTE\HK7\Ozone\
│
├── config/
│   └── settings.py          # Cấu hình hệ thống, đường dẫn, tham số chu kỳ
├── src/
│   ├── crawler/
│   │   ├── nasa_client.py   # Xử lý cUrl SSO Earthdata, cookies, requests
│   │   └── crawler_service.py # Logic cào tăng tiến, so khớp DB
│   ├── etl/
│   │   └── parser_l2.py     # Parser đọc file HDF-EOS5 (.he5), lọc quality, spatial binning
│   ├── db/
│   │   └── models.py        # SQLAlchemy schema (crawl_logs, ozone_grid_summary)
│   └── pipeline/
│       └── scheduler.py     # APScheduler định kỳ 1h - 2h
│
├── data/
│   ├── bronze_raw/          # Lưu trữ file vệ tinh thô (.he5 / .nc)
│   └── silver_processed/    # Lưu trữ file sạch định dạng Parquet
│
├── main.py                  # CLI điều khiển toàn bộ pipeline
├── requirements.txt         # Danh mục thư viện phụ thuộc
├── .env.example             # Biến môi trường mẫu
└── README.md                # Tài liệu hướng dẫn
```

"# OzoneCast" 
