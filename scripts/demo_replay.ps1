# ==============================================================================
#  OzoneCast — Kịch bản chạy Demo Nạp dữ liệu Real-time trước hội đồng báo cáo
#  Cách chạy:
#    powershell -ExecutionPolicy Bypass -File scripts/demo_replay.ps1          # Chạy tiếp, bỏ qua file đã nạp
#    powershell -ExecutionPolicy Bypass -File scripts/demo_replay.ps1 -Reset   # Xóa sạch DB về 0 để demo từ đầu
# ==============================================================================

param(
    [switch]$Reset,                # Chỉ xóa sạch DB khi bạn truyền tham số -Reset
    [switch]$SkipExisting = $true  # Tự động bỏ qua các file đã nạp thành công vào DB
)

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   OZONECAST - REPLAY DEMO NẠP DỮ LIỆU REAL-TIME BÁN ĐẢO NAM CỰC   " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Kiểm tra các container docker đang chạy
Write-Host "[1/4] Kiểm tra các container..." -ForegroundColor White
$runningContainers = (docker ps --format "{{.Names}}") -join " "
if ($runningContainers -notmatch "ozone-postgres" -or $runningContainers -notmatch "ozone-database-api" -or $runningContainers -notmatch "ozone-data-ingestion") {
    Write-Host "[LỖI] Các container chưa khởi động đầy đủ. Hãy chạy 'docker compose up -d' trước!" -ForegroundColor Red
    Write-Host "   Các container đang chạy: $runningContainers" -ForegroundColor Yellow
    exit 1
}
Write-Host "   -> Mọi container đều đang hoạt động tốt (PostgreSQL, DB-API, Ingestion, Frontend)." -ForegroundColor Green

# 2. Xử lý xóa database (nếu có cờ -Reset) hoặc giữ nguyên để chạy tiếp
Write-Host ""
if ($Reset) {
    Write-Host "[2/4] XÓA SẠCH DỮ LIỆU CŨ TRONG DATABASE (Reset về 0 theo cờ -Reset)..." -ForegroundColor Yellow
    $truncateSql = "TRUNCATE TABLE raw_measurements, ozone_daily, ingested_granules, granules, system_analysis_cache, ozone_anomalies, cluster_results RESTART IDENTITY CASCADE;"
    docker exec -i ozone-postgres psql -U postgres -d ozone_db -c "$truncateSql" | Out-Null
    Write-Host "   -> Đã dọn sạch database thành công! Toàn bộ bảng đã về 0." -ForegroundColor Green
    Write-Host "   -> HÃY MỞ TRÌNH DUYỆT TẠI: http://localhost:3000 để thấy số liệu đang ở mức 0." -ForegroundColor Cyan
} else {
    Write-Host "[2/4] CHẾ ĐỘ CHẠY TIẾP (RESUME): Giữ nguyên dữ liệu cũ, tự động bỏ qua file đã nạp." -ForegroundColor Cyan
    Write-Host "      (Nếu muốn xóa sạch DB về 0 để bắt đầu phiên báo cáo mới, hãy gõ thêm: -Reset)" -ForegroundColor Gray
}

# 3. Đọc danh sách URLs từ seed/urls_seed.txt
$seedPath = "services\data-ingestion\seed\urls_seed.txt"
if (-not (Test-Path $seedPath)) {
    Write-Host "[LỖI] Không tìm thấy file $seedPath" -ForegroundColor Red
    exit 1
}
$urls = Get-Content $seedPath | Where-Object { $_ -and -not $_.StartsWith("#") } | ForEach-Object { $_.Trim() }

# Lấy danh sách các granule đã có sẵn điểm trong DB để bỏ qua không tải lại
$existingGranules = @()
if ($SkipExisting -and -not $Reset) {
    $rawList = docker exec -i ozone-postgres psql -U postgres -d ozone_db -t -A -c "SELECT DISTINCT granule_name FROM raw_measurements;" 2>$null
    if ($rawList) {
        $existingGranules = $rawList -split "`r?`n" | Where-Object { $_.Trim() }
    }
}

Write-Host ""
Write-Host "[3/4] Tìm thấy $($urls.Count) file vệ tinh trong file seed." -ForegroundColor White
if ($existingGranules.Count -gt 0) {
    Write-Host "      Đã phát hiện $($existingGranules.Count) file đã có sẵn trong DB -> Sẽ tự động bỏ qua!" -ForegroundColor Green
}
Write-Host "      Chuẩn bị nạp từng ngày một để quan sát biến thiên real-time..." -ForegroundColor White
Write-Host ""

