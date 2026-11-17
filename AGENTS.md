# AGENTS.md — Quy Chuẩn AI Agent cho Dự Án OzoneCast

Tài liệu quy định thống nhất cho **mọi AI Agent** tham gia phát triển dự án (Claude, Gemini, Cursor, Copilot, Codex...). Mọi file cấu hình riêng của từng công cụ (như `CLAUDE.md`, `.cursorrules`, v.v.) chỉ được trỏ về file này. Khi cần điều chỉnh quy chuẩn, chỉ sửa đổi tại **file này**.

---

## 1. Tổng Quan Dự Án OzoneCast

- **Tên dự án:** OzoneCast — Hệ Thống Tự Động Hóa Thu Thập, Khai Phá & Dự Báo Nồng Độ Ozone Khí Quyển Từ Dữ Liệu Vệ Tinh NASA.
- **Học phần:** Khai Phá Dữ Liệu (KPDL) — Đồ Án Cuối Kỳ (GVHD: TS. Phạm Tuấn, Trường Đại Học Sư Phạm Kỹ Thuật TP.HCM - UTE).
- **Kiến trúc hệ thống (Bắt buộc theo Slide 2 Đồ án):**
  1. **Data Source:** Dữ liệu chuỗi thời gian (Time-series) nồng độ Ozone (Tổng cột Ozone - Dobson Units) có cập nhật từ vệ tinh NASA Aura (cảm biến OMI) và Suomi-NPP (cảm biến OMPS).
  2. **Data Ingestion:** Dịch vụ tự động cào và nạp dữ liệu (5 phút lấy dữ liệu 1 lần) lưu trữ qua tầng Medallion (Bronze: HDF-EOS5 thô -> Silver: Parquet sạch).
  3. **Database:** Lưu trữ tập trung dữ liệu đo đạc, log thu thập, chỉ số phân tích, nhãn phân cụm và kết quả dự báo.
  4. **Database API:** Dịch vụ REST API độc lập (FastAPI) cung cấp dữ liệu cho Frontend và các Backend Services.
  5. **Backend Services (Mỗi khối chạy ở một terminal / container độc lập):**
     - **Data Analysis Service:** Chạy định kỳ 5 phút/lần hoặc kích hoạt qua API: Tạo dữ liệu biểu đồ thời gian (ngày, tuần, tháng), Trend (resampling tháng/tuần), Seasonal line, Ma trận Correlation giữa các biến.
     - **Clustering Service:** Chạy 1 ngày/lần hoặc kích hoạt qua API: Phân cụm nồng độ Ozone theo khu vực địa lý / mức độ tập trung khí quyển (K-Means, DBSCAN).
     - **Prediction Service:** Chạy định kỳ 5 phút/lần hoặc kích hoạt qua API: Dự đoán nồng độ Ozone ngày mai (Hồi quy) + Phân loại mức cảnh báo chất lượng không khí ngày mai (Phân loại: Tốt, Trung bình, Nguy hại).
  6. **Front End:** Giao diện Web thẩm mỹ cao, hiển thị đầy đủ các patterns, hỗ trợ Zoom & Filter, nạp dữ liệu qua API (kiểm tra qua F12).

---

## 2. Đội Ngũ Phát Triển (5 Thành Viên)

Chi tiết đầy đủ xem tại [.agents/team.md](.agents/team.md):

| Handle | Họ và Tên | Vai trò | Trọng tâm phụ trách |
|---|---|---|---|
| `huusang` | **Hữu Sáng** | **Team Leader / Data Science & ML Lead** | Thuật toán Prediction, Classification, Clustering, Review & Merge Code |
| `vanphuc` | **Văn Phúc** | **Backend & Database API Lead** | Thiết kế Database Schema, Migrations, FastAPI Service, REST Endpoints |
| `vantrung` | **Văn Trung** | **Data Ingestion & Analytics Lead** | Crawler NASA 5 phút/lần, ETL Bronze/Silver, Service Data Analysis (Trend, Seasonality, Correlation) |
| `vietan` | **Viết An** | **Frontend & UI/UX Lead** | Web Dashboard thẩm mỹ cao, Interactive Charts (Zoom/Filter), Leaflet Heatmap |
| `phucan` | **Phúc An** | **DevOps, System Architecture & QA/Demo Lead** | Docker Compose đa dịch vụ, Kịch bản Demo phòng thi (Slide 5 & 10), Cloud Deployment |

