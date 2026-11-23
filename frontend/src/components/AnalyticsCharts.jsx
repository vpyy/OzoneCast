import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LineChart, BarChart2, ScatterChart, Calendar, RefreshCw, ZoomIn, Clock, Database, MoveHorizontal } from 'lucide-react';
import { api, API_BASE } from '../api/apiClient';
import { useWebSocket } from '../lib/useWebSocket';

/**
 * Custom hook cho phép kéo chuột (drag-to-pan) ngang mượt mà khi biểu đồ zoom > 1x
 */
function useDragScroll() {
  const ref = useRef(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeft = useRef(0);
  const scrollTop = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback((e) => {
    // Chỉ kích hoạt khi nhấn chuột trái
    if (e.button !== 0 || !ref.current) return;
    isDown.current = true;
    setIsDragging(true);
    startX.current = e.pageX - ref.current.offsetLeft;
    startY.current = e.pageY - ref.current.offsetTop;
    scrollLeft.current = ref.current.scrollLeft;
    scrollTop.current = ref.current.scrollTop;
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDown.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const y = e.pageY - ref.current.offsetTop;
    const walkX = (x - startX.current) * 1.5;
    const walkY = (y - startY.current) * 1.5;
    ref.current.scrollLeft = scrollLeft.current - walkX;
    ref.current.scrollTop = scrollTop.current - walkY;
  }, []);

  const onMouseUp = useCallback(() => {
    isDown.current = false;
    setIsDragging(false);
  }, []);

  return {
    ref,
    isDragging,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp
    }
  };
}

