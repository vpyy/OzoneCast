<!-- Template cho .agents/notes/implemented/yyyy-mm-dd-<slug>-<handle>/status.md
     Tệp tài liệu sống, phản ánh chính xác tiến độ thực tế.
     Vòng đời trạng thái: planned → in_progress ⇄ blocked → validation → completed.
     Quy định chi tiết: docs/workflow.md. -->

# Implementation Status: <Tên Tác vụ Triển khai>

## Metadata
- ID: yyyy-mm-dd-<slug>-<handle>
- Status: planned | in_progress | blocked | validation | completed
- Started: yyyy-mm-dd
- Last Updated: yyyy-mm-dd
- Owner: agent | <handle>

---

## 1. Tiến độ Thực tế
- **Tiến độ tổng quan:** NN%
- **Giai đoạn hiện tại:** <Bước đang thực hiện trong plan.md>

### Đã hoàn thành (Completed):
- [x] ...

### Đang tiến hành (In Progress):
- [/] ...

### Đang bị chặn (Blocked):
- [ ] ... *(Nếu có, ghi rõ nguyên nhân và người cần hỗ trợ giải quyết).*

---

## 2. Bảng Kiểm chứng Kết quả (Validation Results)
| Nội dung kiểm tra | Trạng thái (PASS / FAIL / NOT_RUN) | Chi tiết & Lệnh thực thi |
|---|---|---|
| Chạy service độc lập | PASS | `python -m src...` chạy mượt mà, log ghi rõ |
| Database query | PASS | Đã ghi nhận bản ghi mới trong bảng liên quan |
| API Endpoint response | PASS | `curl -X GET http://localhost:8000/api/...` trả về đúng cấu trúc |
| Web Dashboard hiển thị | PASS | Biểu đồ tải dữ liệu chuẩn, không lỗi console |
| Kịch bản Demo phòng thi | PASS | Xóa DB -> báo lỗi -> bấm chạy backend API -> hồi phục |

---

## 3. Các vấn đề Đã biết (Known Issues)
- <Mô tả lỗi> — Mức độ ảnh hưởng / Cách khắc phục tạm thời / Mã bug `BUG-<handle>-NNN` (nếu có).

---

## 4. Độ lệch so với Kế hoạch ban đầu (Deviations From Plan)
Ghi nhận nếu trong quá trình code có điểm khác biệt so với `plan.md`:
- **Dự kiến:** ...
- **Thực tế làm:** ...
- **Lý do thay đổi:** ...

---

## 5. Quyết định Kỹ thuật Phát sinh khi Code
- Ghi lại các quyết định nhỏ (như đặt tên biến, thư viện phụ, giải thuật phụ trợ) được quyết định trong lúc code.

---

## 6. Các Bước Tiếp theo (Next Actions)
- ...

---

## 7. Nhật ký Cập nhật (Change Log)
- yyyy-mm-dd — Cập nhật trạng thái...