- Lần đầu làm việc, Agent đọc file [`.agents/me`](.agents/me) để xác định người dùng hiện tại (mặc định: `phucan`). Không tự đoán từ cấu hình Git.
- Mọi Pull Request / Đề xuất kiến trúc quan trọng phải gán `huusang` (Techlead) hoặc người chủ trì mảng đó làm Reviewer.

---

## 3. Sổ Tay Lệnh Thực Thi Cốt Lõi

```bash
# 1. Khởi tạo môi trường & Database
cp .env.example .env
python main.py init-db

# 2. Khởi chạy toàn bộ hệ thống bằng Docker Compose (Khuyến nghị cho Demo)
docker compose up -d --build

# 3. Chạy từng dịch vụ độc lập ở từng Terminal (Theo đúng yêu cầu Slide 2)
# Terminal 1: Database API
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Data Ingestion (Chu kỳ 5 phút/lần)
python -m src.pipeline.scheduler --mode ingestion --interval 5

# Terminal 3: Data Analysis Service (Chu kỳ 5 phút/lần)
python -m src.analytics.service --interval 5

# Terminal 4: Clustering Service (Chu kỳ 1 ngày/lần hoặc chạy 1 shot)
python -m src.ml.clustering_service --run-once

# Terminal 5: Prediction Service (Chu kỳ 5 phút/lần)
python -m src.ml.prediction_service --interval 5

# Terminal 6: Frontend Web Dashboard
# (Tùy chọn Vite/Next hoặc Server tĩnh Web Dashboard)
python -m http.server 3000 --directory frontend

# 4. Quản lý Đề xuất & Bộ nhớ Quyết định
python scripts/notes_index.py           # Xem bảng tổng hợp proposal
python scripts/notes_index.py --bugs    # Xem bảng danh sách bug
python scripts/notes_index.py --check   # Kiểm tra tính hợp lệ của .agents/notes/
python scripts/notes_index.py --gate <id> # Kiểm tra gate trước khi push nhánh

# 5. Thao tác Git an toàn
./scripts/git-ship.sh start feat/<id>   # Tạo nhánh mới từ develop
./scripts/git-ship.sh status            # Kiểm tra trạng thái commit/nhánh
./scripts/git-ship.sh scope             # Kiểm tra các file đã thay đổi so với develop
./scripts/git-ship.sh update            # Đồng bộ nhánh hiện tại với develop mới nhất
./scripts/git-ship.sh push              # Đẩy nhánh và gợi ý tạo PR
```

---

## 4. Bất Biến Cứng (Invariants Không Thể Vi Phạm)

Tài liệu chi tiết: [docs/coding-rules.md](docs/coding-rules.md).

- **I1 (Decoupled Microservices):** Các khối Ingestion, Database API, Data Analysis, Clustering, Prediction và Frontend phải hoạt động độc lập, có thể chạy ở các terminal riêng rẽ hoặc các Docker container riêng biệt.
- **I2 (Single Gateway):** Mọi giao tiếp đọc/ghi dữ liệu của Frontend và các Backend Services đối với dữ liệu phân tích/patterns đều phải thông qua Database API. Frontend KHÔNG được đọc trực tiếp file nhị phân HDF5/NetCDF.
- **I3 (Pattern Completeness):** Phải đảm bảo đầy đủ tối thiểu 6 nhóm patterns theo Slide 3:
  1. Biểu đồ theo thời gian (Line chart, Scatter, Histogram) với 3 quãng: Ngày, Tuần, Tháng (có Zoom & Filter).
  2. Đường xu hướng (Trend) sau khi resampling theo Tháng/Tuần.
  3. Đường thời vụ (Seasonal line) sau khi resampling theo Tháng/Tuần.
  4. Ma trận tương quan (Correlation matrix) giữa các thuộc tính.
  5. Dự đoán nồng độ Ozone ngày mai (Time-series Prediction / Regression).
  6. Phân loại mức cảnh báo chất lượng khí quyển ngày mai (Classification).
  7. Phân cụm dữ liệu (Clustering) theo khu vực / mức độ tập trung nồng độ.
