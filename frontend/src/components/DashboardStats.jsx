import React from 'react';
import { Database, Activity, BarChart2, ShieldAlert } from 'lucide-react';
import { C, F } from '../theme';

export default function DashboardStats({ stats }) {
  const anomaly = stats?.anomalies_detected > 0;

  const cards = [
    { label: 'Tracked Granules',    value: stats?.total_granules ?? 0,                           unit: '',   sub: 'NASA L2 HDF-EOS5',                                             icon: Database,    accent: C.accent   },
    { label: 'Raw Measurements',    value: (stats?.total_raw_measurements ?? 0).toLocaleString(), unit: '',   sub: 'Point-level soundings',                                        icon: Activity,    accent: C.purple   },
    { label: 'Avg Ozone Column',    value: stats?.avg_ozone_du ?? 290,                            unit: 'DU', sub: `Min ${stats?.min_ozone_du ?? 180} · Max ${stats?.max_ozone_du ?? 450} DU`, icon: BarChart2,   accent: C.success  },
    { label: 'Depletion Anomalies', value: stats?.anomalies_detected ?? 0,                        unit: '',   sub: 'Zones < 220 DU',                                               icon: ShieldAlert, accent: anomaly ? C.danger : C.warning },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map(({ label, value, unit, sub, icon: Icon, accent }, i) => (
        <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: F.heading, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.textMuted, margin: 0 }}>
                {label}
              </p>
              <p style={{ fontFamily: F.heading, fontSize: 24, fontWeight: 700, color: C.textPrimary, margin: '4px 0 0', lineHeight: 1.2 }}>
                {value}
                {unit && <span style={{ fontFamily: F.opensans, fontSize: 12, fontWeight: 600, color: C.textMuted, marginLeft: 4 }}>{unit}</span>}
              </p>
              <p style={{ fontFamily: F.opensans, fontSize: 10, color: C.textMuted, marginTop: 4 }}>{sub}</p>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 4, background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 }}>
              <Icon size={15} strokeWidth={1.75} style={{ color: accent }} />
            </div>
          </div>
          <div style={{ marginTop: 10, height: 2, borderRadius: 1, background: C.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '55%', background: accent, borderRadius: 1 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
