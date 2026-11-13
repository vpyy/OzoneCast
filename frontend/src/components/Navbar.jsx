import React from 'react';
import { Activity, Database, Layers, BrainCircuit, Globe, RefreshCw } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onRefresh, loading }) {
  const navItems = [
    { id: 'overview', label: 'Overview & Map', icon: Globe },
    { id: 'raw', label: 'Raw Ingestion', icon: Database },
    { id: 'clustering', label: 'Spatial Clustering', icon: Layers },
    { id: 'prediction', label: 'ML Prediction', icon: BrainCircuit },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-lg border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-sky-500 p-2 rounded-lg text-white shadow-md">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-300 bg-clip-text text-transparent">
                NASA Ozone System
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800">
                Microservices Architecture
              </span>
            </div>
          </div>

          <nav className="flex space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-slate-700 transition"
            title="Refresh System Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}

