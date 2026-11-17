# Đặc Tả 6+ Patterns Dữ Liệu Bắt Buộc (Data Patterns Specification)

Tài liệu chi tiết hóa toàn bộ các mẫu hình phân tích (Patterns) bắt buộc phải có trong giao diện Web và Database API theo yêu cầu tại **Slide 3** và **Slide 8** của môn học Khai Phá Dữ Liệu (KPDL).

Dữ liệu của OzoneCast là **Dữ liệu Chuỗi Thời Gian (Time-series Data)** đo nồng độ tầng Ozone khí quyển (Dobson Units - DU).

---

## Danh Sách Chi Tiết Các Patterns

### 1. Pattern 1: Trực Quan Hóa Dữ Liệu Theo Thời Gian (Time-series Charts)
Bắt buộc vẽ 3 loại biểu đồ khác nhau theo 3 quãng thời gian (Ngày, Tuần, Tháng):

- **1a. Line Chart (Biểu đồ đường):**
  - Trục X: Thời gian quét vệ tinh (giờ trong ngày, các ngày trong tuần, các ngày trong tháng).
  - Trục Y: Nồng độ Ozone trung bình (DU).
  - Yêu cầu: Đường biểu diễn liên tục, làm nổi bật sự dao động tăng giảm nồng độ trong chu kỳ.
- **1b. Scatter Plot (Biểu đồ phân tán):**
  - Trục X: Thời gian.
  - Trục Y: Giá trị của từng điểm đo thực tế của vệ tinh.
  - Yêu cầu: Thể hiện độ phân tán của dữ liệu quan sát, phát hiện các điểm dị biệt (outliers).
- **1c. Histogram (Biểu đồ tần suất):**
  - Trục X: Các khoảng nồng độ Ozone (ví dụ: các khoảng 200-250 DU, 250-300 DU, 300-350 DU...).
  - Trục Y: Số lượng điểm đo rơi vào từng khoảng giá trị.
  - Yêu cầu: Quan sát dạng phân phối xác suất của nồng độ Ozone (phân phối chuẩn, lệch trái hay lệch phải).

> **Điểm cộng (Slide 6):** Các biểu đồ chuỗi thời gian phải hỗ trợ tính năng **Zoom** (phóng to chi tiết) và **Filter** (chọn dải thời gian linh hoạt).

---

### 2. Pattern 2: Đường Xu Hướng Dài Hạn (Trend Line)
- **Phương pháp tính toán:** Dữ liệu chuỗi thời gian được lấy mẫu lại (**Resampling**) theo chu kỳ Tháng (hoặc Tuần nếu tập dữ liệu ngắn hơn). Áp dụng phương pháp Moving Average (Trung bình trượt) hoặc mô hình hồi quy xu hướng để loại trừ biến động ngắn hạn.
- **Biểu đồ:** Biểu đồ đường thể hiện xu hướng tổng quan của tầng Ozone (tăng, giảm hay đi ngang theo các tháng trong năm).
- **Ý nghĩa KPDL:** Cho thấy sự phục hồi hoặc suy giảm tổng thể của lớp Ozone bảo vệ Trái Đất.

---

### 3. Pattern 3: Đường Chu Kỳ Thời Vụ (Seasonal Line)
- **Phương pháp tính toán:** Sử dụng giải thuật phân rã chuỗi thời gian (**Seasonal Decomposition / STL Decomposition**) trên dữ liệu đã resampling theo Tháng/Tuần.
  $$\text{Observed}(t) = \text{Trend}(t) + \text{Seasonal}(t) + \text{Residual}(t)$$
- **Biểu đồ:** Đường biến thiên mùa vụ lặp lại (Seasonality curve), thể hiện quy luật nồng độ Ozone đạt đỉnh vào mùa nào và giảm thấp vào mùa nào trong năm.
- **Ý nghĩa KPDL:** Phản ánh ảnh hưởng của bức xạ mặt trời và các luồng gió tầng bình lưu theo mùa.

---

### 4. Pattern 4: Ma Trận Tương Quan Giữa Các Biến (Correlation Matrix)
- **Các biến phân tích:**
  1. `ColumnAmountO3`: Tổng nồng độ cột khí quyển Ozone (DU).
  2. `Latitude`: Vĩ độ địa lý (khoảng cách tới xích đạo / cực).
  3. `SolarZenithAngle` / `Radiation`: Góc chiếu mặt trời hoặc cường độ bức xạ.
  4. `CloudFraction`: Tỷ lệ che phủ mây.
  5. `DayOfYear`: Ngày thứ mấy trong năm.
- **Phương pháp tính:** Hệ số tương quan Pearson hoặc Spearman giữa tất cả các cặp biến:
  $$r_{xy} = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2 \sum (y_i - \bar{y})^2}}$$
