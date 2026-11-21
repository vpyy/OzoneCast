import React, { useState } from 'react';
import { Download, Play, Filter, CheckCircle2, XCircle, Database } from 'lucide-react';
import { api } from '../api/apiClient';
import { C, F, panelStyle, labelStyle, monoStyle, thStyle, tdStyle, btnPrimary, btnSecondary } from '../theme';

function ozoneChip(du) {
  if (du == null)  return { background: C.surfaceAlt,     color: C.textMuted   };
  if (du < 220)    return { background: `${C.danger}18`,  color: C.danger      };
  if (du > 400)    return { background: `${C.purple}18`,  color: C.purple      };
  return           { background: `${C.success}18`,         color: C.success     };
}

export default function RawDataTable({ rawData = [], granules = [], onDataMutated }) {
  const [filterGranule, setFilterGranule] = useState('');
  const [ingesting, setIngesting]         = useState(false);
  const [analyzing, setAnalyzing]         = useState(false);
  const [message, setMessage]             = useState(null);

  const handleIngestMock = async () => {
    setIngesting(true); setMessage(null);
    try {
      const res = await api.triggerIngestMock();
      setMessage({ ok: true, text: `Ingested: ${res.file || res.result?.filename || 'OK'}` });
      if (onDataMutated) onDataMutated();
    } catch (err) {
      setMessage({ ok: false, text: 'Ingest error: ' + (err.response?.data?.detail || err.message) });
    } finally { setIngesting(false); }
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true); setMessage(null);
    try {
      const res = await api.runAnalysis(filterGranule || null);
      setMessage({ ok: true, text: `Analysis complete — ${res.cells_processed ?? 0} grid cells · ${res.anomalies_found ?? 0} anomalies` });
      if (onDataMutated) onDataMutated();
    } catch (err) {
      setMessage({ ok: false, text: 'Analysis error: ' + (err.response?.data?.detail || err.message) });
    } finally { setAnalyzing(false); }
  };

  const filtered = filterGranule ? rawData.filter(r => r.granule_name === filterGranule) : rawData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Action bar */}
      <div style={{ ...panelStyle, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleIngestMock} disabled={ingesting}
            style={{ ...btnPrimary, opacity: ingesting ? 0.5 : 1 }}>
            <Download size={12} strokeWidth={1.75} />
            {ingesting ? 'Ingesting...' : 'Ingest Satellite Data'}
          </button>
          <button onClick={handleRunAnalysis} disabled={analyzing || rawData.length === 0}
            style={{ ...btnPrimary, background: C.success, opacity: (analyzing || rawData.length === 0) ? 0.5 : 1 }}>
            <Play size={12} strokeWidth={1.75} />
            {analyzing ? 'Analyzing...' : 'Run ETL Analysis'}
          </button>
        </div>

        {granules.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={12} strokeWidth={1.75} style={{ color: C.textMuted }} />
            <select value={filterGranule} onChange={e => setFilterGranule(e.target.value)}
              style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 8px', color: C.textSecond, fontSize: 11, fontFamily: F.mono, outline: 'none' }}>
              <option value="">All Granules ({granules.length})</option>
              {granules.map(g => <option key={g.id} value={g.filename}>{g.filename}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={{ ...panelStyle, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${message.ok ? C.success : C.danger}44`, background: `${message.ok ? C.success : C.danger}08` }}>
          {message.ok
            ? <CheckCircle2 size={12} strokeWidth={1.75} style={{ color: C.success, flexShrink: 0 }} />
            : <XCircle      size={12} strokeWidth={1.75} style={{ color: C.danger,  flexShrink: 0 }} />
          }
          <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textSecond }}>{message.text}</span>
        </div>
      )}

      {/* Table */}
      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surfaceAlt }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={13} strokeWidth={1.75} style={{ color: C.accent }} />
            <p style={{ ...labelStyle, margin: 0 }}>Raw Measurements — 10 NASA Fields</p>
          </div>
          <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted }}>{filtered.length} records</span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 480 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#','Latitude','Longitude','Ozone (DU)','SZA (°)','Cloud (%)','P Cloud (hPa)','Water','QC Flag','Granule'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: 32, color: C.textDisabled }}>
                  No records. Click "Ingest Satellite Data" to load.
                </td></tr>
              ) : filtered.slice(0, 150).map((r, i) => {
                const chip = ozoneChip(r.ozone_column_raw);
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? C.surface : C.surfaceAlt }}
                    onMouseEnter={e => e.currentTarget.style.background = C.hover}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.surface : C.surfaceAlt}>
                    <td style={{ ...tdStyle, color: C.textDisabled }}>#{r.point_index}</td>
                    <td style={{ ...tdStyle, color: C.textPrimary }}>{r.latitude?.toFixed(3)}°</td>
                    <td style={{ ...tdStyle, color: C.textPrimary }}>{r.longitude?.toFixed(3)}°</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: F.mono, ...chip }}>
                        {r.ozone_column_raw != null ? r.ozone_column_raw.toFixed(1) : 'NULL'}
                      </span>
                    </td>
                    <td style={tdStyle}>{(r.solar_zenith_angle ?? 45).toFixed(1)}</td>
                    <td style={tdStyle}>{((r.radiative_cloud_fraction ?? 0) * 100).toFixed(1)}</td>
                    <td style={tdStyle}>{(r.cloud_pressure ?? 0).toFixed(0)}</td>
                    <td style={tdStyle}>{(r.water_fraction ?? 0) > 0.5 ? 'Sea' : 'Land'}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: r.quality_flag === 0 ? C.surfaceAlt : `${C.warning}18`, color: r.quality_flag === 0 ? C.textMuted : C.warning, fontFamily: F.mono }}>
                        {r.quality_flag}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: C.textMuted, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.granule_name}>
                      {r.granule_name}
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
