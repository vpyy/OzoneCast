-- =============================================================================
-- OzoneCast — Migration: OMTO3G L2G Grid & Daily Summary & Ingestion Tracking
-- File: db/init/02_l2g_and_daily.sql
-- =============================================================================

-- 1. Thêm các cột lưới L2G vào raw_measurements
ALTER TABLE raw_measurements ADD COLUMN IF NOT EXISTS row_index INTEGER;
ALTER TABLE raw_measurements ADD COLUMN IF NOT EXISTS col_index INTEGER;
ALTER TABLE raw_measurements ADD COLUMN IF NOT EXISTS observation_index INTEGER;

-- Index phục vụ UPSERT idempotent theo file + lưới + quan sát
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_granule_grid_obs 
ON raw_measurements (granule_name, row_index, col_index, observation_index);

-- 2. Bảng theo dõi nạp granule OMTO3G tự động
CREATE TABLE IF NOT EXISTS ingested_granules (
    filename            VARCHAR(255) PRIMARY KEY,
    observation_date    DATE NOT NULL,
    produced_at         TIMESTAMPTZ,
    url                 VARCHAR(1024) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, done, no_data_in_region, failed
    rows_inserted       INTEGER NOT NULL DEFAULT 0,
    attempts            INTEGER NOT NULL DEFAULT 0,
    error               TEXT,
    discovered_at       TIMESTAMPTZ DEFAULT NOW(),
    processed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingested_granules_status   ON ingested_granules(status);
CREATE INDEX IF NOT EXISTS idx_ingested_granules_obs_date ON ingested_granules(observation_date);

-- 3. Bảng tổng hợp ozone hàng ngày (ozone_daily)
CREATE TABLE IF NOT EXISTS ozone_daily (
    observation_date    DATE PRIMARY KEY,
    avg_ozone           DOUBLE PRECISION NOT NULL,
    min_ozone           DOUBLE PRECISION NOT NULL,
    max_ozone           DOUBLE PRECISION NOT NULL,
    valid_observations  INTEGER NOT NULL,
    granules_count      INTEGER DEFAULT 1,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ozone_daily_date ON ozone_daily(observation_date DESC);
