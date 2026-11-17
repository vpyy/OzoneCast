# `.agents/notes/`: Bộ nhớ Quyết định Dự án OzoneCast

Bộ nhớ bền vững của dự án Khai phá Dữ liệu **OzoneCast**: mọi thay đổi không-tầm-thường (kiến trúc microservice, pipeline dữ liệu, thuật toán ML, schema DB, biểu đồ Web) đều bắt đầu bằng một proposal tại đây, đi kèm kế hoạch thực thi (`plan.md`) và trạng thái cập nhật liên tục (`status.md`).

Tài liệu quy trình chi tiết: [docs/workflow.md](../../docs/workflow.md).

---

## 1. Cấu trúc Thư mục

```text
.agents/notes/
├── README.md                     # File hướng dẫn này
├── proposed/                     # MỌI proposal kiến trúc/tính năng, không bao giờ di chuyển
│   ├── _TEMPLATE.md              # Khuôn mẫu chuẩn cho proposal mới
│   └── yyyy-mm-dd-<slug>-<handle>.md
├── implemented/                  # Kế hoạch & Trạng thái sau khi proposal được Approved
│   ├── _TEMPLATE/
│   │   ├── plan.md               # Bản kế hoạch triển khai (In/Out Scope, các bước)
│   │   └── status.md             # Trạng thái cập nhật tiến độ (planned -> in_progress -> validation -> completed)
│   └── yyyy-mm-dd-<slug>-<handle>/
│       ├── plan.md
│       └── status.md
└── bugs/                         # Nhật ký ghi nhận & giải quyết lỗi của hệ thống
    ├── README.md                 # Định nghĩa mức độ lỗi và quy trình xử lý
    ├── INDEX.md                  # Hướng dẫn tạo bảng tra cứu bug
    ├── _TEMPLATE.md              # Khuôn mẫu báo cáo bug
    └── BUG-<handle>-NNN-<slug>.md
```

---

## 2. Vòng đời Quyết định (Decision Lifecycle)

Quyết định được ghi nhận tại mục `## 9. Human Review` trong file proposal:

| `Decision:` | Metadata `Status:` | Ý nghĩa | Bước tiếp theo |
|---|---|---|---|
| `Pending` | `proposed` | Đang chờ Reviewer xem xét | Giữ nguyên. Agent và thành viên chưa bắt tay vào code. |
| `Changes Requested` | `changes_requested` | Cần chỉnh sửa/bổ sung giải pháp | Tác giả chỉnh sửa trực tiếp trên file, Reviewer đánh giá lại. |
| `Approved` | `approved` | Đã được phê duyệt | Tạo thư mục `implemented/<id>/` từ template để triển khai. |
| `Rejected` | `rejected` | Bị từ chối (kèm `Scope of Rejection:`) | Giữ lại trong `proposed/` làm negative knowledge (tránh lặp lại sai lầm). |

> **Lưu ý:** Nếu có quyết định mới thay thế quyết định cũ, ghi rõ `Overrides: <id>` trong phần `Related Proposals` của proposal mới. Bảng chỉ mục sẽ tự động đánh dấu proposal cũ là `superseded`. Không sửa nội dung file cũ.

---

## 3. Các Lệnh Tra Cứu & Kiểm Tra

Dự án trang bị công cụ tự động [scripts/notes_index.py](../../scripts/notes_index.py) (viết bằng Python thuần, không cần cài thêm thư viện):

```bash
# 1. Xem bảng tổng hợp mọi proposal (ID, Tiêu đề, Area, Quyết định, Trạng thái)
python scripts/notes_index.py

# 2. Xem bảng danh sách toàn bộ Bug
python scripts/notes_index.py --bugs

# 3. Kiểm tra tính nhất quán và hợp lệ của toàn bộ note (chạy trước khi commit/push)
python scripts/notes_index.py --check

# 4. Kiểm tra điều kiện mở cổng (Gate check) cho một tác vụ:
python scripts/notes_index.py --gate <id>

# 5. Tra cứu nhanh nội dung đã thảo luận về một chủ đề (ví dụ: clustering, prediction, api)
grep -ril "clustering" .agents/notes/proposed/ .agents/notes/implemented/

# 6. Tìm các phương án từng bị từ chối và phạm vi từ chối (Negative Knowledge)
grep -l "^Decision: Rejected" .agents/notes/proposed/*.md
grep -A2 "^Scope of Rejection" .agents/notes/proposed/*.md

# 7. Kiểm tra các bug nghiêm trọng (critical) đang mở
grep -l "Severity:\*\* critical" .agents/notes/bugs/BUG-*.md
```

---

## 4. Bảng Chỉ Mục (Index Table)

Bảng chỉ mục được **sinh tự động bằng script**, không nhập liệu thủ công để đảm bảo luôn đồng bộ 100% với mã nguồn và dữ liệu thực tế.
