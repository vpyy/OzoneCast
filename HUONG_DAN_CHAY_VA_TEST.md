# 📘 Hướng Dẫn Từng Bước Chạy & Kiểm Thử Dự Án OzoneCast (Dành Cho Người Mới Bắt Đầu)

Tài liệu này được biên soạn dành cho bất kỳ ai (dù mới bắt đầu tiếp cận dự án) cũng có thể tự mình **khởi động (bring up)**, **vận hành (run)** và **kiểm thử (test)** toàn bộ hệ sinh thái vi dịch vụ (Microservices) của **OzoneCast**.

---

## 📑 Mục Lục
1. [Yêu cầu Môi trường Trước khi Chạy](#1-yêu-cầu-môi-trường-trước-khi-chạy)
2. [Bước 1: Khởi Động Dự Án Bằng Docker](#2-bước-1-khởi-động-dự-án-bằng-docker)
3. [Bước 2: Kiểm Tra Trạng Thái Các Service Đang Chạy](#3-bước-2-kiểm-tra-trạng-thái-các-service-đang-chạy)
4. [Bước 3: Chạy Bộ Test Tự Động (Kiểm tra xem làm đúng hay chưa)](#4-bước-3-chạy-bộ-test-tự-động-3434-tests)
5. [Bước 4: Kiểm Thử Thực Tế Các Cổng API (Bằng PowerShell / cURL)](#5-bước-4-kiểm-thử-thực-tế-các-cổng-api)
6. [Bước 5: Kiểm Thử Trực Quan Trên Giao Diện Web (Frontend)](#6-bước-5-kiểm-thử-trực-quan-trên-giao-diện-web)
7. [Bước 6: Xem Logs Hoạt Động Của Các Tiến Trình Nền](#7-bước-6-xem-logs-hoạt-động-của-các-tiến-trình-nền)
8. [Các Lệnh Tiện Ích & Xử Lý Sự Cố Thường Gặp](#8-các-lệnh-tiện-ích--xử-lý-sự-cố-thường-gặp)

---

## 1. Yêu Cầu Môi Trường Trước Khi Chạy

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
1. **Docker Desktop** (Dành cho Windows/macOS) hoặc **Docker Engine** (Dành cho Linux).
   - *Kiểm tra bằng lệnh:*
     ```bash
     docker --version
     docker compose version
     ```
   - Hãy chắc chắn biểu tượng **Docker Desktop đang ở trạng thái xanh lá (Engine running)**.
2. **Git** (đã clone dự án về máy).

---

## 2. Bước 1: Khởi Động Dự Án Bằng Docker

Mở **PowerShell** (trên Windows) hoặc **Terminal** (trên macOS/Linux), chuyển vào thư mục gốc của dự án `OzoneCast`:

```powershell
# Chuyển vào thư mục dự án (ví dụ)
cd D:\DAIHOC\HOCKY7\KPDL\du-an-cuoi-ky\OzoneCast
```

Khởi chạy toàn bộ hệ thống bằng một câu lệnh duy nhất:

```powershell
docker compose up --build -d
```

> **Giải thích lệnh:**
> - `docker compose up`: Khởi động toàn bộ các service được định nghĩa trong file `docker-compose.yml`.
> - `--build`: Tự động biên dịch lại mã nguồn mới nhất của các container.
> - `-d` (detached mode): Cho phép các service chạy ngầm, không khóa cửa sổ terminal của bạn.

---

## 3. Bước 2: Kiểm Tra Trạng Thái Các Service Đang Chạy

Sau khi chạy lệnh ở Bước 1 khoảng 30 - 60 giây, gõ lệnh sau để kiểm tra:

```powershell
docker ps
```

### ✅ Dấu hiệu bạn làm ĐÚNG:
Bạn sẽ thấy đủ **5 container** đều có trạng thái **`Up`** (hoặc `healthy`):

| Tên Container | Cổng Mạng (Port) | Vai trò trong hệ thống |
| :--- | :--- | :--- |
| **`ozone-frontend`** | `3000 -> 3000` | Giao diện người dùng Web (React + Vite + Tailwind) |
| **`ozone-backend-services`** | `8004 -> 8004` | Phân hệ Máy học AI, Phân tích dữ liệu & Phân cụm |
| **`ozone-database-api`** | `8000 -> 8000` | Cổng API Gateway đọc cơ sở dữ liệu & WebSocket stream |
| **`ozone-data-ingestion`** | `8002 -> 8002` | Tiến trình tự động tải dữ liệu vệ tinh NASA (mỗi 5 phút) |
| **`ozone-postgres`** | `5432 -> 5432` | Cơ sở dữ liệu quan hệ PostgreSQL 16 |

---

## 4. Bước 3: Chạy Bộ Test Tự Động (34/34 Tests)

Đây là cách nhanh nhất và chính xác nhất để biết mã nguồn thuật toán của bạn có đúng hay không. Hãy chạy lệnh này trong PowerShell:

```powershell
docker exec -e PYTHONPATH=/app ozone-backend-services python -m pytest tests -v
```

### ✅ Dấu hiệu bạn làm ĐÚNG:
Toàn bộ 34 bài kiểm thử đều hiện chữ **`PASSED`** màu xanh và kết thúc bằng dòng thông báo:
```text
============================== 34 passed in ~3.8s ==============================
```

### 🔍 Ý nghĩa của 3 bộ test:
1. **`test_data_analysis.py` (8 bài test):** Kiểm tra thuật toán làm sạch dữ liệu, lọc điểm dị thường bằng IQR & Z-score, phân rã chuỗi thời gian (Trend/Seasonality), và tính ma trận tương quan Pearson/Spearman.
2. **`test_clustering.py` (12 bài test):** Kiểm tra thuật toán phân cụm K-Means, DBSCAN, tính toán điểm Silhouette Score và diễn giải phân vùng khí quyển.
3. **`test_prediction.py` (14 bài test):** Kiểm tra mã hóa lượng giác chu kỳ ngày trong năm ($\sin/\cos$ Day of Year), mô hình hồi quy Random Forest Regressor ($R^2$, MAE), mô hình phân loại rủi ro tia cực tím WMO, và cơ chế đồng bộ thẻ dự báo ngày mai.

---

## 5. Bước 4: Kiểm Thử Thực Tế Các Cổng API

Bạn có thể mở một cửa sổ PowerShell mới và copy/paste các lệnh sau để gửi request trực tiếp đến các dịch vụ:

### 1. Kiểm tra Sức khỏe Backend (`:8004`)
```powershell
Invoke-RestMethod -Uri "http://localhost:8004/health"
```
*Kết quả mong đợi:* `status : ok`, `service : backend-services`.

---

### 2. Thử nghiệm Dự báo Ozone & Rủi ro Bức xạ UV (`:8004`)
Dự báo nồng độ Ozone tại tọa độ TP. Hồ Chí Minh (`Vĩ độ: 10.82`, `Kinh độ: 106.63`):
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8004/api/prediction/predict" -ContentType "application/json" -Body '{"latitude": 10.82, "longitude": 106.63}'
```
*Kết quả mong đợi:*
- `predicted_ozone_du`: Nồng độ dự báo theo đơn vị Dobson Units (khoảng 240 - 360 DU).
- `status_label`: Cấp độ cảnh báo (ví dụ: *Bình thường* hoặc *Cảnh báo UV cao*).
- `confidence_percent`: Độ tin cậy tính từ xác suất lớp (ví dụ: *85% - 98%*).
- `health_advisory`: Lời khuyên bảo vệ sức khỏe phòng tia cực tím theo chuẩn WMO.

---

### 3. Thử nghiệm Huấn luyện lại Mô hình Máy học (Retrain Model)
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8004/api/prediction/train"
```
*Kết quả mong đợi:*
- `status`: `trained`
- `mae_du`: Sai số tuyệt đối trung bình ($MAE < 5.0\text{ DU}$)
- `r2_score`: Hệ số giải thích phương sai ($R^2 > 0.95$)
- `classification_accuracy`: Độ chính xác phân loại ($> 95\%$).

---

### 4. Thử nghiệm Thuật toán Phân cụm K-Means (`:8004`)
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8004/api/clustering/run" -ContentType "application/json" -Body '{"algorithm": "KMeans", "n_clusters": 4}'
```
*Kết quả mong đợi:* Trả về `status : success`, gán cụm cho các ô lưới không gian (Cụm suy giảm Nam Cực, Cụm nhiệt đới, v.v.).

---

### 5. Kiểm tra Thẻ Dự Báo Ngày Mai Đã Lưu Cache (`:8000`)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/prediction/tomorrow"
```
*Kết quả mong đợi:* Trả về dữ liệu thẻ ngày mai gồm 3 trạm quan sát trọng điểm: Toàn cầu, Việt Nam / Đông Nam Á, và Nam Cực.

---

## 6. Bước 5: Kiểm Thử Trực Quan Trên Giao Diện Web

Mở trình duyệt (Google Chrome, Microsoft Edge, Brave) và truy cập vào:
👉 **[http://localhost:3000](http://localhost:3000)**

### 1. Tại Trang Chủ (Bản đồ & Tổng quan):
- Quan sát thanh số liệu trên cùng: Tổng số file vệ tinh (granules), số phép đo thô, số ô lưới, nồng độ trung bình DU.
- Quan sát Bản đồ nhiệt tương tác: Chọn xem theo *Lưới Silver 0.5°* hoặc *Điểm thô Swath*.
- Quan sát thẻ **"Dự báo Chỉ số & Nhãn trạng thái Ngày Mai"** ở phía dưới bản đồ.

### 2. Tại Tab "Dự báo Ngày mai & ML":
- Bạn sẽ thấy bảng điều khiển AI chuyên sâu.
- **Thử nghiệm 1-click:** Nhấn vào các nút tọa độ có sẵn:
  - `🇻🇳 TP. Hồ Chí Minh`
  - `🇻🇳 Thủ đô Hà Nội`
  - `🇦🇶 Trạm Nam Cực (Lỗ thủng Ozone)`
  - `🌐 Xích đạo`
- Nhấn **"Chạy Dự báo Ozone & Đánh giá Rủi ro"**: Xem nồng độ DU, nhãn cảnh báo màu sắc, lời khuyên y tế và thanh thước đo quang phổ khí quyển.
- Nhấn **"Tái huấn luyện mô hình (Retrain)"**: Xem mô hình tính toán lại và trả về chỉ số $MAE$ và $R^2$ trực tiếp trên giao diện.

### 3. Tại Tab "Phân cụm Khu vực":
- Chọn thuật toán `KMeans` hoặc `DBSCAN`.
- Nhấn **"Chạy phân cụm"** để quan sát màu sắc phân bố trên các vùng khí quyển địa lý.

### 4. Tại Tab "Biểu đồ Chuỗi thời gian" & "Xu hướng & Tương quan":
- Xem biểu đồ đường biến thiên theo ngày/tuần/tháng.
- Xem phân rã xu hướng Trend / Mùa vụ Seasonality và ma trận tương quan 6x6 giữa Ozone, Góc thiên đỉnh mặt trời, Độ phản xạ bề mặt.

---

## 7. Bước 6: Xem Logs Hoạt Động Của Các Tiến Trình Nền

Để xem hệ thống đang làm gì phía sau (Background Jobs), dùng lệnh `docker logs`:

```powershell
# Xem log tiến trình thu thập dữ liệu vệ tinh NASA (mỗi 5 phút)
docker logs -f ozone-data-ingestion

# Xem log tiến trình AI (phân tích, dự báo, phân cụm)
docker logs -f ozone-backend-services

# Xem log cổng Gateway & WebSocket
docker logs -f ozone-database-api
```
*(Nhấn `Ctrl + C` để thoát khỏi chế độ theo dõi log).*

---

## 8. Các Lệnh Tiện Ích & Xử Lý Sự Cố Thường Gặp

### 🛑 Khi muốn dừng toàn bộ dự án:
```powershell
docker compose down
```

### 🔄 Khi sửa đổi code và muốn cập nhật lại một container cụ thể:
Ví dụ sửa code ở `backend-services`:
```powershell
# Cách 1: Copy trực tiếp code vào container không cần build lại (rất nhanh)
docker cp services/backend-services/app ozone-backend-services:/app/
docker restart ozone-backend-services

# Cách 2: Build lại sạch sẽ bằng compose
docker compose up --build -d backend-services
```

### ⚠️ Xử lý lỗi thường gặp:

#### 1. Lỗi: `Cannot connect to the Docker daemon`
- **Nguyên nhân:** Phần mềm Docker Desktop trên máy tính chưa được mở.
- **Khắc phục:** Mở ứng dụng **Docker Desktop**, chờ cho đến khi đèn báo góc dưới chuyển sang màu xanh lá rồi chạy lại lệnh.

#### 2. Lỗi: `Bind for 0.0.0.0:xxxx failed: port is already allocated`
- **Nguyên nhân:** Cổng mạng (ví dụ 3000 hoặc 5432 hoặc 8000) đang bị một phần mềm khác trên máy tính chiếm giữ.
- **Khắc phục:** Tắt ứng dụng đang chiếm cổng đó, hoặc đổi cổng trong file `.env` và `docker-compose.yml`.

#### 3. Muốn làm sạch hoàn toàn dữ liệu để chạy lại từ đầu:
```powershell
# Dừng và xóa cả dữ liệu volume PostgreSQL cũ
docker compose down -v
# Khởi động lại mới tinh
docker compose up --build -d
```
*(Lưu ý: Chỉ chạy khi bạn muốn reset cơ sở dữ liệu về ban đầu).*
