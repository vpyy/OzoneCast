import React, { useState, useEffect } from 'react';
import { TrendingUp, Grid, RefreshCw } from 'lucide-react';
import { api } from '../api/apiClient';

const S = {
  panel:  { background: '#111827', border: '1px solid #1F2937', borderRadius: 4, padding: 16 },
  label:  { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280' },
  mono:   { fontFamily: 'JetBrains Mono, monospace' },
};

function getCorrStyle(val) {
  if (val === 1.0) return { background: '#1F2937', color: '#9CA3AF' };
  if (val > 0.6)  return { background: '#EF444488', color: '#FEF2F2' };
  if (val > 0.3)  return { background: '#EF444444', color: '#FCA5A5' };
  if (val > 0.05) return { background: '#EF444418', color: '#FCA5A5' };
  if (val > -0.05) return { background: 'transparent', color: '#4B5563' };
  if (val > -0.3) return { background: '#3B82F618', color: '#93C5FD' };
  if (val > -0.6) return { background: '#3B82F644', color: '#93C5FD' };
  return { background: '#3B82F688', color: '#EFF6FF' };
}

export default function TrendSeasonalCorrelation() {
  const [trendData, setTrendData] = useState(null);
  const [corrData, setCorrData]   = useState(null);
  const [loading, setLoading]     = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.allSettled([api.getTrendSeasonal(), api.getCorrelationMatrix()]);
      if (t.status === 'fulfilled') setTrendData(t.value);
      if (c.status === 'fulfilled') setCorrData(c.value);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const series    = trendData?.series || [];
  const matrix    = corrData?.matrix || [];
  const variables = corrData?.variables || [];

  return (
    <div className="space-y-3">

      {/* Header */}
      <div style={{ ...S.panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={14} strokeWidth={1.75} style={{ color: '#6366F1' }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#F3F4F6', margin: 0 }}>Trend Decomposition &amp; Correlation Analysis</p>
            <p style={{ ...S.mono, fontSize: 10, color: '#4B5563', marginTop: 2 }}>Additive model · Pearson r matrix 6×6</p>
          </div>
        </div>
        <button onClick={fetchData}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 4, border: '1px solid #374151', background: '#1F2937', color: '#9CA3AF', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={11} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Trend chart */}
        <div style={S.panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={S.label}>Trend &amp; Seasonal Decomposition</p>
            <span style={{ ...S.mono, fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid #374151', color: '#6B7280' }}>Additive</span>
          </div>
          <p style={{ ...S.mono, fontSize: 10, color: '#4B5563', marginBottom: 10 }}>
            Observed = Trend + Seasonal + Residual
          </p>

          <div style={{ height: 220 }}>
            {series.length > 0 ? (
              <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="none">
                {/* Gridlines */}
                {[50, 100, 150].map(y => (
                  <line key={y} x1="30" y1={y} x2="490" y2={y} stroke="#1F2937" strokeWidth="1" />
                ))}
                {/* Y labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                  const du = Math.round(350 - r * 150);
                  return <text key={i} x="25" y={30 + r * 150} fontSize="9" fill="#4B5563" textAnchor="end" fontFamily="JetBrains Mono, monospace">{du}</text>;
                })}

                {/* Observed */}
                <polyline fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="3 3"
                  points={series.map((s, i) => `${35 + (i / (series.length - 1)) * 445},${100 - (s.observed - 295) * 1.5}`).join(' ')} />

                {/* Trend */}
                <polyline fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"
                  points={series.map((s, i) => `${35 + (i / (series.length - 1)) * 445},${100 - (s.trend - 295) * 1.5}`).join(' ')} />

                {/* Seasonal */}
                <polyline fill="none" stroke="#F59E0B" strokeWidth="1.75" strokeLinecap="round"
                  points={series.map((s, i) => `${35 + (i / (series.length - 1)) * 445},${160 - s.seasonal * 1.2}`).join(' ')} />

                {/* X labels */}
                {series.filter((_, i) => i % 4 === 0).map((s, i) => (
                  <text key={i} x={35 + (i * 4 / (series.length - 1)) * 445} y="195" fontSize="9" fill="#4B5563" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                    {s.label}
                  </text>
                ))}
                {/* Y-axis label */}
                <text x="8" y="100" fontSize="9" fill="#4B5563" textAnchor="middle" transform="rotate(-90,8,100)" fontFamily="JetBrains Mono, monospace">DU</text>
              </svg>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: 11 }}>
                Loading decomposition series...
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #1F2937', paddingTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { color: '#6366F1', label: 'Trend (long-term)' },
              { color: '#F59E0B', label: 'Seasonal' },
              { color: '#374151', dashed: true, label: 'Observed' },
            ].map(({ color, dashed, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6B7280' }}>
                <span style={{ width: 20, height: 2, background: color, display: 'inline-block', borderRadius: 1, borderTop: dashed ? `2px dashed ${color}` : undefined, opacity: dashed ? 0.6 : 1 }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Correlation matrix */}
        <div style={S.panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Grid size={13} strokeWidth={1.75} style={{ color: '#EF4444' }} />
              <p style={S.label}>Correlation Matrix 6×6</p>
            </div>
            <span style={{ ...S.mono, fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid #374151', color: '#6B7280' }}>Pearson r</span>
          </div>
          <p style={{ ...S.mono, fontSize: 10, color: '#4B5563', marginBottom: 10 }}>
            Ozone · Reflectivity · UV Aerosol · SZA · Latitude · Longitude
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace' }}>
              <thead>
                <tr>
                  <th style={{ padding: '5px 6px', fontSize: 9, color: '#4B5563', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Variable</th>
                  {variables.map((v, i) => (
                    <th key={i} style={{ padding: '5px 4px', fontSize: 9, color: '#4B5563', fontWeight: 600, textAlign: 'center', maxWidth: 50, overflow: 'hidden' }} title={v}>
                      {v.split(' ')[0].substring(0, 6)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 6px', fontSize: 9, color: '#6B7280', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {row.variable.substring(0, 12)}
                    </td>
                    {row.values.map((val, j) => {
                      const st = getCorrStyle(val);
                      return (
                        <td key={j} style={{ padding: '2px 2px', textAlign: 'center' }}>
                          <div style={{ ...st, fontSize: 9, padding: '3px 2px', borderRadius: 3, fontWeight: val === 1.0 ? 400 : 600 }}
                            title={`${row.variable} × ${variables[j]}: r = ${val}`}>
                            {val === 1 ? '1.00' : val > 0 ? `+${val}` : val}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {matrix.length === 0 && (
            <div style={{ textAlign: 'center', color: '#374151', fontSize: 11, padding: 20 }}>
              No correlation data yet.
            </div>
          )}

          <div style={{ borderTop: '1px solid #1F2937', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4B5563', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#3B82F688', display: 'inline-block' }} /> Negative (−1.0)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1F2937', border: '1px solid #374151', display: 'inline-block' }} /> Neutral (0)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#EF444488', display: 'inline-block' }} /> Positive (+1.0)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
