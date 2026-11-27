import React, { useState } from 'react';
import { RefreshCw, Filter, Database } from 'lucide-react';
import { C, F, panelStyle, labelStyle, thStyle, tdStyle, btnPrimary } from '../theme';

function ozoneChip(du) {
  if (du == null)  return { background: C.surfaceAlt,     color: C.textMuted   };
  if (du < 220)    return { background: `${C.danger}18`,  color: C.danger      };
  if (du > 400)    return { background: `${C.purple}18`,  color: C.purple      };
  return           { background: `${C.success}18`,         color: C.success     };
}

function formatDateTime(val, granuleName) {
  if (val) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        const y = d.getUTCFullYear();
        const m = pad(d.getUTCMonth() + 1);
        const day = pad(d.getUTCDate());
        const h = pad(d.getUTCHours());
        const min = pad(d.getUTCMinutes());
        const s = pad(d.getUTCSeconds());
        return `${y}-${m}-${day} ${h}:${min}:${s}`;
      }
    } catch {}
  }
  if (granuleName) {
    const match = granuleName.match(/(\d{4})m(\d{2})(\d{2})(?:t(\d{2})(\d{2})(\d{2})?)?/);
    if (match) {
      const [, y, m, day, h, min, s] = match;
      return `${y}-${m}-${day} ${h || '00'}:${min || '00'}:${s || '00'}`;
    }
  }
  return '—';
}

const TABLE_COLUMNS = [
  { en: '#', vi: 'STT' },
  { en: 'Date / Time', vi: 'Ngày quan trắc' },
  { en: 'Latitude', vi: 'Vĩ độ' },
  { en: 'Longitude', vi: 'Kinh độ' },
  { en: 'Ozone (DU)', vi: 'Cột Ozone' },
  { en: 'SZA (°)', vi: 'Góc thiên đỉnh mặt trời' },
  { en: 'Cloud (%)', vi: 'Độ che phủ mây' },
  { en: 'P Cloud (hPa)', vi: 'Áp suất mây' },
  { en: 'Water', vi: 'Mặt nước / Đất liền' },
  { en: 'QC Flag', vi: 'Cờ kiểm tra chất lượng' },
  { en: 'Granule', vi: 'Tên file vệ tinh gốc' },
];

export default function RawDataTable({ rawData = [], granules = [], onDataMutated }) {
  const [filterGranule, setFilterGranule] = useState('');
  const [refreshing, setRefreshing]       = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onDataMutated) await onDataMutated();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const filtered = filterGranule ? rawData.filter(r => r.granule_name === filterGranule) : rawData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Action bar */}
      <div style={{ ...panelStyle, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ ...btnPrimary, opacity: refreshing ? 0.7 : 1 }}
          >
            <RefreshCw size={13} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Đang làm mới...' : 'Làm mới bảng dữ liệu (Refresh)'}
          </button>
        </div>

        {granules.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={12} strokeWidth={1.75} style={{ color: C.textMuted }} />
            <select value={filterGranule} onChange={e => setFilterGranule(e.target.value)}
              style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 8px', color: C.textSecond, fontSize: 11, fontFamily: F.opensans, outline: 'none' }}>
              <option value="">Tất cả Granule ({granules.length} file)</option>
              {granules.map(g => <option key={g.id || g.filename} value={g.filename}>{g.filename}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surfaceAlt }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={13} strokeWidth={1.75} style={{ color: C.accent }} />
            <p style={{ ...labelStyle, margin: 0 }}>Bảng Dữ Liệu Quan Trắc (Raw Measurements Data Table)</p>
          </div>
          <span style={{ fontFamily: F.opensans, fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
            {filtered.length.toLocaleString('vi-VN')} bản ghi (records)
          </span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 520 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {TABLE_COLUMNS.map(col => (
                  <th key={col.en} style={thStyle}>
                    <span style={{ color: C.textPrimary, fontWeight: 700 }}>{col.en}</span>
                    <span style={{ fontSize: 9, fontWeight: 500, color: C.textMuted, textTransform: 'none', marginLeft: 4, display: 'inline-block' }}>
                      ({col.vi})
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={TABLE_COLUMNS.length} style={{ ...tdStyle, textAlign: 'center', padding: 32, color: C.textDisabled }}>
                  Chưa có bản ghi nào.
                </td></tr>
              ) : filtered.slice(0, 150).map((r, i) => {
                const chip = ozoneChip(r.ozone_column_raw);
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? C.surface : C.surfaceAlt }}
                    onMouseEnter={e => e.currentTarget.style.background = C.hover}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.surface : C.surfaceAlt}>
                    <td style={{ ...tdStyle, color: C.textDisabled, fontFamily: F.mono }}>#{r.point_index}</td>
                    <td style={{ ...tdStyle, color: C.textSecond, fontFamily: F.mono, fontSize: 10, whiteSpace: 'nowrap' }}>
                      {formatDateTime(r.created_at, r.granule_name)}
                    </td>
                    <td style={{ ...tdStyle, color: C.textPrimary, fontFamily: F.mono }}>{r.latitude?.toFixed(3)}°</td>
                    <td style={{ ...tdStyle, color: C.textPrimary, fontFamily: F.mono }}>{r.longitude?.toFixed(3)}°</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: F.mono, ...chip }}>
                        {r.ozone_column_raw != null ? r.ozone_column_raw.toFixed(1) : 'NULL'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: F.mono }}>{(r.solar_zenith_angle ?? 45).toFixed(1)}</td>
                    <td style={{ ...tdStyle, fontFamily: F.mono }}>{((r.radiative_cloud_fraction ?? 0) * 100).toFixed(1)}</td>
                    <td style={{ ...tdStyle, fontFamily: F.mono }}>{(r.cloud_pressure ?? 0).toFixed(0)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        background: (r.water_fraction ?? 0) > 0.5 ? '#0284c718' : '#10b98118',
                        color: (r.water_fraction ?? 0) > 0.5 ? '#0284c7' : '#10b981'
                      }}>
                        {(r.water_fraction ?? 0) > 0.5 ? 'Sea (Biển)' : 'Land (Đất)'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: r.quality_flag === 0 ? C.surfaceAlt : `${C.warning}18`, color: r.quality_flag === 0 ? C.textMuted : C.warning, fontFamily: F.mono }}>
                        {r.quality_flag}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: C.textMuted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: F.mono, fontSize: 10 }} title={r.granule_name}>
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
