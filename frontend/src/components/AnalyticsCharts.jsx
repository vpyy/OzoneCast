import React, { useState, useEffect } from 'react';
import { LineChart, BarChart2, ScatterChart, Calendar, RefreshCw } from 'lucide-react';
import { api } from '../api/apiClient';

export default function AnalyticsCharts() {
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTimeseries = async (p) => {
    setLoading(true);
    try {
      const res = await api.getTimeseries(p);
      setData(res);
    } catch (err) {
      console.error("Error fetching timeseries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeseries(period);
  }, [period]);

  const linePoints = data?.line_chart || [];
  const scatterPoints = data?.scatter_plot || [];
  const histBars = data?.histogram || [];

  // Line chart SVG calculation
  const maxOzone = Math.max(...linePoints.map(d => d.ozone_max || d.ozone_mean || 320), 380);
  const minOzone = Math.min(...linePoints.map(d => d.ozone_min || d.ozone_mean || 220), 180);
  const ozoneRange = Math.max(maxOzone - minOzone, 50);

  const getY = (val) => {
    const norm = (val - minOzone) / ozoneRange;
    return 180 - norm * 150;
  };

  return (
    <div className="space-y-6">
      {/* Header & Period Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <LineChart className="w-5 h-5 text-sky-600" />
            Bộ 3 Biểu đồ Chuỗi thời gian (Time-Series Analytics)
          </h2>
          <p className="text-xs text-slate-500">
            Tổng hợp dữ liệu theo chu kỳ, biểu diễn đường diễn biến, phân tán tương quan và phân phối tần suất Ozone
          </p>
        </div>

        {/* Filter buttons: Ngày / Tuần / Tháng */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
          <button
            onClick={() => setPeriod('day')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              period === 'day' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo Ngày (Day)
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              period === 'week' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo Tuần (Week)
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              period === 'month' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo Tháng (Month)
          </button>
          <button
            onClick={() => fetchTimeseries(period)}
            title="Làm mới"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid 3 biểu đồ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Line Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                1. Biểu đồ đường (Line Chart) — Diễn biến Ozone (DU)
              </h3>
              <p className="text-xs text-slate-400">Nồng độ trung bình kèm dải min-max theo {period === 'day' ? 'ngày' : period === 'week' ? 'tuần' : 'tháng'}</p>
            </div>
            <span className="text-xs font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-200">
              Đơn vị: DU
            </span>
          </div>

          <div className="h-64 w-full relative pt-2">
            {linePoints.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 500 210" preserveAspectRatio="none">
                {/* Grid horizontal lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = 30 + ratio * 150;
                  const du = Math.round(maxOzone - ratio * ozoneRange);
                  return (
                    <g key={i}>
                      <line x1="40" y1={y} x2="490" y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                      <text x="32" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                        {du}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area for min-max band */}
                {linePoints.length > 1 && (
                  <polygon
                    points={`
                      ${linePoints.map((p, i) => `${45 + (i / (linePoints.length - 1)) * 435},${getY(p.ozone_max || p.ozone_mean)}`).join(' ')}
                      ${linePoints.slice().reverse().map((p, i) => `${45 + ((linePoints.length - 1 - i) / (linePoints.length - 1)) * 435},${getY(p.ozone_min || p.ozone_mean)}`).join(' ')}
                    `}
                    fill="#38bdf8"
                    opacity="0.18"
                  />
                )}

                {/* Main Trend Line */}
                {linePoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={linePoints.map((p, i) => `${45 + (i / (linePoints.length - 1)) * 435},${getY(p.ozone_mean)}`).join(' ')}
                  />
                )}

                {/* Data Points */}
                {linePoints.map((p, i) => {
                  const cx = 45 + (i / Math.max(linePoints.length - 1, 1)) * 435;
                  const cy = getY(p.ozone_mean);
                  return (
                    <g key={i} className="group cursor-pointer">
                      <circle cx={cx} cy={cy} r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                      <text x={cx} y="200" textAnchor="middle" fontSize="10" fill="#64748b">
                        {p.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Đang chờ tải dữ liệu chuỗi thời gian...
              </div>
            )}
          </div>
          <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-sky-600 inline-block"></span> Nồng độ Ozone trung bình</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-sky-200 inline-block rounded-sm"></span> Vùng dao động Min-Max</span>
          </div>
        </div>

        {/* 2. Scatter Plot */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span>
                2. Biểu đồ phân tán (Scatter Plot) — Góc Mặt Trời vs Ozone
              </h3>
              <p className="text-xs text-slate-400">Trục X: Solar Zenith Angle (10°-85°) &bull; Trục Y: Nồng độ Ozone (DU)</p>
            </div>
            <span className="text-xs font-mono bg-violet-50 text-violet-700 px-2 py-0.5 rounded border border-violet-200">
              Tương quan Bức xạ
            </span>
          </div>

          <div className="h-64 w-full relative pt-2">
            {scatterPoints.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 500 210">
                {/* Background Grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line key={i} x1="45" y1={30 + r * 140} x2="480" y2={30 + r * 140} stroke="#f1f5f9" />
                ))}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line key={i} x1={45 + r * 435} y1="30" x2={45 + r * 435} y2="170" stroke="#f1f5f9" />
                ))}

                {/* Scatter Dots */}
                {scatterPoints.map((pt, i) => {
                  const cx = 45 + ((pt.x_sza - 10) / 75) * 430;
                  const cy = 170 - ((pt.y_ozone - 150) / 320) * 140;
                  const isDepleted = pt.y_ozone < 220;
                  return (
                    <circle
                      key={i}
                      cx={Math.max(45, Math.min(475, cx))}
                      cy={Math.max(30, Math.min(170, cy))}
                      r="4"
                      fill={isDepleted ? "#ef4444" : "#8b5cf6"}
                      fillOpacity="0.75"
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Axes labels */}
                <text x="45" y="195" fontSize="10" fill="#94a3b8">10° (SZA Thấp)</text>
                <text x="260" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">Góc thiên đỉnh mặt trời (Độ)</text>
                <text x="475" y="195" fontSize="10" fill="#94a3b8" textAnchor="end">85° (Vĩ độ cao)</text>
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu phân tán...
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span> Điểm quan trắc thông thường</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Điểm suy giảm Ozone (&lt;220 DU)</span>
          </div>
        </div>

        {/* 3. Histogram */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                3. Biểu đồ tần suất (Histogram) — Phân phối mật độ nồng độ Ozone
              </h3>
              <p className="text-xs text-slate-400">Số lượng điểm quan trắc / pixels rơi vào từng dải nồng độ Dobson Units (DU)</p>
            </div>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
              Tổng số dải: {histBars.length} bins
            </span>
          </div>

          <div className="h-56 w-full relative pt-2">
            {histBars.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 800 190">
                {(() => {
                  const maxCount = Math.max(...histBars.map(b => b.count), 1);
                  const barWidth = 700 / histBars.length;
                  return histBars.map((b, i) => {
                    const x = 50 + i * barWidth;
                    const h = (b.count / maxCount) * 130;
                    const y = 150 - h;
                    const isAlert = b.bin_start < 220;
                    return (
                      <g key={i} className="group">
                        <rect
                          x={x + 4}
                          y={y}
                          width={barWidth - 8}
                          height={h}
                          fill={isAlert ? "#f87171" : "#10b981"}
                          rx="3"
                          className="transition-all hover:opacity-80"
                        />
                        <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">
                          {b.count > 0 ? b.count : ''}
                        </text>
                        <text x={x + barWidth / 2} y="172" textAnchor="middle" fontSize="9" fill="#94a3b8" transform={`rotate(0, ${x + barWidth / 2}, 172)`}>
                          {b.bin_start}
                        </text>
                      </g>
                    );
                  });
                })()}
                <line x1="45" y1="151" x2="760" y2="151" stroke="#cbd5e1" strokeWidth="1.5" />
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu phân phối tần suất...
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> Dải an toàn tiêu chuẩn (260 - 380 DU)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-400 rounded-sm"></span> Dải suy giảm nguy hiểm (&lt; 220 DU)</span>
          </div>
        </div>

      </div>
    </div>
  );
}

