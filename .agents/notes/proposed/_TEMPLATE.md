<!-- Template cho .agents/notes/proposed/yyyy-mm-dd-<slug>-<handle>.md
     Sao chép ra file mới khi có đề xuất kỹ thuật/kiến trúc mới. Không sửa trực tiếp file template này.
     Quy định chi tiết: docs/workflow.md.
     Agent và người thực hiện KHÔNG tự ý điền mục §9 (chỉ Reviewer được duyệt). -->

# Proposal: <Tên Đề xuất Ngắn gọn>

## Metadata
- ID: yyyy-mm-dd-<slug>-<handle>
- Author: agent | <handle>
- Created: yyyy-mm-dd
- Type: architecture | pipeline | ml-model | backend-api | frontend | devops | docs
- Status: proposed | changes_requested | approved | rejected (luôn đồng bộ với Decision ở §9)
- Priority: low | medium | high | critical
- Area: <ingestion | db | api | analysis | clustering | prediction | frontend | docker>
- Architecture Impact: none | docs/architecture.md | docs/patterns-spec.md | docker-compose.yml | ...
  (Nếu khác `none`, ghi rõ thông số/luồng dữ liệu nào trong tài liệu sẽ thay đổi để kiểm soát drift)
- Related Docs:
  - docs/patterns-spec.md §...
  - docs/architecture.md §...
- Related Proposals:
  - none | .agents/notes/proposed/<id>.md
  - Overrides: <id> (chỉ điền nếu đề xuất này thay thế hoàn toàn một quyết định trước đó)
- Related Bugs: none | BUG-<handle>-NNN

---

## 1. Vấn đề & Động lực
### Bối cảnh
Hệ thống OzoneCast hiện tại đang xử lý thế nào? (Ví dụ: dữ liệu thô, endpoint API, thuật toán phân cụm...)
### Vấn đề cần giải quyết
Điểm nghẽn hoặc yêu cầu đồ án nào chưa được đáp ứng? (Đối chiếu các yêu cầu trong slide đồ án KPDL).
### Tác động
Tại sao thay đổi này cần thiết đối với hệ thống và buổi demo đồ án?

---

## 2. Hiện trạng Kỹ thuật
Mô tả cách thức hiện tại (kèm sơ đồ luồng dữ liệu ASCII nếu cần, danh sách các file liên quan).

---

## 3. Mục tiêu & Giới hạn
- **Trong mục tiêu (In-Scope):** Những tính năng/mô-đun cụ thể sẽ triển khai.
- **Ngoài mục tiêu (Out-of-Scope):** Những gì cố tình KHÔNG đụng đến trong đề xuất này.

---

## 4. Giải pháp Đề xuất
- **Kiến trúc & Luồng xử lý:** Mô tả chi tiết cách giải quyết (dữ liệu vào -> xử lý -> kết quả vào DB/API).
- **Thuật toán / Công nghệ:** (Ví dụ: Random Forest, K-Means, Seasonal Decomposition, FastAPI, Docker Compose...).
- **Cấu hình & Tần suất:** (Ví dụ: 5 phút/lần đối với Ingestion/Analysis/Prediction, 1 ngày/lần đối với Clustering).

---

## 5. Các Phương án đã Cân nhắc
### Phương án A: <Tên phương án đề xuất>
- Ưu điểm: ...
- Nhược điểm: ...
- Lý do chọn: ...

### Phương án B: <Phương án thay thế>
- Ưu điểm / Nhược điểm: ...
- Lý do không chọn: ...

---

## 6. Đánh đổi (Trade-offs)
| Khía cạnh | Tác động | Lý do chấp nhận |
|---|---|---|
| Độ phức tạp | ... | ... |
| Thời gian tính toán / Độ trễ | ... | Phải đáp ứng kịch bản demo (chạy trong vài giây khi gọi API) |
| Tài nguyên bộ nhớ / Disk | ... | ... |
| Khả năng bảo trì & Mở rộng | ... | ... |

---

## 7. Rủi ro & Giải pháp Giảm thiểu
| Rủi ro kỹ thuật | Xác suất | Mức độ ảnh hưởng | Giải pháp kiểm soát |
|---|---|---|---|
| Lỗi mạng khi cào NASA Earthdata | Trung bình | Cao | Sử dụng cơ chế cache dữ liệu & mock granule dự phòng |
| API tính toán bị quá thời gian (timeout) | Thấp | Cao | Sử dụng mô hình đã tiền huấn luyện (pre-trained model), không train lại lúc demo |
| Lỗi xung đột schema database | Thấp | Trung bình | Sử dụng migration hoặc tạo bảng tự động có cấu trúc nhất quán |

---

## 8. Phương pháp Kiểm chứng (Verification)
Làm thế nào để xác minh đề xuất chạy đúng tiêu chuẩn đồ án?
1. Kiểm tra API: Endpoint nào trả về dữ liệu đúng schema?
2. Kiểm tra Database: Bảng nào được cập nhật dữ liệu sau khi chạy service?
3. Kiểm tra Web: Pattern nào hiển thị đúng trên biểu đồ Web Dashboard?
4. Kịch bản Demo: Có vượt qua bài test xóa DB bằng tay -> gọi API -> khôi phục dữ liệu không?

---

## 9. Human Review
Decision: Pending   <!-- Reviewer điền: Pending | Changes Requested | Approved | Rejected -->
Reviewer: -
Review Date: -
Comments:
Scope of Rejection: -   <!-- Bắt buộc khi Rejected: "Rejected for: <tình huống cụ thể>, không cấm hoàn toàn <công nghệ> trong bối cảnh khác." -->

---

## 10. Kế hoạch Tiếp theo (Next Action)
Chờ Reviewer phê duyệt.

<!-- Khi nhận trạng thái "Changes Requested": sửa trực tiếp nội dung phía trên và thêm mục ghi chú bên dưới:
### Revision yyyy-mm-dd
- Đã điều chỉnh những điểm gì theo phản hồi của reviewer.
-->
