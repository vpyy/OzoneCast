import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Grid,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Layers,
  Info,
  Calendar,
  Sparkles
} from 'lucide-react';
import { api } from '../api/apiClient';

/**
 * Hàm xác định màu sắc ô tương quan Pearson (Heatmap trên nền trắng)
 */
function getCorrColor(val) {
  if (val === 1.0) return { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' }; // Đường chéo chính
  if (val >= 0.7)  return { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' }; // Thuận rất mạnh
  if (val >= 0.4)  return { bg: '#FFEDD5', text: '#9A3412', border: '#FDBA74' }; // Thuận vừa
  if (val >= 0.1)  return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' }; // Thuận yếu
  if (val > -0.1)  return { bg: '#F8FAFC', text: '#94A3B8', border: '#E2E8F0' }; // Trung tính gần 0
  if (val > -0.4)  return { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' }; // Nghịch yếu
  if (val > -0.7)  return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' }; // Nghịch vừa
  return { bg: '#C7D2FE', text: '#3730A3', border: '#818CF8' };                   // Nghịch rất mạnh
}

export default function TrendSeasonalCorrelation() {
  const [trendData, setTrendData] = useState(null);
  const [corrData, setCorrData]   = useState(null);
  const [loading, setLoading]     = useState(false);

  // ── 1. Bộ lọc thành phần (Series Filters / Toggles) ──
  const [filters, setFilters] = useState({
    observed: true,
    trend: true,
    seasonal: true,
    residual: true,
  });

  // ── 2. Chế độ hiển thị: 'combined' (gộp 1 biểu đồ) hoặc 'faceted' (tách 4 tầng) ──
  const [viewMode, setViewMode] = useState('combined');

  // ── 3. Trạng thái Zoom & Cửa sổ thời gian ──
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 2 = 50% window, 3 = 33% window
  const [windowOffset, setWindowOffset] = useState(0); // Offset bắt đầu khi zoom

  // ── 4. Trạng thái Tương tác Hover & Tooltip ──
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.allSettled([
        api.getTrendSeasonal(),
        api.getCorrelationMatrix()
      ]);
      if (t.status === 'fulfilled') setTrendData(t.value);
      if (c.status === 'fulfilled') setCorrData(c.value);
    } catch (e) {
      console.error('Error fetching trend/seasonal data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fullSeries = trendData?.series || [];
  const matrix     = corrData?.matrix || [];
  const variables  = corrData?.variables || [];

  // ── Xử lý Cắt lọc dữ liệu theo Zoom Window ──
  const visibleSeries = useMemo(() => {
    if (!fullSeries.length) return [];
    if (zoomLevel === 1) return fullSeries;

    const windowSize = Math.max(4, Math.floor(fullSeries.length / zoomLevel));
    const maxOffset = Math.max(0, fullSeries.length - windowSize);
    const safeOffset = Math.min(windowOffset, maxOffset);
    return fullSeries.slice(safeOffset, safeOffset + windowSize);
  }, [fullSeries, zoomLevel, windowOffset]);

  // Điều khiển Zoom
  const handleZoom = (level) => {
    setZoomLevel(level);
    setWindowOffset(0);
    setHoveredIdx(null);
  };

  const handlePan = (direction) => {
    if (zoomLevel === 1) return;
    const windowSize = Math.max(4, Math.floor(fullSeries.length / zoomLevel));
    const step = Math.max(1, Math.floor(windowSize / 3));
    const maxOffset = Math.max(0, fullSeries.length - windowSize);

    if (direction === 'left') {
      setWindowOffset(prev => Math.max(0, prev - step));
    } else {
      setWindowOffset(prev => Math.min(maxOffset, prev + step));
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setWindowOffset(0);
    setHoveredIdx(null);
  };

  // Toggle filter
  const toggleFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Tính toán tọa độ và tỉ lệ SVG cho biểu đồ nền trắng ──
  const svgWidth = 650;
  const svgHeight = 260;
  const margin = { top: 25, right: 30, bottom: 40, left: 50 };
  const chartW = svgWidth - margin.left - margin.right;
  const chartH = svgHeight - margin.top - margin.bottom;

  // Tính Min/Max động dựa trên các thành phần đang bật
  const { minY, maxY } = useMemo(() => {
    if (!visibleSeries.length) return { minY: 200, maxY: 400 };

    let values = [];
    visibleSeries.forEach(s => {
      if (filters.observed && s.observed != null) values.push(s.observed);
      if (filters.trend && s.trend != null) values.push(s.trend);
      if (filters.seasonal && s.seasonal != null) values.push(290 + s.seasonal * 1.5); // Baseline căn giữa
      if (filters.residual && s.residual != null) values.push(290 + s.residual * 2.0);
    });

    if (!values.length) return { minY: 240, maxY: 380 };
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const pad = Math.max(15, (maxVal - minVal) * 0.12);
    return {
      minY: Math.floor((minVal - pad) / 10) * 10,
      maxY: Math.ceil((maxVal + pad) / 10) * 10
    };
  }, [visibleSeries, filters]);

  // Scale functions
  const getX = (index) => {
    if (visibleSeries.length <= 1) return margin.left + chartW / 2;
    return margin.left + (index / (visibleSeries.length - 1)) * chartW;
  };

  const getY = (val) => {
    if (maxY === minY) return margin.top + chartH / 2;
    return margin.top + (1 - (val - minY) / (maxY - minY)) * chartH;
  };

  // Xử lý di chuột trên SVG để lấy điểm gần nhất (Hover Tooltip)
  const handleSvgMouseMove = (e) => {
    if (!svgRef.current || !visibleSeries.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const chartMouseX = (mouseX / rect.width) * svgWidth;

    if (chartMouseX < margin.left - 10 || chartMouseX > svgWidth - margin.right + 10) {
      setHoveredIdx(null);
      return;
    }

    // Tìm index gần nhất
    const boundedX = Math.max(margin.left, Math.min(svgWidth - margin.right, chartMouseX));
    const ratio = (boundedX - margin.left) / chartW;
    const closestIdx = Math.round(ratio * (visibleSeries.length - 1));
    setHoveredIdx(Math.max(0, Math.min(visibleSeries.length - 1, closestIdx)));
  };

  const handleSvgMouseLeave = () => {
    setHoveredIdx(null);
  };

  const hoveredPoint = hoveredIdx !== null ? visibleSeries[hoveredIdx] : null;

  return (
    <div className="space-y-6">

      {/* ── 1. Header Bảng Điều Khiển Nền Trắng ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Phân Tích Xu Hướng, Chu Kỳ Mùa Vụ & Ma Trận Tương Quan Khí Quyển
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mô hình phân rã cộng tính (Additive Decomposition) & Ma trận hệ số Pearson 6×6
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* ── 2. Khu Vực 2 Biểu Đồ Song Song ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ── Khối Bên Trái: Biểu Đồ Phân Rã Xu Hướng & Mùa Vụ NỀN TRẮNG (7 cols) ── */}
        <div className="xl:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header thanh công cụ của biểu đồ */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Phân Rã Chuỗi Thời Gian (Trend & Seasonal Decomposition)
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Cộng tính (Additive)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Công thức: <strong className="text-slate-800">Observed(t)</strong> = Trend(t) + Seasonal(t) + Residual(t)
                </p>
              </div>

              {/* Chuyển đổi chế độ xem Gộp chung / Tách 4 tầng */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
                <button
                  onClick={() => setViewMode('combined')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    viewMode === 'combined' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Gộp chung
                </button>
                <button
                  onClick={() => setViewMode('faceted')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    viewMode === 'faceted' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Tách 4 tầng
                </button>
              </div>
            </div>

            {/* ── Thanh Công Cụ Điều Khiển: FILTER & ZOOM ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-100">
              {/* Bộ lọc bật/tắt từng đường (Filler / Series Toggles) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Lọc thành phần:
                </span>

                <button
                  onClick={() => toggleFilter('observed')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filters.observed
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className="w-2 h-0.5 bg-current border-t border-dashed"></span>
                  <span>Observed (Thực đo)</span>
                </button>

                <button
                  onClick={() => toggleFilter('trend')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filters.trend
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className="w-2.5 h-1 bg-indigo-600 rounded-full"></span>
                  <span>Trend (Xu hướng)</span>
                </button>

                <button
                  onClick={() => toggleFilter('seasonal')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filters.seasonal
                      ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className="w-2.5 h-1 bg-amber-500 rounded-full"></span>
                  <span>Seasonal (Mùa vụ)</span>
                </button>

                <button
                  onClick={() => toggleFilter('residual')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filters.residual
                      ? 'bg-teal-50 text-teal-800 border-teal-300 font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className="w-2.5 h-1 bg-teal-500 rounded-full"></span>
                  <span>Residual (Phần dư)</span>
                </button>
              </div>

              {/* Bộ điều khiển ZOOM (Phóng to / Thu nhỏ / Điều hướng) */}
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 px-1.5">Zoom:</span>
                <button
                  onClick={() => handleZoom(1)}
                  className={`px-2 py-0.5 text-xs rounded-lg font-mono font-medium transition ${
                    zoomLevel === 1 ? 'bg-sky-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                  title="Xem toàn bộ 100%"
                >
                  100%
                </button>
                <button
                  onClick={() => handleZoom(1.5)}
                  className={`px-2 py-0.5 text-xs rounded-lg font-mono font-medium transition ${
                    zoomLevel === 1.5 ? 'bg-sky-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                  title="Phóng to 1.5x"
                >
                  1.5x
                </button>
                <button
                  onClick={() => handleZoom(2)}
                  className={`px-2 py-0.5 text-xs rounded-lg font-mono font-medium transition ${
                    zoomLevel === 2 ? 'bg-sky-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                  title="Phóng to 2x"
                >
                  2x
                </button>

                {zoomLevel > 1 && (
                  <>
                    <div className="h-3 w-px bg-slate-300 mx-0.5"></div>
                    <button
                      onClick={() => handlePan('left')}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      title="Dịch khung nhìn sang trái"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handlePan('right')}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      title="Dịch khung nhìn sang phải"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleResetZoom}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      title="Đặt lại góc nhìn ban đầu"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── VÙNG HIỂN THỊ BIỂU ĐỒ NỀN TRẮNG ── */}
            <div className="relative mt-3 select-none">
              {viewMode === 'combined' ? (
                /* CHẾ ĐỘ 1: GỘP CHUNG (COMBINED OVERLAY VIEW) */
                <div className="w-full bg-white rounded-xl border border-slate-100 p-2 relative">
                  {visibleSeries.length > 0 ? (
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-auto overflow-visible cursor-crosshair"
                      onMouseMove={handleSvgMouseMove}
                      onMouseLeave={handleSvgMouseLeave}
                    >
                      {/* 1. Nền canvas trắng tinh khôi */}
                      <rect
                        x={margin.left}
                        y={margin.top}
                        width={chartW}
                        height={chartH}
                        fill="#FFFFFF"
                      />

                      {/* 2. Lưới ngang (Horizontal Gridlines) & Trục Y */}
                      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                        const yVal = Math.round(minY + (1 - r) * (maxY - minY));
                        const yPos = margin.top + r * chartH;
                        return (
                          <g key={i}>
                            <line
                              x1={margin.left}
                              y1={yPos}
                              x2={svgWidth - margin.right}
                              y2={yPos}
                              stroke="#F1F5F9"
                              strokeWidth="1.2"
                            />
                            <text
                              x={margin.left - 8}
                              y={yPos + 3}
                              fontSize="10"
                              fill="#64748B"
                              textAnchor="end"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="500"
                            >
                              {yVal}
                            </text>
                          </g>
                        );
                      })}

                      {/* 3. Đơn vị trục Y (Dobson Units) */}
                      <text
                        x={margin.left - 36}
                        y={margin.top - 8}
                        fontSize="10"
                        fontWeight="700"
                        fill="#475569"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        (DU)
                      </text>

                      {/* 4. Vẽ đường Observed (Thực đo - Nét đứt than chì) */}
                      {filters.observed && (
                        <polyline
                          fill="none"
                          stroke="#334155"
                          strokeWidth="1.8"
                          strokeDasharray="4 3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.85"
                          points={visibleSeries.map((s, i) => `${getX(i)},${getY(s.observed)}`).join(' ')}
                        />
                      )}

                      {/* 5. Vẽ đường Trend (Xu hướng - Nét đậm Indigo) */}
                      {filters.trend && (
                        <polyline
                          fill="none"
                          stroke="#4F46E5"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={visibleSeries.map((s, i) => `${getX(i)},${getY(s.trend)}`).join(' ')}
                        />
                      )}

                      {/* 6. Vẽ đường Seasonal (Mùa vụ - Nét Cam hổ phách) */}
                      {filters.seasonal && (
                        <polyline
                          fill="none"
                          stroke="#EA580C"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={visibleSeries.map((s, i) => `${getX(i)},${getY(290 + s.seasonal * 1.5)}`).join(' ')}
                        />
                      )}

                      {/* 7. Vẽ đường Residual (Phần dư - Nét Ngọc lam) */}
                      {filters.residual && (
                        <polyline
                          fill="none"
                          stroke="#0D9488"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.9"
                          points={visibleSeries.map((s, i) => `${getX(i)},${getY(290 + s.residual * 2.0)}`).join(' ')}
                        />
                      )}

                      {/* 8. Trục X & Các nhãn thời gian */}
                      {visibleSeries.map((s, i) => {
                        // Giảm mật độ hiển thị nhãn nếu có quá nhiều điểm
                        const stepInterval = zoomLevel > 1 ? 1 : 3;
                        if (i % stepInterval !== 0 && i !== visibleSeries.length - 1) return null;
                        const xPos = getX(i);
                        return (
                          <g key={i}>
                            <line
                              x1={xPos}
                              y1={margin.top + chartH}
                              x2={xPos}
                              y2={margin.top + chartH + 5}
                              stroke="#CBD5E1"
                              strokeWidth="1"
                            />
                            <text
                              x={xPos}
                              y={margin.top + chartH + 18}
                              fontSize="10"
                              fill="#64748B"
                              textAnchor="middle"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="600"
                            >
                              {s.label}
                            </text>
                          </g>
                        );
                      })}

                      {/* 9. Hiệu ứng HOVER: Đường gióng dọc và các điểm chốt */}
                      {hoveredIdx !== null && (
                        <g>
                          {/* Đường gióng dọc Crosshair */}
                          <line
                            x1={getX(hoveredIdx)}
                            y1={margin.top}
                            x2={getX(hoveredIdx)}
                            y2={margin.top + chartH}
                            stroke="#64748B"
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                          />

                          {/* Điểm nhấn Observed */}
                          {filters.observed && (
                            <circle
                              cx={getX(hoveredIdx)}
                              cy={getY(visibleSeries[hoveredIdx].observed)}
                              r="4.5"
                              fill="#334155"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                              className="filter drop-shadow-sm"
                            />
                          )}

                          {/* Điểm nhấn Trend */}
                          {filters.trend && (
                            <circle
                              cx={getX(hoveredIdx)}
                              cy={getY(visibleSeries[hoveredIdx].trend)}
                              r="5.5"
                              fill="#4F46E5"
                              stroke="#FFFFFF"
                              strokeWidth="2.5"
                              className="filter drop-shadow-sm"
                            />
                          )}

                          {/* Điểm nhấn Seasonal */}
                          {filters.seasonal && (
                            <circle
                              cx={getX(hoveredIdx)}
                              cy={getY(290 + visibleSeries[hoveredIdx].seasonal * 1.5)}
                              r="4.5"
                              fill="#EA580C"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                              className="filter drop-shadow-sm"
                            />
                          )}

                          {/* Điểm nhấn Residual */}
                          {filters.residual && (
                            <circle
                              cx={getX(hoveredIdx)}
                              cy={getY(290 + visibleSeries[hoveredIdx].residual * 2.0)}
                              r="4"
                              fill="#0D9488"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                              className="filter drop-shadow-sm"
                            />
                          )}
                        </g>
                      )}
                    </svg>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
                      Đang nạp dữ liệu phân rã chuỗi thời gian...
                    </div>
                  )}
                </div>
              ) : (
                /* CHẾ ĐỘ 2: TÁCH TẦNG (FACETED SUBPLOTS VIEW) */
                <div className="space-y-3 bg-white p-2 rounded-xl">
                  {/* Tầng 1: Observed */}
                  {filters.observed && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-1">
                        <span>1. Dữ liệu thực nghiệm (Observed)</span>
                        <span className="font-mono text-slate-600">
                          {hoveredPoint ? `${hoveredPoint.observed} DU` : 'Tổng hòa 3 thành phần'}
                        </span>
                      </div>
                      <div className="h-14">
                        <svg viewBox={`0 0 ${svgWidth} 60`} className="w-full h-full">
                          <polyline
                            fill="none"
                            stroke="#334155"
                            strokeWidth="2"
                            strokeDasharray="4 3"
                            points={visibleSeries.map((s, i) => `${getX(i)},${45 - (s.observed - 270) * 0.4}`).join(' ')}
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Tầng 2: Trend */}
                  {filters.trend && (
                    <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/30">
                      <div className="flex justify-between items-center text-xs font-bold text-indigo-900 mb-1">
                        <span>2. Xu hướng dài hạn (Trend Component)</span>
                        <span className="font-mono text-indigo-700">
                          {hoveredPoint ? `${hoveredPoint.trend} DU` : 'Đường biến động vĩ mô'}
                        </span>
                      </div>
                      <div className="h-14">
                        <svg viewBox={`0 0 ${svgWidth} 60`} className="w-full h-full">
                          <polyline
                            fill="none"
                            stroke="#4F46E5"
                            strokeWidth="2.5"
                            points={visibleSeries.map((s, i) => `${getX(i)},${45 - (s.trend - 270) * 0.4}`).join(' ')}
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Tầng 3: Seasonal */}
                  {filters.seasonal && (
                    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/30">
                      <div className="flex justify-between items-center text-xs font-bold text-amber-900 mb-1">
                        <span>3. Chu kỳ mùa vụ (Seasonal Component)</span>
                        <span className="font-mono text-amber-700">
                          {hoveredPoint ? `${hoveredPoint.seasonal > 0 ? '+' : ''}${hoveredPoint.seasonal} DU` : 'Chu kỳ bức xạ mặt trời'}
                        </span>
                      </div>
                      <div className="h-14">
                        <svg viewBox={`0 0 ${svgWidth} 60`} className="w-full h-full">
                          <line x1={margin.left} y1="30" x2={svgWidth - margin.right} y2="30" stroke="#CBD5E1" strokeDasharray="2 2" />
                          <polyline
                            fill="none"
                            stroke="#EA580C"
                            strokeWidth="2"
                            points={visibleSeries.map((s, i) => `${getX(i)},${30 - s.seasonal * 0.8}`).join(' ')}
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Tầng 4: Residual */}
                  {filters.residual && (
                    <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/30">
                      <div className="flex justify-between items-center text-xs font-bold text-teal-900 mb-1">
                        <span>4. Phần dư ngẫu nhiên (Residual Component)</span>
                        <span className="font-mono text-teal-700">
                          {hoveredPoint ? `${hoveredPoint.residual > 0 ? '+' : ''}${hoveredPoint.residual} DU` : 'Nhiễu khí quyển'}
                        </span>
                      </div>
                      <div className="h-14">
                        <svg viewBox={`0 0 ${svgWidth} 60`} className="w-full h-full">
                          <line x1={margin.left} y1="30" x2={svgWidth - margin.right} y2="30" stroke="#CBD5E1" strokeDasharray="2 2" />
                          <polyline
                            fill="none"
                            stroke="#0D9488"
                            strokeWidth="1.8"
                            points={visibleSeries.map((s, i) => `${getX(i)},${30 - s.residual * 1.5}`).join(' ')}
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── BẢNG THÔNG TIN CHI TIẾT KHI HOVER (Rich Interactive Tooltip Card) ── */}
            <div className="mt-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs">
              {hoveredPoint ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-white border border-slate-200 font-mono font-bold text-slate-800 text-[11px]">
                      {hoveredPoint.label} (Mốc #{hoveredPoint.step})
                    </span>
                    <span className="text-slate-500 font-medium">Chi tiết giá trị tại mốc:</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11.5px] flex-wrap">
                    {filters.observed && (
                      <span className="flex items-center gap-1 text-slate-800 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                        <span className="w-2 h-0.5 bg-slate-800 inline-block border-t border-dashed"></span>
                        Thực đo: {hoveredPoint.observed} DU
                      </span>
                    )}

                    {filters.trend && (
                      <span className="flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                        Xu hướng: {hoveredPoint.trend} DU
                      </span>
                    )}

                    {filters.seasonal && (
                      <span className="flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                        Mùa vụ: {hoveredPoint.seasonal > 0 ? `+${hoveredPoint.seasonal}` : hoveredPoint.seasonal} DU
                      </span>
                    )}

                    {filters.residual && (
                      <span className="flex items-center gap-1 text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                        Phần dư: {hoveredPoint.residual > 0 ? `+${hoveredPoint.residual}` : hoveredPoint.residual} DU
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-slate-500">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Info className="w-3.5 h-3.5 text-sky-600" />
                    <span>Rê chuột (Hover) lên bất kỳ điểm nào trên biểu đồ để xem chi tiết phân rã số liệu.</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    Hiển thị: {visibleSeries.length} / {fullSeries.length} mốc
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Diễn giải khoa học khí quyển dưới chân biểu đồ */}
          {trendData?.interpretation && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11.5px] text-slate-600 leading-relaxed bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/60">
              <strong className="text-indigo-900 font-semibold">Diễn giải khí quyển: </strong>
              {trendData.interpretation}
            </div>
          )}
        </div>

        {/* ── Khối Bên Phải: Ma Trận Tương Quan 6x6 NỀN TRẮNG ĐỒNG BỘ (5 cols) ── */}
        <div className="xl:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                  <Grid className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Ma Trận Tương Quan Đa Biến (6×6 Heatmap)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Hệ số Pearson r
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Mức độ phụ thuộc tuyến tính giữa nồng độ Ozone, Vĩ độ, Kinh độ, Góc thiên đỉnh (SZA), Độ phản xạ và Chỉ số Sol khí (Aerosol).
            </p>

            {/* Bảng Heatmap Ma trận */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse font-mono text-center">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-2 text-[10px] text-slate-600 text-left font-bold uppercase tracking-wider">
                      Biến số
                    </th>
                    {variables.map((v, i) => (
                      <th
                        key={i}
                        className="p-1.5 text-[10px] text-slate-700 font-bold uppercase"
                        title={v}
                      >
                        {v.split(' ')[0].substring(0, 5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                      <td className="p-2 text-[10px] text-slate-800 text-left font-semibold whitespace-nowrap bg-slate-50/60">
                        {row.variable.substring(0, 11)}
                      </td>
                      {row.values.map((val, j) => {
                        const style = getCorrColor(val);
                        return (
                          <td key={j} className="p-1">
                            <div
                              style={{
                                backgroundColor: style.bg,
                                color: style.text,
                                borderColor: style.border
                              }}
                              className={`text-[10px] py-1 px-0.5 rounded-lg border font-bold transition-transform hover:scale-110 cursor-pointer ${
                                val === 1.0 ? 'font-normal opacity-70' : ''
                              }`}
                              title={`${row.variable} × ${variables[j]}: r = ${val}`}
                            >
                              {val === 1 ? '1.0' : val > 0 ? `+${val}` : val}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {matrix.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                Đang nạp ma trận tương quan...
              </div>
            )}
          </div>

          {/* Chú giải dải màu Heatmap */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-indigo-200 border border-indigo-400"></span>
              Nghịch mạnh (−1.0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-300"></span>
              Trung tính (0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-200 border border-rose-400"></span>
              Thuận mạnh (+1.0)
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
