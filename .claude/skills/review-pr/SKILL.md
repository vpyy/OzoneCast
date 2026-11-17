---
name: review-pr
description: Tự động hóa Git và chuẩn bị Pull Request cho nhóm dự án OzoneCast. Tự động tạo nhánh đúng chuẩn, kiểm tra phạm vi (scope check), commit đúng format, đồng bộ develop và hướng dẫn tạo Pull Request an toàn cho thành viên.
---

# review-pr (Dự án OzoneCast)

Hỗ trợ các thành viên trong nhóm thực hiện quy trình Git chuẩn mực mà không sợ gõ nhầm lệnh hay làm hỏng nhánh chung.

## Hai Thời Điểm Kích Hoạt

- **(A) Khi bắt đầu công việc:** Tạo nhánh `<type>/<id>` từ `develop` trước khi sửa file đầu tiên.
- **(B) Khi hoàn thành & qua validation:** Kiểm tra scope, commit, đồng bộ develop và push lên remote.

## Các Bước Thực Hiện

1. **Kiểm tra trạng thái:** `./scripts/git-ship.sh status`.
2. **Kiểm tra phạm vi (Scope Check):** `./scripts/git-ship.sh scope` so với mục In-Scope trong `plan.md`. Báo động nếu có file nằm ngoài phạm vi đăng ký ban đầu.
3. **Chạy kiểm tra tự động (Self-review):**
   - Chạy `python scripts/notes_index.py --check`
   - Chạy `python scripts/notes_index.py --gate <id>`
4. **Tạo Commit theo chuẩn Conventional Commits:**
   - Định dạng: `<type>(<scope>): <mô tả ngắn> (<id>)`
   - Ví dụ: `feat(ml): implement k-means clustering service (2026-11-20-clustering-huusang)`
   - Thêm mã lỗi nếu có: `(BUG-<handle>-NNN)`.
5. **Đồng bộ với nhánh chính:** `./scripts/git-ship.sh update`.
6. **Đẩy mã nguồn lên Remote:** `./scripts/git-ship.sh push`.
7. **Thông báo cho Reviewer:**
   - Báo cho `huusang` (Techlead) hoặc người phụ trách mảng tương ứng vào duyệt Pull Request.
