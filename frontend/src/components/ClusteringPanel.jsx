import React, { useState } from 'react';
import { Layers, Play, CheckCircle2 } from 'lucide-react';
import { api } from '../api/apiClient';
import { C, F, panelStyle, labelStyle, monoStyle, inputStyle, inputLabelStyle, thStyle, tdStyle } from '../theme';

function clusterAccent(char = '') {
  if (char.includes('băng') || char.includes('mây'))           return '#06B6D4';
  if (char.includes('suy giảm') || char.includes('thủng'))    return C.danger;
  if (char.includes('nhiệt đới') || char.includes('xích'))    return C.warning;
  return C.success;
}

export default function ClusteringPanel({ clusters = [], onClustersUpdated }) {
  const [algorithm, setAlgorithm] = useState('KMeans');
  const [nClusters, setNClusters] = useState(4);
  const [eps, setEps]             = useState(1.2);
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState(null);

  const handleRun = async () => {
    setRunning(true);
    try {
      setResult(await api.runClustering(algorithm, parseFloat(eps), parseInt(nClusters)));
      if (onClustersUpdated) onClustersUpdated();
    } catch (err) {
      alert('Clustering error: ' + (err.response?.data?.detail || err.message));
    } finally { setRunning(false); }
  };

  const groups = {};
  clusters.forEach(c => {
    if (!groups[c.cluster_id]) groups[c.cluster_id] = { id: c.cluster_id, tag: c.tag, characteristic: c.characteristic, count: 0, sumO3: 0, sumRefl: 0 };
    groups[c.cluster_id].count++;
    groups[c.cluster_id].sumO3   += c.mean_ozone || 0;
    groups[c.cluster_id].sumRefl += c.mean_reflectivity || 20;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Control */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={14} strokeWidth={1.75} style={{ color: C.purple }} />
            <div>
              <p style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Spatial Clustering</p>
              <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                Variables: Lat · Lon · Ozone DU · Reflectivity 331
              </p>
            </div>
          </div>
          <span style={{ ...monoStyle, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.border}`, color: C.textMuted, background: C.surfaceAlt }}>
            Auto: 1×/day
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={inputLabelStyle}>Algorithm</label>
            <select value={algorithm} onChange={e => setAlgorithm(e.target.value)}
              style={{ ...inputStyle, appearance: 'none' }}>
              <option value="KMeans">K-Means</option>
              <option value="DBSCAN">DBSCAN</option>
            </select>
          </div>
          <div>
            <label style={inputLabelStyle}>{algorithm === 'KMeans' ? 'K (Clusters)' : 'Epsilon'}</label>
            <input style={inputStyle} type="number"
              step={algorithm === 'KMeans' ? '1' : '0.1'}
              value={algorithm === 'KMeans' ? nClusters : eps}
              onChange={e => algorithm === 'KMeans' ? setNClusters(e.target.value) : setEps(e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <button onClick={handleRun} disabled={running}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 4, border: 'none',
                cursor: running ? 'not-allowed' : 'pointer',
                fontFamily: F.sans, fontSize: 12, fontWeight: 600,
                background: running ? C.surfaceAlt : C.purple, color: running ? C.textMuted : '#fff',
                opacity: running ? 0.7 : 1,
              }}>
              <Play size={12} strokeWidth={1.75} />
              {running ? 'Running...' : 'Execute Clustering'}
            </button>
          </div>
        </div>

        {result && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: `${C.purple}0C`, border: `1px solid ${C.purple}33`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={12} strokeWidth={1.75} style={{ color: C.purple }} />
            <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textSecond }}>
              {result.cluster_count} clusters · {result.total_points_clustered} points processed
            </span>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {Object.values(groups).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {Object.values(groups).map((g, i) => {
            const acc = clusterAccent(g.characteristic || g.tag || '');
            const avgO3  = g.count > 0 ? (g.sumO3   / g.count).toFixed(1) : '—';
            const avgR   = g.count > 0 ? (g.sumRefl / g.count).toFixed(1) : '—';
            return (
              <div key={i} style={{ ...panelStyle, borderLeft: `3px solid ${acc}`, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ ...monoStyle, fontSize: 11, fontWeight: 600, color: acc }}>Cluster {i + 1}</span>
                  <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted }}>{g.count} pts</span>
                </div>
                <p style={{ fontFamily: F.sans, fontSize: 11, color: C.textSecond, marginBottom: 8, lineHeight: 1.4 }}>
                  {g.characteristic || g.tag || 'Standard atmospheric region'}
                </p>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                  {[['Ozone TB', `${avgO3} DU`], ['Reflectivity', `${avgR}%`]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 10, color: C.textMuted, marginBottom: 2 }}>
                      <span>{k}</span><span style={{ color: C.textSecond }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surfaceAlt }}>
          <p style={{ ...labelStyle, margin: 0 }}>Cluster Points Detail</p>
          <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted }}>{clusters.length} records</span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 320 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Cluster','Latitude','Longitude','Ozone DU','Reflectivity','Characteristic'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {clusters.length === 0 ? (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: 24, color: C.textDisabled }}>
                  No cluster data. Run clustering above.
                </td></tr>
              ) : clusters.slice(0, 100).map((c, i) => {
                const acc = clusterAccent(c.characteristic || c.tag || '');
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? C.surface : C.surfaceAlt }}>
                    <td style={tdStyle}>
                      <span style={{ padding: '1px 7px', borderRadius: 4, background: c.cluster_id === -1 ? C.surfaceAlt : `${acc}18`, color: c.cluster_id === -1 ? C.textMuted : acc, fontSize: 10, fontWeight: 600, fontFamily: F.mono }}>
                        {c.cluster_id === -1 ? 'Noise' : `C-${c.cluster_id + 1}`}
                      </span>
                    </td>
                    <td style={tdStyle}>{c.latitude?.toFixed(2)}°</td>
                    <td style={tdStyle}>{c.longitude?.toFixed(2)}°</td>
                    <td style={{ ...tdStyle, color: C.textPrimary, fontWeight: 600 }}>{c.mean_ozone?.toFixed(1)}</td>
                    <td style={tdStyle}>{(c.mean_reflectivity || 20).toFixed(1)}%</td>
                    <td style={{ ...tdStyle, color: acc, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.characteristic || c.tag || 'Normal'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
