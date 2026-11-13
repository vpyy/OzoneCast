import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardStats from './components/DashboardStats';
import OzoneMap from './components/OzoneMap';
import RawDataTable from './components/RawDataTable';
import ClusteringPanel from './components/ClusteringPanel';
import PredictionPanel from './components/PredictionPanel';
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
        api.getClusters(150)
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
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={loadAllData}
        loading={loading}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <DashboardStats stats={stats} />

        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Map Display Layer:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setMapMode('grid')}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    mapMode === 'grid' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Silver Grid Mean ({gridData.length} cells)
                </button>
                <button
                  onClick={() => setMapMode('raw')}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    mapMode === 'raw' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Raw Swath Points ({rawData.length} points)
                </button>
              </div>
            </div>

            <OzoneMap gridData={gridData} rawData={rawData} mode={mapMode} />
          </div>
        )}

        {activeTab === 'raw' && (
          <RawDataTable
            rawData={rawData}
            granules={granules}
            onDataMutated={loadAllData}
          />
        )}

        {activeTab === 'clustering' && (
          <ClusteringPanel
            clusters={clusters}
            onClustersUpdated={loadAllData}
          />
        )}

        {activeTab === 'prediction' && (
          <PredictionPanel />
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-4 text-center">
        NASA Ozone Satellite Monitoring System &bull; Microservices & Docker Architecture &bull; 2026
      </footer>
    </div>
  );
}

