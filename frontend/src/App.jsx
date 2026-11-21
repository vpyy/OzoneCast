import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import DashboardStats from './components/DashboardStats';
import OzoneMap from './components/OzoneMap';
import RawDataTable from './components/RawDataTable';
import ClusteringPanel from './components/ClusteringPanel';
import PredictionPanel from './components/PredictionPanel';
import AnalyticsCharts from './components/AnalyticsCharts';
import TrendSeasonalCorrelation from './components/TrendSeasonalCorrelation';
import TomorrowPredictionCard from './components/TomorrowPredictionCard';
import { api, API_BASE } from './api/apiClient';
import { useWebSocket } from './lib/useWebSocket';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [granules, setGranules] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapMode, setMapMode] = useState('grid'); // 'grid' or 'raw'

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, granulesRes, rawRes, gridRes, clustersRes] = await Promise.allSettled([
        api.getStats(),
        api.getGranules(),
        api.getRawMeasurements(250),
        api.getGridSummary(500),
        api.getClusters(200)
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (granulesRes.status === 'fulfilled') setGranules(granulesRes.value);
      if (rawRes.status === 'fulfilled') setRawData(rawRes.value);
      if (gridRes.status === 'fulfilled') setGridData(gridRes.value);
      if (clustersRes.status === 'fulfilled') setClusters(clustersRes.value);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Xử lý thông điệp từ WebSocket stream
  const handleWsMessage = useCallback((payload) => {
    if (payload.type === 'snapshot' || payload.type === 'update') {
      const d = payload.data;
      if (d) {
        setStats((prev) => ({
          ...prev,
          total_granules: d.total_granules ?? prev?.total_granules ?? 0,
          total_raw_measurements: d.total_raw_measurements ?? prev?.total_raw_measurements ?? 0,
          total_grid_cells: d.total_grid_cells ?? prev?.total_grid_cells ?? 0,
          avg_ozone_du: d.avg_ozone_du ?? prev?.avg_ozone_du ?? 290.0,
          min_ozone_du: d.min_ozone_du ?? prev?.min_ozone_du ?? 180.0,
          max_ozone_du: d.max_ozone_du ?? prev?.max_ozone_du ?? 450.0,
          anomalies_detected: d.anomalies_detected ?? prev?.anomalies_detected ?? 0,
          last_updated: d.last_updated || new Date().toISOString()
        }));

        // Khi có sự kiện update, cập nhật dữ liệu bản đồ và bảng mà không reload trang
        if (payload.type === 'update') {
          api.getRawMeasurements(250).then(setRawData).catch(() => {});
          api.getGridSummary(500).then(setGridData).catch(() => {});
          api.getGranules().then(setGranules).catch(() => {});
        }
      }
    }
  }, []);

  // Kết nối WebSocket thời gian thực (có tự động reconnect & fallback REST)
  const { status: wsStatus } = useWebSocket({
    url: API_BASE.ws,
    onMessage: handleWsMessage,
    onFallbackPoll: loadAllData,
    enabled: true
  });

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-row font-sans">
      {/* ── Left Sidebar Navigation ── */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={loadAllData}
        loading={loading}
        wsStatus={wsStatus}
      />

      {/* ── Main Dashboard Workspace ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Top Metric Cards */}
          <DashboardStats stats={stats} />

          {/* Tab 1: Bản đồ & Tổng quan */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-700">Hiển thị Layer Bản đồ Tương tác:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setMapMode('grid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      mapMode === 'grid' ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Lưới Silver 0.5° ({gridData.length} ô)
                  </button>
                  <button
                    onClick={() => setMapMode('raw')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      mapMode === 'raw' ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Điểm Thô Vệ tinh Swath ({rawData.length} điểm)
                  </button>
                </div>
              </div>

              <OzoneMap gridData={gridData} rawData={rawData} mode={mapMode} />

              {/* Quick Tomorrow Prediction Preview */}
              <TomorrowPredictionCard />
            </div>
          )}

          {/* Tab 2: Bộ 3 Biểu đồ Chuỗi thời gian (Line, Scatter, Histogram) */}
          {activeTab === 'analytics' && (
            <AnalyticsCharts />
          )}

          {/* Tab 3: Xu hướng Trend, Mùa vụ Seasonal & Heatmap Tương quan */}
          {activeTab === 'trend_corr' && (
            <TrendSeasonalCorrelation />
          )}

          {/* Tab 4: Phân cụm Khu vực (Clustering) */}
          {activeTab === 'clustering' && (
            <ClusteringPanel
              clusters={clusters}
              onClustersUpdated={loadAllData}
            />
          )}

          {/* Tab 5: Dự báo Ngày mai & Máy học */}
          {activeTab === 'prediction' && (
            <div className="space-y-6">
              <TomorrowPredictionCard />
              <PredictionPanel />
            </div>
          )}

          {/* Tab 6: Bảng Dữ liệu Thô (10 Trường Vệ tinh) */}
          {activeTab === 'raw' && (
            <RawDataTable
              rawData={rawData}
              granules={granules}
              onDataMutated={loadAllData}
            />
          )}
        </main>

        <footer className="bg-white border-t border-slate-200 text-slate-500 text-xs py-4 text-center">
          NASA Ozone Satellite Monitoring System &bull; Microservices & Docker Architecture &bull; 2026
        </footer>
      </div>
    </div>
  );
}
