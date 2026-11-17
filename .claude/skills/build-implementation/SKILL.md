---
name: build-implementation
description: Pha 4 của agent workflow (docs/workflow.md) — Triển khai một proposal đã được Reviewer duyệt (Decision: Approved ở §9). Tạo implemented/<id>/{plan.md, status.md}, viết code, kiểm thử, duy trì status sống và chuyển giao cho review-pr.
---

# build-implementation (Dự án OzoneCast)

Giai đoạn hiện thực hóa giải pháp sau khi proposal đã được phê duyệt.

## Điều Kiện Tiên Quyết (Bắt Buộc Kiểm Tra Trước Khi Viết Code)

1. Mở file `.agents/notes/proposed/<id>.md`.
2. Kiểm tra mục `## 9. Human Review`: **Bắt buộc phải có `Decision: Approved`** kèm tên Reviewer và ngày duyệt. Nếu còn `Pending`, `Changes Requested` hoặc `Rejected`, **dừng ngay lập tức** và thông báo cho người dùng.
3. Nếu thư mục `.agents/notes/implemented/<id>/` đã tồn tại: Tiếp tục công việc dở dang từ `status.md`, không ghi đè mất lịch sử.

## Các Bước Triển Khai

1. **Khởi tạo Kế hoạch Thực thi (`plan.md`):**
   - Tạo từ template `.agents/notes/implemented/_TEMPLATE/plan.md`.
   - Xác định rõ In-Scope (file được đụng vào) và Out-of-Scope (file không được can thiệp).
2. **Khởi tạo Bảng Trạng thái (`status.md`):**
   - Đặt `Status: planned`, `Progress: 0%`.
3. **Tạo Nhánh Git:**
   - Chạy `./scripts/git-ship.sh start <type>/<id>` trước khi chỉnh sửa file đầu tiên.
4. **Viết Mã Nguồn & Kiểm Thử Theo Từng Bước:**
   - Tuân thủ các Invariants kiến trúc trong [AGENTS.md](../../../AGENTS.md).
   - Đảm bảo các dịch vụ hoạt động độc lập (Slide 2) và tuân thủ kịch bản Demo phòng thi (Slide 5).
5. **Cập nhật `status.md` liên tục:**
   - Cập nhật tiến độ `in_progress -> validation`.
   - Ghi nhận ngay mọi độ lệch kế hoạch (Deviations) và các quyết định kỹ thuật phát sinh.
6. **Thực hiện Validation:**
   - Kiểm tra API chạy ổn định, trả về đúng định dạng JSON cho biểu đồ Web.
   - Kiểm tra kịch bản phục hồi dữ liệu khi gọi trigger API.
7. **Chuyển giao cho `review-pr`:**
   - Đặt `Status: validation` trong `status.md`, chuẩn bị commit và push code.