- **I4 (Demo Compliance):** Các Backend services phải cung cấp endpoint kích hoạt (`POST /api/services/run-...`) để chạy mô hình AI đã nạp sẵn (pre-built model, không train lại lúc demo), sẵn sàng phục vụ bài thi xóa DB -> gọi API -> khôi phục web.
- **I5 (Interactive Web & Aesthetic):** Web UI phải có tính thẩm mỹ cao, nạp dữ liệu hoàn toàn từ API (kiểm tra F12 không có lỗi), có thanh lọc thời gian và tính năng zoom biểu đồ.
- **I6 (Credential & Data Security):** Mọi tài khoản NASA Earthdata và Database credentials chỉ lưu tại file `.env` (không commit lên Git). Tuyệt đối không commit file nhị phân lớn (`.he5`, `.nc` > 50MB) lên repo.
- **I7 (Offline Resilience & Mock Data):** Luôn duy trì module `src/utils/mock_granule.py` để sinh dữ liệu mẫu hợp lệ phòng trường hợp mất mạng hoặc NASA API bảo trì trong buổi chấm thi.
- **I8 (Database Integrity):** Mọi bảng dữ liệu phải có định dạng timestamp ISO chuẩn, lưu vết `created_at`, có cơ chế chống trùng lặp dữ liệu (`idempotency`).
- **I9 (Decision Memory):** Mọi thay đổi lớn về kiến trúc hoặc giải thuật phải có file đề xuất trong `.agents/notes/proposed/` và chỉ triển khai khi đã được Reviewer chuyển sang `Approved`.

---

## 5. Kịch Bản Buổi Báo Cáo Demo (Bắt Buộc theo Slide 5 & 10)

Mọi thành viên và Agent khi phát triển đều phải đảm bảo hệ thống vượt qua quy trình kiểm tra thực tế 7 bước của Giảng viên:

1. **Bước 1:** Trình chiếu màn hình xác nhận đã xóa sạch các Docker container cũ.
2. **Bước 2:** Chạy lệnh `docker compose up -d` (hoặc khởi động các terminal độc lập).
3. **Bước 3:** Mở trình duyệt Web -> Hiển thị đầy đủ các biểu đồ, bấm `F12` kiểm tra các API calls trả về mã `200 OK`.
4. **Bước 4:** Xóa sạch dữ liệu các pattern trong Database bằng tay (qua SQLite/Postgres client hoặc lệnh CLI).
5. **Bước 5:** Tải lại trang Web -> Trang Web hiển thị trạng thái thiếu dữ liệu / lỗi một cách rõ ràng.
6. **Bước 6:** Mở API docs (Swagger UI tại `http://localhost:8000/docs`) hoặc gọi endpoint của các Backend Services (Data Analysis, Clustering, Prediction) và nhấn **Run** (mô hình đã build sẵn, chạy suy luận trong vài giây) -> Kiểm tra lại Database thấy dữ liệu đã được tái xử lý và ghi mới.
7. **Bước 7:** Tải lại trang Web -> Toàn bộ biểu đồ và chỉ số phân tích xuất hiện trở lại hoàn chỉnh.

---

## 6. Ngôn Ngữ Quy Định

- **Tài liệu & Thảo luận (`.md`):** Viết bằng **tiếng Việt** trong sáng, chuẩn thuật ngữ kỹ thuật.
- **Mã nguồn (Source Code):** Tên file, tên class, hàm, biến viết bằng **tiếng Anh**.
- **Khóa máy đọc trong Note:** Giữ nguyên tiếng Anh (`Decision:`, `Status:`, `## 9. Human Review`, `Severity:`, `Overrides:`...).

---

## 7. Ranh Giới Quyền Hạn của Agent

- **Được phép:** Đọc mã nguồn, viết mã và kiểm thử; tạo proposal và kế hoạch triển khai; cập nhật `status.md` và `bugs/`; chạy các script kiểm tra chất lượng.
- **Không được phép (trừ khi có lệnh rõ ràng của người dùng):**
  - Tự ý thay đổi mục `## 9. Human Review` (chỉ Reviewer là con người điền).
  - Bắt tay vào viết mã cho một proposal đang ở trạng thái `Pending` hoặc `Rejected`.
  - Thực hiện lệnh Git nguy hiểm (`git push --force`, `git reset --hard`, commit thẳng vào `main`).
  - Xóa dữ liệu môi trường dev (`docker compose down -v`) mà chưa hỏi ý kiến người dùng.
