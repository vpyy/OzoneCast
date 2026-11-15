import React from 'react';
import { Activity, Database, Layers, BrainCircuit, Globe, RefreshCw, LineChart, TrendingUp, CheckCircle, Server } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onRefresh, loading }) {
  const navItems = [
    { id: 'overview', label: 'Bản đồ & Tổng quan', desc: 'Lưới Silver & Điểm thô Swath', icon: Globe },
    { id: 'analytics', label: 'Biểu đồ Chuỗi thời gian', desc: 'Line, Scatter & Histogram', icon: LineChart },
    { id: 'trend_corr', label: 'Xu hướng & Tương quan', desc: 'Trend, Seasonal & Heatmap 6x6', icon: TrendingUp },
    { id: 'clustering', label: 'Phân cụm Khu vực', desc: 'K-Means 4 biến không gian', icon: Layers },
    { id: 'prediction', label: 'Dự báo Ngày mai & ML', desc: 'Hồi quy DU & Nhãn cảnh báo', icon: BrainCircuit },
    { id: 'raw', label: 'Dữ liệu Thô (7 Trường)', desc: 'Bóc tách từ file HDF-EOS5', icon: Database },
  ];

  return (
    <aside className="w-64 lg:w-72 bg-slate-900 text-white border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-40">
      {/* ── 1. Brand & Header ── */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-sky-600 to-indigo-500 p-2.5 rounded-xl text-white shadow-lg shadow-sky-600/30">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight bg-gradient-to-r from-sky-400 via-indigo-200 to-white bg-clip-text text-transparent">
              NASA Ozone System
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
              Microservices Platform
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="mt-4 flex items-center justify-between bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Hệ thống đang hoạt động
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
            7 Containers
          </span>
        </div>
      </div>

      {/* ── 2. Navigation Menu Links ── */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-2 font-mono">
          Điều hướng Chức năng
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-sky-500/40 text-white' : 'bg-slate-800 text-slate-400'}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate">{item.label}</div>
                <div className={`text-[10px] truncate ${isActive ? 'text-sky-100' : 'text-slate-400'}`}>
                  {item.desc}
                </div>
              </div>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── 3. Bottom Actions & Footer ── */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          <span>{loading ? 'Đang cập nhật...' : 'Làm mới Dữ liệu'}</span>
        </button>

        <div className="text-[10px] text-slate-400 text-center leading-tight">
          NASA Aura/OMI & Suomi-NPP &bull; v2.0<br/>
          Docker Compose Architecture
        </div>
      </div>
    </aside>
  );
}
