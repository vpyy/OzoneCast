import axios from 'axios';

const API_BASE = {
  db: import.meta.env.VITE_DB_API_URL || 'http://localhost:8001',
  ingest: import.meta.env.VITE_INGEST_API_URL || 'http://localhost:8002',
  analysis: import.meta.env.VITE_ANALYSIS_API_URL || 'http://localhost:8003',
  clustering: import.meta.env.VITE_CLUSTERING_API_URL || 'http://localhost:8004',
  prediction: import.meta.env.VITE_PREDICTION_API_URL || 'http://localhost:8005'
};

export const api = {
  // Database API
  getStats: () => axios.get(`${API_BASE.db}/api/stats`).then(res => res.data),
  getGranules: () => axios.get(`${API_BASE.db}/api/granules`).then(res => res.data),
  getRawMeasurements: (limit = 100, offset = 0) => 
    axios.get(`${API_BASE.db}/api/raw-measurements?limit=${limit}&offset=${offset}`).then(res => res.data),
  getGridSummary: (limit = 600) => 
    axios.get(`${API_BASE.db}/api/grid-summary?limit=${limit}`).then(res => res.data),
  getAnomalies: () => axios.get(`${API_BASE.db}/api/anomalies`).then(res => res.data),
  getClusters: () => axios.get(`${API_BASE.db}/api/clusters`).then(res => res.data),

  // Analytics APIs
  getTimeseries: (period = 'day') => 
    axios.get(`${API_BASE.db}/api/analysis/timeseries?period=${period}`).then(res => res.data),
  getTrendSeasonal: () => 
    axios.get(`${API_BASE.db}/api/analysis/trend-seasonal`).then(res => res.data),
  getCorrelationMatrix: () => 
    axios.get(`${API_BASE.db}/api/analysis/correlation-matrix`).then(res => res.data),
  getAnalysisSummary: () => 
    axios.get(`${API_BASE.db}/api/analysis/summary`).then(res => res.data),
  getTomorrowPrediction: () => 
    axios.get(`${API_BASE.db}/api/prediction/tomorrow`).then(res => res.data),

  // Ingestion API triggers
  triggerIngestMock: () => axios.post(`${API_BASE.ingest}/api/ingest/mock`).then(res => res.data),
  triggerIngestReal: () => axios.post(`${API_BASE.ingest}/api/ingest/real`).then(res => res.data),

  // Analysis API triggers
  runAnalysis: (granuleName = null) => 
    axios.post(`${API_BASE.analysis}/api/analysis/process`, { granule_name: granuleName }).then(res => res.data),

  // Clustering API triggers
  runClustering: (algorithm = 'KMeans', eps = 1.2, n_clusters = 4) => 
    axios.post(`${API_BASE.clustering}/api/clustering/run`, { algorithm, eps, n_clusters })
      .catch(() => axios.post(`${API_BASE.db}/api/clustering/run`, { algorithm, eps, n_clusters }))
      .then(res => res.data),

  // Prediction API triggers
  predictOzone: (latitude, longitude, datetime = null) => 
    axios.post(`${API_BASE.prediction}/api/prediction/predict`, { latitude, longitude, datetime })
      .catch(() => axios.post(`${API_BASE.db}/api/prediction/predict`, { latitude, longitude, datetime }))
      .then(res => res.data),
  trainModel: () => 
    axios.post(`${API_BASE.prediction}/api/prediction/train`)
      .catch(() => axios.post(`${API_BASE.db}/api/prediction/train`))
      .then(res => res.data)
};
