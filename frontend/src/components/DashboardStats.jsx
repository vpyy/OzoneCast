import React from 'react';
import { Database, Activity, ShieldAlert, Cpu, BarChart2 } from 'lucide-react';

export default function DashboardStats({ stats }) {
  const cards = [
    {
      title: 'Tracked Granules',
      value: stats?.total_granules || 0,
      sub: 'NASA L2 HDF5 Swaths',
      icon: Database,
      color: 'text-sky-500',
      bg: 'bg-sky-50'
    },
    {
      title: 'Raw Measurement Points',
      value: (stats?.total_raw_measurements || 0).toLocaleString(),
      sub: 'Point-level soundings',
      icon: Activity,
      color: 'text-indigo-500',
      bg: 'bg-indigo-50'
    },
    {
      title: 'Average Ozone (DU)',
      value: `${stats?.avg_ozone_du || 290} DU`,
      sub: `Min: ${stats?.min_ozone_du || 180} | Max: ${stats?.max_ozone_du || 450}`,
      icon: BarChart2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50'
    },
    {
      title: 'Depletion Anomalies',
      value: stats?.anomalies_detected || 0,
      sub: 'Critical low-ozone zones (<220 DU)',
      icon: ShieldAlert,
      color: (stats?.anomalies_detected > 0) ? 'text-rose-500' : 'text-amber-500',
      bg: (stats?.anomalies_detected > 0) ? 'bg-rose-50' : 'bg-amber-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c, idx) => {
        const Icon = c.icon;
        return (
          <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.title}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{c.value}</p>
                <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
              </div>
              <div className={`p-3 rounded-xl ${c.bg}`}>
                <Icon className={`h-6 w-6 ${c.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

