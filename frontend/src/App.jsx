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
import { C, F } from './theme';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats]         = useState(null);
  const [granules, setGranules]   = useState([]);
  const [rawData, setRawData]     = useState([]);
  const [gridData, setGridData]   = useState([]);
  const [clusters, setClusters]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [mapMode, setMapMode]     = useState('grid');

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, granulesRes, rawRes, gridRes, clustersRes] = await Promise.allSettled([
        api.getStats(),
        api.getGranules(),
        api.getRawMeasurements(250),
        api.getGridSummary(500),
        api.getClusters(200),
      ]);
      if (statsRes.status    === 'fulfilled') setStats(statsRes.value);
      if (granulesRes.status === 'fulfilled') setGranules(granulesRes.value);
      if (rawRes.status      === 'fulfilled') setRawData(rawRes.value);
      if (gridRes.status     === 'fulfilled') setGridData(gridRes.value);
      if (clustersRes.status === 'fulfilled') setClusters(clustersRes.value);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleWsMessage = useCallback((payload) => {
    if (payload.type === 'snapshot' || payload.type === 'update') {
      const d = payload.data;
      if (d) {
        setStats(prev => ({
          ...prev,
          total_granules:          d.total_granules          ?? prev?.total_granules          ?? 0,
          total_raw_measurements:  d.total_raw_measurements  ?? prev?.total_raw_measurements  ?? 0,
          total_grid_cells:        d.total_grid_cells        ?? prev?.total_grid_cells        ?? 0,
          avg_ozone_du:            d.avg_ozone_du            ?? prev?.avg_ozone_du            ?? 290,
          min_ozone_du:            d.min_ozone_du            ?? prev?.min_ozone_du            ?? 180,
          max_ozone_du:            d.max_ozone_du            ?? prev?.max_ozone_du            ?? 450,
          anomalies_detected:      d.anomalies_detected      ?? prev?.anomalies_detected      ?? 0,
          last_updated:            d.last_updated            || new Date().toISOString(),
        }));
        if (payload.type === 'update') {
          api.getRawMeasurements(250).then(setRawData).catch(() => {});
          api.getGridSummary(500).then(setGridData).catch(() => {});
          api.getGranules().then(setGranules).catch(() => {});
        }
      }
    }
  }, []);

  const { status: wsStatus } = useWebSocket({
    url: API_BASE.ws,
    onMessage: handleWsMessage,
    onFallbackPoll: loadAllData,
    enabled: true,
  });

  useEffect(() => { loadAllData(); }, [loadAllData]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: C.bg, color: C.textPrimary, fontFamily: F.sans }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={loadAllData}
        loading={loading}
        wsStatus={wsStatus}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowY: 'auto' }}>
        <main style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <DashboardStats stats={stats} />

          {/* Overview */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Map mode bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: F.sans }}>
                  Map Layer
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { key: 'grid', label: `Grid 0.5° (${gridData.length})` },
                    { key: 'raw',  label: `Raw Points (${rawData.length})` },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setMapMode(key)} style={{
                      padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      fontFamily: F.sans, cursor: 'pointer', transition: 'all 0.15s',
                      background: mapMode === key ? C.accent : C.surfaceAlt,
                      color:      mapMode === key ? '#fff'    : C.textSecond,
                      border:     `1px solid ${mapMode === key ? C.accent : C.border}`,
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <OzoneMap gridData={gridData} rawData={rawData} mode={mapMode} />
              <TomorrowPredictionCard />
            </div>
          )}

          {activeTab === 'analytics'  && <AnalyticsCharts />}
          {activeTab === 'trend_corr' && <TrendSeasonalCorrelation />}
          {activeTab === 'clustering' && <ClusteringPanel clusters={clusters} onClustersUpdated={loadAllData} />}
          {activeTab === 'prediction' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TomorrowPredictionCard />
              <PredictionPanel />
            </div>
          )}
          {activeTab === 'raw' && (
            <RawDataTable rawData={rawData} granules={granules} onDataMutated={loadAllData} />
          )}
        </main>

        <footer style={{
          textAlign: 'center', fontSize: 11, padding: '12px 0',
          borderTop: `1px solid ${C.border}`, color: C.textMuted, fontFamily: F.mono,
        }}>
          NASA Aura/OMI Ozone Monitoring System &nbsp;·&nbsp; Microservices Architecture &nbsp;·&nbsp; 2026
        </footer>
      </div>
    </div>
  );
}
