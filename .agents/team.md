# Đội ngũ Dự án OzoneCast

Nguồn sự thật duy nhất (Single Source of Truth) về danh tính và phân công trách nhiệm trong dự án Khai phá Dữ liệu (KPDL) - Dự án OzoneCast (Dự báo & Khai phá Dữ liệu Nồng độ Ozone Khí quyển từ Vệ tinh NASA).

`handle` là định danh ngắn gọn dùng trong ID note (`yyyy-mm-dd-<slug>-<handle>`), mã lỗi (`BUG-<handle>-NNN`) và tên nhánh Git (`feat/<id>`, `fix/<id>`, ...).

| handle | Họ và Tên | Vai trò | Mảng phụ trách | Nhiệm vụ cốt lõi theo Yêu cầu Đồ án |
|---|---|---|---|---|
| `huusang` | **Hữu Sáng** | **Team Leader / Data Science & ML Lead** | AI & Machine Learning, Review & Merge Code | Huấn luyện & tối ưu mô hình Prediction (Hồi quy nồng độ Ozone ngày mai), Classification (Phân loại cảnh báo chất lượng khí quyển Tốt/Trung bình/Nguy hại), Clustering (K-Means/DBSCAN phân vùng nồng độ). Review và phê duyệt proposal/code. |
| `vanphuc` | **Văn Phúc** | **Backend & Database API Lead** | Database Architecture & RESTful API Service | Thiết kế Schema Database (PostgreSQL/SQLite), Migrations; Xây dựng Database API Service độc lập (FastAPI); Viết các endpoints cung cấp dữ liệu cho 6+ patterns (Line, Scatter, Histogram, Trend, Seasonality, Correlation, Prediction, Clustering) và trigger API cho backend services. |
| `vantrung` | **Văn Trung** | **Data Ingestion & Time-series Analytics Lead** | Crawler, Ingestion Pipeline & Analytics Service | Module Data Ingestion cào dữ liệu vệ tinh NASA (Aura/OMI OMTO3, Suomi-NPP/OMPS) định kỳ 5 phút/lần; Tiền xử lý Bronze -> Silver (Parquet); Xây dựng Data Analysis Service độc lập (5 phút/lần) phân tích thống kê, tính toán Trend, Seasonality (phân rã chuỗi thời gian) và Ma trận Correlation. |
| `vietan` | **Viết An** | **Frontend & UI/UX Lead** | Web Dashboard & Interactive Visualization | Xây dựng Giao diện Web trực quan thẩm mỹ cao; Trực quan hóa toàn bộ 6+ patterns theo đúng slide yêu cầu; Tích hợp tính năng Zoom, Filter theo khoảng thời gian (ngày, tuần, tháng); Tích hợp bản đồ nhiệt Heatmap/Leaflet; Đảm bảo Web tải dữ liệu qua Database API (kiểm tra chuẩn qua F12 Network tab). |
| `phucan` | **Phúc An** | **DevOps, System Architecture & QA/Demo Lead** | Multi-service Containerization, QA & Demo Script | Đóng gói Docker Compose đa container (Ingestion, DB API, Analysis, Clustering, Prediction, Frontend); Thiết lập kịch bản Demo phòng thi (Xóa DB -> Web lỗi -> Run Backend API -> Web hồi phục); Kiểm soát chất lượng dữ liệu và kiểm thử tích hợp; Chuẩn bị tài liệu Báo cáo & Slide thuyết trình. |

---

## Cách Agent sử dụng Bảng này

1. **Nhận diện người dùng đang làm việc:**
   - Agent đọc file [`.agents/me`](file:///d:/DAIHOC/HOCKY7/KPDL/du-an-cuoi-ky/OzoneCast/.agents/me) để biết `handle` của thành viên hiện tại (mặc định cấu hình trên máy này là `phucan`).
   - Nếu file chưa có hoặc rỗng, hỏi người dùng đúng một câu: *"Bạn là ai trong danh sách thành viên nhóm? (huusang, vanphuc, vantrung, vietan, phucan)"* rồi lưu vào `.agents/me`. Không tự động đoán từ `git config user.name`.

2. **Tôn trọng quyền hạn và ranh giới chuyên môn:**
   - Khi thực hiện thay đổi, nếu phạm vi công việc chạm vào mảng chuyên môn của thành viên khác (cột Mảng phụ trách), ghi rõ tên người phụ trách vào proposal / MR để họ theo dõi.
   - Tránh việc một thành viên tự ý sửa đổi kiến trúc lõi của thành viên khác mà không có sự đồng thuận qua proposal.

3. **Techlead & Reviewer (`huusang`):**
   - Hữu Sáng là người giữ vai trò Team Leader, thẩm định các thay đổi kiến trúc và giải pháp ML quan trọng.
   - Mọi Pull Request / Merge Request quan trọng cần được gán `huusang` hoặc thành viên phụ trách mảng đó làm Reviewer.
