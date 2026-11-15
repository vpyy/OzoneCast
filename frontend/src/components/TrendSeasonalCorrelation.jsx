import React, { useState, useEffect } from 'react';
import { TrendingUp, Grid, Info, RefreshCw } from 'lucide-react';
import { api } from '../api/apiClient';

export default function TrendSeasonalCorrelation() {
  const [trendData, setTrendData] = useState(null);
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trendRes, corrRes] = await Promise.allSettled([
        api.getTrendSeasonal(),
        api.getCorrelationMatrix()
      ]);
      if (trendRes.status === 'fulfilled') setTrendData(trendRes.value);
      if (corrRes.status === 'fulfilled') setCorrData(corrRes.value);
    } catch (err) {
      console.error("Error fetching trend/corr data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const series = trendData?.series || [];
  const matrix = corrData?.matrix || [];
  const variables = corrData?.variables || [];

  // Color helper for Correlation Matrix (-1 to +1)
  const getCorrColor = (val) => {
    if (val === 1.0) return 'bg-slate-200 text-slate-800 font-bold';
    if (val > 0.6) return 'bg-rose-600 text-white font-bold';
    if (val > 0.3) return 'bg-rose-400 text-white font-semibold';
    if (val > 0.05) return 'bg-rose-100 text-rose-900';
    if (val > -0.05) return 'bg-slate-50 text-slate-600';
    if (val > -0.3) return 'bg-sky-100 text-sky-900';
    if (val > -0.6) return 'bg-sky-400 text-white font-semibold';
    return 'bg-sky-700 text-white font-bold';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Phân tích Xu hướng (Trend), Mùa vụ (Seasonal) & Ma trận Tương quan
          </h2>
          <p className="text-xs text-slate-500">
            Tách chuỗi thời gian thành thành phần xu hướng và chu kỳ dao động định kỳ &bull; Khảo sát tương quan bức xạ 6 biến
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Trend & Seasonal Decomposition */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                Trích xuất Đường Trend & Chu kỳ Mùa vụ (Seasonal)
              </h3>
              <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                Additive Model
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Mô hình hóa: Quan trắc (Observed) = Xu hướng dài hạn (Trend) + Dao động mùa (Seasonal) + Phần dư
            </p>
          </div>

          <div className="h-64 w-full relative pt-2">
            {series.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                {/* Horizontal reference lines */}
                <line x1="30" y1="50" x2="480" y2="50" stroke="#f1f5f9" strokeDasharray="2 2" />
                <line x1="30" y1="100" x2="480" y2="100" stroke="#f1f5f9" strokeDasharray="2 2" />
                <line x1="30" y1="150" x2="480" y2="150" stroke="#f1f5f9" strokeDasharray="2 2" />

                {/* 1. Observed (raw fluctuation - grey) */}
                <polyline
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  points={series.map((s, i) => `${35 + (i / (series.length - 1)) * 440},${100 - (s.observed - 295) * 1.5}`).join(' ')}
                />

                {/* 2. Trend Line (smooth purple) */}
                <polyline
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  strokeLinecap="round"
                  points={series.map((s, i) => `${35 + (i / (series.length - 1)) * 440},${100 - (s.trend - 295) * 1.5}`).join(' ')}
                />

                {/* 3. Seasonal Sine Wave (amber) */}
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  points={series.map((s, i) => `${35 + (i / (series.length - 1)) * 440},${160 - s.seasonal * 1.2}`).join(' ')}
                />

                {/* X labels */}
                {series.filter((_, i) => i % 4 === 0).map((s, i) => (
                  <text key={i} x={35 + (i * 4 / (series.length - 1)) * 440} y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">
                    {s.label}
                  </text>
                ))}
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Đang nạp chuỗi decomposition...
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-0.5 bg-indigo-600 inline-block rounded"></span>
              <span>Đường Trend (Xu hướng)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-0.5 bg-amber-500 inline-block rounded"></span>
              <span>Dao động Mùa vụ</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-0.5 bg-slate-300 inline-block border-dashed"></span>
              <span>Dữ liệu thực tế</span>
            </div>
          </div>
        </div>

        {/* 2. Correlation Matrix Heatmap */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Grid className="w-4 h-4 text-rose-500" />
                Heatmap Ma trận Tương quan (Correlation Matrix 6x6)
              </h3>
              <span className="text-xs font-mono bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                Pearson r (-1 đến +1)
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Mức độ tương quan giữa Ozone, Độ phản xạ 331nm, UV Aerosol, Góc mặt trời và Tọa độ
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr>
                  <th className="p-1.5 text-left text-slate-400 font-semibold text-[11px]">Biến số</th>
                  {variables.map((v, i) => (
                    <th key={i} className="p-1.5 text-slate-600 font-semibold text-[10px] truncate max-w-[65px]" title={v}>
                      {v.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-1.5 text-left font-medium text-slate-700 text-[11px] whitespace-nowrap">
                      {row.variable}
                    </td>
                    {row.values.map((val, j) => (
                      <td key={j} className="p-1">
                        <div
                          className={`w-full py-1.5 rounded text-[10.5px] transition-all cursor-default ${getCorrColor(val)}`}
                          title={`${row.variable} vs ${variables[j]}: r = ${val}`}
                        >
                          {val > 0 && val !== 1 ? `+${val}` : val}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Heatmap Legend */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-sky-600 inline-block"></span> Tương quan nghịch (-1.0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block"></span> Độc lập (0.0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-600 inline-block"></span> Tương quan thuận (+1.0)
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

