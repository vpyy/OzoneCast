# Quy Chuẩn Quản Lý Mã Nguồn Git (Git Workflow)

Tài liệu hướng dẫn quy trình làm việc Git dành cho nhóm 5 thành viên dự án OzoneCast: **Hữu Sáng** (`huusang`), **Văn Phúc** (`vanphuc`), **Văn Trung** (`vantrung`), **Viết An** (`vietan`), **Phúc An** (`phucan`).

---

## 1. Cấu Trúc Nhánh (Branch Strategy)

- **`main`:** Nhánh phát hành chính thức, chứa mã nguồn hoàn chỉnh, ổn định và sẵn sàng cho buổi chấm thi. Chỉ Techlead (`huusang`) được merge vào nhánh này.
- **`develop`:** Nhánh tích hợp làm việc chung của cả nhóm. Mọi tính năng sau khi được kiểm thử sẽ được merge vào đây.
- **`<type>/<id>`:** Nhánh tính năng hoặc sửa lỗi của từng thành viên:
  - `<type>`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
  - `<id>`: Mã proposal hoặc bug, có định dạng `yyyy-mm-dd-<slug>-<handle>` (ví dụ: `feat/2026-11-20-db-api-vanphuc`).

---

## 2. Quy Chuẩn Đặt Tên Commit (Conventional Commits)

Định dạng commit bắt buộc:

```text
<type>(<scope>): <mô tả ngắn bằng tiếng Anh hoặc tiếng Việt> (<id>)
```

- `<type>`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- `<scope>`: `ingestion`, `db`, `api`, `analysis`, `clustering`, `prediction`, `frontend`, `docker`, `docs`.
- `<id>`: Mã proposal (`2026-11-20-...`) hoặc mã lỗi (`BUG-<handle>-NNN`).

**Ví dụ hợp lệ:**
- `feat(api): add endpoints for timeseries and trend patterns (2026-11-20-db-api-vanphuc)`
- `fix(crawler): handle missing quality flags in hdf5 parser (BUG-vantrung-001)`
- `feat(frontend): integrate chart zoom and filter controls (2026-11-21-chart-zoom-vietan)`

---

## 3. Lệnh Git An Toàn Thông Qua `git-ship.sh`

Để tránh các sai sót ngoài ý muốn, mọi thao tác Git khuyến nghị thực hiện qua script [scripts/git-ship.sh](../../scripts/git-ship.sh):

```bash
# 1. Khai báo danh tính làm việc
./scripts/git-ship.sh me phucan

# 2. Tạo nhánh làm việc mới từ develop
./scripts/git-ship.sh start feat/2026-11-20-docker-setup-phucan

# 3. Xem trạng thái các file đã thay đổi
./scripts/git-ship.sh status

# 4. Kiểm tra phạm vi các file so với nhánh develop
./scripts/git-ship.sh scope

# 5. Cập nhật nhánh của mình với develop mới nhất
./scripts/git-ship.sh update

# 6. Đẩy nhánh lên Remote
./scripts/git-ship.sh push

# 7. Đồng bộ develop sau khi Pull Request đã được merge
./scripts/git-ship.sh sync
```
