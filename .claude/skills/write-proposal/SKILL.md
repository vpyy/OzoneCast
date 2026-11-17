---
name: write-proposal
description: Pha 1+2 của agent workflow (docs/workflow.md) — Khám phá read-only mã nguồn, kiểm tra conflict với quyết định cũ (trong .agents/notes/proposed/ và implemented/), viết proposal mới từ template vào .agents/notes/proposed/, rồi DỪNG chờ Reviewer phê duyệt. Sử dụng trước mọi tính năng, sửa bug lớn, thay đổi mô hình ML, endpoint API hoặc kiến trúc service.
---

# write-proposal (Dự án OzoneCast)

Pha 1 (Khám phá) + Pha 2 (Soạn Đề xuất). Quy định chi tiết: [docs/workflow.md](../../../docs/workflow.md). Mẫu template: [.agents/notes/proposed/_TEMPLATE.md](../../../.agents/notes/proposed/_TEMPLATE.md).

## Nguyên tắc Cốt lõi

- **Chế độ Read-only khi nghiên cứu:** Chỉ đọc file, grep, phân tích log. Không tự ý chỉnh sửa mã nguồn khi đang ở bước đề xuất.
- **Không nhảy cóc vào code:** Bất kỳ thay đổi nào liên quan đến kiến trúc microservices (Slide 2), 6+ patterns (Slide 3) hoặc kịch bản demo (Slide 5) đều phải có proposal.

## Các Bước Thực Hiện

1. **Thu thập bối cảnh & Yêu cầu:**
   - Đọc yêu cầu từ giảng viên trong [docs/patterns-spec.md](../../../docs/patterns-spec.md) và [docs/architecture.md](../../../docs/architecture.md).
   - Kiểm tra các Invariants trong [AGENTS.md](../../../AGENTS.md) và [docs/coding-rules.md](../../../docs/coding-rules.md).
   - Tra cứu quyết định cũ trong `.agents/notes/proposed/` bằng lệnh `python scripts/notes_index.py`. Nếu phát hiện xung đột, dừng lại và thông báo `CONFLICT DETECTED`.

2. **Cấp mã định danh (ID):**
   - Định dạng: `yyyy-mm-dd-<slug>-<handle>` (ví dụ: `2026-11-20-clustering-kmeans-huusang`).
   - Lấy `<handle>` từ `.agents/me` hoặc hỏi người dùng nếu chưa có.

3. **Soạn thảo Proposal:**
   - Sao chép từ `_TEMPLATE.md` vào `.agents/notes/proposed/<id>.md`.
   - Giữ mục `## 9. Human Review` ở trạng thái `Decision: Pending`, `Status: proposed`. **Tuyệt đối không tự điền kết quả duyệt.**
   - Điền trung thực trường `Architecture Impact` nếu có ảnh hưởng tới schema DB, Docker compose hay API contracts.

4. **Kiểm tra cú pháp:**
   - Chạy `python scripts/notes_index.py --check` để đảm bảo file hợp lệ 100%.

5. **Trình bày tóm tắt cho người dùng và DỪNG LẠI:**
   - Báo cáo ngắn gọn về giải pháp và các đánh đổi.
   - Chờ Reviewer (`huusang` hoặc thành viên phụ trách) xem xét và ghi `Decision: Approved`.
