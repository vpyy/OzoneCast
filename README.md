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

## 🚀 Hướng dẫn Triển khai Đồng bộ với Docker Compose

### Cách 1: Khởi chạy toàn bộ hệ thống bằng 1 lệnh duy nhất (Khuyên dùng)
Mở terminal tại thư mục gốc `d:\UTE\HK7\Ozone`:
```bash
docker compose up -d --build
```

---

### Cách 2: Khởi chạy từng Service độc lập trên từng Terminal (Đúng yêu cầu sơ đồ khối)
Bạn có thể mở từng cửa sổ Terminal riêng biệt tại thư mục dự án và dùng lệnh `docker compose up <tên-service>`. Docker Compose sẽ tự động kết nối qua mạng nội bộ `ozone-network` và xuất log trực tiếp ra từng màn hình terminal:

* **Terminal 1 — Database API & PostgreSQL:**
  ```bash
  docker compose up database-api
  ```
  *(Tự động khởi động `postgres` trước và mở cổng Database REST API tại `http://localhost:8001`)*

* **Terminal 2 — Data Ingestion Service (Cào vệ tinh 5 phút/lần):**
  ```bash
  docker compose up data-ingestion
  ```
  *(Chạy ngầm lấy dữ liệu từ NASA CMR API và đẩy vào database-api qua Port 8002)*

* **Terminal 3 — Data Analysis Service (Chuỗi thời gian & Ma trận tương quan 5 phút/lần):**
  ```bash
  docker compose up data-analysis
  ```
  *(Tính toán 3 biểu đồ Line, Scatter, Histogram, Trend & Seasonal qua Port 8003)*

* **Terminal 4 — Spatial Clustering Service (Phân cụm K-Means 1 ngày/lần):**
  ```bash
  docker compose up clustering
  ```
  *(Gom cụm nhận diện vùng mây/băng tuyết, vùng suy giảm qua Port 8004)*

* **Terminal 5 — ML Prediction Service (Dự báo nồng độ & nhãn ngày mai 5 phút/lần):**
  ```bash
  docker compose up prediction
  ```
  *(Huấn luyện Random Forest Regressor & Classifier qua Port 8005)*

* **Terminal 6 — Front End Dashboard (Giao diện React):**
  ```bash
  docker compose up frontend
  ```
  *(Truy cập Dashboard trực quan tại `http://localhost:3000`)*

---

### 🛑 Lệnh Dừng & Quản lý Containers
* **Kiểm tra trạng thái các service đang chạy:**
  ```bash
  docker compose ps
  ```
* **Xem log thời gian thực của 1 service cụ thể:**
  ```bash
  docker compose logs -f <tên-service>
  # Ví dụ: docker compose logs -f data-ingestion
  ```
* **Dừng toàn bộ hệ thống:**
  ```bash
  docker compose down
  ```
