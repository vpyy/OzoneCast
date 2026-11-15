import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardStats from './components/DashboardStats';
import OzoneMap from './components/OzoneMap';
import RawDataTable from './components/RawDataTable';
import ClusteringPanel from './components/ClusteringPanel';
import PredictionPanel from './components/PredictionPanel';
import AnalyticsCharts from './components/AnalyticsCharts';
import TrendSeasonalCorrelation from './components/TrendSeasonalCorrelation';
import TomorrowPredictionCard from './components/TomorrowPredictionCard';
import { api } from './api/apiClient';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [granules, setGranules] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapMode, setMapMode] = useState('grid'); // 'grid' or 'raw'

  const loadAllData = async () => {
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
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-row font-sans">
      {/* ── Left Sidebar Navigation ── */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={loadAllData}
        loading={loading}
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

          {/* Tab 6: Bảng Dữ liệu Thô (7 Trường) */}
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
