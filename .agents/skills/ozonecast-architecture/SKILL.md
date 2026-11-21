---
name: ozonecast-architecture
description: Kiến trúc và quy tắc chung của dự án OzoneCast (dự đoán ozone Bán đảo Nam Cực). Dùng khi làm việc ở bất kỳ service nào, hoặc khi thay đổi docker-compose, schema DB, biến môi trường.
---

# OzoneCast Architecture

## Use this skill when
- Làm việc ở data-ingestion, backend-services, database-api, frontend, db/init, docker-compose.

## Kiến trúc (không được đổi)
NASA OMI OMTO3G -> data-ingestion -> PostgreSQL <- backend-services (analysis/clustering/prediction)
PostgreSQL -> database-api (FastAPI, chỉ đọc, WebSocket stream /ws/stream & REST) -> frontend (WebSocket thời gian thực, fallback REST polling)

## Quy tắc chung
1. Mỗi service là một container độc lập, giao tiếp CHỈ qua PostgreSQL. Không gọi HTTP chéo giữa service.
2. Chỉ data-ingestion và backend-services được ghi DB. database-api chỉ SELECT (chỉ đọc). database-api được dùng thêm WebSocket (/ws/stream) để đẩy cập nhật trực tiếp tới frontend thay cho việc chỉ polling thuần túy.
3. Cấu hình qua biến môi trường. Không hardcode secret. Trong container, host DB là "postgres".
4. Dữ liệu: vùng Bán đảo Nam Cực (lat -70..-63, lon -70..-55), biến chính ColumnAmountO3 (DU).
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
