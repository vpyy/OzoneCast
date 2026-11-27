# 📥 Data Ingestion Microservice — OzoneCast

Service đảm nhiệm việc tự động Discovery, thu thập và trích xuất dữ liệu vệ tinh NASA OMI/Aura OMTO3G (Level-2G Global Gridded, độ phân giải 0.25° × 0.25°) tập trung vào **Bán đảo Nam Cực (Antarctic Peninsula)**, ghi trực tiếp vào cơ sở dữ liệu **PostgreSQL** (`raw_measurements`, `ingested_granules`, `ozone_daily`, `granules`).

---

## 📌 1. Vùng Dữ Liệu Mục Tiêu & Cắt Chỉ Số Lưới (Grid Slicing)

- **Vùng mục tiêu:** Bán đảo Nam Cực
  - **Vĩ độ (Latitude):** `-70.0°` đến `-63.0°` (`REGION_LAT_MIN=-70`, `REGION_LAT_MAX=-63`)
  - **Kinh độ (Longitude):** `-75.0°` đến `-55.0°` (`REGION_LON_MIN=-75`, `REGION_LON_MAX=-55`)
- **Cơ chế Grid Slicing từ HDF-EOS5:**
  - Lưới toàn cầu 0.25° × 0.25° có 720 hàng vĩ độ (YDim: -90° đến +90°) và 1,440 cột kinh độ (XDim: -180° đến +180°).
  - Vùng Bán đảo Nam Cực tương ứng chính xác với:
    - **Chỉ số hàng (YDim):** Hàng `80` đến `108` (28 hàng).
    - **Chỉ số cột (XDim):** Cột `420` đến `500` (80 cột).
    - **Số ô lưới:** $28 \times 80 = 2,240$ ô lưới.
  - Service dùng `h5py` cắt trực tiếp lát cắt `[:, 80:108, 420:500]` từ file HDF5 mà **không nạp cả mảng toàn cầu 150MB vào RAM** (chỉ tốn ~134 KB RAM cho lát cắt).
  - Mỗi ô lưới L2G lưu giữ **mọi quan sát (candidate)** rơi vào ô trong ngày (lên tới 15 lớp quan sát), không lấy trung bình thô bạo.

---

## 📊 2. Quy Tắc Làm Sạch & Lọc Dữ Liệu

1. **Giá trị rỗng (Fill Values):**
   - Giá trị fill chuẩn của NASA (khoảng `-1.2676506e+30`) hoặc các giá trị âm / vượt quá 1000 DU được quy đổi thành `NULL` trong Database.
   - Bỏ qua các vị trí ô lưới không có điểm đo ozone hợp lệ.
2. **Cờ chất lượng thuật toán (`QualityFlags`):**
   - Lọc theo chuẩn NASA TOMS/OMI Algorithm: Kiểm tra Bit 0 (lỗi truy xuất dữ liệu). Nếu `(QualityFlags & 1) != 0` hoặc bằng `65535` thì loại bỏ.
   - Giữ lại các phép đo có chất lượng tốt và chấp nhận được.
3. **Cờ pixel mặt đất (`GroundPixelQualityFlags`):**
   - Loại bỏ các pixel bị gán cờ lỗi tối đa (`65535`).
4. **Góc thiên đỉnh mặt trời (`SolarZenithAngle`):**
   - Ở vùng cực, Mặt Trời xuống thấp sát chân trời tạo góc xiên lớn. Loại bỏ mọi quan sát có `SolarZenithAngle > 88.0°` để đảm bảo độ tin cậy.
5. **Chuẩn hóa thời gian:**
   - Dùng ngày quan sát trích xuất từ tên file kết hợp với `SecondsInDay` (số giây từ 00:00 UTC) để xác định thời điểm chính xác theo chuẩn UTC.

---

## 🛰️ 3. Cơ Chế Tự Động Discovery Granule Từ NASA

1. **Xác định đúng sản phẩm:**
   - Trang dữ liệu NASA OzoneAQ (`https://ozoneaq.gsfc.nasa.gov/data/ozone/`):
   - Mã sản phẩm **OMTO3G** chuẩn là **`measure_id=27`** (trong khi mã `26` là OMTO3 theo orbit).
   - API gọi trực tiếp:
     `https://ozoneaq.gsfc.nasa.gov/api/data/?products=27&start=YYYY-MM-DD&end=YYYY-MM-DD`
   - Bộ lọc tên file bắt buộc: `^OMI-Aura_L2G-OMTO3G_\d{4}m\d{4}_v\d+-.*\.he5$`
2. **Chu kỳ & Quản lý hàng đợi (`ingested_granules`):**
   - **Discovery Job:** Chạy định kỳ mỗi 2 giờ (`DISCOVERY_INTERVAL_SECONDS=7200`) và chạy ngay 1 lần khi khởi động. Quét từ `DISCOVERY_START_DATE=2026-11-16` đến nay.
   - Granule mới tìm thấy được lưu vào bảng `ingested_granules` với trạng thái `pending`.
   - **Queue Processing Job:** Chạy mỗi 5 phút (`INGESTION_INTERVAL_SECONDS=300`) lấy các granule `pending` (hoặc `failed` dưới 3 lần) để tải stream, cắt vùng, ghi DB và cập nhật thành `done` hoặc `no_data_in_region`.
   - File tải về được xử lý và **xóa ngay lập tức** sau khi trích xuất.

---

## 🗄️ 4. Kiến Trúc Bảng CSDL (PostgreSQL)

- **`raw_measurements`:** Lưu chi tiết từng quan sát trong vùng Bán đảo Nam Cực với 10 trường + khóa `(granule_name, row_index, col_index, observation_index)` đảm bảo tính **Idempotent (UPSERT)** không bao giờ ghi trùng.
- **`ingested_granules`:** Bảng theo dõi tiến trình và trạng thái tải từng granule (`pending`, `done`, `no_data_in_region`, `failed`).
- **`ozone_daily`:** Bảng tổng hợp tự động hàng ngày sau mỗi file: ngày quan sát, ozone trung bình, min, max, số quan sát hợp lệ.
- **`granules`:** Metadata tổng quan về file tải về.

---

## ⚙️ Biến Môi Trường (.env)

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ozone_db
NASA_DATA_URL=https://omisips1.omisips.eosdis.nasa.gov/data/10da43cd73977b549e32cd346b9f2a2f/OMI-Aura_L2G-OMTO3G_2026m1116_v004-2026m1117t052851.he5

# Vùng dữ liệu mục tiêu: Bán đảo Nam Cực
REGION_LAT_MIN=-70
REGION_LAT_MAX=-63
REGION_LON_MIN=-75
REGION_LON_MAX=-55

# Cấu hình tự động quét tìm granule OMTO3G từ NASA
DISCOVERY_INTERVAL_SECONDS=7200
DISCOVERY_START_DATE=2026-11-16

INGESTION_INTERVAL_SECONDS=300
COOKIE_JAR_PATH=/tmp/.urs_cookies
```

---

## 🚀 Hướng Dẫn Chạy & Kiểm Tra

Khởi động lại service bằng Docker Compose:
```powershell
docker compose up -d postgres
docker compose build data-ingestion
docker compose up -d data-ingestion
```

Kiểm tra logs:
```powershell
docker compose logs -f data-ingestion
```
