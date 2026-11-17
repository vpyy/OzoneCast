# BUG-<handle>-NNN: <Tiêu đề một dòng — mô tả hiện tượng, không mô tả cách sửa>

- **Status:** open | investigating | fix-in-progress | fixed | wont-fix | duplicate | invalid
- **Severity:** critical | high | medium | low   <!-- Xem định nghĩa chi tiết tại bugs/README.md -->
- **Area:** <crawler | ingestion | db | api | analysis | clustering | prediction | frontend | docker>
- **Reported:** yyyy-mm-dd — <Người/Agent phát hiện: user, test, code review, demo trial>
- **Fixed:** yyyy-mm-dd — <commit SHA hoặc PR> (để trống cho tới khi trạng thái chuyển sang `fixed`)
- **Related:** <Proposal liên quan, BUG-<handle>-NNN khác, hoặc "none">
- **Duplicate of:** <BUG-<handle>-NNN — chỉ điền khi Status là `duplicate`>

---

## 1. Triệu chứng & Hiện tượng Lỗi
Mô tả chính xác điều bất thường quan sát được. Trích dẫn nguyên văn mã lỗi, log terminal hoặc phản hồi sai lệch từ API / Web.

```text
[Dán log hoặc stack trace ở đây nếu có]
```

---

## 2. Các Bước Tái Hiện Lỗi (Reproduction Steps)
Các bước tối thiểu bằng dữ liệu mẫu hoặc thao tác cụ thể:
1. Bước 1: ...
2. Bước 2: ...
3. Bước 3: ...

- **Kết quả mong đợi:** ...
- **Kết quả thực tế:** ...

---

## 3. Nguyên nhân Gốc rễ (Root Cause)
Giải thích cơ chế dẫn tới lỗi (vị trí file, dòng mã nguồn cụ thể, điều kiện biên chưa kiểm soát). Có thể ghi "Chưa rõ" khi đang ở trạng thái `open` hoặc `investigating`.

---

## 4. Giải pháp Sửa chữa (Fix Details)
Mô tả những gì đã được chỉnh sửa và lý do tại sao giải pháp này giải quyết triệt để lỗi gốc rễ (không chỉ ẩn triệu chứng). Danh sách các file bị tác động.
*(Với `wont-fix` hoặc `invalid`: giải trình lý do cụ thể tại mục này).*

---

## 5. Quy trình Kiểm chứng Sau khi Sửa (Verification)
Lệnh test hoặc thao tác tái hiện chứng minh lỗi đã được giải quyết hoàn toàn (thất bại trước khi sửa, thành công sau khi sửa).

---

## 6. Lịch sử Cập nhật (History)
- yyyy-mm-dd — Ghi nhận lỗi lần đầu (status: open).
