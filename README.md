# 🛰️ NASA Ozone Monitoring System (Microservices & Docker)

[![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue.svg)](#architecture)
[![Docker Compose](https://img.shields.io/badge/Orchestration-Docker%20Compose-2496ED.svg)](#deployment)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20%2B%20Tailwind-61DAFB.svg)](#frontend)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20PostgreSQL-009688.svg)](#services)

Hệ thống giám sát, phân tích và dự báo nồng độ Ozone khí quyển từ vệ tinh NASA (Aura/OMI và Suomi-NPP/OMPS) được xây dựng hoàn toàn theo kiến trúc **Microservices** và đóng gói bằng **Docker Compose**.

---

## 🏗️ Cấu trúc Thư mục Dự án

```text
├── config/                     # Cấu hình tập trung cho toàn bộ hệ thống
├── services/
│   ├── clustering/             # Microservice phân cụm không gian (DBSCAN / K-Means) [Port 8004]
│   ├── data-analysis/          # Microservice làm sạch, Spatial Binning & phát hiện lỗ thủng Ozone [Port 8003]
│   ├── data-ingestion/         # Microservice cào dữ liệu vệ tinh NASA (CMR API / HDF5 Swath) [Port 8002]
│   ├── database-api/           # Central Database API (FastAPI + PostgreSQL) [Port 8001]
│   └── prediction/             # Microservice dự báo Machine Learning (Random Forest) [Port 8005]
├── frontend/                   # Ứng dụng Web Dashboard (React + Vite + Tailwind CSS + Leaflet) [Port 3000]
│   ├── src/
│   │   ├── api/                # Axios API Client kết nối các microservices
│   │   ├── components/         # Các thành phần UI (Bản đồ Leaflet, Bảng dữ liệu thô, Phân cụm, Dự báo)
│   │   ├── App.jsx             # Giao diện chính điều phối các tab
│   │   ├── index.css           # Cấu hình Tailwind CSS
│   │   └── main.jsx            # Entry point React
│   ├── Dockerfile              # Dockerfile đóng gói Frontend
│   ├── index.html              # HTML template tích hợp Leaflet CDN
│   ├── package.json            # Dependencies Frontend
│   ├── postcss.config.js       # PostCSS config
│   ├── tailwind.config.js      # Tailwind theme & colors config
│   └── vite.config.js          # Vite config & API reverse proxy
├── .env                        # Biến môi trường cục bộ (tự động bỏ qua bởi git)
├── .env.example                # Mẫu biến môi trường an toàn khi push git
├── .gitignore                  # Cấu hình loại trừ cache, data lớn và credentials
├── docker-compose.yml          # Điều phối toàn bộ 7 containers (5 services + DB + Frontend)
└── README.md                   # Tài liệu hướng dẫn sử dụng
```

---

## 🌐 Danh sách Microservices & Cổng Dịch vụ

| Microservice | Công nghệ | Cổng (Port) | Chu kỳ chạy (Schedule) | Chức năng chính |
| :--- | :--- | :--- | :--- | :--- |
| **`postgres`** | PostgreSQL 15 | `5432` | Liên tục | Cơ sở dữ liệu quan hệ lưu trữ Granules, Raw Points, Binned Grid & Clusters. |
| **`database-api`** | FastAPI, SQLAlchemy | `8001` | Liên tục | Cung cấp REST API trung tâm cho các dịch vụ khác truy xuất và lưu dữ liệu. |
| **`data-ingestion`** | FastAPI, Requests, h5py | `8002` | **5 phút / lần** | Tự động lấy dữ liệu mới từ NASA CMR API, trích xuất ma trận HDF-EOS5 và đẩy vào database-api. |
| **`data-analysis`** | FastAPI, Pandas, NumPy | `8003` | **5 phút / lần** | Lọc nhiễu Quality Flags, gom cụm lưới tọa độ 0.5° (Silver Layer), phát hiện Ozone Anomaly. |
| **`clustering`** | FastAPI, Scikit-learn | `8004` | **1 ngày / lần** | Phân cụm mật độ không gian DBSCAN / K-Means để nhận diện vùng thủng tầng Ozone. |
| **`prediction`** | FastAPI, Scikit-learn | `8005` | **5 phút / lần** | Huấn luyện định kỳ mô hình Random Forest & cung cấp API dự đoán nồng độ Ozone (DU). |
| **`frontend`** | React 18, Vite, Tailwind | `3000` | Liên tục | Dashboard trực quan hóa bản đồ vệ tinh tương tác, bảng dữ liệu thô và biểu mẫu dự báo. |

---

## 🚀 Hướng dẫn Triển khai với Docker Compose

### 1. Chuẩn bị biến môi trường
Sao chép file `.env.example` thành `.env`:
```bash
copy .env.example .env
```
*(Điền tài khoản NASA Earthdata của bạn vào `.env` nếu muốn cào dữ liệu trực tiếp).*

### 2. Khởi chạy toàn bộ hệ thống bằng 1 lệnh duy nhất
```bash
docker compose up -d --build
```

### 3. Kiểm tra trạng thái các containers
```bash
docker compose ps
```

### 4. Truy cập giao diện & dịch vụ
- **Giao diện Dashboard chính (Frontend):** [http://localhost:3000](http://localhost:3000)
- **Database API Docs (Swagger):** [http://localhost:8001/docs](http://localhost:8001/docs)
- **Data Ingestion API Docs:** [http://localhost:8002/docs](http://localhost:8002/docs)
- **Data Analysis API Docs:** [http://localhost:8003/docs](http://localhost:8003/docs)
- **Clustering API Docs:** [http://localhost:8004/docs](http://localhost:8004/docs)
- **Prediction API Docs:** [http://localhost:8005/docs](http://localhost:8005/docs)

### 5. Dừng hệ thống
```bash
docker compose down
```

---

## 💻 Hướng dẫn Chạy Cục bộ (Không dùng Docker)

Nếu cần phát triển hoặc kiểm thử từng service độc lập mà không bật Docker:

1. **Khởi động Database API:**
   ```bash
   cd services/database-api
   pip install -r requirements.txt
   uvicorn app.main:app --port 8001 --reload
   ```

2. **Khởi động Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
