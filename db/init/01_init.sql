-- =============================================================================
-- OzoneCast — Database Initialization
-- File: db/init/01_init.sql
-- Auto-executed by postgres:16 on first start (via /docker-entrypoint-initdb.d)
-- =============================================================================

-- ── 1. granules ───────────────────────────────────────────────────────────────
-- Lưu metadata mỗi file HDF5 / granule tải về từ NASA CMR / OMTO3G URL
CREATE TABLE IF NOT EXISTS granules (
    id               SERIAL PRIMARY KEY,
    filename         VARCHAR(255) NOT NULL UNIQUE,
    file_url         VARCHAR(1024),
    satellite        VARCHAR(50)  DEFAULT 'Aura',
    instrument       VARCHAR(50)  DEFAULT 'OMI',
    product_level    VARCHAR(20)  DEFAULT 'L2G',
    orbit_number     INTEGER,
    file_size_bytes  INTEGER      DEFAULT 0,
    download_status  VARCHAR(30)  DEFAULT 'DOWNLOADED',
    process_status   VARCHAR(30)  DEFAULT 'UNPROCESSED',
    local_path       VARCHAR(1024),
    created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_granules_filename   ON granules(filename);
CREATE INDEX IF NOT EXISTS idx_granules_created_at ON granules(created_at DESC);

-- ── 2. raw_measurements ───────────────────────────────────────────────────────
-- Bảng lưu trữ 10 trường trích xuất từ file HDF5/HE5 (OMTO3/OMTO3G):
-- Nhóm 1: Bắt buộc (6 trường)
--   - ColumnAmountO3          -> ozone_column_raw (DU)
--   - Latitude, Longitude     -> latitude, longitude (Tọa độ địa lý)
--   - SecondsInDay, Time      -> seconds_in_day, time_raw (Thời điểm đo trong ngày UTC)
--   - QualityFlags            -> quality_flag (Cờ thuật toán)
--   - GroundPixelQualityFlags -> ground_pixel_quality_flag (Chất lượng pixel mặt đất)
-- Nhóm 2: Nên lấy thêm (4 trường)
--   - SolarZenithAngle        -> solar_zenith_angle (Góc thiên đỉnh mặt trời, loại góc > 84-88°)
--   - RadiativeCloudFraction  -> radiative_cloud_fraction (Tỷ lệ che phủ mây bức xạ 0.0 - 1.0)
--   - CloudPressure           -> cloud_pressure (Áp suất đỉnh mây hPa)
--   - WaterFraction           -> water_fraction (Mặt nước / băng tuyết / đất liền)
-- Mở rộng: reflectivity331, uv_aerosol_index (hỗ trợ phân tích phổ bức xạ)
CREATE TABLE IF NOT EXISTS raw_measurements (
    id                          SERIAL PRIMARY KEY,
    granule_name                VARCHAR(255)     NOT NULL,
    point_index                 INTEGER          NOT NULL,
    latitude                    DOUBLE PRECISION NOT NULL,
    longitude                   DOUBLE PRECISION NOT NULL,
    seconds_in_day              DOUBLE PRECISION DEFAULT 0.0,
    time_raw                    DOUBLE PRECISION DEFAULT 0.0,
    ozone_column_raw            DOUBLE PRECISION NOT NULL,
    quality_flag                INTEGER          DEFAULT 0,
    ground_pixel_quality_flag   INTEGER          DEFAULT 0,
    solar_zenith_angle          DOUBLE PRECISION DEFAULT 0.0,
    radiative_cloud_fraction    DOUBLE PRECISION DEFAULT 0.0,
    cloud_pressure              DOUBLE PRECISION DEFAULT 0.0,
    water_fraction              DOUBLE PRECISION DEFAULT 0.0,
    reflectivity331             DOUBLE PRECISION DEFAULT 0.0,
    uv_aerosol_index            DOUBLE PRECISION DEFAULT 0.0,
    scan_line                   INTEGER          DEFAULT 0,
    pixel_index                 INTEGER          DEFAULT 29,
    created_at                  TIMESTAMPTZ      DEFAULT NOW()
);

-- Index tối ưu hóa truy vấn không gian & thời gian:
CREATE INDEX IF NOT EXISTS idx_raw_granule_name   ON raw_measurements(granule_name);
CREATE INDEX IF NOT EXISTS idx_raw_lat_lon        ON raw_measurements(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_raw_seconds_in_day ON raw_measurements(seconds_in_day);
CREATE INDEX IF NOT EXISTS idx_raw_sza            ON raw_measurements(solar_zenith_angle);
CREATE INDEX IF NOT EXISTS idx_raw_flags          ON raw_measurements(quality_flag, ground_pixel_quality_flag);
CREATE INDEX IF NOT EXISTS idx_raw_created_at     ON raw_measurements(created_at DESC);

-- -----------------------------------------------------------------------------
-- [CÂU LỆNH SQL MẪU DÙNG ĐỂ LƯU VÀ TRÍCH XUẤT LỌC DỮ LIỆU / DỰ ĐOÁN]
-- -----------------------------------------------------------------------------
-- 1. Câu lệnh INSERT dữ liệu mẫu:
-- INSERT INTO raw_measurements (
--     granule_name, point_index, latitude, longitude, seconds_in_day, time_raw,
--     ozone_column_raw, quality_flag, ground_pixel_quality_flag,
--     solar_zenith_angle, radiative_cloud_fraction, cloud_pressure, water_fraction
-- ) VALUES (
--     'OMI-Aura_L2G-OMTO3G_2026m1116.he5', 1, -65.25, -64.12, 43200.0, 1036368000.0,
--     195.4, 0, 0, 68.5, 0.25, 750.0, 0.0
-- );

-- 2. Câu lệnh LỌC DỮ LIỆU Bán đảo Nam Cực phục vụ huấn luyện mô hình / dự đoán AI:
-- SELECT
--     latitude,
--     longitude,
--     seconds_in_day,
--     ozone_column_raw,
--     solar_zenith_angle,
--     radiative_cloud_fraction,
--     cloud_pressure,
--     water_fraction
-- FROM raw_measurements
-- WHERE latitude BETWEEN -90.0 AND -55.0               -- Cắt vùng Bán đảo Nam Cực
--   AND quality_flag = 0                               -- Lọc bỏ điểm đo xấu
--   AND ground_pixel_quality_flag = 0                  -- Lọc bỏ pixel mặt đất bị lỗi/che khuất
--   AND solar_zenith_angle <= 84.0                     -- Loại góc xiên quá lớn gần chân trời
--   AND ozone_column_raw BETWEEN 80.0 AND 600.0
-- ORDER BY seconds_in_day ASC;

-- ── 3. ozone_grid_summary ─────────────────────────────────────────────────────
-- Kết quả binning không gian 0.5°×0.5° từ data-analysis
CREATE TABLE IF NOT EXISTS ozone_grid_summary (
    id                  SERIAL PRIMARY KEY,
    source_filename     VARCHAR(255),
    timestamp           TIMESTAMPTZ      DEFAULT NOW(),
    lat_bin             DOUBLE PRECISION NOT NULL,
    lon_bin             DOUBLE PRECISION NOT NULL,
    ozone_column_mean   DOUBLE PRECISION NOT NULL,
    ozone_column_min    DOUBLE PRECISION,
    ozone_column_max    DOUBLE PRECISION,
    reflectivity_mean   DOUBLE PRECISION DEFAULT 0.0,
    uv_aerosol_mean     DOUBLE PRECISION DEFAULT 0.0,
    valid_pixel_count   INTEGER          DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_grid_timestamp       ON ozone_grid_summary(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_grid_source_filename ON ozone_grid_summary(source_filename);

-- ── 4. ozone_anomalies ────────────────────────────────────────────────────────
-- Vùng có ozone < 220 DU (WMO: Ozone Hole)
CREATE TABLE IF NOT EXISTS ozone_anomalies (
    id           SERIAL PRIMARY KEY,
    timestamp    TIMESTAMPTZ      DEFAULT NOW(),
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    ozone_level  DOUBLE PRECISION NOT NULL,
    severity     VARCHAR(50)      DEFAULT 'Moderate',  -- Warning | Severe (Ozone Hole)
    description  VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON ozone_anomalies(timestamp DESC);

-- ── 5. cluster_results ────────────────────────────────────────────────────────
-- Kết quả K-Means clustering từ backend-services/clustering
CREATE TABLE IF NOT EXISTS cluster_results (
    id              SERIAL PRIMARY KEY,
    run_timestamp   TIMESTAMPTZ      DEFAULT NOW(),
    algorithm       VARCHAR(50)      DEFAULT 'KMeans',
    cluster_id      INTEGER          NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    mean_ozone      DOUBLE PRECISION NOT NULL,
    mean_reflectivity DOUBLE PRECISION DEFAULT 0.0,
    point_count     INTEGER          DEFAULT 1,
    tag             VARCHAR(100),
    characteristic  VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_cluster_run_timestamp ON cluster_results(run_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cluster_cluster_id    ON cluster_results(cluster_id);

-- ── 6. system_analysis_cache ──────────────────────────────────────────────────
-- Cache JSON cho timeseries / trend_seasonal / correlation_matrix / prediction_tomorrow
CREATE TABLE IF NOT EXISTS system_analysis_cache (
    id           SERIAL PRIMARY KEY,
    cache_key    VARCHAR(100) NOT NULL UNIQUE,
    payload_json TEXT         NOT NULL,
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_key ON system_analysis_cache(cache_key);
