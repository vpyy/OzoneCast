import React from 'react';
import { Globe, LineChart, TrendingUp, Layers, BrainCircuit, Database, RefreshCw, Radio } from 'lucide-react';
import { C, F } from '../theme';

const NAV = [
  { id: 'overview',   label: 'Bản đồ & Tổng quan',   desc: 'Grid 0.5° · Raw Swath',        icon: Globe        },
  { id: 'analytics',  label: 'Chuỗi thời gian',       desc: 'Line · Scatter · Histogram',   icon: LineChart    },
  { id: 'trend_corr', label: 'Xu hướng & Tương quan', desc: 'Trend · Seasonal · Pearson r', icon: TrendingUp   },
  { id: 'clustering', label: 'Phân cụm Khu vực',      desc: 'K-Means · DBSCAN',             icon: Layers       },
  { id: 'prediction', label: 'Dự báo & Học máy',      desc: 'Regressor · Classifier',       icon: BrainCircuit },
  { id: 'raw',        label: 'Dữ liệu Thô',           desc: 'HDF-EOS5 · 10 trường',        icon: Database     },
];

export default function Navbar({ activeTab, setActiveTab, onRefresh, loading, wsStatus = 'disconnected' }) {
  const wsColor = wsStatus === 'connected' ? C.success : wsStatus === 'reconnecting' ? C.warning : C.textDisabled;
  const wsLabel = wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting' : 'REST Fallback';

  const pill = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '5px 9px', marginTop: 6, borderRadius: 4,
    border: `1px solid ${C.border}`, background: C.surfaceAlt,
    fontSize: 10, fontFamily: F.opensans, color: C.textMuted,
  };

  return (
    <aside style={{
      width: 236, minWidth: 236, flexShrink: 0,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0, zIndex: 40,
    }}>

      {/* Brand */}
      <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontFamily: F.heading, fontSize: 14, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>
          NASA Ozone System
        </p>
        <p style={{ fontFamily: F.mono, fontSize: 10, color: C.textMuted, letterSpacing: '0.08em', marginTop: 2 }}>
          MICROSERVICES PLATFORM
        </p>

        {/* PostgreSQL */}
        <div style={pill}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.success }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
            PostgreSQL :5432
          </span>
          <span style={{ color: C.success }}>OK</span>
        </div>

        {/* WebSocket */}
        <div style={{ ...pill, marginTop: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: wsColor }}>
            <Radio size={10} strokeWidth={1.75} />
            WS · {wsLabel}
          </span>
          <span>/ws/stream</span>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        <div style={{ fontFamily: F.heading, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDisabled, padding: '4px 8px 8px' }}>
          Navigation
        </div>

        {NAV.map(({ id, label, desc, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 4, marginBottom: 2,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.12s',
                background: active ? C.accent : 'transparent',
                color: active ? '#fff' : C.textSecond,
                fontFamily: F.heading,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceAlt; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={15} strokeWidth={1.75} style={{ flexShrink: 0, color: active ? '#fff' : C.textMuted }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.heading, fontSize: 12, fontWeight: active ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </div>
                <div style={{ fontFamily: F.opensans, fontSize: 10, color: active ? 'rgba(255,255,255,0.85)' : C.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {desc}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.border}`, background: C.surfaceAlt }}>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 0', borderRadius: 4, border: `1px solid ${C.border}`,
            background: C.surface, color: loading ? C.textDisabled : C.textSecond,
            fontSize: 11, fontWeight: 700, fontFamily: F.heading,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={12} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
        <p style={{ fontFamily: F.opensans, fontSize: 10, color: C.textDisabled, textAlign: 'center', marginTop: 8 }}>
          Aura/OMI · v2.0 · Docker Compose
        </p>
      </div>
    </aside>
  );
}