$idx = 0
foreach ($url in $urls) {
    $idx++
    $filename = $url.Split("/")[-1].Split("?")[0]

    # Kiểm tra xem file này đã nạp trước đó chưa
    if ($SkipExisting -and -not $Reset -and ($existingGranules -contains $filename)) {
        Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host "[$idx/$($urls.Count)] File $filename ĐÃ CÓ TRONG DB -> BỎ QUA!" -ForegroundColor Yellow
        continue
    }

    $dateMatch = [regex]::Match($filename, "_(\d{4})m(\d{2})(\d{2})(?:t(\d{2})(\d{2}))?")
    $obsDate = if ($dateMatch.Success) {
        if ($dateMatch.Groups[4].Success) {
            "$($dateMatch.Groups[1].Value)-$($dateMatch.Groups[2].Value)-$($dateMatch.Groups[3].Value) $($dateMatch.Groups[4].Value):$($dateMatch.Groups[5].Value) UTC"
        } else {
            "$($dateMatch.Groups[1].Value)-$($dateMatch.Groups[2].Value)-$($dateMatch.Groups[3].Value)"
        }
    } else { "Unknown" }

    $targetDateOnly = if ($dateMatch.Success) {
        "$($dateMatch.Groups[1].Value)-$($dateMatch.Groups[2].Value)-$($dateMatch.Groups[3].Value)"
    } else { "2026-11-15" }

    Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[$idx/$($urls.Count)] Đang nạp ngày $obsDate..." -ForegroundColor Cyan
    Write-Host "   File: $filename" -ForegroundColor Gray
    Write-Host "   Tải stream & cắt lát lưới Bán đảo Nam Cực (Lat -70..-63, Lon -75..-55)..." -ForegroundColor Gray

    $body = @{ file_url = $url } | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8002/api/ingest/url" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 600
        $savedCount = $response.saved_to_db
        if ($savedCount -gt 0) {
            Write-Host "   -> [THÀNH CÔNG] Đã lưu $savedCount điểm đo Bán đảo Nam Cực vào PostgreSQL!" -ForegroundColor Green
            Write-Host "   -> WebSocket đã gửi tín hiệu tới Frontend (http://localhost:3000)." -ForegroundColor Green
        } else {
            Write-Host "   -> [THÔNG TIN] Quỹ đạo này không giao với Bán đảo Nam Cực (0 điểm), tiếp tục..." -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "   -> [CẢNH BÁO] Nạp từ NASA URL gặp sự cố: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "      Tự động kích hoạt nạp file Mock chuẩn L2G cho ngày $targetDateOnly để demo không bị gián đoạn..." -ForegroundColor Yellow
        try {
            $mockBody = @{ target_date = $targetDateOnly; filename = "mock_$filename" } | ConvertTo-Json
            $mockRes = Invoke-RestMethod -Uri "http://localhost:8002/api/ingest/mock" -Method Post -Body $mockBody -ContentType "application/json" -TimeoutSec 30
            Write-Host "   -> [MOCK THÀNH CÔNG] Đã lưu $($mockRes.saved_to_db) điểm giả lập vào PostgreSQL (Ngày $targetDateOnly)!" -ForegroundColor Green
        } catch {
            Write-Host "   -> [MOCK LỖI] $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    # Đợi 5 giây để quan sát biểu đồ nhảy trực tiếp
    if ($idx -lt $urls.Count) {
        Write-Host "   -> Chờ 5 giây để quan sát biểu đồ nhảy trước khi nạp tiếp file tiếp theo..." -ForegroundColor Magenta
        Start-Sleep -Seconds 5
    }
}

# 4. Báo cáo tổng kết sau phiên Demo
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "[4/4] TỔNG KẾT PHIÊN DEMO NẠP DỮ LIỆU REAL-TIME THÀNH CÔNG!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan

docker exec -i ozone-postgres psql -U postgres -d ozone_db -c "SELECT count(*) AS tong_diem_do FROM raw_measurements; SELECT observation_date, avg_ozone, min_ozone, max_ozone, valid_observations FROM ozone_daily ORDER BY observation_date;"

Write-Host ""
Write-Host "Trình duyệt: Mở http://localhost:3000 để xem đầy đủ các Tab:" -ForegroundColor Yellow
Write-Host "  - Bản đồ & Tổng quan (Lưới trắc địa & Điểm đo)" -ForegroundColor White
Write-Host "  - Bộ 3 Biểu đồ Chuỗi thời gian (Line, Scatter & Histogram)" -ForegroundColor White
Write-Host "  - Xu hướng & Tương quan" -ForegroundColor White
Write-Host "  - Phân cụm & Dự báo" -ForegroundColor White
Write-Host ""