- **Biểu đồ:** Heatmap ma trận vuông ($N \times N$) với thang màu trực quan từ $-1.0$ (tương quan nghịch màu xanh) đến $+1.0$ (tương quan thuận màu đỏ).

---

### 5. Pattern 5: Dự Đoán Nồng Độ Cho Ngày Mai (Time-series Prediction)
- **Mục tiêu:** Đưa ra giá trị dự báo cụ thể của nồng độ Ozone trung bình cho **ngày tiếp theo (ngày mai)**.
- **Thuật toán:** Machine Learning Hồi quy (Random Forest Regressor, XGBoost hoặc Ridge Regression) huấn luyện trên các đặc trưng độ trễ (Lag features $t-1, t-2$, rolling mean 7 ngày, vĩ độ, ngày trong năm).
- **Hiển thị trên Web:** Thẻ thông số nổi bật (Metric Card) với:
  - Giá trị dự đoán ngày mai (ví dụ: `286.4 DU`).
  - So sánh với hôm nay (ví dụ: `+1.8 DU / +0.6%`).
  - Độ tin cậy hoặc khoảng tin cậy 95%.

---

### 6. Pattern 6: Phân Loại Mức Cảnh Báo Cho Ngày Mai (Classification)
- **Mục tiêu:** Phân loại chất lượng nồng độ khí quyển Ozone vào các mức cảnh báo cho **ngày tiếp theo (ngày mai)**.
- **Thuật toán:** Phân loại (Classification) dựa trên ngưỡng khoa học hoặc mô hình Random Forest Classifier:
  - **Mức 1 (Tốt / Bình thường):** $250 \text{ DU} \le O_3 \le 350 \text{ DU}$ (Lớp Ozone bảo vệ tốt tia cực tím).
  - **Mức 2 (Nguy hại - Lỗ thủng/Suy giảm):** $O_3 < 220 \text{ DU}$ (Tia cực tím UV-B chiếu mạnh xuống mặt đất, nguy cơ gây ung thư da).
  - **Mức 3 (Bất thường / Cảnh báo cao):** $O_3 > 400 \text{ DU}$.
- **Hiển thị trên Web:** Huy hiệu trạng thái cảnh báo (Status Badge) màu Xanh / Vàng / Đỏ kèm khuyến nghị bảo vệ sức khỏe.

---

### 7. Pattern 7: Phân Cụm Dữ Liệu (Clustering Pattern - Slide 2 & 8)
- **Thuật toán:** K-Means Clustering hoặc DBSCAN.
- **Ý nghĩa:**
  - Gom cụm các trạm đo hoặc tọa độ địa lý thành các nhóm có cùng hành vi khí quyển (ví dụ: Nhóm vùng Cực có biến động nồng độ cực đoan, Nhóm Xích đạo ổn định, Nhóm Ôn đới có chu kỳ rõ nét).
- **Biểu đồ:** Biểu đồ không gian Scatter Plot 2D (Latitude vs Ozone DU) có tô màu theo cụm (Cluster 0, 1, 2) hoặc hiển thị trực tiếp trên bản đồ Leaflet.

---

## Bảng Ánh Xạ Endpoint REST API (Database API)

| Pattern | HTTP Method & URL | Dữ liệu trả về |
|---|---|---|
| **Time-series (Line/Scatter/Histogram)** | `GET /api/patterns/timeseries?range=day\|week\|month` | Danh sách mốc thời gian, giá trị đo và mảng phân phối histogram |
| **Trend Line** | `GET /api/patterns/trend?resample=month\|week` | Chuỗi thời gian đã làm phẳng xu hướng |
| **Seasonal Line** | `GET /api/patterns/seasonality` | Thành phần chu kỳ mùa vụ theo từng mốc thời gian |
| **Correlation Matrix** | `GET /api/patterns/correlation` | Danh sách tên các biến và ma trận 2D hệ số tương quan |
| **Prediction (Ngày mai)** | `GET /api/patterns/prediction/tomorrow` | Giá trị dự báo nồng độ Ozone (DU) ngày mai |
| **Classification (Ngày mai)** | `GET /api/patterns/classification/tomorrow` | Nhãn phân loại cảnh báo ngày mai (Tốt / Nguy hại) |
| **Clustering** | `GET /api/patterns/clustering` | Danh sách tọa độ và nhãn cụm (cluster_id) |
| **Trigger Service: Analysis** | `POST /api/services/run-analysis` | Kích hoạt tính toán lại toàn bộ patterns phân tích |
| **Trigger Service: Clustering** | `POST /api/services/run-clustering` | Kích hoạt phân cụm mô hình AI |
| **Trigger Service: Prediction** | `POST /api/services/run-prediction` | Kích hoạt suy luận mô hình dự báo |
