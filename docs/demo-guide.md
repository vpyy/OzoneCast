# Hướng Dẫn Thực Hiện Buổi Báo Cáo & Demo Đồ Án (Demo Guide)

Tài liệu hướng dẫn chi tiết quy trình thực hiện bài thi Demo thực tế trước Giảng viên hướng dẫn (TS. Phạm Tuấn), bám sát 100% các bước yêu cầu tại **Slide 5**, **Slide 10** và bảng tiêu chí chấm điểm tại **Slide 6**, **Slide 11**.

---

## 1. Mục Tiêu & Cơ Cấu Điểm Đồ Án

### Thang Điểm Chuẩn (10 Điểm):
1. **Hệ thống thiết kế chuẩn theo sơ đồ Slide 2:** 3 điểm
   *(Đầy đủ các khối: Data Source, Ingestion, Database, Database API, Backend Services: Analysis, Clustering, Prediction, Front End).*
2. **Đủ các patterns phân tích (Slide 3):** 3 điểm
   *(Có xử lý thuật toán thực tế và nạp động thông qua Database API, không dùng dữ liệu cứng).*
3. **Giao diện Web đẹp mắt & thẩm mỹ:** 1 điểm
4. **Docker hóa toàn bộ hệ thống:** 1 điểm
5. **Slide trình bày chuyên nghiệp & hiểu rõ hệ thống:** 1 điểm
6. **Cấu trúc Source Code sạch sẽ, bài bản:** 1 điểm

### Điểm Cộng Tối Đa (+2 Điểm Khuyến Khích):
- **Docker Compose hoàn chỉnh:** Triển khai một lệnh chạy tất cả.
- **Tổ chức Codebase xuất sắc:** Phân tầng rõ ràng theo chuẩn công nghiệp (Medallion architecture + Microservices + AI Agent workflow).
- **Deploy lên Cloud:** AWS (EC2 + Lambda + RDS/PostgreSQL) hoặc Azure (VM + Functions + Container Apps + Azure Database).
- **Biểu đồ có tính năng Zoom và Filter thời gian linh hoạt.**

---

## 2. Quy Trình 7 Bước Thực Hiện Trong Buổi Demo (Bắt Buộc)

Dưới đây là kịch bản mẫu từng bước để nhóm thực hiện mượt mà trong phòng thi:

### Bước 1: Chứng minh môi trường sạch (Clean Environment)
- Mở Terminal hoặc Docker Desktop.
- Thực hiện lệnh dừng và xóa toàn bộ container cũ:
  ```bash
  docker compose down -v
  docker ps -a
  ```
- *Mục tiêu:* Cho Giảng viên thấy hệ thống khởi động từ đầu, không dùng cache ảo.

### Bước 2: Khởi động hệ thống bằng Docker Compose
- Chạy lệnh khởi động đa dịch vụ:
  ```bash
  docker compose up -d --build
  ```
- Kiểm tra trạng thái các container đang chạy song song:
  ```bash
  docker compose ps
  ```
- *Mục tiêu:* Chứng minh hệ thống phân rã thành các dịch vụ độc lập theo Slide 2.

### Bước 3: Mở Web Dashboard & Kiểm tra F12
- Truy cập trình duyệt: `http://localhost:3000`.
- Bấm phím `F12` -> Chọn tab **Network**.
- Nhấn `F5` tải lại trang:
  - Chỉ ra cho Giảng viên thấy các request gọi tới `http://localhost:8000/api/patterns/...` đều trả về HTTP `200 OK`.
  - Giới thiệu các biểu đồ: Line chart, Scatter, Histogram (ngày/tuần/tháng), Trendline, Seasonality, Correlation heatmap, Thẻ dự đoán nồng độ ngày mai và nhãn phân loại cảnh báo.
  - Thao tác thử tính năng **Zoom** và **Filter thời gian** trên biểu đồ để lấy điểm cộng.

### Bước 4: Xóa dữ liệu các pattern trong Database bằng tay
- Mở terminal hoặc công cụ quản lý DB (DBeaver, SQLite CLI, pgAdmin).
- Chạy lệnh xóa dữ liệu đã xử lý:
  ```sql
  DELETE FROM analysis_patterns;
  DELETE FROM clustering_results;
  DELETE FROM predictions;
  ```
- *Mục tiêu:* Giả lập sự cố mất dữ liệu trung gian trong database.

### Bước 5: Mở lại Web để kiểm chứng lỗi
- Chuyển sang trình duyệt Web Dashboard, nhấn `F5`.
- Quan sát thấy: Giao diện Web hiển thị trạng thái *"Không có dữ liệu"* hoặc thông báo lỗi từ API.
- Tab F12 Network hiển thị API trả về danh sách rỗng hoặc lỗi 404/500 có kiểm soát.
- *Mục tiêu:* Chứng minh Web không hardcode dữ liệu mà phụ thuộc 100% vào Database qua API.

### Bước 6: Gọi API các Backend Services và nhấn Run
- Mở trang Swagger UI của Database API tại: `http://localhost:8000/docs`.
- Lần lượt gọi các trigger endpoints (hoặc bấm nút "Chạy xử lý tức thì" ngay trên giao diện Web):
  1. `POST /api/services/run-analysis` (Tính toán lại Trend, Seasonality, Histogram, Correlation).
  2. `POST /api/services/run-clustering` (Chạy mô hình K-Means phân cụm vùng nồng độ).
  3. `POST /api/services/run-prediction` (Chạy mô hình AI đã nạp sẵn dự đoán nồng độ ngày mai).
- *Lưu ý quan trọng:* **Các mô hình AI đã được build/train sẵn**, khi gọi API chỉ thực hiện bước suy luận (Inference), thời gian chạy chỉ mất 1-3 giây.
- Mở lại Database để thấy các bản ghi mới đã được tạo lại đầy đủ.

### Bước 7: Mở lại Web Dashboard kiểm tra khôi phục hoàn toàn
- Nhấn `F5` tải lại trang Web `http://localhost:3000`.
- Tất cả các biểu đồ và số liệu dự đoán lập tức xuất hiện trở lại đầy đủ, chính xác.
- *Kết thúc bài demo thành công 100%!*

---

## 3. Nội Dung Báo Cáo Cuối Kỳ (Bản In & Slide)

Theo yêu cầu tại **Slide 9**:
1. **Demo chương trình:** Vượt qua 7 bước ở mục 2.
2. **Nội dung quyển Báo cáo (In nộp):**
   - Hình ảnh giao diện chương trình trực quan.
   - Sơ đồ khối chức năng chi tiết:
     - Miêu tả chi tiết chức năng từng khối (Data Source, Ingestion, Database, API, Analysis, Clustering, Prediction, Frontend).
     - Sơ đồ kiến trúc mạng (Network Diagram giữa các container/ports).
     - Thông tin cấu hình hệ thống: Tần suất cập nhật (5 phút/lần, 1 ngày/lần), thời gian huấn luyện mô hình, dung lượng tập dữ liệu, chu kỳ tái huấn luyện.
     - Mô tả chi tiết các thuật toán sử dụng: K-Means/DBSCAN (Clustering), Random Forest / Ridge (Prediction), Decision Rule / Classifier (Classification), STL Decomposition (Trend & Seasonality).
   - In phụ lục Source code sạch sẽ.
