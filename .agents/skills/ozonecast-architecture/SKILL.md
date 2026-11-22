---
name: ozonecast-architecture
description: Kiến trúc và quy tắc chung của dự án OzoneCast (dự đoán ozone Bán đảo Nam Cực). Dùng khi làm việc ở bất kỳ service nào, hoặc khi thay đổi docker-compose, schema DB, biến môi trường.
---

# OzoneCast Architecture

## Use this skill when
- Làm việc ở data-ingestion, backend-services, database-api, frontend, db/init, docker-compose.

## Kiến trúc (Microservices Architecture)
NASA OMI OMTO3G -> data-ingestion (mỗi 5 phút) -> PostgreSQL
PostgreSQL <- data-analysis (mỗi 5 phút)
PostgreSQL <- prediction (mỗi 5 phút)
PostgreSQL <- clustering (mỗi 1 ngày)
PostgreSQL -> database-api (FastAPI, chỉ đọc, WebSocket stream /ws/stream & REST) -> frontend (React + Vite)

## Quy tắc chung
1. Mỗi service là một container độc lập, giao tiếp CHỈ qua PostgreSQL / database-api. Không gọi HTTP chéo giữa 3 worker services.
2. 3 backend services chạy độc lập với vai trò daemon workers:
   - data-analysis: tính toán spatial grid summary, phát hiện lỗ thủng ozone (< 220 DU), phân rã chuỗi thời gian (trend/seasonal/residual) và ma trận tương quan.
   - prediction: huấn luyện Random Forest Regressor & Classifier, dự báo nồng độ ozone ngày mai và phân loại rủi ro UV.
   - clustering: phân cụm không gian K-Means & DBSCAN dựa trên tọa độ, nồng độ ozone và độ phản xạ.
3. Chỉ data-ingestion và 3 backend services được ghi DB. database-api chỉ SELECT (chỉ đọc). database-api dùng WebSocket (/ws/stream) để đẩy cập nhật trực tiếp tới frontend thay cho việc chỉ polling thuần túy.
3. Cấu hình qua biến môi trường. Không hardcode secret. Trong container, host DB là "postgres".
4. Dữ liệu: nguồn vệ tinh OMI/Aura OMTO3G (L2G Gridded), vùng Bán đảo Nam Cực (lat -70..-63, lon -75..-55), biến chính ColumnAmountO3 (DU). Lọc cắt vùng theo chỉ số ô lưới, giữ từng quan sát hợp lệ (nhiều lớp quan sát trong 1 ô lưới).
5. Giá trị thiếu (fill value ~ -1.27e30, đêm cực) phải đổi thành NaN/NULL, không bao giờ thay bằng 0.
6. Ghi DB phải idempotent (UPSERT theo granule + tọa độ + thời điểm), tránh trùng khi chạy lại.
7. Đổi schema thì sửa db/init/*.sql và báo rõ các service bị ảnh hưởng.

## Quy tắc ML (backend-services)
1. Chia train/test THEO THỜI GIAN, tuyệt đối không shuffle ngẫu nhiên.
2. Có mùa vụ rõ (lỗ thủng ozone đạt đỉnh tháng 9-10): đưa đặc trưng mùa vào mô hình.
3. Luôn so sánh với baseline đơn giản (naive, giá trị cùng kỳ năm trước) trước khi dùng mô hình phức tạp.
4. Backtest bằng walk-forward, báo cáo MAE/RMSE.
5. Dự đoán lưu kèm khoảng tin cậy (lower/upper) và tên phiên bản mô hình.
6. Lưu ý ozone chỉ liên quan gián tiếp tới băng tan; không tuyên bố dự đoán băng tan.

## Safety
- Không chạy docker compose down -v, DROP TABLE hay xóa volume khi chưa hỏi người dùng.
