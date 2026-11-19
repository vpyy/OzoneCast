import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';

export default function AnalyticsCharts() {
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lineChartZoom, setLineChartZoom] = useState({ minX: 0, maxX: 1 });
  const [scatterChartZoom, setScatterChartZoom] = useState({ minX: 0, maxX: 1 });
  const [histogramZoom, setHistogramZoom] = useState({ minX: 0, maxX: 1 });
  const [filterOzoneRange, setFilterOzoneRange] = useState([150, 400]);
  const [filterSZARange, setFilterSZARange] = useState([10, 85]);

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

  const fetchTimeseries = async (p) => {
    setLoading(true);
    try {
      const res = await api.getTimeseries(p);
      setData(res);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeseries(period);
  }, [period]);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      await api.runAnalysis();
      await fetchTimeseries(period);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const linePoints = (data?.line_chart || []).slice(
    Math.floor(lineChartZoom.minX * (data?.line_chart?.length || 1)),
    Math.ceil(lineChartZoom.maxX * (data?.line_chart?.length || 1))
  );

  const scatterPoints = (data?.scatter_plot || []).filter(
    p => p.x_sza >= filterSZARange[0] && p.x_sza <= filterSZARange[1] &&
         p.y_ozone >= filterOzoneRange[0] && p.y_ozone <= filterOzoneRange[1]
  ).slice(
    Math.floor(scatterChartZoom.minX * (data?.scatter_plot?.length || 1)),
    Math.ceil(scatterChartZoom.maxX * (data?.scatter_plot?.length || 1))
  );

  const histBars = (data?.histogram || []).slice(
    Math.floor(histogramZoom.minX * (data?.histogram?.length || 1)),
    Math.ceil(histogramZoom.maxX * (data?.histogram?.length || 1))
  );

  const maxOzone = Math.max(...linePoints.map(d => d.ozone_max || d.ozone_mean || 320), 380);
  const minOzone = Math.min(...linePoints.map(d => d.ozone_min || d.ozone_mean || 220), 180);
  const ozoneRange = Math.max(maxOzone - minOzone, 50);

  const getY = (val) => {
    const norm = (val - minOzone) / ozoneRange;
    return 180 - norm * 150;
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 bg-white p-3 border border-gray-200">
        <button
          onClick={() => setPeriod('day')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            period === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => setPeriod('week')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            period === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            period === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="ml-auto px-4 py-1.5 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Analyze
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <div className="bg-white p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Ozone Trend (Dobson Units)</h3>
          <div className="text-xs text-gray-500 mb-3 flex gap-2">
            <button onClick={() => setLineChartZoom({ minX: 0, maxX: 1 })} className="px-2 py-1 bg-gray-100 hover:bg-gray-200">Reset</button>
            <span className="ml-auto">Scroll to zoom</span>
          </div>
          <div
            className="h-64 w-full bg-gray-50"
            onWheel={(e) => handleScroll(e, lineChartZoom, setLineChartZoom)}
            style={{ cursor: 'grab' }}
          >
            {linePoints.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 500 210" preserveAspectRatio="none">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = 30 + ratio * 150;
                  const du = Math.round(maxOzone - ratio * ozoneRange);
                  return (
                    <g key={i}>
                      <line x1="40" y1={y} x2="490" y2={y} stroke="#e5e7eb" strokeDasharray="2 2" />
                      <text x="32" y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280" fontFamily="monospace">
                        {du}
                      </text>
                    </g>
                  );
                })}

                {linePoints.length > 1 && (
                  <polygon
                    points={`
                      ${linePoints.map((p, i) => `${45 + (i / (linePoints.length - 1)) * 435},${getY(p.ozone_max || p.ozone_mean)}`).join(' ')}
                      ${linePoints.slice().reverse().map((p, i) => `${45 + ((linePoints.length - 1 - i) / (linePoints.length - 1)) * 435},${getY(p.ozone_min || p.ozone_mean)}`).join(' ')}
                    `}
                    fill="#3b82f6"
                    opacity="0.1"
                  />
                )}

                {linePoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    points={linePoints.map((p, i) => `${45 + (i / (linePoints.length - 1)) * 435},${getY(p.ozone_mean)}`).join(' ')}
                  />
                )}

                {linePoints.map((p, i) => {
                  const cx = 45 + (i / Math.max(linePoints.length - 1, 1)) * 435;
                  const cy = getY(p.ozone_mean);
                  return <circle key={i} cx={cx} cy={cy} r="3" fill="#2563eb" stroke="#fff" strokeWidth="1" />;
                })}
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
            )}
          </div>
        </div>

        {/* Scatter Plot */}
        <div className="bg-white p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Solar Zenith Angle vs Ozone</h3>
          <div className="text-xs text-gray-500 mb-3 flex gap-2 flex-wrap">
            <label className="flex items-center gap-1">
              Ozone:
              <input
                type="number"
                value={filterOzoneRange[0]}
                onChange={(e) => setFilterOzoneRange([parseFloat(e.target.value), filterOzoneRange[1]])}
                className="w-12 px-1 py-0.5 border border-gray-300"
              />
              -
              <input
                type="number"
                value={filterOzoneRange[1]}
                onChange={(e) => setFilterOzoneRange([filterOzoneRange[0], parseFloat(e.target.value)])}
                className="w-12 px-1 py-0.5 border border-gray-300"
              />
            </label>
            <button
              onClick={() => {
                setFilterOzoneRange([150, 400]);
                setFilterSZARange([10, 85]);
              }}
              className="text-blue-600 hover:text-blue-800 text-xs"
            >
              Reset
            </button>
          </div>
          <div
            className="h-64 w-full bg-gray-50"
            onWheel={(e) => handleScroll(e, scatterChartZoom, setScatterChartZoom)}
            style={{ cursor: 'grab' }}
          >
            {scatterPoints.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 500 210">
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line key={i} x1="45" y1={30 + r * 140} x2="480" y2={30 + r * 140} stroke="#f3f4f6" strokeWidth="1" />
                ))}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line key={`v${i}`} x1={45 + r * 435} y1="30" x2={45 + r * 435} y2="170" stroke="#f3f4f6" strokeWidth="1" />
                ))}

                {scatterPoints.map((pt, i) => {
                  const cx = 45 + ((pt.x_sza - 10) / 75) * 430;
                  const cy = 170 - ((pt.y_ozone - 150) / 320) * 140;
                  const isDepleted = pt.y_ozone < 220;
                  return (
                    <circle
                      key={i}
                      cx={Math.max(45, Math.min(475, cx))}
                      cy={Math.max(30, Math.min(170, cy))}
                      r="3"
                      fill={isDepleted ? '#dc2626' : '#2563eb'}
                      opacity="0.6"
                    />
                  );
                })}

                <text x="45" y="195" fontSize="10" fill="#6b7280">10°</text>
                <text x="475" y="195" textAnchor="end" fontSize="10" fill="#6b7280">85°</text>
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
            )}
          </div>
        </div>

        {/* Histogram */}
        <div className="bg-white p-4 border border-gray-200 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Ozone Distribution</h3>
          <div className="text-xs text-gray-500 mb-3 flex gap-2">
            <button onClick={() => setHistogramZoom({ minX: 0, maxX: 1 })} className="px-2 py-1 bg-gray-100 hover:bg-gray-200">Reset</button>
            <span className="ml-auto">Scroll to zoom</span>
          </div>
          <div
            className="h-56 w-full bg-gray-50"
            onWheel={(e) => handleScroll(e, histogramZoom, setHistogramZoom)}
            style={{ cursor: 'grab' }}
          >
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
                      <g key={i}>
                        <rect
                          x={x + 4}
                          y={y}
                          width={barWidth - 8}
                          height={h}
                          fill={isAlert ? '#dc2626' : '#10b981'}
                        />
                        <text x={x + barWidth / 2} y="172" textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="monospace">
                          {b.bin_start}
                        </text>
                      </g>
                    );
                  });
                })()}
                <line x1="45" y1="151" x2="760" y2="151" stroke="#d1d5db" strokeWidth="1.5" />
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
