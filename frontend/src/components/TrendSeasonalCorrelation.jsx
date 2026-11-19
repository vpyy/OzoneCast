import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';

export default function TrendSeasonalCorrelation() {
  const [trendData, setTrendData] = useState(null);
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trendZoom, setTrendZoom] = useState({ minX: 0, maxX: 1 });
  const [corrThreshold, setCorrThreshold] = useState(-1);

  const handleScroll = (e, zoomState, setZoomState) => {
    e.preventDefault();
    const ZOOM_SPEED = 0.1;
    const direction = e.deltaY > 0 ? 1 : -1;
    const newRange = direction > 0 ? ZOOM_SPEED : -ZOOM_SPEED;
    const newMinX = Math.max(0, zoomState.minX + newRange);
    const newMaxX = Math.min(1, zoomState.maxX - newRange);
    if (newMaxX - newMinX > 0.05) {
      setZoomState({ minX: newMinX, maxX: newMaxX });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trendRes, corrRes] = await Promise.allSettled([
        api.getTimeseries('day'),
        api.getCorrelationMatrix()
      ]);
      if (trendRes.status === 'fulfilled') setTrendData(trendRes.value);
      if (corrRes.status === 'fulfilled') setCorrData(corrRes.value);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const series = (trendData?.line_chart || []).slice(
    Math.floor(trendZoom.minX * (trendData?.line_chart?.length || 1)),
    Math.ceil(trendZoom.maxX * (trendData?.line_chart?.length || 1))
  );

  const matrix = corrData?.matrix || [];
  const variables = corrData?.variables || [];

  const getCorrColor = (val) => {
    if (val === 1) return 'bg-blue-900 text-white font-bold';
    if (val >= 0.7) return 'bg-blue-600 text-white';
    if (val >= 0.5) return 'bg-blue-400 text-white';
    if (val >= 0.3) return 'bg-blue-200 text-gray-800';
    if (val > 0) return 'bg-gray-100 text-gray-700';
    if (val > -0.3) return 'bg-gray-100 text-gray-700';
    if (val > -0.5) return 'bg-red-200 text-gray-800';
    if (val >= -0.7) return 'bg-red-400 text-white';
    return 'bg-red-600 text-white';
  };

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <div className="bg-white p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Time Series Decomposition</h3>
        <div className="text-xs text-gray-500 mb-3 flex gap-2">
          <button onClick={() => setTrendZoom({ minX: 0, maxX: 1 })} className="px-2 py-1 bg-gray-100 hover:bg-gray-200">Reset</button>
          <span className="ml-auto">Scroll to zoom</span>
        </div>
        <div
          className="h-64 w-full bg-gray-50"
          onWheel={(e) => handleScroll(e, trendZoom, setTrendZoom)}
          style={{ cursor: 'grab' }}
        >
          {series.length > 0 ? (
            <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
              {[0, 0.5, 1].map((ratio, i) => {
                const y = 30 + ratio * 140;
                return (
                  <g key={i}>
                    <line x1="40" y1={y} x2="490" y2={y} stroke="#e5e7eb" strokeDasharray="2 2" />
                    <text x="32" y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
                      {Math.round(300 - ratio * 100)}
                    </text>
                  </g>
                );
              })}
              {series.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                  points={series.map((p, i) => `${45 + (i / (series.length - 1)) * 435},${170 - ((p.ozone_mean - 200) / 150) * 140}`).join(' ')}
                />
              )}
              {series.map((p, i) => {
                const cx = 45 + (i / Math.max(series.length - 1, 1)) * 435;
                const cy = 170 - ((p.ozone_mean - 200) / 150) * 140;
                return <circle key={i} cx={cx} cy={cy} r="2" fill="#2563eb" />;
              })}
            </svg>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
          )}
        </div>
      </div>

      {/* Correlation Matrix */}
      <div className="bg-white p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Correlation Matrix</h3>
        <div className="text-xs text-gray-500 mb-3 flex gap-2 items-center">
          <label>
            Threshold:
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={corrThreshold}
              onChange={(e) => setCorrThreshold(parseFloat(e.target.value))}
              className="w-16 px-1 py-0.5 border border-gray-300 ml-1"
            />
          </label>
          <button
            onClick={() => setCorrThreshold(-1)}
            className="text-blue-600 hover:text-blue-800 text-xs"
          >
            Clear
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr>
                <th className="p-1.5 text-left text-gray-600 font-semibold">Variable</th>
                {variables.map((v, i) => (
                  <th key={i} className="p-1.5 text-gray-600 font-semibold truncate max-w-[60px] text-[10px]">
                    {v.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="p-1.5 text-left font-medium text-gray-700 text-[11px] whitespace-nowrap">
                    {row.variable}
                  </td>
                  {row.values.map((val, j) => (
                    <td key={j} className="p-1">
                      {(Math.abs(val) >= corrThreshold || val === 1) ? (
                        <div className={`w-full py-1 rounded text-[10.5px] ${getCorrColor(val)}`}>
                          {val > 0 && val !== 1 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                        </div>
                      ) : (
                        <div className="w-full py-1 rounded text-[10.5px] text-gray-300">—</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