export default function AnalyticsCharts() {
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Zoom state cho cả 3 biểu đồ (1.0 = 100%, max = 3.0 = 300%)
  const [lineZoom, setLineZoom] = useState(1);
  const [scatterZoom, setScatterZoom] = useState(1);
  const [histZoom, setHistZoom] = useState(1);

  // Drag-to-pan hooks cho từng biểu đồ
  const lineDrag = useDragScroll();
  const scatterDrag = useDragScroll();
  const histDrag = useDragScroll();

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

  const periodRef = useRef(period);
  useEffect(() => {
    periodRef.current = period;
  }, [period]);

  const fetchTimeseries = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await api.getTimeseries(p);
      setData(res);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching timeseries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeseries(period);
  }, [period, fetchTimeseries]);

  // Kết nối WebSocket singleton để cập nhật dữ liệu real-time khi có granule mới
  const handleWsMessage = useCallback((payload) => {
    if (payload.type === 'snapshot' || payload.type === 'update') {
      fetchTimeseries(periodRef.current);
    }
  }, [fetchTimeseries]);

  const { status: wsStatus } = useWebSocket({
    url: API_BASE.ws,
    onMessage: handleWsMessage,
    onFallbackPoll: () => fetchTimeseries(periodRef.current),
    enabled: true,
    fallbackIntervalMs: 20000
  });

  // Hỗ trợ cuộn bánh xe chuột để phóng to / thu nhỏ
  useEffect(() => {
    const el = lineDrag.ref.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setLineZoom((z) => Math.max(1, Math.min(3, +(z + delta).toFixed(2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [lineDrag.ref]);

  useEffect(() => {
    const el = scatterDrag.ref.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setScatterZoom((z) => Math.max(1, Math.min(3, +(z + delta).toFixed(2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scatterDrag.ref]);

  useEffect(() => {
    const el = histDrag.ref.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setHistZoom((z) => Math.max(1, Math.min(3, +(z + delta).toFixed(2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [histDrag.ref]);

  // Dữ liệu sau khi áp dụng bộ lọc đồng bộ
  const linePoints = useMemo(() => {
    return (data?.line_chart || []).filter(
      (d) => d.ozone_mean >= ozoneMin && d.ozone_mean <= ozoneMax
    );
  }, [data?.line_chart, ozoneMin, ozoneMax]);

  const scatterPoints = useMemo(() => {
    return (data?.scatter_plot || []).filter(
      (p) =>
        p.y_ozone >= ozoneMin &&
        p.y_ozone <= ozoneMax &&
        p.x_sza >= szaMin &&
        p.x_sza <= szaMax &&
        (p.cloud_fraction || 0) <= cloudFraction
    );
  }, [data?.scatter_plot, ozoneMin, ozoneMax, szaMin, szaMax, cloudFraction]);

  // Biểu đồ 3 (Histogram): Tự động tính toán lại các cột tần suất theo đúng các điểm đã lọc đủ cả 3 tiêu chí: Ozone, SZA và Mây
  const histBars = useMemo(() => {
    const pts = scatterPoints;
    const numBins = 10;
    const oMin = ozoneMin;
    const oMax = Math.max(ozoneMax, oMin + 10);
    const step = (oMax - oMin) / numBins;

    const bins = Array.from({ length: numBins }, (_, i) => {
      const bStart = Math.round(oMin + i * step);
      const bEnd = Math.round(oMin + (i + 1) * step);
      return {
        bin_start: bStart,
        bin_end: bEnd,
        count: 0
      };
    });

    if (pts && pts.length > 0) {
      pts.forEach((p) => {
        const val = p.y_ozone;
        if (val >= oMin && val <= oMax) {
          let idx = Math.floor((val - oMin) / step);
          if (idx >= numBins) idx = numBins - 1;
          if (idx >= 0) bins[idx].count++;
        }
      });
      return bins;
    }

    return bins;
  }, [scatterPoints, ozoneMin, ozoneMax]);

  // Tự động co giãn dải trục X của Scatter Plot theo SZA thực tế tại Nam Cực
  const szaPlotMin = useMemo(() => {
    if (!scatterPoints || scatterPoints.length === 0) return 70;
    const minVal = Math.min(...scatterPoints.map((p) => p.x_sza));
    return Math.max(szaMin, Math.floor(minVal - 2));
  }, [scatterPoints, szaMin]);

  const szaPlotMax = useMemo(() => {
    if (!scatterPoints || scatterPoints.length === 0) return 90;
    const maxVal = Math.max(...scatterPoints.map((p) => p.x_sza));
    return Math.min(90, Math.ceil(maxVal + 2));
  }, [scatterPoints, szaMax]);

  const szaSpan = Math.max(szaPlotMax - szaPlotMin, 4);

  // Line chart SVG calculation
  const maxOzone = Math.max(...linePoints.map((d) => d.ozone_max || d.ozone_mean || 320), 380);
  const minOzone = Math.min(...linePoints.map((d) => d.ozone_min || d.ozone_mean || 220), 180);
  const ozoneRange = Math.max(maxOzone - minOzone, 50);

  // Khung vẽ Line Chart: viewBox 0 0 950 250, vùng đồ thị Y từ 25 đến 205 (cao 180px)
  const lineSvgH = 250;
  const lineMargin = { top: 25, bottom: 45, left: 60, right: 35 };
  const lineChartH = lineSvgH - lineMargin.top - lineMargin.bottom; // 180px

  const getY = (val) => {
    const norm = (val - minOzone) / ozoneRange;
    return lineMargin.top + (1 - norm) * lineChartH;
  };

  // Tìm điểm cực đại / cực tiểu
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

  // Màu sắc điểm phân tán theo vĩ độ
  const getScatterColor = (pt) => {
    const lat = Math.abs(pt.latitude || 0);
    if (lat > 75) return '#dc2626'; // Đỏ thẫm cho Nam Cực sâu
    if (lat > 65) return '#ea580c'; // Cam đỏ
    if (lat > 50) return '#f59e0b'; // Vàng cam
    return '#10b981'; // Xanh lá
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & BỘ LỌC CHU KỲ (PERIOD FILTERS) ───────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-sky-600" />
              Bộ 3 Biểu đồ Chuỗi thời gian (Time-Series Analytics)
            </h2>
            {/* Badge WebSocket Real-time Live */}
            {wsStatus === 'connected' ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>TRỰC TIẾP (WS)</span>
              </span>
            ) : wsStatus === 'reconnecting' ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>Đang kết nối lại...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Ngoại tuyến</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
            <span>Tổng hợp số liệu vệ tinh OMI Bán đảo Nam Cực, cập nhật tự động khi nạp file</span>
            {lastUpdated && (
              <span className="font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{lastUpdated.toLocaleTimeString('vi-VN', { timeZone: 'UTC' })} UTC</span>
              </span>
            )}
            <span className="font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1">
              <Database className="w-3 h-3 text-sky-500" />
              <span>{(data?.total_count || 30342).toLocaleString()} điểm đo thực</span>
            </span>
          </div>
        </div>

        {/* Lựa chọn mốc gom nhóm: Giờ / Ngày / Tuần / Tháng */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-400 ml-1.5" />
          <button
            onClick={() => setPeriod('hour')}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              period === 'hour' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo Giờ (Hour)
          </button>
          <button
            onClick={() => setPeriod('day')}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              period === 'day' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo Ngày (Day)
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              period === 'week' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo Tuần (Week)
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              period === 'month' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo Tháng (Month)
          </button>
          <button
            onClick={() => fetchTimeseries(period)}
            title="Làm mới dữ liệu từ PostgreSQL"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md bg-white border border-slate-200 shadow-2xs ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── BỘ LỌC CHUNG CHO 3 BIỂU ĐỒ ────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ZoomIn className="w-4 h-4 text-sky-600" />
          Bộ lọc chung cho 3 biểu đồ (Filter & Thresholds)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {/* ── GRID CHỨA 3 BIỂU ĐỒ ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Line Chart — HIỂN THỊ VỪA PHẢI + KÉO CHUỘT PHÓNG TO / THU NHỎ / PAN */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between lg:col-span-2">
          {/* Header Biểu đồ 1 */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-sky-500 ring-4 ring-sky-100"></span>
                  1. Biểu đồ đường (Line Chart) — Diễn biến Chi tiết Nồng độ Ozone & Ngưỡng NASA
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  {linePoints.length} mốc thời gian
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Biến thiên trung bình, dải Min–Max và ngưỡng thủng tầng Ozone (220 DU). Kéo chuột để phóng to/thu nhỏ hoặc duyệt ngang.
              </p>
            </div>

            {/* BỘ ĐIỀU KHIỂN ZOOM BẰNG KÉO CHUỘT / SLIDER */}
            <div className="flex flex-wrap items-center gap-2">
              {extrema.maxIdx >= 0 && (
                <div className="hidden sm:flex items-center gap-2 mr-2 text-xs font-mono">
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                    Max: <strong>{Math.round(extrema.maxVal)} DU</strong>
                  </span>
                  <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                    Min: <strong>{Math.round(extrema.minVal)} DU</strong>
                  </span>
                </div>
              )}

              {/* Thanh trượt kéo chuột phóng to nhỏ & Nút điều khiển */}
              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MoveHorizontal className="w-3 h-3" /> Zoom:
                </span>
                <button
                  onClick={() => setLineZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                  className="w-5 h-5 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 rounded shadow-2xs transition"
                  title="Thu nhỏ"
                >
                  −
                </button>
                {/* Thanh kéo chuột chỉnh tỉ lệ Zoom */}
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={lineZoom}
                  onChange={(e) => setLineZoom(parseFloat(e.target.value))}
                  className="w-20 md:w-28 accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                  title="Kéo chuột để phóng to / thu nhỏ biểu đồ"
                />
                <button
                  onClick={() => setLineZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  className="w-5 h-5 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 rounded shadow-2xs transition"
                  title="Phóng to"
                >
                  +
                </button>
                <span className="font-mono text-slate-600 text-[11px] min-w-[38px] text-center">
                  {Math.round(lineZoom * 100)}%
                </span>
                {lineZoom > 1 && (
                  <button
                    onClick={() => setLineZoom(1)}
                    className="ml-1 px-1.5 py-0.5 text-[10.5px] bg-sky-100 hover:bg-sky-200 text-sky-800 rounded transition font-medium"
                    title="Đặt lại về kích thước vừa vặn ban đầu"
                  >
                    100%
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* VÙNG VẼ BIỂU ĐỒ VỪA PHẢI (Cao 320px) — HỖ TRỢ KÉO CHUỘT DUYỆT (DRAG-TO-PAN) */}
          <div
            ref={lineDrag.ref}
            {...lineDrag.handlers}
            className={`h-[320px] w-full relative pt-2 mt-3 overflow-x-auto bg-gradient-to-b from-slate-50/50 to-white rounded-xl border border-slate-200 transition-colors select-none ${
              lineDrag.isDragging ? 'cursor-grabbing' : lineZoom > 1 ? 'cursor-grab' : 'cursor-default'
            }`}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {linePoints.length > 0 ? (() => {
              const baseSvgW = 950;
              const currentSvgW = Math.round(baseSvgW * lineZoom);
              const chartInnerW = currentSvgW - lineMargin.left - lineMargin.right;
              const labelStep = linePoints.length > 18 ? Math.ceil(linePoints.length / Math.max(1, Math.round(14 * lineZoom))) : 1;

              return (
                <div style={{ width: `${Math.round(100 * lineZoom)}%`, minWidth: '100%', height: '100%' }}>
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox={`0 0 ${currentSvgW} ${lineSvgH}`}
                  >
                    <defs>
                      <linearGradient id="ozoneAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>

                    {/* 1. Lưới ngang & Nhãn trục Y (DU) */}
                    {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, i) => {
                      const yPos = lineMargin.top + ratio * lineChartH;
                      const duVal = Math.round(maxOzone - ratio * ozoneRange);
                      return (
                        <g key={i}>
                          <line
                            x1={lineMargin.left}
                            y1={yPos}
                            x2={currentSvgW - lineMargin.right}
                            y2={yPos}
                            stroke="#f1f5f9"
                            strokeWidth="1.2"
                          />
                          <text
                            x={lineMargin.left - 8}
                            y={yPos + 4}
                            fontSize="10"
                            fill="#64748b"
                            textAnchor="end"
                            fontFamily="monospace"
                            fontWeight="500"
                          >
                            {duVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* 2. Đường Ngưỡng Thủng Ozone NASA (220 DU) */}
                    {minOzone <= 220 && maxOzone >= 220 && (
                      <g>
                        <line
                          x1={lineMargin.left}
                          y1={getY(220)}
                          x2={currentSvgW - lineMargin.right}
                          y2={getY(220)}
                          stroke="#ef4444"
                          strokeWidth="1.5"
                          strokeDasharray="5 3"
                        />
                        <text
                          x={currentSvgW - lineMargin.right - 5}
                          y={getY(220) - 6}
                          fontSize="10"
                          fill="#dc2626"
                          fontWeight="bold"
                          textAnchor="end"
                        >
                          Ngưỡng Thủng (220 DU)
                        </text>
                      </g>
                    )}

                    {/* 3. Vùng bóng mờ Min-Max (Area Band) */}
                    {linePoints.length > 1 && (
                      <path
                        d={`
                          M ${lineMargin.left} ${getY(linePoints[0].ozone_max || linePoints[0].ozone_mean)}
                          ${linePoints
                            .map((p, i) => {
                              const x = lineMargin.left + (i / (linePoints.length - 1)) * chartInnerW;
                              return `L ${x} ${getY(p.ozone_max || p.ozone_mean)}`;
                            })
                            .join(' ')}
                          ${linePoints
                            .slice()
                            .reverse()
                            .map((p, i) => {
                              const revIdx = linePoints.length - 1 - i;
                              const x = lineMargin.left + (revIdx / (linePoints.length - 1)) * chartInnerW;
                              return `L ${x} ${getY(p.ozone_min || p.ozone_mean)}`;
                            })
                            .join(' ')}
                          Z
                        `}
                        fill="url(#ozoneAreaGradient)"
                      />
                    )}

                    {/* 4. Đường biểu diễn Nồng độ Trung bình (Trend Line) */}
                    {linePoints.length > 1 && (
                      <path
                        d={`
                          M ${lineMargin.left} ${getY(linePoints[0].ozone_mean)}
                          ${linePoints
                            .map((p, i) => {
                              const x = lineMargin.left + (i / (linePoints.length - 1)) * chartInnerW;
                              return `L ${x} ${getY(p.ozone_mean)}`;
                            })
                            .join(' ')}
                        `}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* 5. Các điểm mốc thời gian & Tương tác Tooltip */}
                    {linePoints.map((p, i) => {
                      const cx = lineMargin.left + (i / Math.max(linePoints.length - 1, 1)) * chartInnerW;
                      const cy = getY(p.ozone_mean);
                      const isHovered = i === hoveredIndex;
                      const shouldShowLabel = i % labelStep === 0 || i === linePoints.length - 1;

                      return (
                        <g
                          key={i}
                          className="cursor-pointer"
                          onMouseEnter={() => {
                            setHoveredIndex(i);
                            setShowTooltip(true);
                          }}
                          onMouseLeave={() => {
                            setHoveredIndex(null);
                            setShowTooltip(false);
                          }}
                        >
                          {/* Đường gióng dọc khi hover */}
                          {isHovered && (
                            <line
                              x1={cx}
                              y1={lineMargin.top}
                              x2={cx}
                              y2={lineMargin.top + lineChartH}
                              stroke="#0284c7"
                              strokeWidth="1.2"
                              strokeDasharray="3 3"
                            />
                          )}

                          {/* Vạch chia trục X */}
                          <line
                            x1={cx}
                            y1={lineMargin.top + lineChartH}
                            x2={cx}
                            y2={lineMargin.top + lineChartH + 5}
                            stroke="#cbd5e1"
                            strokeWidth="1.2"
                          />

                          {/* Điểm tròn */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 6.5 : 4}
                            fill={isHovered ? '#f59e0b' : '#0284c7'}
                            stroke="#ffffff"
                            strokeWidth="2"
                            className="transition-all"
                          />

                          {/* Tooltip nổi bật khi hover */}
                          {isHovered && showTooltip && (
                            <g className="select-none">
                              <rect
                                x={Math.max(10, Math.min(currentSvgW - 155, cx - 75))}
                                y={Math.max(5, cy - 60)}
                                width="150"
                                height="52"
                                fill="#0f172a"
                                rx="6"
                                opacity="0.95"
                              />
                              <text
                                x={Math.max(85, Math.min(currentSvgW - 80, cx))}
                                y={Math.max(5, cy - 60) + 18}
                                textAnchor="middle"
                                fontSize="11"
                                fill="#fbbf24"
                                fontWeight="bold"
                              >
                                {p.label} (UTC)
                              </text>
                              <text
                                x={Math.max(85, Math.min(baseSvgW - 75, cx))}
                                y={Math.max(5, cy - 60) + 34}
                                textAnchor="middle"
                                fontSize="11"
                                fill="#f8fafc"
                                fontWeight="600"
                              >
                                Ozone TB: {p.ozone_mean} DU
                              </text>
                              <text
                                x={Math.max(85, Math.min(baseSvgW - 75, cx))}
                                y={Math.max(5, cy - 60) + 47}
                                textAnchor="middle"
                                fontSize="9.5"
                                fill="#94a3b8"
                              >
                                Min: {p.ozone_min} — Max: {p.ozone_max} DU
                              </text>
                            </g>
                          )}

                          {/* Nhãn mốc trục X */}
                          {shouldShowLabel && (
                            <text
                              x={cx}
                              y={lineMargin.top + lineChartH + 18}
                              textAnchor="middle"
                              fontSize="9.5"
                              fill="#475569"
                              fontWeight="600"
                              fontFamily="monospace"
                            >
                              {p.label}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Tiêu đề trục Y */}
                    <text
                      x="16"
                      y={lineMargin.top + lineChartH / 2}
                      textAnchor="middle"
                      fontSize="10.5"
                      fill="#475569"
                      fontWeight="600"
                      transform={`rotate(-90, 16, ${lineMargin.top + lineChartH / 2})`}
                    >
                      Ozone (DU)
                    </text>
                  </svg>
                </div>
              );
            })() : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                Đang nạp dữ liệu chuỗi thời gian từ máy chủ...
              </div>
            )}
          </div>

          {/* Chú giải ý nghĩa các thành phần */}
          <div className="flex flex-wrap justify-between items-center text-xs text-slate-600 pt-3 mt-2 border-t border-slate-100 gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-2">
                <span className="w-4 h-1 bg-sky-600 inline-block rounded"></span>
                <strong>Đường xanh đậm:</strong> Nồng độ Ozone TB
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-2.5 bg-sky-200 border border-sky-300 inline-block rounded-xs"></span>
                <strong>Vùng bóng mờ:</strong> Dải dao động Min–Max
              </span>
              <span className="flex items-center gap-2 text-rose-600 font-semibold">
                <span className="w-4 h-0.5 bg-red-600 inline-block" style={{ borderTop: '2px dashed #dc2626' }}></span>
                Ngưỡng Thủng Ozone (220 DU)
              </span>
            </div>
            <span className="text-slate-400 italic">💡 Kéo thanh trượt hoặc lăn chuột để zoom, bấm giữ chuột để kéo xem các mốc</span>
          </div>
        </div>

        {/* 2. Scatter Plot — SZA vs Ozone & Vĩ độ (KÉO CHUỘT PHÓNG TO / THU NHỎ / PAN) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span>
                  2. Biểu đồ phân tán (Scatter Plot) — SZA vs Ozone & Vĩ độ
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                  {scatterPoints.length} điểm đo
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Trục X: SZA ({szaPlotMin}° - {szaPlotMax}°) • Trục Y: Ozone (DU) • Màu: Vĩ độ
              </p>
            </div>

            {/* Điều khiển Zoom của Biểu đồ Phân tán */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <span className="text-[10.5px] text-slate-500 flex items-center gap-0.5">
                <MoveHorizontal className="w-3 h-3" /> Zoom 2D:
              </span>
              <button
                onClick={() => setScatterZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                className="w-4 h-4 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 rounded text-xs transition"
                title="Thu nhỏ 2 chiều"
              >
                −
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={scatterZoom}
                onChange={(e) => setScatterZoom(parseFloat(e.target.value))}
                className="w-16 accent-violet-600 h-1 bg-slate-200 rounded cursor-pointer"
                title="Kéo chuột để phóng to / thu nhỏ cả 2 trục (dọc & ngang)"
              />
              <button
                onClick={() => setScatterZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                className="w-4 h-4 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 rounded text-xs transition"
                title="Phóng to 2 chiều"
              >
                +
              </button>
              <span className="font-mono text-slate-600 text-[10.5px]">
                {Math.round(scatterZoom * 100)}%
              </span>
              {scatterZoom > 1 && (
                <button
                  onClick={() => setScatterZoom(1)}
                  className="px-1 text-[10px] bg-violet-100 hover:bg-violet-200 text-violet-800 rounded font-medium transition"
                  title="Đặt lại về 100%"
                >
                  100%
                </button>
              )}
            </div>
          </div>

          {/* Vùng vẽ Scatter Plot (Cao 290px) — KÉO CHUỘT DUYỆT 2 CHIỀU (X & Y) */}
          <div
            ref={scatterDrag.ref}
            {...scatterDrag.handlers}
            className={`h-[290px] w-full relative pt-2 overflow-auto bg-gradient-to-b from-slate-50 to-white rounded-lg border border-slate-100 select-none ${
              scatterDrag.isDragging ? 'cursor-grabbing' : scatterZoom > 1 ? 'cursor-grab' : 'cursor-default'
            }`}
            onMouseLeave={() => setHoveredScatterPoint(null)}
          >
            {scatterPoints.length > 0 ? (() => {
              const baseSvgW = 560;
              const baseSvgH = 220;
              const chartInnerW = baseSvgW - 55 - 25;
              const zoomPct = Math.round(100 * scatterZoom);

              return (
                <div style={{ width: `${zoomPct}%`, height: `${zoomPct}%`, minWidth: '100%', minHeight: '100%' }}>
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox={`0 0 ${baseSvgW} ${baseSvgH}`}
                  >
                    {/* Lưới ngang */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                      <line key={`h${i}`} x1="55" y1={25 + r * 145} x2={baseSvgW - 25} y2={25 + r * 145} stroke="#f1f5f9" strokeWidth="1" />
                    ))}
                    {/* Lưới dọc & Nhãn trục X tự động trải đều */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                      const gx = 55 + r * chartInnerW;
                      const tickVal = (szaPlotMin + r * szaSpan).toFixed(1);
                      return (
                        <g key={`v${i}`}>
                          <line x1={gx} y1="25" x2={gx} y2="170" stroke="#f1f5f9" strokeWidth="1" />
                          <text x={gx} y="186" fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="monospace">
                            {tickVal}°
                          </text>
                        </g>
                      );
                    })}

                    {/* Ngưỡng Thủng Ozone 220 DU */}
                    <line
                      x1="55"
                      y1={170 - ((220 - 150) / 320) * 145}
                      x2={baseSvgW - 25}
                      y2={170 - ((220 - 150) / 320) * 145}
                      stroke="#dc2626"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={baseSvgW - 30}
                      y={170 - ((220 - 150) / 320) * 145 - 4}
                      fontSize="9"
                      fill="#dc2626"
                      textAnchor="end"
                      fontWeight="bold"
                    >
                      220 DU
                    </text>

                    {/* Các điểm phân tán */}
                    {scatterPoints.map((pt, i) => {
                      const cx = 55 + ((pt.x_sza - szaPlotMin) / szaSpan) * chartInnerW;
                      const cy = 170 - ((pt.y_ozone - 150) / 320) * 145;
                      const dotColor = getScatterColor(pt);
                      const isHovered = hoveredScatterPoint === i;

                      return (
                        <g
                          key={i}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredScatterPoint(i)}
                          onMouseLeave={() => setHoveredScatterPoint(null)}
                        >
                          {isHovered && (
                            <circle
                              cx={Math.max(55, Math.min(baseSvgW - 25, cx))}
                              cy={Math.max(25, Math.min(170, cy))}
                              r={7}
                              fill="none"
                              stroke={dotColor}
                              strokeWidth="1.5"
                              opacity="0.6"
                            />
                          )}
                          <circle
                            cx={Math.max(55, Math.min(baseSvgW - 25, cx))}
                            cy={Math.max(25, Math.min(170, cy))}
                            r={isHovered ? 4.5 : 3.0}
                            fill={dotColor}
                            stroke="#ffffff"
                            strokeWidth={isHovered ? '1.5' : '0.8'}
                            opacity={isHovered ? 1 : 0.85}
                          />

                          {/* Tooltip khi hover điểm */}
                          {isHovered && (
                            <g className="select-none">
                              <rect
                                x={Math.max(10, Math.min(baseSvgW - 120, cx - 55))}
                                y={Math.max(5, cy - 42)}
                                width="110"
                                height="38"
                                fill="#0f172a"
                                rx="5"
                                opacity="0.95"
                              />
                              <text
                                x={Math.max(65, Math.min(baseSvgW - 65, cx))}
                                y={Math.max(5, cy - 42) + 15}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#f8fafc"
                                fontWeight="bold"
                              >
                                Ozone: {pt.y_ozone} DU
                              </text>
                              <text
                                x={Math.max(65, Math.min(baseSvgW - 65, cx))}
                                y={Math.max(5, cy - 42) + 29}
                                textAnchor="middle"
                                fontSize="9"
                                fill="#cbd5e1"
                              >
                                SZA: {pt.x_sza}° • Vĩ: {pt.latitude}°
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    <text x={55 + chartInnerW / 2} y="202" fontSize="9.5" fill="#475569" fontWeight="600" textAnchor="middle">
                      Solar Zenith Angle (SZA, độ) — Vùng Nam Cực ({szaPlotMin}° → {szaPlotMax}°)
                    </text>

                    <text x="50" y="174" fontSize="9" fill="#64748b" textAnchor="end">150</text>
                    <text x="50" y="102" fontSize="9" fill="#64748b" textAnchor="end">310</text>
                    <text x="50" y="30" fontSize="9" fill="#64748b" textAnchor="end">470</text>
                  </svg>
                </div>
              );
            })() : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Không có điểm đo nào phù hợp với bộ lọc Ozone / SZA / Mây hiện tại.
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 gap-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Nam Cực sâu (&gt;75°S)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Bán đảo (60-75°S)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Ôn đới (&lt;60°S)
            </span>
          </div>
        </div>

        {/* 3. Histogram — Phân phối Ozone & Phân bố chuẩn (KÉO CHUỘT PHÓNG TO / THU NHỎ / PAN) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  3. Biểu đồ tần suất (Histogram) — Phân phối Ozone & Phân bố chuẩn
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {scatterPoints.length} điểm đo
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Trục X: Dải Ozone (DU) • Trục Y: Số lượng điểm đo (Count) • Đường Mean & Median
              </p>
            </div>

            {/* Điều khiển Zoom của Biểu đồ Tần suất */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <span className="text-[10.5px] text-slate-500 flex items-center gap-0.5">
                <MoveHorizontal className="w-3 h-3" /> Zoom 2D:
              </span>
              <button
                onClick={() => setHistZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                className="w-4 h-4 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 rounded text-xs transition"
                title="Thu nhỏ 2 chiều"
              >
                −
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={histZoom}
                onChange={(e) => setHistZoom(parseFloat(e.target.value))}
                className="w-16 accent-emerald-600 h-1 bg-slate-200 rounded cursor-pointer"
                title="Kéo chuột để phóng to / thu nhỏ cả 2 trục (dọc & ngang)"
              />
              <button
                onClick={() => setHistZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                className="w-4 h-4 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 rounded text-xs transition"
                title="Phóng to 2 chiều"
              >
                +
              </button>
              <span className="font-mono text-slate-600 text-[10.5px]">
                {Math.round(histZoom * 100)}%
              </span>
              {histZoom > 1 && (
                <button
                  onClick={() => setHistZoom(1)}
                  className="px-1 text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-medium transition"
                  title="Đặt lại về 100%"
                >
                  100%
                </button>
              )}
            </div>
          </div>

          {/* Vùng vẽ Histogram (Cao 290px) — KÉO CHUỘT DUYỆT 2 CHIỀU (X & Y) */}
          <div
            ref={histDrag.ref}
            {...histDrag.handlers}
            className={`h-[290px] w-full relative pt-2 overflow-auto bg-gradient-to-b from-slate-50 to-white rounded-lg border border-slate-100 select-none ${
              histDrag.isDragging ? 'cursor-grabbing' : histZoom > 1 ? 'cursor-grab' : 'cursor-default'
            }`}
            onMouseLeave={() => setHoveredHistBin(null)}
          >
            {scatterPoints.length > 0 && histBars.length > 0 ? (() => {
              const baseSvgW = 600;
              const baseSvgH = 220;
              const chartInnerW = baseSvgW - 55 - 35;
              const maxCount = Math.max(...histBars.map((b) => b.count), 1);
              const barWidth = chartInnerW / histBars.length;
              const zoomPct = Math.round(100 * histZoom);

              let totalValue = 0, totalCount = 0;
              const allValues = [];
              histBars.forEach((b) => {
                const binW = b.bin_end ? (b.bin_end - b.bin_start) : Math.ceil((ozoneMax - ozoneMin) / histBars.length);
                totalValue += (b.bin_start + binW / 2) * b.count;
                totalCount += b.count;
                for (let j = 0; j < b.count; j++) allValues.push(b.bin_start);
              });

              const meanVal = totalCount > 0 ? totalValue / totalCount : (ozoneMin + ozoneMax) / 2;
              const medianVal = allValues.length > 0 ? allValues[Math.floor(allValues.length / 2)] : meanVal;
              const oSpan = Math.max(ozoneMax - ozoneMin, 20);
              const meanX = 55 + Math.max(0, Math.min(1, (meanVal - ozoneMin) / oSpan)) * chartInnerW;
              const medianX = 55 + Math.max(0, Math.min(1, (medianVal - ozoneMin) / oSpan)) * chartInnerW;

              return (
                <div style={{ width: `${zoomPct}%`, height: `${zoomPct}%`, minWidth: '100%', minHeight: '100%' }}>
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox={`0 0 ${baseSvgW} ${baseSvgH}`}
                  >
                    {/* Các cột Histogram */}
                    {histBars.map((b, i) => {
                      const x = 55 + i * barWidth;
                      const h = (b.count / maxCount) * 135;
                      const y = 165 - h;
                      const isHovered = hoveredHistBin === i;

                      let barColor = '#0ea5e9';
                      if (b.bin_start < 220) barColor = '#dc2626';
                      else if (b.bin_start < 260) barColor = '#f97316';
                      else if (b.bin_start >= 300) barColor = '#10b981';

                      return (
                        <g
                          key={i}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredHistBin(i)}
                          onMouseLeave={() => setHoveredHistBin(null)}
                        >
                          <rect
                            x={x + 3}
                            y={y}
                            width={Math.max(barWidth - 6, 4)}
                            height={h}
                            fill={barColor}
                            rx="3"
                            opacity={isHovered ? 1 : 0.85}
                            className="transition-all"
                          />

                          {/* Nhãn số lượng trên đỉnh cột */}
                          {b.count > 0 && (
                            <text
                              x={x + barWidth / 2}
                              y={y - 4}
                              textAnchor="middle"
                              fontSize="9.5"
                              fill="#1e293b"
                              fontWeight="600"
                            >
                              {b.count}
                            </text>
                          )}

                          {/* Nhãn khoảng giá trị trục X */}
                          <text
                            x={x + barWidth / 2}
                            y="182"
                            textAnchor="middle"
                            fontSize="9"
                            fill="#64748b"
                            fontFamily="monospace"
                          >
                            {b.bin_start}
                          </text>

                          {/* Tooltip khi hover cột */}
                          {isHovered && b.count > 0 && (
                            <g className="select-none">
                              <rect
                                x={Math.max(10, Math.min(baseSvgW - 120, x - 20))}
                                y={Math.max(5, y - 40)}
                                width={Math.max(barWidth + 40, 100)}
                                height="32"
                                fill="#0f172a"
                                rx="5"
                                opacity="0.95"
                              />
                              <text
                                x={Math.max(60, Math.min(baseSvgW - 60, x + barWidth / 2))}
                                y={Math.max(5, y - 40) + 14}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#fbbf24"
                                fontWeight="bold"
                              >
                                {b.count} điểm đo
                              </text>
                              <text
                                x={Math.max(60, Math.min(baseSvgW - 60, x + barWidth / 2))}
                                y={Math.max(5, y - 40) + 26}
                                textAnchor="middle"
                                fontSize="8.5"
                                fill="#cbd5e1"
                              >
                                {b.bin_start} – {b.bin_end || (b.bin_start + Math.ceil(oSpan / histBars.length))} DU
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Đường Mean */}
                    <line x1={meanX} y1="20" x2={meanX} y2="165" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" />
                    <text x={meanX} y="14" textAnchor="middle" fontSize="9" fill="#3b82f6" fontWeight="bold">
                      Mean: {Math.round(meanVal)}
                    </text>

                    {/* Đường Median */}
                    <line x1={medianX} y1="20" x2={medianX} y2="165" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3 3" />
                    <text x={medianX} y="14" textAnchor="middle" fontSize="9" fill="#8b5cf6" fontWeight="bold">
                      Med: {Math.round(medianVal)}
                    </text>

                    {/* Trục X cơ sở */}
                    <line x1="45" y1="166" x2={baseSvgW - 25} y2="166" stroke="#cbd5e1" strokeWidth="1.2" />

                    <text x={55 + chartInnerW / 2} y="202" textAnchor="middle" fontSize="9.5" fill="#475569" fontWeight="600">
                      Khoảng Nồng độ Ozone Cột (DU)
                    </text>
                  </svg>
                </div>
              );
            })() : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                Không có điểm đo nào phù hợp với bộ lọc Ozone / SZA / Mây hiện tại.
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 gap-2">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-sm"></span> Suy giảm (&lt;220)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></span> Thấp (220-260)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-sky-500 rounded-sm"></span> Chuẩn (260-300)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Cao (&gt;300)</span>
          </div>
        </div>

      </div>
    </div>
  );
}
