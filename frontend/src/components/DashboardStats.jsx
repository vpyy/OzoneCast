import React from 'react';

export default function DashboardStats({ stats }) {
  const cards = [
    {
      title: 'Granules',
      value: stats?.total_granules || 0,
      unit: 'files'
    },
    {
      title: 'Raw Points',
      value: (stats?.total_raw_measurements || 0).toLocaleString(),
      unit: 'swath pixels'
    },
    {
      title: 'Ozone (avg)',
      value: `${stats?.avg_ozone_du || 290}`,
      unit: 'DU'
    },
    {
      title: 'Anomalies',
      value: stats?.anomalies_detected || 0,
      unit: 'zones'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, idx) => (
        <div key={idx} className="bg-white p-4 border border-gray-200 hover:shadow transition">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.title}</p>
          <p className="text-3xl font-semibold text-gray-900 mt-2">{c.value}</p>
          <p className="text-xs text-gray-400 mt-1">{c.unit}</p>
        </div>
      ))}
    </div>
  );
}

