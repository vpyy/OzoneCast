import React, { useState, useEffect, useRef } from 'react';
import { LineChart, BarChart2, ScatterChart, Calendar, RefreshCw, ZoomIn } from 'lucide-react';
import { api } from '../api/apiClient';

export default function AnalyticsCharts() {
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Zoom state for each chart (via scroll wheel)
  const [lineZoom, setLineZoom] = useState(1);
  const [scatterZoom, setScatterZoom] = useState(1);
  const [histZoom, setHistZoom] = useState(1);
  
  // Crosshair & Hover state
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredScatterPoint, setHoveredScatterPoint] = useState(null);
  const [hoveredHistBin, setHoveredHistBin] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Filter state
  const [ozoneMin, setOzoneMin] = useState(100);
  const [ozoneMax, setOzoneMax] = useState(500);
  const [szaMin, setSzaMin] = useState(10);
  const [szaMax, setSzaMax] = useState(85);
  const [cloudFraction, setCloudFraction] = useState(1.0);
  
  // Refs for scroll wheel detection
  const lineChartRef = useRef(null);
  const scatterChartRef = useRef(null);
  const histChartRef = useRef(null);

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

  // Scroll wheel zoom handlers
  const handleLineChartWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setLineZoom(Math.max(0.5, Math.min(3, lineZoom + delta)));
  };

  const handleScatterChartWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScatterZoom(Math.max(0.5, Math.min(3, scatterZoom + delta)));
  };

  const handleHistChartWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setHistZoom(Math.max(0.5, Math.min(3, histZoom + delta)));
  };

  // Attach wheel event listeners
  useEffect(() => {
    const lineEl = lineChartRef.current;
    if (lineEl) {
      lineEl.addEventListener('wheel', handleLineChartWheel, { passive: false });
      return () => lineEl.removeEventListener('wheel', handleLineChartWheel);
    }
  }, [lineZoom]);

  useEffect(() => {
    const scatterEl = scatterChartRef.current;
    if (scatterEl) {
      scatterEl.addEventListener('wheel', handleScatterChartWheel, { passive: false });
      return () => scatterEl.removeEventListener('wheel', handleScatterChartWheel);
    }
  }, [scatterZoom]);

  useEffect(() => {
    const histEl = histChartRef.current;
    if (histEl) {
      histEl.addEventListener('wheel', handleHistChartWheel, { passive: false });
      return () => histEl.removeEventListener('wheel', handleHistChartWheel);
    }
  }, [histZoom]);

  const linePoints = (data?.line_chart || []).filter(
    d => (d.ozone_mean >= ozoneMin && d.ozone_mean <= ozoneMax)
  );
  const scatterPoints = (data?.scatter_plot || []).filter(
    p => (p.y_ozone >= ozoneMin && p.y_ozone <= ozoneMax && 
           p.x_sza >= szaMin && p.x_sza <= szaMax &&
           (p.cloud_fraction || 0) <= cloudFraction)
  );
  const histBars = data?.histogram || [];

  // Line chart SVG calculation
  const maxOzone = Math.max(...linePoints.map(d => d.ozone_max || d.ozone_mean || 320), 380);
  const minOzone = Math.min(...linePoints.map(d => d.ozone_min || d.ozone_mean || 220), 180);
  const ozoneRange = Math.max(maxOzone - minOzone, 50);

  const getY = (val) => {
    const norm = (val - minOzone) / ozoneRange;
    return 180 - norm * 150;
  };
  
  // Find min/max for callout pins
  const findExtrema = () => {
    if (linePoints.length === 0) return { maxIdx: -1, minIdx: -1, maxVal: 0, minVal: 0 };
    let maxIdx = 0, minIdx = 0;
    let maxVal = linePoints[0].ozone_mean;
    let minVal = linePoints[0].ozone_mean;
    
    linePoints.forEach((p, i) => {
      if (p.ozone_mean > maxVal) { maxVal = p.ozone_mean; maxIdx = i; }
      if (p.ozone_mean < minVal) { minVal = p.ozone_mean; minIdx = i; }
    });
    return { maxIdx, minIdx, maxVal, minVal };
  };
  
  const extrema = findExtrema();
  
  // Calculate scatter color based on latitude
  const getScatterColor = (pt) => {
    const lat = Math.abs(pt.latitude || 0);
    if (lat > 75) return '#dc2626'; // Deep red for extreme south
    if (lat > 60) return '#ef4444'; // Red
    if (lat > 45) return '#f97316'; // Orange
    if (lat > 30) return '#eab308'; // Yellow
    return '#84cc16'; // Green for tropical
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

      {/* Global Filters Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ZoomIn className="w-4 h-4 text-sky-600" />
          Bộ lọc chung cho 3 biểu đồ (Filter & Zoom)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Ozone Range Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Nồng độ Ozone (DU)</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={ozoneMin}
                onChange={(e) => setOzoneMin(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md"
                placeholder="Min"
              />
              <span className="text-xs text-slate-400 py-1">→</span>
              <input
                type="number"
                value={ozoneMax}
                onChange={(e) => setOzoneMax(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md"
                placeholder="Max"
              />
            </div>
          </div>

          {/* SZA Range Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">SZA - Góc Mặt Trời (°)</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={szaMin}
                onChange={(e) => setSzaMin(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md"
                placeholder="Min"
              />
              <span className="text-xs text-slate-400 py-1">→</span>
              <input
                type="number"
                value={szaMax}
                onChange={(e) => setSzaMax(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md"
                placeholder="Max"
              />
            </div>
          </div>

          {/* Cloud Fraction Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Mây (Phân số mây)</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={cloudFraction}
                onChange={(e) => setCloudFraction(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />
              <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                {cloudFraction.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Reset Button */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Hành động</label>
            <button
              onClick={() => {
                setOzoneMin(100);
                setOzoneMax(500);
                setSzaMin(10);
                setSzaMax(85);
                setCloudFraction(1.0);
              }}
              className="px-2 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-all"
            >
              Đặt lại (Reset)
            </button>
          </div>
        </div>
      </div>

      {/* Grid 3 biểu đồ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Line Chart - FULL WIDTH */}
        <div 
          ref={lineChartRef}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between lg:col-span-2"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                1. Biểu đồ đường (Line Chart) — Diễn biến Ozone & Ngưỡng chuẩn NASA
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-semibold text-slate-600">Trục Y (Tung):</span> Nồng độ Ozone Column (DU) — từ dữ liệu <code className="bg-slate-100 px-1 rounded">ozone_mean, ozone_min, ozone_max</code>
              </p>
              <p className="text-xs text-slate-400">
                <span className="font-semibold text-slate-600">Trục X (Hoành):</span> Thời gian UTC — từ dữ liệu <code className="bg-slate-100 px-1 rounded">label (DD/MM HH:mm)</code>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-semibold text-amber-600">💡 Tương tác:</span> Lăn chuột để zoom ({lineZoom.toFixed(1)}x) • Rê chuột qua điểm để xem chi tiết
              </p>
            </div>
          </div>

          <div 
            className="h-72 w-full relative pt-2 overflow-x-auto bg-gradient-to-b from-slate-50 to-white rounded-lg border border-slate-100"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {linePoints.length > 0 ? (
              <svg 
                className="w-full h-full" 
                viewBox={`0 0 ${500 * lineZoom} 220`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Grid horizontal lines with DU labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = 30 + ratio * 150;
                  const du = Math.round(maxOzone - ratio * ozoneRange);
                  return (
                    <g key={i}>
                      <line x1="40" y1={y} x2={490 * lineZoom} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                      <text x="32" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                        {du}
                      </text>
                    </g>
                  );
                })}

                {/* *** NASA Ozone Hole Threshold Line (220 DU) *** */}
                {(() => {
                  const thresholdY = getY(220);
                  return (
                    <g>
                      <line 
                        x1="40" 
                        y1={thresholdY} 
                        x2={490 * lineZoom} 
                        y2={thresholdY} 
                        stroke="#dc2626" 
                        strokeWidth="2"
                        strokeDasharray="5 4"
                      />
                      <text 
                        x="42" 
                        y={thresholdY - 6} 
                        fontSize="11" 
                        fill="#dc2626" 
                        fontWeight="bold"
                      >
                        🚨 Ozone Hole (220 DU)
                      </text>
                    </g>
                  );
                })()}

                {/* Shaded Area for min-max band */}
                {linePoints.length > 1 && (
                  <polygon
                    points={`
                      ${linePoints.map((p, i) => `${45 + (i / (linePoints.length - 1)) * 435 * lineZoom},${getY(p.ozone_max || p.ozone_mean)}`).join(' ')}
                      ${linePoints.slice().reverse().map((p, i) => `${45 + ((linePoints.length - 1 - i) / (linePoints.length - 1)) * 435 * lineZoom},${getY(p.ozone_min || p.ozone_mean)}`).join(' ')}
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
                    points={linePoints.map((p, i) => `${45 + (i / (linePoints.length - 1)) * 435 * lineZoom},${getY(p.ozone_mean)}`).join(' ')}
                  />
                )}

                {/* *** Min/Max Callout Pins *** */}
                {extrema.maxIdx >= 0 && (
                  <g>
                    <circle 
                      cx={45 + (extrema.maxIdx / Math.max(linePoints.length - 1, 1)) * 435 * lineZoom}
                      cy={getY(extrema.maxVal)}
                      r="6"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text 
                      x={45 + (extrema.maxIdx / Math.max(linePoints.length - 1, 1)) * 435 * lineZoom}
                      y={getY(extrema.maxVal) - 12}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#10b981"
                      fontWeight="bold"
                    >
                      MAX: {Math.round(extrema.maxVal)} DU
                    </text>
                  </g>
                )}
                
                {extrema.minIdx >= 0 && (
                  <g>
                    <circle 
                      cx={45 + (extrema.minIdx / Math.max(linePoints.length - 1, 1)) * 435 * lineZoom}
                      cy={getY(extrema.minVal)}
                      r="6"
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text 
                      x={45 + (extrema.minIdx / Math.max(linePoints.length - 1, 1)) * 435 * lineZoom}
                      y={getY(extrema.minVal) + 20}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#ef4444"
                      fontWeight="bold"
                    >
                      MIN: {Math.round(extrema.minVal)} DU
                    </text>
                  </g>
                )}

                {/* Data Points with Smooth Hover Animation */}
                {linePoints.map((p, i) => {
                  const cx = 45 + (i / Math.max(linePoints.length - 1, 1)) * 435 * lineZoom;
                  const cy = getY(p.ozone_mean);
                  const isHovered = i === hoveredIndex;
                  return (
                    <g 
                      key={i} 
                      className="cursor-pointer group"
                      onMouseEnter={() => {
                        setHoveredIndex(i);
                        setShowTooltip(true);
                      }}
                      onMouseLeave={() => {
                        setHoveredIndex(null);
                        setShowTooltip(false);
                      }}
                    >
                      {/* Circle with smooth transition */}
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={isHovered ? 6 : 4.5} 
                        fill={isHovered ? "#fbbf24" : "#0284c7"} 
                        stroke="#ffffff" 
                        strokeWidth="2"
                        className="transition-all duration-200"
                        style={{
                          filter: isHovered ? 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.6))' : 'none',
                        }}
                      />
                      
                      {/* Tooltip - Smooth fade-in */}
                      {isHovered && showTooltip && (
                        <g className="animate-fadeIn">
                          <rect 
                            x={cx - 55} 
                            y={cy - 45} 
                            width="110" 
                            height="38" 
                            fill="#1e293b" 
                            rx="4" 
                            opacity="0.95"
                            style={{ backdropFilter: 'blur(4px)' }}
                          />
                          <text 
                            x={cx} 
                            y={cy - 28} 
                            textAnchor="middle" 
                            fontSize="10" 
                            fill="#fbbf24" 
                            fontWeight="bold"
                          >
                            {p.label}
                          </text>
                          <text 
                            x={cx} 
                            y={cy - 16} 
                            textAnchor="middle" 
                            fontSize="9" 
                            fill="#e2e8f0"
                          >
                            Mean: {Math.round(p.ozone_mean)} DU
                          </text>
                          <text 
                            x={cx} 
                            y={cy - 6} 
                            textAnchor="middle" 
                            fontSize="8" 
                            fill="#cbd5e1"
                          >
                            Rng: {Math.round(p.ozone_min)}-{Math.round(p.ozone_max)}
                          </text>
                        </g>
                      )}
                      
                      <text x={cx} y="200" textAnchor="middle" fontSize="9" fill="#64748b">
                        {p.label}
                      </text>
                    </g>
                  );
                })}

                {/* Y-axis label */}
                <text x="15" y="100" textAnchor="middle" fontSize="10" fill="#64748b" transform="rotate(-90, 15, 100)">
                  Ozone Column (DU)
                </text>
                
                {/* X-axis label */}
                <text x="260" y="215" textAnchor="middle" fontSize="10" fill="#64748b">
                  Thời gian (UTC)
                </text>
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Đang chờ tải dữ liệu chuỗi thời gian...
              </div>
            )}
          </div>
          
          <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-sky-600 inline-block"></span> Nồng độ Ozone TB</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-sky-200 inline-block rounded-sm"></span> Vùng dao động Min-Max</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-600 inline-block" style={{borderTop: '2px dashed #dc2626'}}></span> Ngưỡng Ozone Hole (220 DU)</span>
            </div>
            <span className="text-slate-400">Cuộn chuột để zoom tương tác</span>
          </div>
        </div>

        {/* 2. Scatter Plot - 50% width */}
        <div 
          ref={scatterChartRef}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span>
                2. Biểu đồ phân tán (Scatter Plot) — SZA vs Ozone & Vĩ độ
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-semibold text-slate-600">Trục X (Hoành):</span> Solar Zenith Angle (°) — từ <code className="bg-slate-100 px-1 rounded">x_sza (10-85°)</code>
              </p>
              <p className="text-xs text-slate-400">
                <span className="font-semibold text-slate-600">Trục Y (Tung):</span> Ozone Column (DU) — từ <code className="bg-slate-100 px-1 rounded">y_ozone</code> • <span className="font-semibold text-violet-600">Màu:</span> Vĩ độ (latitude)
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-semibold text-amber-600">💡 Tương tác:</span> Lăn chuột để zoom ({scatterZoom.toFixed(1)}x) • Rê chuột qua điểm để xem chi tiết
              </p>
            </div>
          </div>

          <div 
            className="h-64 w-full relative pt-2 overflow-x-auto bg-gradient-to-b from-slate-50 to-white rounded-lg border border-slate-100"
            onMouseLeave={() => setHoveredScatterPoint(null)}
          >
            {scatterPoints.length > 0 ? (
              <svg 
                className="w-full h-full" 
                viewBox={`0 0 ${500 * scatterZoom} 210`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Background Grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line key={`h${i}`} x1="45" y1={30 + r * 140} x2={480 * scatterZoom} y2={30 + r * 140} stroke="#f1f5f9" strokeWidth="0.5" />
                ))}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                  <line key={`v${i}`} x1={45 + r * 435 * scatterZoom} y1="30" x2={45 + r * 435 * scatterZoom} y2="170" stroke="#f1f5f9" strokeWidth="0.5" />
                ))}

                {/* Ozone Hole Threshold Line */}
                <line 
                  x1="45" 
                  y1={170 - ((220 - 150) / 320) * 140}
                  x2={480 * scatterZoom}
                  y2={170 - ((220 - 150) / 320) * 140}
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />

                {/* Scatter Dots with Color Encoding & Smooth Hover */}
                {scatterPoints.map((pt, i) => {
                  const cx = 45 + ((pt.x_sza - 10) / 75) * 430 * scatterZoom;
                  const cy = 170 - ((pt.y_ozone - 150) / 320) * 140;
                  const isDepleted = pt.y_ozone < 220;
                  const dotColor = getScatterColor(pt);
                  const isOutlier = pt.y_ozone < 200 || pt.y_ozone > 350;
                  const isHovered = hoveredScatterPoint === i;
                  
                  return (
                    <g 
                      key={i} 
                      className="group cursor-pointer"
                      onMouseEnter={() => setHoveredScatterPoint(i)}
                      onMouseLeave={() => setHoveredScatterPoint(null)}
                    >
                      {/* Outer glow effect on hover */}
                      {isHovered && (
                        <circle
                          cx={Math.max(45, Math.min(475 * scatterZoom, cx))}
                          cy={Math.max(30, Math.min(170, cy))}
                          r={8}
                          fill="none"
                          stroke={dotColor}
                          strokeWidth="1"
                          opacity="0.4"
                          style={{
                            animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                          }}
                        />
                      )}
                      
                      <circle
                        cx={Math.max(45, Math.min(475 * scatterZoom, cx))}
                        cy={Math.max(30, Math.min(170, cy))}
                        r={isHovered ? 6 : (isOutlier ? 5.5 : 4)}
                        fill={dotColor}
                        fillOpacity={isHovered ? 0.9 : 0.7}
                        stroke={isOutlier ? "#000" : "#ffffff"}
                        strokeWidth={isOutlier ? "2" : "1"}
                        className="transition-all duration-200"
                        style={{
                          filter: isHovered ? `drop-shadow(0 0 6px ${dotColor})` : 'none',
                        }}
                      />
                      
                      {/* Smooth fade-in tooltip */}
                      {isHovered && (
                        <g className="animate-fadeIn">
                          <rect 
                            x={cx - 60} 
                            y={cy - 48} 
                            width="120" 
                            height="44" 
                            fill="#1e293b" 
                            rx="4" 
                            opacity="0.95"
                          />
                          <text 
                            x={cx} 
                            y={cy - 32} 
                            textAnchor="middle" 
                            fontSize="9" 
                            fill="#fbbf24" 
                            fontWeight="bold"
                          >
                            Ozone: {Math.round(pt.y_ozone)} DU
                          </text>
                          <text 
                            x={cx} 
                            y={cy - 20} 
                            textAnchor="middle" 
                            fontSize="8" 
                            fill="#e2e8f0"
                          >
                            SZA: {Math.round(pt.x_sza)}°
                          </text>
                          <text 
                            x={cx} 
                            y={cy - 10} 
                            textAnchor="middle" 
                            fontSize="8" 
                            fill="#cbd5e1"
                          >
                            Lat: {Math.round(pt.latitude || 0)}°
                          </text>
                          <text 
                            x={cx} 
                            y={cy} 
                            textAnchor="middle" 
                            fontSize="8" 
                            fill="#cbd5e1"
                          >
                            Cloud: {(pt.cloud_fraction || 0).toFixed(2)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Axes labels */}
                <text x="45" y="195" fontSize="9" fill="#94a3b8" fontFamily="monospace">10°</text>
                <text x="260" y="195" fontSize="9" fill="#94a3b8" textAnchor="middle" fontFamily="monospace">SZA (°)</text>
                <text x={475 * scatterZoom} y="195" fontSize="9" fill="#94a3b8" textAnchor="end" fontFamily="monospace">85°</text>
                
                <text x="20" y="100" fontSize="9" fill="#94a3b8" transform="rotate(-90, 20, 100)">
                  Ozone (DU)
                </text>
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu phân tán...
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
            <div className="flex gap-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-lime-500"></span> Trung bình</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Cao</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Suy giảm</span>
            </div>
            <span className="text-slate-400">Viền đậm = điểm bất thường</span>
          </div>
        </div>

        {/* 3. Histogram - 50% width */}
        <div 
          ref={histChartRef}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                3. Biểu đồ tần suất (Histogram) — Phân phối Ozone & Phân bố chuẩn
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-semibold text-slate-600">Trục X (Hoành):</span> Dải Ozone Column (DU) — từ <code className="bg-slate-100 px-1 rounded">bin_start (100-380 DU)</code>
              </p>
              <p className="text-xs text-slate-400">
                <span className="font-semibold text-slate-600">Trục Y (Tung):</span> Tần suất (Count) — từ <code className="bg-slate-100 px-1 rounded">count</code> • Đường Mean/Median là thống kê
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-semibold text-amber-600">💡 Tương tác:</span> Lăn chuột để zoom ({histZoom.toFixed(1)}x) • Rê chuột qua thanh để xem chi tiết
              </p>
            </div>
          </div>

          <div 
            className="h-56 w-full relative pt-2 overflow-x-auto bg-gradient-to-b from-slate-50 to-white rounded-lg border border-slate-100"
            onMouseLeave={() => setHoveredHistBin(null)}
          >
            {histBars.length > 0 ? (
              <svg 
                className="w-full h-full" 
                viewBox={`0 0 ${800 * histZoom} 190`}
                preserveAspectRatio="xMidYMid meet"
              >
                {(() => {
                  const maxCount = Math.max(...histBars.map(b => b.count), 1);
                  const barWidth = 700 / histBars.length;
                  
                  // Calculate mean and median for reference lines
                  let totalValue = 0, totalCount = 0;
                  const allValues = [];
                  histBars.forEach(b => {
                    totalValue += (b.bin_start + (b.bin_start + (histBars.length > 0 ? Math.ceil((380 - 100) / histBars.length) : 50))) / 2 * b.count;
                    totalCount += b.count;
                    for (let j = 0; j < b.count; j++) allValues.push(b.bin_start);
                  });
                  
                  const meanVal = totalCount > 0 ? totalValue / totalCount : 250;
                  const medianVal = allValues.length > 0 ? allValues[Math.floor(allValues.length / 2)] : 250;
                  const meanX = 50 + ((meanVal - 100) / 280) * 700 * histZoom;
                  const medianX = 50 + ((medianVal - 100) / 280) * 700 * histZoom;

                  return (
                    <>
                      {/* Bars with semantic coloring & hover animation */}
                      {histBars.map((b, i) => {
                        const x = 50 + i * barWidth;
                        const h = (b.count / maxCount) * 130;
                        const y = 150 - h;
                        const isAlert = b.bin_start < 220;
                        const binWidth = Math.ceil((380 - 100) / histBars.length);
                        const isHovered = hoveredHistBin === i;
                        
                        // Semantic coloring
                        let barColor;
                        if (b.bin_start < 220) {
                          barColor = "#dc2626"; // Red for depletion
                        } else if (b.bin_start < 260) {
                          barColor = "#f97316"; // Orange for low
                        } else if (b.bin_start < 300) {
                          barColor = "#0ea5e9"; // Sky blue for standard
                        } else {
                          barColor = "#10b981"; // Green for high
                        }

                        return (
                          <g 
                            key={i} 
                            className="group"
                            onMouseEnter={() => setHoveredHistBin(i)}
                            onMouseLeave={() => setHoveredHistBin(null)}
                          >
                            <rect
                              x={x + 4}
                              y={y}
                              width={barWidth - 8}
                              height={h}
                              fill={barColor}
                              rx="2"
                              className="transition-all duration-200 cursor-pointer hover:opacity-100"
                              opacity={isHovered ? 1 : 0.85}
                              style={{
                                filter: isHovered ? `drop-shadow(0 0 4px ${barColor})` : 'none',
                              }}
                            />
                            
                            {/* Smooth fade-in tooltip for bin */}
                            {isHovered && b.count > 0 && (
                              <g className="animate-fadeIn">
                                <rect 
                                  x={x + 4} 
                                  y={y - 32} 
                                  width="60" 
                                  height="28" 
                                  fill="#1e293b" 
                                  rx="3" 
                                  opacity="0.95"
                                />
                                <text 
                                  x={x + 34} 
                                  y={y - 16} 
                                  textAnchor="middle" 
                                  fontSize="9" 
                                  fill="#fbbf24" 
                                  fontWeight="bold"
                                >
                                  {b.count}
                                </text>
                                <text 
                                  x={x + 34} 
                                  y={y - 6} 
                                  textAnchor="middle" 
                                  fontSize="8" 
                                  fill="#e2e8f0"
                                >
                                  {b.bin_start}-{b.bin_start + binWidth}
                                </text>
                              </g>
                            )}
                            
                            {b.count > 0 && (
                              <text 
                                x={x + barWidth / 2} 
                                y={y - 4} 
                                textAnchor="middle" 
                                fontSize="9" 
                                fill="#1e293b" 
                                fontWeight="600"
                              >
                                {b.count}
                              </text>
                            )}
                            <text 
                              x={x + barWidth / 2} 
                              y="172" 
                              textAnchor="middle" 
                              fontSize="8" 
                              fill="#94a3b8"
                            >
                              {b.bin_start}
                            </text>
                          </g>
                        );
                      })}

                      {/* Mean line */}
                      <line 
                        x1={meanX} 
                        y1="30" 
                        x2={meanX} 
                        y2="150" 
                        stroke="#3b82f6" 
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                      <text 
                        x={meanX} 
                        y="20" 
                        textAnchor="middle" 
                        fontSize="9" 
                        fill="#3b82f6"
                        fontWeight="bold"
                      >
                        Mean: {Math.round(meanVal)}
                      </text>

                      {/* Median line */}
                      <line 
                        x1={medianX} 
                        y1="30" 
                        x2={medianX} 
                        y2="150" 
                        stroke="#8b5cf6" 
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                      <text 
                        x={medianX} 
                        y="20" 
                        textAnchor="middle" 
                        fontSize="9" 
                        fill="#8b5cf6"
                        fontWeight="bold"
                      >
                        Med: {Math.round(medianVal)}
                      </text>

                      {/* Ozone Hole threshold line */}
                      <line 
                        x1={50 + ((220 - 100) / 280) * 700 * histZoom}
                        y1="30"
                        x2={50 + ((220 - 100) / 280) * 700 * histZoom}
                        y2="150"
                        stroke="#dc2626"
                        strokeWidth="2"
                        strokeDasharray="5 4"
                      />

                      <line x1="45" y1="151" x2={750 * histZoom} y2="151" stroke="#cbd5e1" strokeWidth="1.5" />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu phân phối tần suất...
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
            <div className="flex gap-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span> Suy giảm (&lt;220)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded-sm"></span> Thấp (220-260)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-sky-500 rounded-sm"></span> Chuẩn (260-300)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> Cao (&gt;300)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

