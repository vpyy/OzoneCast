# `.agents/notes/bugs/`: Nhật Ký Theo Dõi Lỗi (Bug Tracking)

Thư mục ghi nhận có cấu trúc mọi lỗi được phát hiện trong quá trình phát triển hệ thống **OzoneCast**. Trước khi bắt tay vào debug bất kỳ lỗi nào, **luôn tra cứu trong thư mục này trước** để tránh trùng lặp hoặc điều tra lại lỗi đã được xử lý.

Thư mục này quản lý lỗi thực tế phát sinh, tách biệt khỏi vòng đời của các đề xuất kiến trúc (proposals).

---

## 1. Cấu trúc Thư mục

```text
bugs/
├── README.md                 # Hướng dẫn này
├── INDEX.md                  # Hướng dẫn tạo bảng tra cứu
├── _TEMPLATE.md              # Template khi phát hiện bug mới
└── BUG-<handle>-NNN-<slug>.md # Mỗi bug lưu ở 1 file độc lập
```

---

## 2. Quy tắc Đặt Mã Lỗi (Bug ID)

Mã lỗi có định dạng: `BUG-<handle>-NNN`:
- `<handle>`: Định danh của thành viên ghi nhận bug (theo bảng [team.md](../team.md), ví dụ: `huusang`, `vanphuc`, `vantrung`, `vietan`, `phucan`).
- `NNN`: Số thứ tự 3 chữ số tăng dần của riêng thành viên đó (`001`, `002`, `003`...).
- Tên file: `BUG-<handle>-NNN-<slug-tieng-anh-ngan>.md` (ví dụ: `BUG-vantrung-001-crawler-netcdf-missing-dim.md`).
- **Tuyệt đối không tái sử dụng mã ID**, kể cả với các bug bị trùng (`duplicate`) hoặc không hợp lệ (`invalid`).

Mã lỗi này phải được dẫn chiếu xuyên suốt trong commit Git (`fix(api): fix missing correlation data (BUG-vanphuc-002)`), trong mã nguồn test hồi quy, và trong proposal/plan liên quan.

---

## 3. Phân cấp Mức độ Nghiêm trọng (Severity)

| Mức độ | Định nghĩa | Ví dụ thực tế trong OzoneCast | Cách xử lý |
|---|---|---|---|
| `critical` | Hệ thống dừng hoạt động; mất mát dữ liệu; lộ thông tin nhạy cảm; kịch bản demo bị gãy (không khôi phục được DB qua API backend). | Docker compose không thể khởi động; API backend trả về 500 khi nhấn nút Run; rò rỉ NASA SSO token vào git; database SQLite bị khóa cứng (database locked) đa luồng. | **Dừng toàn bộ việc khác để sửa ngay.** Báo cáo ngay cho nhóm. Dòng đầu phản hồi của Agent phải là: `CRITICAL BUG: BUG-<handle>-NNN — <tiêu đề>`. Bắt buộc có kiểm thử hồi quy. |
| `high` | Một trong các khối chức năng chính (Ingestion, Analysis, Clustering, Prediction) bị tính toán sai hoặc lỗi; API thiếu endpoint cốt lõi; Frontend không hiển thị được pattern yêu cầu. | Thuật toán Trend tính ra chuỗi rỗng; Ma trận correlation bị lỗi chia cho 0; Model prediction dự đoán ra giá trị âm hoặc vượt ngưỡng vật lý (DU ngoài dải 100-600); Biểu đồ Web không zoom/filter được. | Sửa trong đợt phát triển hiện tại hoặc sprint kế tiếp trước khi tích hợp hệ thống. |
| `medium` | Lỗi chức năng nhỏ có phương án né tạm thời; sai lệch giữa tài liệu kiến trúc và API contract; giao diện hiển thị lệch nhãn dữ liệu. | F12 báo cảnh báo console nhưng biểu đồ vẫn lên; API trả về dư field không dùng; bảng thống kê bị sai format ngày tháng; icon trên Leaflet map bị lệch vị trí. | Lên lịch sửa trong kế hoạch làm việc thông thường. |
| `low` | Lỗi thẩm mỹ, chính tả, sai font chữ hoặc định dạng văn bản. | Sai chính tả trong phần mô tả popup; màu sắc heatmap chưa đồng bộ; lề của thẻ biểu đồ bị lệch vài pixel. | Sửa khi thuận tiện hoặc lúc tinh chỉnh UI cuối kỳ. |

---

## 4. Vòng đời Trạng thái (Bug Status)

- `open`: Lỗi mới được ghi nhận, đang chờ xác minh.
- `investigating`: Đang tái hiện và phân tích nguyên nhân gốc rễ.
- `fix-in-progress`: Đã rõ nguyên nhân, đang viết mã sửa lỗi và test.
- `fixed`: Đã sửa xong và đã kiểm chứng thành công (test pass, kịch bản chạy trơn tru).
- `wont-fix`: Quyết định có chủ đích không sửa (bắt buộc nêu rõ lý do kỹ thuật).
- `duplicate`: Trùng với một lỗi đã có (ghi rõ `Duplicate of: BUG-<handle>-NNN`).
- `invalid`: Không phải là lỗi của hệ thống (ghi rõ lý do giải thích).

---

## 5. Lệnh Sinh Bảng Tra Cứu Tự Động

```bash
# Xem danh sách tất cả các bug trong dự án:
python scripts/notes_index.py --bugs
```
