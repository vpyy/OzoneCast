# Kiến Trúc Hệ Thống OzoneCast (System Architecture)

Tài liệu thiết kế kiến trúc chuẩn hóa cho Đồ án Cuối kỳ môn **Khai Phá Dữ Liệu (KPDL)** — Giảng viên hướng dẫn: TS. Phạm Tuấn (UTE).

Hệ thống được thiết kế theo mô hình **Microservices** phân rã độc lập, bám sát 100% sơ đồ khối yêu cầu tại **Slide 2** của đề bài.

---

## 1. Sơ Đồ Khối Tổng Thể (Theo Slide 2)

```text
[ Data Source ]
(Vệ tinh NASA OMI/OMPS
 Dữ liệu chuỗi thời gian)
       │
       ▼ (5 phút lấy dữ liệu 1 lần)
[ Data Ingestion ] ──────────► [ Database ] ◄──────────┐
(Bronze / Silver ETL)        (SQLite / Postgres)        │
                                       ▲                │
                                       │ (Đọc/Ghi dữ liệu)
                                       │                │
                              [ Database API ]          │
                              (FastAPI Port 8000)       │
                                       ▲                │
                                       │ (REST Calls)   │
                                       ▼                │
                                 [ Front End ]          │
                             (Web Dashboard Port 3000)  │
                                                        │
┌─────────────────────────────── Backend Services ──────┴──────────────────────┐
│                                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐  │
│  │    Data Analysis     │  │      Clustering      │  │     Prediction      │  │
│  │   (5 phút chạy/lần   │  │   (1 ngày chạy/lần   │  │  (5 phút chạy/lần   │  │
│  │   hoặc gọi qua API)  │  │   hoặc gọi qua API)  │  │  hoặc gọi qua API)  │  │
│  └──────────────────────┘  └──────────────────────┘  └─────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

> **Yêu cầu bắt buộc (Slide 2):** *"Mỗi khối trong này được chạy ở một terminal, như là một service độc lập."*

---

## 2. Phân Vai & Mô Tả Chi Tiết Từng Khối Dịch Vụ

### 2.1. Khối 1: Data Source & Data Ingestion (Lead: Văn Trung - `vantrung`)
- **Nguồn dữ liệu:** NASA Earthdata GES DISC Archive, sản phẩm đo Ozone khí quyển cấp 2 (`OMTO3` từ cảm biến OMI trên vệ tinh Aura, và `NMTO3-L2` từ Suomi-NPP).
- **Đặc tính dữ liệu:** Dữ liệu chuỗi thời gian (Time-series) liên tục theo quỹ đạo quét (Swath Orbit Track), có cập nhật dữ liệu mới thường xuyên.
- **Tần suất hoạt động:** Chạy tự động **5 phút 1 lần** (hoặc kích hoạt thủ công qua CLI/API).
- **Quy trình xử lý (Medallion Pipeline):**
  - *Tầng Bronze:* Tải file nhị phân HDF-EOS5 (`.he5`) hoặc NetCDF4 (`.nc`) về `data/raw/`.
  - *Tầng Silver:* Lọc nhiễu bức xạ và mây che (`QualityFlags == 0`), loại bỏ giá trị khuyết tật (`_FillValue == -1.26e+30`), tính toán phân vùng lưới không gian (Spatial Binning `0.5° x 0.5°`), xuất ra file nén Parquet và đồng bộ vào Database.

### 2.2. Khối 2: Database & Database API (Lead: Văn Phúc - `vanphuc`)
- **Database Engine:** SQLite (phát triển cục bộ) / PostgreSQL (triển khai Docker/Cloud).
- **Các bảng dữ liệu chính:**
  1. `crawl_logs`: Lưu vết các file vệ tinh đã cào, thời gian tải và trạng thái xử lý.
  2. `raw_measurements`: Lưu các điểm đo thô (Kinh độ, Vĩ độ, Thời gian, Nồng độ Ozone DU, Quality Flag).
  3. `ozone_grid_summary`: Dữ liệu Silver đã làm sạch, tổng hợp theo mốc thời gian và ô lưới địa lý.
  4. `analysis_patterns`: Lưu kết quả phân tích thống kê, trendline, seasonality và ma trận correlation.
  5. `clustering_results`: Lưu nhãn phân cụm (Cluster ID) của từng vùng hoặc mốc thời gian.
  6. `predictions`: Lưu kết quả dự báo nồng độ Ozone và nhãn phân loại cảnh báo cho ngày mai.
- **Database API (FastAPI - Port 8000):**
  - Cung cấp cổng REST API duy nhất để Frontend truy vấn dữ liệu các biểu đồ.
  - Cung cấp các endpoints kích hoạt (Trigger Endpoints) để chạy các Backend Services.

### 2.3. Khối 3: Backend Services (Data Mining & Machine Learning)
Các dịch vụ tính toán độc lập, lưu trữ trực tiếp kết quả vào Database:

#### A. Data Analysis Service (Lead: Văn Trung - `vantrung`)
- **Tần suất:** Chạy tự động **5 phút 1 lần** (hoặc gọi qua `POST /api/services/run-analysis`).
- **Nhiệm vụ:**
  - Tính toán các chuỗi dữ liệu cho **Line chart, Scatter chart, Histogram** ở 3 quãng thời gian (Ngày, Tuần, Tháng).
  - Phân tích và trích xuất đường xu hướng (**Trend**) khi resampling theo Tháng/Tuần.
  - Phân tích thành phần thời vụ (**Seasonality**) theo Tháng/Tuần bằng giải thuật Seasonal Decomposition.
  - Tính toán ma trận hệ số tương quan (**Correlation Matrix**) giữa nồng độ Ozone, Vĩ độ, Nhiệt độ và Góc quét vệ tinh.

#### B. Clustering Service (Lead: Hữu Sáng - `huusang`)
- **Tần suất:** Chạy định kỳ **1 ngày 1 lần** (hoặc gọi qua `POST /api/services/run-clustering`).
- **Thuật toán:** K-Means / DBSCAN / Hierarchical Clustering.
- **Nhiệm vụ:** Phân cụm các vùng không gian hoặc các trạm đo theo đặc trưng phân bố nồng độ Ozone (ví dụ: Vùng Ozone suy giảm mạnh, Vùng ổn định, Vùng biến động cao theo mùa).

#### C. Prediction Service (Lead: Hữu Sáng - `huusang`)
- **Tần suất:** Chạy tự động **5 phút 1 lần** (hoặc gọi qua `POST /api/services/run-prediction`).
- **Nhiệm vụ:**
  - **Dự đoán chuỗi thời gian (Regression):** Sử dụng Random Forest Regressor / Ridge Regression đã huấn luyện sẵn để dự đoán nồng độ Ozone trung bình cho **ngày mai** (Dobson Units).
  - **Phân loại chất lượng (Classification):** Dự báo mức cảnh báo chất lượng khí quyển cho **ngày mai** (Ví dụ: *Tốt [220-300 DU]*, *Trung bình [300-380 DU]*, *Cảnh báo suy giảm [<220 DU]* hoặc *Nồng độ cao [>380 DU]*).

### 2.4. Khối 4: Front End Web Dashboard (Lead: Viết An - `vietan`)
- **Công nghệ:** HTML5/CSS3/JavaScript hiện đại kết hợp Chart.js, Plotly.js, DataTables và Leaflet.js (hoặc Single Page App React/Vite).
- **Yêu cầu thẩm mỹ:** Giao diện trực quan đẹp mắt, hiện đại, có chế độ Dark/Light mode, thẻ hiển thị chỉ số KPI rõ ràng.
- **Tương tác:** Cho phép **Zoom** trên biểu đồ chuỗi thời gian và **Filter** chọn dải thời gian (Ngày, Tuần, Tháng, Tùy chỉnh).
- **Kiểm tra API (F12):** Toàn bộ dữ liệu hiển thị trên Web được nạp thông qua các cuộc gọi `fetch()` hoặc `axios` đến Database API (mã HTTP `200 OK`).

### 2.5. Khối 5: DevOps, Containerization & Kịch Bản Demo (Lead: Phúc An - `phucan`)
- **Docker Compose:** Đóng gói toàn bộ hệ thống vào file `docker-compose.yml`, khởi động tất cả các service chỉ với 1 câu lệnh duy nhất.
- **Kịch bản Demo chuẩn:** Đáp ứng bài kiểm tra xóa DB -> Web lỗi -> chạy backend API -> hồi phục web theo yêu cầu của Giảng viên.

---

## 3. Bản Đồ Cổng Mạng (Port Allocation)

| Dịch vụ | Container Name | Port Host | Giao thức | Mô tả |
|---|---|---|---|---|
| Database API | `ozone-api` | `8000:8000` | HTTP / REST | Cổng dữ liệu trung tâm & Swagger UI (`/docs`) |
| Web Dashboard | `ozone-frontend` | `3000:3000` | HTTP | Giao diện tương tác người dùng |
| Database Engine | `ozone-postgres` | `5432:5432` | TCP (Tùy chọn) | PostgreSQL (nếu sử dụng thay SQLite) |
| Ingestion Service | `ozone-ingestion` | — | Internal Worker | Chạy tiến trình ngầm chu kỳ 5 phút |
| Analysis Service | `ozone-analysis` | — | Internal Worker | Chạy tiến trình ngầm chu kỳ 5 phút |
| Clustering Service | `ozone-clustering`| — | Internal Worker | Chạy tiến trình ngầm chu kỳ 1 ngày |
| Prediction Service | `ozone-prediction`| — | Internal Worker | Chạy tiến trình ngầm chu kỳ 5 phút |
