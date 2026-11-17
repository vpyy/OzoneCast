# 📥 Data Ingestion Microservice — OzoneCast

Service đảm nhiệm việc kết nối tới nguồn dữ liệu NASA (hoặc qua link curl URL), tải file vệ tinh định dạng HDF5/HE5 (`.he5`, `.h5`), trích xuất **10 trường dữ liệu khí quyển & bề mặt**, và ghi trực tiếp vào cơ sở dữ liệu **PostgreSQL** (bảng `raw_measurements` và `granules`).

---

## 📌 Các trường dữ liệu trích xuất từ file HDF5

Service sử dụng thư viện `h5py` với cơ chế **Smart Discovery** (tự động nhận diện Swath hoặc Grid) để trích xuất đầy đủ 10 trường:

### 🔹 Nhóm 1: Bắt buộc (6 trường)
| Tên trường trong H5 | Cột Database | Kiểu dữ liệu | Mục đích sử dụng |
|---|---|---|---|
| **ColumnAmountO3** | `ozone_column_raw` | Float (DU) | Biến chính cần phân tích và dự đoán nồng độ ozone |
| **Latitude** | `latitude` | Float (deg) | Tọa độ vĩ độ — Cắt vùng Bán đảo Nam Cực (`[-90°, -55°]`), vẽ bản đồ |
| **Longitude** | `longitude` | Float (deg) | Tọa độ kinh độ (`[-180°, 180°]`) |
| **SecondsInDay** / **Time** | `seconds_in_day` / `time_raw` | Float (giây) | Xác định thời điểm đo trong ngày UTC (cộng với ngày trong tên file) |
| **QualityFlags** | `quality_flag` | Integer | Lọc bỏ các điểm đo lỗi thuật toán |
| **GroundPixelQualityFlags** | `ground_pixel_quality_flag` | Integer | Lọc thêm theo chất lượng pixel bề mặt |

### 🔹 Nhóm 2: Nên lấy thêm (4 trường)
| Tên trường trong H5 | Cột Database | Kiểu dữ liệu | Lý do & Mục đích sử dụng |
|---|---|---|---|
| **SolarZenithAngle** | `solar_zenith_angle` | Float (deg) | Ở vùng cực Mặt Trời thấp sát chân trời, dùng lọc bỏ góc quá lớn (> 84°–88°) |
| **RadiativeCloudFraction** | `radiative_cloud_fraction` | Float (0.0–1.0) | Mây ảnh hưởng độ chính xác ozone, làm feature quan trọng cho mô hình AI |
| **CloudPressure** | `cloud_pressure` | Float (hPa) | Bổ sung thông tin áp suất đỉnh mây |
| **WaterFraction** / **LandWater** | `water_fraction` | Float (0.0–1.0) | Phân biệt ô đất liền, biển, băng tuyết (rất quan trọng cho Bán đảo Nam Cực) |

*(Ngoài ra service còn giữ thêm `reflectivity331` và `uv_aerosol_index` nếu có trong file).*

---

## ⚙️ Biến môi trường (.env)

Tạo file `.env` tại thư mục này hoặc thư mục gốc dự án:
```env
# Kết nối PostgreSQL (trong Docker dùng host postgres, local dùng localhost)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ozone_db

# URL dữ liệu NASA mặc định (file OMI-Aura L2G OMTO3G)
NASA_DATA_URL=https://omisips1.omisips.eosdis.nasa.gov/data/10da43cd73977b549e32cd346b9f2a2f/OMI-Aura_L2G-OMTO3G_2026m1116_v004-2026m1117t052851.he5

# NASA Earthdata Credentials (nếu link yêu cầu tài khoản URS)
NASA_USERNAME=your_username
NASA_PASSWORD=your_password

# Chu kỳ tự động lấy dữ liệu: 300s = 5 phút/lần (theo đúng Sơ đồ khối)
INGESTION_INTERVAL_SECONDS=300

# Thư mục tạm lưu file HDF5 trước khi giải nén (tự động xóa sau khi extract)
COOKIE_JAR_PATH=/tmp/.urs_cookies
```

---

## 🚀 Hướng dẫn chạy Service

### Cách 1: Chạy độc lập bằng Docker (Khuyên dùng)

Chỉ cần chạy container `postgres` và `data-ingestion`, không cần bật các service khác:

```powershell
# Tại thư mục gốc OzoneCast:
docker compose up --build -d postgres data-ingestion

# Xem log thời gian thực:
docker compose logs -f data-ingestion
```

---

### Cách 2: Chạy trực tiếp ở Terminal (Local Development)

#### 1. Cài đặt các thư viện cần thiết
Đảm bảo đã có Python 3.10+ và PostgreSQL đang chạy (trên máy hoặc trong Docker port 5432):

```powershell
# Di chuyển vào thư mục service:
cd d:\UTE\126UTE\KKPDL\OzoneCast\services\data-ingestion

# Cài đặt thư viện:
pip install -r requirements.txt
```

*Các thư viện chính được cài đặt:*
- `h5py`: Đọc cấu trúc file HDF5 / HDF-EOS5
- `numpy`: Xử lý mảng tọa độ và ma trận quang phổ
- `sqlalchemy` & `psycopg2-binary`: Kết nối và ghi bulk data trực tiếp vào PostgreSQL
- `apscheduler`: Lên lịch tự động 5 phút/lần
- `fastapi` & `uvicorn`: Cung cấp HTTP API trigger thủ công và health check

#### 2. Khởi chạy service
```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

---

## 🧪 Các lệnh Test & Trigger dữ liệu

### 1. Nạp từ URL cụ thể (Link NASA curl)
Gửi URL file `.he5` mà bạn muốn hệ thống tải về và nạp:

```powershell
curl -X POST http://localhost:8002/api/ingest/url `
  -H "Content-Type: application/json" `
  -d '{\"file_url\": \"https://omisips1.omisips.eosdis.nasa.gov/data/10da43cd73977b549e32cd346b9f2a2f/OMI-Aura_L2G-OMTO3G_2026m1116_v004-2026m1117t052851.he5\"}'
```

### 2. Nạp dữ liệu giả lập Mock (Offline - Không cần mạng)
Tạo file `.he5` chuẩn với đầy đủ 10 trường mô phỏng lỗ thủng ozone tại Nam Cực:

```powershell
curl -X POST http://localhost:8002/api/ingest/mock
```

### 3. Kiểm tra Health Check
```powershell
curl http://localhost:8002/health
```
Hoặc mở Swagger UI trên trình duyệt: [http://localhost:8002/docs](http://localhost:8002/docs)

---

## 🔍 Kiểm tra dữ liệu trong PostgreSQL

Mở terminal kiểm tra trực tiếp các trường dữ liệu vừa lưu:

```powershell
# Kiểm tra 5 dòng đầu tiên với đủ 10 trường:
docker exec -it ozone-postgres psql -U postgres -d ozone_db -c "SELECT id, granule_name, latitude, longitude, seconds_in_day, ozone_column_raw, quality_flag, ground_pixel_quality_flag, solar_zenith_angle, radiative_cloud_fraction, cloud_pressure, water_fraction FROM raw_measurements ORDER BY id DESC LIMIT 5;"

# Đếm số điểm đo thuộc vùng Bán đảo Nam Cực (-90 <= lat <= -55):
docker exec -it ozone-postgres psql -U postgres -d ozone_db -c "SELECT COUNT(*) FROM raw_measurements WHERE latitude BETWEEN -90.0 AND -55.0;"
```
