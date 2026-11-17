# Implementation Plan: Thiết Lập Hệ Thống Agent Workflow & Bộ Nhớ Quyết Định

## Metadata
- ID: 2026-11-17-001-agent-workflow-setup-phucan
- Proposal: .agents/notes/proposed/2026-11-17-001-agent-workflow-setup-phucan.md
- Approved By: huusang
- Approved At: 2026-11-17
- Implementer: phucan
- Status: completed

---

## 1. Mục tiêu
Thiết lập bộ khung làm việc giữa 5 thành viên và AI Agent cho dự án OzoneCast, bao gồm bảng phân vai, bộ nhớ quyết định, script tự động hóa và tài liệu đặc tả kiến trúc.

---

## 2. Phạm vi Triển khai
### In Scope
- `.agents/team.md`, `.agents/me`
- `.agents/notes/` (`README.md`, templates cho `proposed/`, `implemented/`, `bugs/`)
- `AGENTS.md`, `CLAUDE.md`
- `scripts/notes_index.py`, `scripts/git-ship.sh`, `scripts/git-setup.sh`
- `.claude/skills/` (`write-proposal`, `build-implementation`, `review-pr`, `project-review`)
- `docs/` (`architecture.md`, `patterns-spec.md`, `demo-guide.md`, `coding-rules.md`, `workflow.md`, `git-workflow.md`)
### Out of Scope
- Mã nguồn nghiệp vụ frontend / model ML.

---

## 3. Các Bước Thực Hiện
- Bước 1: Tạo bảng thành viên và phân định mảng phụ trách của 5 sinh viên.
- Bước 2: Tạo cấu trúc bộ nhớ quyết định `.agents/notes/`.
- Bước 3: Soạn thảo `AGENTS.md` định nghĩa 9 bất biến kiến trúc bám sát Slide 2 và Slide 3.
- Bước 4: Viết script `notes_index.py` và `git-ship.sh`.
- Bước 5: Soạn thảo tài liệu đặc tả kiến trúc và kịch bản Demo phòng thi.

---

## 4. Thay đổi Dữ liệu / API / Cấu hình
Không thay đổi schema database hiện tại. Bổ sung hệ thống tài liệu và script kiểm tra.

---

## 5. Validation
- [x] Chạy `python scripts/notes_index.py --check` đạt kết quả hợp lệ.
- [x] Tạo bảng index `python scripts/notes_index.py` hiển thị đúng định dạng.
- [x] Bảng phân vai 5 thành viên khớp đúng danh sách Hữu Sáng, Văn Phúc, Văn Trung, Viết An, Phúc An.

---

## 6. Rủi ro Triển khai & Khắc phục
Đã xử lý mã hóa UTF-8 trên Windows trong script `notes_index.py` để tránh lỗi font chữ tiếng Việt.

---

## 7. Rollback
Xóa các thư mục `.agents/`, `docs/`, `scripts/` nếu có yêu cầu huỷ bỏ.
