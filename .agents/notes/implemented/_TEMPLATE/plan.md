<!-- Template cho .agents/notes/implemented/yyyy-mm-dd-<slug>-<handle>/plan.md
     Chỉ được tạo sau khi proposal tương ứng đã được Reviewer duyệt (Decision: Approved ở §9).
     Tập trung vào chi tiết kỹ thuật thực thi, không lặp lại lý do hay phân tích đánh đổi của proposal.
     Quy định chi tiết: docs/workflow.md. -->

# Implementation Plan: <Tên Kế hoạch Triển khai>

## Metadata
- ID: yyyy-mm-dd-<slug>-<handle>
- Proposal: .agents/notes/proposed/yyyy-mm-dd-<slug>-<handle>.md
- Approved By: <handle người duyệt>
- Approved At: yyyy-mm-dd
- Implementer: agent | <handle người code>
- Status: planned

---

## 1. Mục tiêu Cụ thể
Mô tả chính xác đầu ra kỹ thuật của đợt triển khai này (File mới nào được tạo, Service nào được bổ sung, Endpoint nào được publish).

---

## 2. Phạm vi Triển khai (Scope Boundary)
### In Scope (Được phép chỉnh sửa)
- Danh sách file / thư mục nằm trong diện thay đổi (ví dụ: `src/api/routes/patterns.py`, `src/analytics/trend.py`).
### Out of Scope (Cố tình không can thiệp)
- Các module lân cận không được phép thay đổi để tránh ảnh hưởng chéo hoặc tạo xung đột.

---

## 3. Các Bước Thực hiện (Implementation Steps)
### Bước 1: Chuẩn bị & Thiết kế Interface
- Định nghĩa hàm, data class hoặc Pydantic schema cho dữ liệu đầu vào / đầu ra.
### Bước 2: Triển khai Logic / Thuật toán Lõi
- Viết mã nguồn xử lý chính.
### Bước 3: Tích hợp Database / API Endpoint
- Đấu nối vào Database và khai báo route API trong FastAPI.
### Bước 4: Kiểm thử Độc lập & Tích hợp
- Chạy thử nghiệm service độc lập qua lệnh terminal hoặc Docker.

---

## 4. Thay đổi Dữ liệu / Database / Cấu hình
- **Database Schema:** Có thêm bảng mới hay cột mới nào không? (Ví dụ: `analysis_patterns`, `clustering_results`).
- **Endpoints mới:** Danh sách HTTP method và URL (ví dụ: `GET /api/patterns/trend`, `POST /api/services/run-clustering`).
- **Biến môi trường:** Có bổ sung key nào vào `.env.example` không?
*(Ghi "Không có" nếu giữ nguyên).*

---

## 5. Quy trình Kiểm chứng (Validation Checklist)
Chỉ kiểm tra phần mã nguồn và chức năng bị ảnh hưởng:
- [ ] Chạy kiểm tra cú pháp và logic: `python -m py_compile <file_path>` hoặc `pytest tests/...`
- [ ] Khởi động service kiểm tra chạy độc lập không bị crash
- [ ] Dùng curl/Postman/Swagger kiểm tra endpoint trả về status 200 và JSON đúng định dạng
- [ ] Kiểm tra tài liệu kỹ thuật liên quan ([docs/architecture.md](../../../docs/architecture.md), [docs/patterns-spec.md](../../../docs/patterns-spec.md)) đã đồng bộ
- [ ] Kiểm tra khả năng tương thích với kịch bản Demo phòng thi (Slide 5 & 10)

---

## 6. Rủi ro Triển khai Kỹ thuật & Phương án Khắc phục
- Rủi ro phát sinh trong quá trình code và cách phòng ngừa (khác với rủi ro nghiệp vụ của proposal).

---

## 7. Kế hoạch Khôi phục (Rollback Plan)
Nếu việc triển khai gặp sự cố không thể khắc phục:
- Revert commit liên quan bằng Git.
- Khôi phục file cấu hình / database về trạng thái trước đó.

---

## 8. Ghi chú Khác
Ràng buộc hoặc phụ thuộc đặc thù, nếu có.
