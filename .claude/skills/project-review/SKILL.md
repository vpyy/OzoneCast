---
name: project-review
description: Bộ kiểm tra chất lượng chuyên biệt cho dự án OzoneCast — Kiểm tra tính nhất quán với yêu cầu Đồ án KPDL, các bất biến kiến trúc (I1..I9), tính độc lập của các service và kịch bản Demo phòng thi.
---

# project-review (Dự án OzoneCast)

Lớp kiểm thử độc lập được thực thi trước khi mã nguồn được merge vào nhánh chính `develop`.

## Danh Sách Hạng Mục Bắt Buộc Kiểm Tra

1. **Khớp nối Kiến trúc Đồ án (Slide 2):**
   - Các khối Ingestion, Database API, Data Analysis, Clustering, Prediction có độc lập về tiến trình (terminal/container) không?
   - Có service nào bị phụ thuộc cứng hoặc truy cập trái phép trực tiếp vào file thô thay vì thông qua API/Database không?

2. **Đầy đủ 6+ Patterns (Slide 3):**
   - [ ] Pattern 1: Dữ liệu theo thời gian (Line, Scatter, Histogram: ngày, tuần, tháng)?
   - [ ] Pattern 2: Trend resampling theo tháng/tuần?
   - [ ] Pattern 3: Seasonal line resampling theo tháng/tuần?
   - [ ] Pattern 4: Correlation matrix giữa các biến đo đạc?
   - [ ] Pattern 5: Dự đoán nồng độ Ozone ngày mai (Prediction)?
   - [ ] Pattern 6: Phân loại cảnh báo chất lượng không khí ngày mai (Classification)?
   - [ ] Phân cụm nồng độ Ozone (Clustering)?

3. **Tính Tương thích Kịch bản Demo (Slide 5 & 10):**
   - Backend services có endpoint kích hoạt (`POST /api/services/run-...`) để chạy mô hình AI đã nạp sẵn không?
   - Thời gian thực thi khi nhấn Run có dưới 10 giây không? (Tuyệt đối không chạy quá trình train lại mô hình lúc demo).
   - Web Dashboard có xử lý trạng thái lỗi/trống khi dữ liệu trong Database bị xóa sạch không?

4. **Bảo mật & Chuẩn mực:**
   - Không có file mật khẩu `.env` hoặc token nào bị stage vào Git.
   - Không có file dữ liệu nhị phân lớn (`.he5`, `.nc` > 50MB) bị commit trực tiếp.
   - Luôn có sẵn dữ liệu mẫu (`mock_granule.py`) hoạt động ngoại tuyến.
