# Quy Trình Phát Triển & Phối Hợp Người - AI Agent (Workflow)

Quy trình làm việc chuẩn hóa giữa các thành viên nhóm 5 người (`huusang`, `vanphuc`, `vantrung`, `vietan`, `phucan`) và các AI Agent hỗ trợ phát triển dự án **OzoneCast**.

---

## 1. Bốn Nguyên Tắc Nền Tảng

1. **Kế hoạch trước, Thực thi sau (Plan ≠ Implement):**
   - Không được phép viết mã cho bất kỳ thay đổi không-tầm-thường nào khi chưa có bản đề xuất (proposal) được phê duyệt bởi Reviewer.
2. **Triển khai xong là chuyển giao cho Git (Implement ≠ Merge):**
   - Khi hoàn thành việc code và đã vượt qua kiểm chứng, Agent hỗ trợ commit và push nhánh, nhưng **không bao giờ tự ý merge vào `develop`/`main`**. Quyền merge thuộc về Techlead (`huusang`) hoặc chủ trì module.
3. **Agent là trợ lý, Con người là người quyết định:**
   - Agent nghiên cứu, viết code, tìm giải pháp, trình bày ưu nhược điểm; con người giữ vai trò phê duyệt kiến trúc và đánh giá nghiệp vụ.
4. **Không tự ý sửa đổi luật chơi:**
   - Agent không tự sửa các file quy chuẩn như `AGENTS.md`, `coding-rules.md` trừ khi có chỉ thị rõ ràng.

---

## 2. Các Pha Làm Việc Chuẩn (Phases)

```text
[Pha 1: Discovery] ──► [Pha 2: Proposal] ──► [Pha 3: Human Review]
                                                      │
                       ┌──────────────────────────────┘
                       ▼
                 Decision: Approved?
                 ├── Có  ──► [Pha 4: Implementation] ──► [Pha 5: Validation] ──► [Pha 6: PR & Merge]
                 └── Không ──► Changes Requested / Rejected (Lưu negative knowledge)
```

### Pha 1: Khám Phá (Discovery)
- Đọc hiểu yêu cầu kỹ thuật.
- Kiểm tra tính tương thích với [docs/patterns-spec.md](patterns-spec.md) và [docs/architecture.md](architecture.md).
- Tra cứu các quyết định cũ trong `.agents/notes/` để phát hiện xung đột sớm.

### Pha 2: Soạn Thảo Đề Xuất (Proposal)
- Tạo file `.agents/notes/proposed/yyyy-mm-dd-<slug>-<handle>.md` từ template.
- Xác định rõ mục tiêu In-Scope, Out-of-Scope, đánh đổi kỹ thuật và rủi ro.
- Giữ mục `## 9. Human Review` ở trạng thái `Decision: Pending`.

### Pha 3: Đánh Giá & Phê Duyệt (Human Review)
- Reviewer đọc proposal, điền kết quả vào mục §9:
  - `Approved`: Cho phép bắt đầu code.
  - `Changes Requested`: Yêu cầu tác giả sửa lại các điểm chưa hợp lý.
  - `Rejected`: Bác bỏ phương án, ghi rõ lý do vào `Scope of Rejection:`.

### Pha 4: Triển Khai (Implementation)
- Tạo thư mục `implemented/<id>/` chứa `plan.md` và `status.md`.
- Tạo nhánh Git `feat/<id>` hoặc `fix/<id>`.
- Viết mã nguồn theo các bước đã định. Cập nhật `status.md` liên tục.

### Pha 5: Kiểm Chứng (Validation)
- Kiểm tra mã nguồn, chạy thử service độc lập.
- Thử nghiệm gọi API và kiểm tra giao diện Web.
- Kiểm tra lại bài test xóa DB -> gọi API -> khôi phục.

### Pha 6: Đóng Gói & Review Pull Request
- Chạy `./scripts/git-ship.sh scope` và commit đúng định dạng Conventional Commits.
- Đẩy nhánh lên Remote Git qua `./scripts/git-ship.sh push`.
- Techlead review và merge vào nhánh `develop`.
