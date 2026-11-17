# Bất Biến Kiến Trúc & Quy Chuẩn Lập Trình (Coding Rules & Invariants)

Tài liệu định nghĩa các **Bất Biến Cứng (Invariants I1–I9)** của dự án OzoneCast. Bất kỳ sự thay đổi mã nguồn nào vi phạm các nguyên tắc này mà không có thảo luận và phê duyệt trước qua proposal đều bị coi là lỗi nghiêm trọng.

---

## Danh Sách 9 Bất Biến Kiến Trúc (Invariants I1–I9)

### I1. Phân Tách Microservices Độc Lập
- **Nguyên tắc:** Mỗi khối (Data Ingestion, Database API, Data Analysis, Clustering, Prediction, Frontend) phải là một service độc lập, có thể chạy ở từng terminal riêng biệt hoặc container riêng rẽ.
- **Dấu hiệu vi phạm:** Gộp chung logic của crawler và prediction vào cùng một tiến trình nguyên khối (monolith); gọi trực tiếp hàm nội bộ của service này từ service khác qua import thay vì qua REST API hoặc Database.

### I2. Cổng Giao Tiếp Dữ Liệu Tập Trung (Single Gateway)
- **Nguyên tắc:** Frontend chỉ được phép truy xuất dữ liệu thông qua Database API (FastAPI port 8000). Dữ liệu tính toán của các backend services sau khi hoàn thành phải ghi vào Database để Database API phân phối.
- **Dấu hiệu vi phạm:** Frontend cố tình đọc trực tiếp file nhị phân HDF5/Parquet từ ổ đĩa; bypass API để truy cập file tĩnh.

### I3. Đầy Đủ 6+ Patterns Bắt Buộc (Pattern Completeness)
- **Nguyên tắc:** Hệ thống phải cung cấp đầy đủ các mẫu hình chuỗi thời gian theo yêu cầu của môn học:
  1. Biểu đồ theo thời gian (Line, Scatter, Histogram) theo 3 quãng: Ngày, Tuần, Tháng.
  2. Đường Trend (resampling Tháng/Tuần).
  3. Đường Seasonality (resampling Tháng/Tuần).
  4. Ma trận tương quan Correlation.
  5. Dự đoán nồng độ ngày mai.
  6. Phân loại cảnh báo nồng độ ngày mai.
  7. Phân cụm nồng độ Ozone (Clustering).
- **Dấu hiệu vi phạm:** Thiếu một trong các pattern trên; dữ liệu biểu đồ bị hardcode cố định trong code frontend.

### I4. Tuân Thủ Kịch Bản Demo Phòng Thi (Demo Compliance)
- **Nguyên tắc:** Các Backend Services phải cung cấp các trigger endpoints (`POST /api/services/run-...`) để chạy mô hình AI đã build sẵn (inference only, thời gian < 5s), cho phép khôi phục toàn bộ dữ liệu patterns sau khi DB bị xóa bằng tay.
- **Dấu hiệu vi phạm:** Quá trình chạy lại model lúc demo bị treo do chạy lại toàn bộ quá trình train; API không hỗ trợ trigger tức thời; Web bị crash hoàn toàn không hiển thị được giao diện khi DB trống.

### I5. Frontend Trực Quan, Tương Tác & Thẩm Mỹ
- **Nguyên tắc:** Giao diện Web phải đẹp mắt, hỗ trợ Zoom và Filter thời gian trên biểu đồ. Mọi dữ liệu phải tải qua API (kiểm tra F12 mã 200 OK).
- **Dấu hiệu vi phạm:** Biểu đồ tĩnh không tương tác được; F12 xuất hiện lỗi console màu đỏ hoặc lỗi 500; bố cục giao diện vỡ trên màn hình demo.

### I6. Bảo Mật Secret & Quản Lý File Lớn
- **Nguyên tắc:** Thông tin đăng nhập NASA Earthdata (`NASA_USERNAME`, `NASA_PASSWORD`) chỉ lưu tại file `.env` (nằm trong `.gitignore`). Không commit file nhị phân lớn (`.he5`, `.nc` > 50MB) lên Git repo.
- **Dấu hiệu vi phạm:** Hardcode mật khẩu vào file python; commit file nhị phân nặng làm phình dung lượng git.

### I7. Khả Năng Chống Chịu Ngoại Tuyến (Offline Resilience)
- **Nguyên tắc:** Luôn duy trì module dữ liệu mẫu (`src/utils/mock_granule.py`) hoạt động trơn tru để dự phòng khi mạng trường hoặc server NASA gặp sự cố.
- **Dấu hiệu vi phạm:** Hệ thống không thể khởi động hoặc demo nếu không có kết nối internet ra ngoài.

### I8. Tính Toàn Vẹn Của Dữ Liệu & Idempotency
- **Nguyên tắc:** Mọi bản ghi trong Database phải có trường thời gian chuẩn ISO/UTC. Quá trình cào và nạp dữ liệu lặp lại không được tạo ra bản ghi trùng lặp (`Idempotency`).
- **Dấu hiệu vi phạm:** Cào 2 lần cùng 1 file vệ tinh sinh ra 2 dòng đo đạc trùng kinh độ/vĩ độ/thời gian.

### I9. Bộ Nhớ Quyết Định Bền Vững (Decision Memory)
- **Nguyên tắc:** Mọi thay đổi kiến trúc hoặc tính năng không-tầm-thường phải có proposal trong `.agents/notes/proposed/` và chỉ thực thi khi đã được Reviewer duyệt (`Approved`).
- **Dấu hiệu vi phạm:** Tự ý thay đổi cấu trúc bảng database hoặc xóa service mà không có proposal được duyệt.
