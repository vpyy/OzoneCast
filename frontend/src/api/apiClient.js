import axios from 'axios';

export const API_BASE = {
  db: import.meta.env.VITE_DB_API_URL || 'http://localhost:8000',
  ws: import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/stream',
  ingest: import.meta.env.VITE_INGEST_API_URL || 'http://localhost:8002',
  prediction: import.meta.env.VITE_PREDICTION_API_URL || 'http://localhost:8004'
};

export const api = {
  // ── Database API (FastAPI Gateway - Port 8000, Read-Only) ──────────────────
  getStats: () =>
    axios.get(`${API_BASE.db}/api/stats`).then((res) => res.data),

  getGranules: (limit = 50, offset = 0) =>
    axios.get(`${API_BASE.db}/api/granules?limit=${limit}&offset=${offset}`).then((res) => res.data),

  getRawMeasurements: (limit = 100, offset = 0, params = {}) => {
    const q = new URLSearchParams({ limit, offset, ...params });
    return axios.get(`${API_BASE.db}/api/raw-measurements?${q.toString()}`).then((res) => res.data);
  },

  getAggregatedTimeseries: (granularity = 'day', start = null, end = null, limit = 1000) => {
    const q = new URLSearchParams({ granularity, limit });
    if (start) q.append('start', start);
    if (end) q.append('end', end);
    return axios.get(`${API_BASE.db}/api/aggregated/timeseries?${q.toString()}`).then((res) => res.data);
  },

  getGridSummary: (limit = 600, offset = 0) =>
    axios.get(`${API_BASE.db}/api/grid-summary?limit=${limit}&offset=${offset}`).then((res) => res.data),

  getAnomalies: (limit = 100) =>
    axios.get(`${API_BASE.db}/api/anomalies?limit=${limit}`).then((res) => res.data),

  getClusters: (limit = 300) =>
    axios.get(`${API_BASE.db}/api/clusters?limit=${limit}`).then((res) => res.data),

  // Analytics & AI Cache Endpoints
  getTimeseries: (period = 'day') =>
    axios.get(`${API_BASE.db}/api/analysis/timeseries?period=${period}`).then((res) => res.data),

  getTrendSeasonal: () =>
    axios.get(`${API_BASE.db}/api/analysis/trend-seasonal`).then((res) => res.data),

  getCorrelationMatrix: () =>
    axios.get(`${API_BASE.db}/api/analysis/correlation-matrix`).then((res) => res.data),

  getTomorrowPrediction: () =>
    axios.get(`${API_BASE.db}/api/prediction/tomorrow`).then((res) => res.data),

  // ── Machine Learning & AI Prediction (backend-services :8004 kèm fallback :8000) ──
  predictOzone: (latitude, longitude, datetime = null) =>
    axios.post(`${API_BASE.prediction}/api/prediction/predict`, { latitude, longitude, datetime })
      .catch(() => axios.post(`${API_BASE.db}/api/prediction/predict`, { latitude, longitude, datetime }))
      .then((res) => res.data),

  trainModel: () =>
    axios.post(`${API_BASE.prediction}/api/prediction/train`)
      .catch(() => axios.post(`${API_BASE.db}/api/prediction/train`))
      .then((res) => res.data),

  // ── Trigger Ingest (qua Service 1: data-ingestion :8002) ───────────────────
  triggerIngestMock: () =>
    axios.post(`${API_BASE.ingest}/api/ingest/mock`).then((res) => res.data),

  triggerIngestUrl: (fileUrl) =>
    axios.post(`${API_BASE.ingest}/api/ingest/url`, { file_url: fileUrl }).then((res) => res.data),
};
