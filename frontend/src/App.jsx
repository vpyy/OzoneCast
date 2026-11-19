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
  const [mapMode, setMapMode] = useState('grid');

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
    <div className="min-h-screen bg-gray-50 flex flex-row">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onRefresh={loadAllData} loading={loading} />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
          <DashboardStats stats={stats} />

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex gap-2 bg-white p-3 border border-gray-200">
                <button
                  onClick={() => setMapMode('grid')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    mapMode === 'grid' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Grid 0.5° ({gridData.length})
                </button>
                <button
                  onClick={() => setMapMode('raw')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    mapMode === 'raw' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Swath ({rawData.length})
                </button>
              </div>

              <OzoneMap gridData={gridData} rawData={rawData} mode={mapMode} />
              <TomorrowPredictionCard />
            </div>
          )}

          {activeTab === 'analytics' && <AnalyticsCharts />}

          {activeTab === 'trend_corr' && <TrendSeasonalCorrelation />}

          {activeTab === 'clustering' && (
            <ClusteringPanel clusters={clusters} onClustersUpdated={loadAllData} />
          )}

          {activeTab === 'prediction' && (
            <div className="space-y-6">
              <TomorrowPredictionCard />
              <PredictionPanel />
            </div>
          )}

          {activeTab === 'raw' && (
            <RawDataTable rawData={rawData} granules={granules} onDataMutated={loadAllData} />
          )}
        </main>

        <footer className="bg-white border-t border-gray-200 text-gray-500 text-xs py-4 text-center">
          OzoneCast - NASA Satellite Monitoring System
        </footer>
      </div>
    </div>
  );
}
