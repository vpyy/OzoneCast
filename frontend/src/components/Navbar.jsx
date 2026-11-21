import React from 'react';

export default function Navbar({ activeTab, setActiveTab, onRefresh, loading }) {
  const navItems = [
    { id: 'overview', label: 'Map' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'trend_corr', label: 'Trends' },
    { id: 'clustering', label: 'Clustering' },
    { id: 'prediction', label: 'Forecast' },
    { id: 'raw', label: 'Raw Data' },
  ];

  return (
    <aside className="w-56 bg-gray-900 text-white border-r border-gray-800 flex flex-col h-screen sticky top-0 shrink-0 z-40">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold">OzoneCast</h1>
        <p className="text-xs text-gray-400 mt-1">NASA Satellite System</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full px-3 py-2 text-sm text-left transition-colors ${
              activeTab === item.id
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-full px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded transition disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">NASA Aura/OMI</p>
      </div>
    </aside>
  );
}
