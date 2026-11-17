# Proposal: Thiết Lập Hệ Thống Agent Workflow & Bộ Nhớ Quyết Định Cho Dự Án OzoneCast

## Metadata
- ID: 2026-11-17-001-agent-workflow-setup-phucan
- Author: phucan
- Created: 2026-11-17
- Type: infrastructure
- Status: approved
- Priority: high
- Area: agents / workflow / docs
- Architecture Impact: AGENTS.md, docs/architecture.md, docs/patterns-spec.md, docs/demo-guide.md
- Related Docs:
  - docs/workflow.md
  - docs/coding-rules.md
- Related Proposals: none
- Related Bugs: none

---

## 1. Vấn đề & Động lực
### Bối cảnh
Dự án OzoneCast là đồ án cuối kỳ môn Khai Phá Dữ Liệu (KPDL) của nhóm 5 sinh viên (Hữu Sáng, Văn Phúc, Văn Trung, Viết An, Phúc An) dưới sự hướng dẫn của TS. Phạm Tuấn.
### Vấn đề cần giải quyết
Hệ thống đòi hỏi phân rã thành nhiều microservices độc lập (Slide 2), hỗ trợ 6+ patterns dữ liệu chuỗi thời gian (Slide 3) và kịch bản demo phòng thi nghiêm ngặt (Slide 5, 10). Cần một quy trình làm việc chuẩn hóa cho cả người và AI Agent để phát triển song song mà không xung đột mã nguồn.
### Tác động
Giúp 5 thành viên làm việc độc lập đúng phân công trách nhiệm, các quyết định kiến trúc được lưu vết bền vững, và đảm bảo đáp ứng đầy đủ tiêu chí chấm điểm tối đa (10 điểm chuẩn + 2 điểm cộng).

---

## 2. Hiện trạng Kỹ thuật
Trước đó dự án chỉ có các script crawler, etl, ml đơn lẻ trong thư mục `src/`, chưa có sự phân rã microservice độc lập theo sơ đồ Slide 2, chưa có REST API riêng cho patterns và chưa có kịch bản demo kiểm soát DB.

---

## 3. Mục tiêu & Giới hạn
- **In Scope:**
  - Thiết lập bộ nhớ quyết định `.agents/notes/` (`proposed/`, `implemented/`, `bugs/`).
  - Phân công rõ 5 vai trò trong `.agents/team.md`.
  - Ban hành quy chuẩn `AGENTS.md` và các Invariants cứng (I1–I9).
  - Biên soạn tài liệu kiến trúc [docs/architecture.md](../../docs/architecture.md), [docs/patterns-spec.md](../../docs/patterns-spec.md), [docs/demo-guide.md](../../docs/demo-guide.md).
  - Tự động hóa kiểm tra tính nhất quán qua `scripts/notes_index.py` và `scripts/git-ship.sh`.
- **Out of Scope:** Chưa viết mã cụ thể cho giao diện frontend hoặc thuật toán clustering mới trong đợt này.

---

## 4. Giải pháp Đề xuất
- Kế thừa mô hình Agent Workflow chuyên nghiệp đã kiểm chứng từ dự án GoDine.
- Tùy biến toàn bộ danh tính, vai trò và quy tắc kỹ thuật bám sát yêu cầu đề bài Đồ án KPDL.

---

## 5. Các Phương án đã Cân nhắc
- **Phương án A (Chọn):** Hệ thống hóa bằng `.agents/` + `AGENTS.md` + 4 Skills Claude/Agent + Script kiểm tra. Phù hợp cho nhóm sinh viên làm việc phối hợp với AI.
- **Phương án B:** Chỉ viết ghi chú trong README chung. Nhược điểm: Dễ bị trôi quyết định, không kiểm soát được scope và kịch bản demo phòng thi.

---

## 6. Đánh đổi (Trade-offs)
| Khía cạnh | Tác động | Lý do chấp nhận |
|---|---|---|
| Thời gian chuẩn bị ban đầu | Tốn thời gian tạo tài liệu quy chuẩn | Giúp cả nhóm tiết kiệm nhiều ngày phát triển và tránh lỗi xung đột |
| Kỷ luật ghi chép | Bắt buộc viết proposal trước khi làm | Đảm bảo hệ thống đạt điểm tối đa ở tiêu chí "Tổ chức code tốt" |

---

## 7. Rủi ro & Giải pháp Giảm thiểu
- **Rủi ro:** Thành viên chưa quen với quy trình note và git ship.
- **Giảm thiểu:** Viết sẵn script tự động `notes_index.py` và `git-ship.sh` với thông báo tiếng Việt rõ ràng, dễ hiểu.

---

## 8. Phương pháp Kiểm chứng (Verification)
1. Chạy `python scripts/notes_index.py --check` trả về mã 0 và thông báo nhất quán.
2. Kiểm tra các file tài liệu hướng dẫn đầy đủ, liên kết chặt chẽ.

---

## 9. Human Review
Decision: Approved
Reviewer: huusang
Review Date: 2026-11-17
Comments: Phê duyệt thiết lập ban đầu. Phân công vai trò 5 thành viên rõ ràng, bám sát các yêu cầu slide của Thầy Tuấn.
Scope of Rejection: -

---

## 10. Kế hoạch Tiếp theo (Next Action)
Tiến hành hoàn thiện các tầng dịch vụ (FastAPI Database API, Ingestion 5 phút, Analysis/Clustering/Prediction services và Web Dashboard).
