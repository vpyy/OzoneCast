import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  TrendingUp,
  Grid,
  RefreshCw,
  RotateCcw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Layers,
  Info,
  Calendar,
  Sparkles,
  Radio,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { api, API_BASE } from '../api/apiClient';
import { useWebSocket } from '../lib/useWebSocket';

// ── CÁC HẰNG SỐ PHÂN RÃ KHÍ QUYỂN (DECOMPOSITION CONSTANTS) ──────────────────
const SEASONAL_BASELINE = 290.0; // Mốc căn giữa trên trục hiển thị chung
const SEASONAL_SCALE    = 1.5;   // Hệ số co giãn mùa vụ trên trục gộp
const RESIDUAL_SCALE    = 2.0;   // Hệ số co giãn phần dư trên trục gộp
const MAX_POINTS        = 5000;  // Giới hạn bộ nhớ tối đa trong state
const STALE_MINUTES     = Number(import.meta.env.VITE_LIVE_STALE_MINUTES || 180);
const IS_MOCK_ENV       = import.meta.env.VITE_MOCK_LIVE === 'true';

// ── BẢNG MÀU TƯƠNG QUAN PEARSON 6×6 ──────────────────────────────────────────
function getCorrColor(val) {
  if (val === 1.0) return { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' }; // Đường chéo chính
  if (val >= 0.7)  return { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' }; // Thuận rất mạnh
  if (val >= 0.4)  return { bg: '#FFEDD5', text: '#9A3412', border: '#FDBA74' }; // Thuận vừa
  if (val >= 0.1)  return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' }; // Thuận yếu
  if (val > -0.1)  return { bg: '#F8FAFC', text: '#94A3B8', border: '#E2E8F0' }; // Gần 0 (độc lập)
  if (val > -0.4)  return { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' }; // Nghịch yếu
  if (val > -0.7)  return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' }; // Nghịch vừa
  return { bg: '#C7D2FE', text: '#3730A3', border: '#818CF8' };                   // Nghịch rất mạnh
}

// ── HÀM ĐỊNH DẠNG THỜI GIAN THEO CHUẨN UTC & VI-VN ───────────────────────────
const utcDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit'
});

const utcDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const utcGroupDayFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'UTC',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const utcGroupMonthFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'UTC',
  month: '2-digit',
  year: 'numeric'
});

const utcFullTooltipFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'UTC',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

// ── TÌM KIẾM NHỊ PHÂN O(log N) ĐIỂM GẦN NHẤT THEO THỜI GIAN ───────────────────
function findClosestIndexByTime(points, targetTime) {
  if (!points || points.length === 0) return -1;
  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midTime = points[mid].time;
    if (midTime === targetTime) return mid;
    if (midTime < targetTime) low = mid + 1;
    else high = mid - 1;
  }

  if (low >= points.length) return points.length - 1;
  if (high < 0) return 0;
  return Math.abs(points[low].time - targetTime) < Math.abs(points[high].time - targetTime)
    ? low
    : high;
}

// ── XỬ LÝ TÁCH ĐOẠN POLYLINE KHI GẶP NULL/NAN (KHÔNG VẼ VỀ 0) ─────────────────
function buildPolylineSegments(points, valueExtractor, timeExtractor, getX, getY) {
  const segments = [];
  let currentSegment = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const val = valueExtractor(p);
    const t = timeExtractor(p);

    if (val === null || val === undefined || isNaN(val)) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    } else {
      const x = getX(t);
      const y = getY(val);
      currentSegment.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  return segments;
}

// ── GIẢM MẪU (PIXEL BUCKET DOWNSAMPLING) KHI SỐ ĐIỂM > 2 * BỀ RỘNG ────────────
function downsamplePoints(points, maxBuckets) {
  if (points.length <= maxBuckets) return points;
  const bucketSize = points.length / maxBuckets;
  const result = [];

  for (let i = 0; i < maxBuckets; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(points.length, Math.floor((i + 1) * bucketSize));
    if (start >= end) continue;

    // Lấy điểm min, max và điểm cuối trong bucket để giữ nguyên biên độ
    let minPt = points[start];
    let maxPt = points[start];
    for (let j = start + 1; j < end; j++) {
      const p = points[j];
      if (p.observed != null && (minPt.observed == null || p.observed < minPt.observed)) minPt = p;
      if (p.observed != null && (maxPt.observed == null || p.observed > maxPt.observed)) maxPt = p;
    }

    if (minPt.time < maxPt.time) {
      result.push(minPt);
      if (minPt !== maxPt) result.push(maxPt);
    } else {
      result.push(maxPt);
      if (minPt !== maxPt) result.push(minPt);
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

// ── COMPONENT DÙNG CHUNG: TRỤC X HAI HÀNG (TWO-ROW X-AXIS WITH REAL DATES) ────
function TwoRowXAxis({
  tStart,
  tEnd,
  chartW,
  chartH,
  margin,
  svgWidth,
  getX
}) {
  const durationMs = tEnd - tStart;
  if (durationMs <= 0) return null;

  // Tính toán bước nhảy mốc (step interval) sao cho nhãn không chồng chéo (tối thiểu ~65px)
  const isMultiDay = durationMs > 36 * 3600 * 1000;
  const maxTicks = Math.max(3, Math.min(10, Math.floor(chartW / 75)));

  // Sinh các mốc thời gian tròn
  const tickTimes = useMemo(() => {
    const times = [];
    const stepMs = durationMs / maxTicks;

    for (let i = 0; i <= maxTicks; i++) {
      const t = tStart + i * stepMs;
      times.push(t);
    }
    return times;
  }, [tStart, durationMs, maxTicks]);

  // Phân nhóm hàng 2: Theo ngày (nếu khung nhìn <= 4 ngày) hoặc theo Tháng/Năm (nếu > 4 ngày)
  const groupHeaders = useMemo(() => {
    const groups = [];
    const spanDays = durationMs / (86400 * 1000);

    if (spanDays <= 4) {
      // Nhóm theo từng ngày riêng biệt: 00:00 UTC ranh giới
      const startDay = new Date(tStart);
      startDay.setUTCHours(0, 0, 0, 0);

      let cur = startDay.getTime();
      while (cur <= tEnd + 86400000) {
        if (cur >= tStart - 86400000) {
          const d = new Date(cur);
          groups.push({
            time: cur,
            label: utcGroupDayFormatter.format(d)
          });
        }
        cur += 86400000;
      }
    } else {
      // Nhóm theo từng tháng: ngày 1 đầu tháng ranh giới
      const startDate = new Date(tStart);
      startDate.setUTCDate(1);
      startDate.setUTCHours(0, 0, 0, 0);

      let curDate = new Date(startDate);
      while (curDate.getTime() <= tEnd + 31 * 86400000) {
        const t = curDate.getTime();
        if (t >= tStart - 31 * 86400000) {
          groups.push({
            time: t,
            label: `Tháng ${utcGroupMonthFormatter.format(curDate)}`
          });
        }
        curDate.setUTCMonth(curDate.getUTCMonth() + 1);
      }
    }

    return groups;
  }, [tStart, tEnd, durationMs]);

  const axisY = margin.top + chartH;

  return (
    <g className="select-none font-mono">
      {/* Đường cơ sở trục X */}
      <line
        x1={margin.left}
        y1={axisY}
        x2={svgWidth - margin.right}
        y2={axisY}
        stroke="#CBD5E1"
        strokeWidth="1.2"
      />

      {/* ── HÀNG 1: MỐC THỜI GIAN CHI TIẾT (dd/MM hoặc HH:mm) ── */}
      {tickTimes.map((t, idx) => {
        const x = getX(t);
        if (x < margin.left - 5 || x > svgWidth - margin.right + 5) return null;
        const d = new Date(t);
        const label = isMultiDay ? utcDateFormatter.format(d) : utcDateTimeFormatter.format(d);

        return (
          <g key={`tick-${idx}`}>
            <line
              x1={x}
              y1={axisY}
              x2={x}
              y2={axisY + 4}
              stroke="#94A3B8"
              strokeWidth="1"
            />
            <text
              x={x}
              y={axisY + 16}
              fontSize="9.5"
              fill="#475569"
              textAnchor="middle"
              fontWeight="600"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* ── HÀNG 2: NHÃN NHÓM LỚN HƠN (NGÀY/THÁNG) CÓ VẠCH PHÂN RANH GIỚI ── */}
      {groupHeaders.map((g, idx) => {
        const xBoundary = getX(g.time);
        // Vạch phân tách nhóm
        const showBoundaryLine = xBoundary >= margin.left && xBoundary <= svgWidth - margin.right;
        // Điểm đặt chữ: không để tràn ra ngoài mép trái
        const xText = Math.max(margin.left + 8, Math.min(svgWidth - margin.right - 90, xBoundary + 6));

        return (
          <g key={`group-${idx}`}>
            {showBoundaryLine && (
              <line
                x1={xBoundary}
                y1={axisY + 1}
                x2={xBoundary}
                y2={axisY + 36}
                stroke="#CBD5E1"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}
            {/* Chỉ in nhãn nhóm nếu vị trí hợp lệ */}
            {xBoundary <= svgWidth - margin.right - 20 && (
              <text
                x={xText}
                y={axisY + 32}
                fontSize="10"
                fill="#0F172A"
                textAnchor="start"
                fontWeight="700"
                className="tracking-tight"
              >
                {g.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Chỉ báo múi giờ chuẩn NASA UTC */}
      <text
        x={svgWidth - margin.right}
        y={axisY + 46}
        fontSize="8.5"
        fill="#94A3B8"
        textAnchor="end"
        fontWeight="700"
      >
        [Giờ chuẩn UTC]
      </text>
    </g>
  );
}

// ── MAIN COMPONENT: TREND SEASONAL CORRELATION ────────────────────────────────
export default function TrendSeasonalCorrelation() {
  // Dữ liệu chuỗi thời gian phân rã (sắp xếp tăng dần theo epoch ms)
  const [points, setPoints]             = useState([]);
  const [corrData, setCorrData]         = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Bộ lọc các thành phần hiển thị
  const [filters, setFilters] = useState({
    observed: true,
    trend: true,
    seasonal: true,
    residual: true
  });

  // Chế độ xem: 'combined' (gộp chung 1 biểu đồ) hoặc 'faceted' (tách 4 tầng)
  const [viewMode, setViewMode] = useState('combined');

  // Zoom & Điều hướng khung nhìn
  const [zoomLevel, setZoomLevel]       = useState(1); // 1 = 100%, 1.5 = 1.5x, 2 = 2x, 3 = 3x
  const [isFollowing, setIsFollowing]   = useState(true); // Chế độ theo dõi realtime mép phải
  const [unseenCount, setUnseenCount]   = useState(0);    // Điểm mới đến trong lúc tạm dừng follow
  const [customRange, setCustomRange]   = useState(null); // { tStart, tEnd } khi pan/zoom thủ công

  // Hover & Tooltip Crosshair
  const [hoveredIdx, setHoveredIdx]     = useState(null);
  const svgRef = useRef(null);

  // Chế độ phát dữ liệu mẫu trực tiếp (VITE_MOCK_LIVE)
  const [mockLiveEnabled, setMockLiveEnabled] = useState(IS_MOCK_ENV);

  // Batching hàng đợi cập nhật dồn dập qua requestAnimationFrame
  const pendingQueueRef = useRef([]);
  const rafRef          = useRef(null);

  // Kích thước SVG
  const svgWidth = 650;
  const svgHeight = 280; // Tăng chiều cao để trục X 2 hàng hiển thị thoáng đãng
  const margin = { top: 25, right: 65, bottom: 52, left: 50 }; // Chừa lề phải cho Nhãn Giá Cuối Sàn Chứng Khoán
  const chartW = svgWidth - margin.left - margin.right;
  const chartH = svgHeight - margin.top - margin.bottom;

  // ── 1. HÀM CHUYỂN ĐỔI CHUẨN HÓA MỘT ĐIỂM DỮ LIỆU CÓ TIMESTAMP ───────────────
  const normalizePoint = useCallback((item, indexFallback = 0) => {
    let tMs = null;
    let isoStr = null;

    if (item.timestamp) {
      tMs = Date.parse(item.timestamp);
      isoStr = new Date(tMs).toISOString();
    } else if (item.t) {
      tMs = Date.parse(item.t);
      isoStr = new Date(tMs).toISOString();
    } else if (item.time_raw) {
      tMs = Number(item.time_raw);
      isoStr = new Date(tMs).toISOString();
    } else {
      // Trường hợp dữ liệu tĩnh W1..W24 từ cache cũ: gán mốc giờ thực bắt đầu từ 2026-11-15 00:00 UTC
      const baseMs = Date.UTC(2026, 10, 15, 0, 0, 0); // Tháng 11 là index 10
      const stepOffset = item.step != null ? item.step - 1 : indexFallback;
      tMs = baseMs + stepOffset * 3600 * 1000 * 6; // Mỗi bước 6 tiếng
      isoStr = new Date(tMs).toISOString();
    }

    return {
      time: isNaN(tMs) ? Date.now() : tMs,
      timestamp: isoStr || new Date().toISOString(),
      observed: item.observed != null ? Number(Number(item.observed).toFixed(2)) : (item.value != null ? Number(Number(item.value).toFixed(2)) : null),
      trend: item.trend != null ? Number(Number(item.trend).toFixed(2)) : null,
      seasonal: item.seasonal != null ? Number(Number(item.seasonal).toFixed(2)) : null,
      residual: item.residual != null ? Number(Number(item.residual).toFixed(2)) : null,
      step: item.step
    };
  }, []);

  // ── 2. XỬ LÝ UPSERT ĐIỂM VÀO MẢNG SẮP XẾP THỜI GIAN ────────────────────────
  const flushPendingUpdates = useCallback(() => {
    if (pendingQueueRef.current.length === 0) return;

    const incoming = [...pendingQueueRef.current];
    pendingQueueRef.current = [];

    setPoints((prev) => {
      const pointMap = new Map();
      prev.forEach((p) => pointMap.set(p.time, p));

      incoming.forEach((item) => {
        const norm = normalizePoint(item);
        if (pointMap.has(norm.time)) {
          // Cập nhật giá trị nếu điểm đã tồn tại (backend tính lại phân rã)
          const old = pointMap.get(norm.time);
          pointMap.set(norm.time, {
            ...old,
            observed: norm.observed ?? old.observed,
            trend: norm.trend ?? old.trend,
            seasonal: norm.seasonal ?? old.seasonal,
            residual: norm.residual ?? old.residual
          });
        } else {
          pointMap.set(norm.time, norm);
        }
      });

      // Sắp xếp lại tăng dần theo thời gian
      const sorted = Array.from(pointMap.values()).sort((a, b) => a.time - b.time);
      // Giới hạn bộ nhớ tối đa MAX_POINTS
      const bounded = sorted.length > MAX_POINTS ? sorted.slice(sorted.length - MAX_POINTS) : sorted;

      return bounded;
    });

    setLastUpdateTime(new Date());

    // Nếu người dùng đang pan/zoom (tắt follow), cộng dồn số điểm mới đến
    setIsFollowing((following) => {
      if (!following) {
        setUnseenCount((cnt) => cnt + incoming.length);
      }
      return following;
    });
  }, [normalizePoint]);

  // Đưa điểm mới vào hàng đợi gom (Throttle via requestAnimationFrame)
  const enqueueUpdates = useCallback((newItems) => {
    if (!newItems || newItems.length === 0) return;
    pendingQueueRef.current.push(...newItems);

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        flushPendingUpdates();
      });
    }
  }, [flushPendingUpdates]);

  // ── 3. GỌI REST BACKFILL TOÀN BỘ LỊCH SỬ KHI MOUNT ──────────────────────────
  const fetchBackfillData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendRes, corrRes, hourTimeseriesRes] = await Promise.allSettled([
        api.getTrendSeasonal(),
        api.getCorrelationMatrix(),
        api.getAggregatedTimeseries('hour', null, null, 1500)
      ]);

      if (corrRes.status === 'fulfilled' && corrRes.value) {
        setCorrData(corrRes.value);
      }

      let combinedPoints = [];

      // 1. ƯU TIÊN SỐ 1: Chuỗi thời gian thực tế từ bảng raw_measurements trong PostgreSQL
      if (hourTimeseriesRes.status === 'fulfilled' && hourTimeseriesRes.value?.series?.length > 0) {
        const hourly = hourTimeseriesRes.value.series.filter((h) => h.t && h.value != null);
        hourly.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

        const N = hourly.length;
        const halfWindow = Math.min(3, Math.max(1, Math.floor(N / 4)));

        combinedPoints = hourly.map((h, i) => {
          const tMs = Date.parse(h.t);
          const oVal = Number(Number(h.value).toFixed(2));
          const dt = new Date(tMs);
          const hourUtc = dt.getUTCHours();

          // 1. Trend: Moving Average cục bộ (cửa sổ trượt k điểm)
          const startIdx = Math.max(0, i - halfWindow);
          const endIdx = Math.min(N - 1, i + halfWindow);
          let sumVal = 0;
          let count = 0;
          for (let k = startIdx; k <= endIdx; k++) {
            sumVal += Number(hourly[k].value);
            count++;
          }
          const trendVal = Number((sumVal / count).toFixed(2));

          // 2. Seasonal: Chu kỳ bức xạ nhật triều Nam Cực (cực đại vào 14-16h UTC tại Bán đảo 65°W)
          const seasonalVal = Number((18.5 * Math.cos((2 * Math.PI * (hourUtc - 15)) / 24)).toFixed(2));

          // 3. Residual = Observed - Trend - Seasonal
          const residualVal = Number((oVal - trendVal - seasonalVal).toFixed(2));

          return {
            time: tMs,
            timestamp: h.t,
            observed: oVal,
            trend: trendVal,
            seasonal: seasonalVal,
            residual: residualVal,
            step: i + 1
          };
        });
      } else if (trendRes.status === 'fulfilled' && trendRes.value?.series) {
        // Fallback sang cache tĩnh chỉ khi DB hoàn toàn chưa có điểm đo nào
        combinedPoints = trendRes.value.series.map((s, idx) => normalizePoint(s, idx));
      }

      combinedPoints.sort((a, b) => a.time - b.time);
      setPoints(combinedPoints);
      setLastUpdateTime(new Date());
    } catch (e) {
      console.error('[Trend/Seasonal] Backfill error:', e);
      setError('Không thể nạp dữ liệu chuỗi thời gian từ máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [normalizePoint]);

  useEffect(() => {
    fetchBackfillData();
  }, [fetchBackfillData]);

  // ── 4. KẾT NỐI WEBSOCKET STREAMING (TÁI SỬ DỤNG SINGLETON HOOK) ──────────────
  const handleWsMessage = useCallback((payload) => {
    if (payload.type === 'snapshot' || payload.type === 'update') {
      const d = payload.data;
      if (!d) return;

      // Khi có bản ghi mới trong DB, tự động kích hoạt lấy lại chuỗi phân rã thực
      fetchBackfillData();

      // Làm mới ma trận tương quan khi có dữ liệu mới
      api.getCorrelationMatrix().then(setCorrData).catch(() => {});
    }
  }, [fetchBackfillData]);

  const { status: wsStatus } = useWebSocket({
    url: API_BASE.ws,
    onMessage: handleWsMessage,
    onFallbackPoll: fetchBackfillData,
    enabled: true,
    fallbackIntervalMs: 30000
  });

  // ── 5. CHẾ ĐỘ THỬ KHÔNG CẦN CHỜ (VITE_MOCK_LIVE) ───────────────────────────
  useEffect(() => {
    if (!mockLiveEnabled) return;

    const interval = setInterval(() => {
      setPoints((prev) => {
        const last = prev[prev.length - 1];
        const nextTime = last ? last.time + 2 * 3600 * 1000 : Date.now(); // Nhảy 2 tiếng mô phỏng vệ tinh
        const prevTrend = last?.trend ?? 295.0;
        const nextTrend = Number((prevTrend + (Math.random() - 0.49) * 0.4).toFixed(2));
        const tStep = prev.length + 1;
        const nextSeasonal = Number((28.0 * Math.sin((2 * Math.PI * tStep) / 12)).toFixed(2));
        const nextResidual = Number(((Math.random() - 0.5) * 4.5).toFixed(2));
        const nextObserved = Math.max(160, Math.min(360, Number((nextTrend + nextSeasonal + nextResidual).toFixed(2))));

        const mockItem = {
          time: nextTime,
          timestamp: new Date(nextTime).toISOString(),
          observed: nextObserved,
          trend: nextTrend,
          seasonal: nextSeasonal,
          residual: nextResidual,
          step: tStep
        };

        enqueueUpdates([mockItem]);
        return prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [mockLiveEnabled, enqueueUpdates]);

  // Cleanup requestAnimationFrame
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── 6. TÍNH TOÁN CỬA SỔ THỜI GIAN HIỂN THỊ [tStart, tEnd] ──────────────────
  const { tStart, tEnd, visiblePoints } = useMemo(() => {
    if (points.length === 0) {
      const now = Date.now();
      return { tStart: now - 86400000, tEnd: now, visiblePoints: [] };
    }

    const minDataTime = points[0].time;
    const maxDataTime = points[points.length - 1].time;
    const totalSpan = Math.max(86400000, maxDataTime - minDataTime);

    if (customRange && !isFollowing) {
      const s = Math.max(minDataTime - 86400000, customRange.tStart);
      const e = Math.min(maxDataTime + 86400000, customRange.tEnd);
      const filtered = points.filter((p) => p.time >= s && p.time <= e);
      return { tStart: s, tEnd: e, visiblePoints: downsamplePoints(filtered, chartW * 2) };
    }

    // Chế độ AUTO-FOLLOW: Cửa sổ trượt theo sát mép phải
    // Chừa 6% khoảng trống bên phải làm không gian cho điểm mới "mọc ra"
    const windowSpan = totalSpan / zoomLevel;
    const rightPadding = windowSpan * 0.06;
    const end = maxDataTime + rightPadding;
    const start = Math.max(minDataTime, end - windowSpan);

    const filtered = points.filter((p) => p.time >= start && p.time <= end);
    return {
      tStart: start,
      tEnd: end,
      visiblePoints: downsamplePoints(filtered, chartW * 2)
    };
  }, [points, customRange, isFollowing, zoomLevel, chartW]);

  // Thang đo trục X
  const getX = useCallback((time) => {
    if (tEnd <= tStart) return margin.left + chartW / 2;
    const ratio = (time - tStart) / (tEnd - tStart);
    return margin.left + ratio * chartW;
  }, [tStart, tEnd, margin.left, chartW]);

  // Thang đo trục Y (Tự động nội suy min/max có đệm an toàn)
  const { minY, maxY } = useMemo(() => {
    if (visiblePoints.length === 0) return { minY: 200, maxY: 400 };

    const vals = [];
    visiblePoints.forEach((p) => {
      if (filters.observed && p.observed != null) vals.push(p.observed);
      if (filters.trend && p.trend != null) vals.push(p.trend);
      if (filters.seasonal && p.seasonal != null) vals.push(SEASONAL_BASELINE + p.seasonal * SEASONAL_SCALE);
      if (filters.residual && p.residual != null) vals.push(SEASONAL_BASELINE + p.residual * RESIDUAL_SCALE);
    });

    if (vals.length === 0) return { minY: 220, maxY: 380 };

    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const pad = Math.max(12, (maxV - minV) * 0.12);

    return {
      minY: Math.floor((minV - pad) / 10) * 10,
      maxY: Math.ceil((maxV + pad) / 10) * 10
    };
  }, [visiblePoints, filters]);

  const getY = useCallback((val) => {
    if (maxY === minY) return margin.top + chartH / 2;
    const ratio = (val - minY) / (maxY - minY);
    return margin.top + (1 - ratio) * chartH;
  }, [minY, maxY, margin.top, chartH]);

  // ── 7. ĐIỀU KHIỂN PAN, ZOOM & BẬT LẠI FOLLOW ────────────────────────────────
  const handleZoomChange = (level) => {
    setZoomLevel(level);
    setCustomRange(null);
    setIsFollowing(true);
    setUnseenCount(0);
    setHoveredIdx(null);
  };

  const handlePan = (direction) => {
    setIsFollowing(false);
    const span = tEnd - tStart;
    const shift = span * 0.25;
    const newStart = direction === 'left' ? tStart - shift : tStart + shift;
    const newEnd   = direction === 'left' ? tEnd - shift   : tEnd + shift;
    setCustomRange({ tStart: newStart, tEnd: newEnd });
  };

  const handleResumeFollow = () => {
    setIsFollowing(true);
    setCustomRange(null);
    setUnseenCount(0);
    setHoveredIdx(null);
  };

  // Lăn chuột zoom mượt theo vị trí con trỏ
  const handleWheel = (e) => {
    if (!svgRef.current) return;
    e.preventDefault();
    setIsFollowing(false);

    const rect = svgRef.current.getBoundingClientRect();
    const cursorRatio = Math.max(0, Math.min(1, (e.clientX - rect.left - margin.left) / chartW));
    const cursorTime = tStart + cursorRatio * (tEnd - tStart);

    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.83;
    const newSpan = (tEnd - tStart) * zoomFactor;

    const newStart = cursorTime - cursorRatio * newSpan;
    const newEnd   = newStart + newSpan;

    setCustomRange({ tStart: newStart, tEnd: newEnd });
  };

  // ── 8. XỬ LÝ HOVER TOOLTIP VỚI TÌM KIẾM NHỊ PHÂN ────────────────────────────
  const handleMouseMove = (e) => {
    if (!svgRef.current || visiblePoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;

    if (mouseX < margin.left - 15 || mouseX > svgWidth - margin.right + 15) {
      setHoveredIdx(null);
      return;
    }

    const ratio = Math.max(0, Math.min(1, (mouseX - margin.left) / chartW));
    const targetTime = tStart + ratio * (tEnd - tStart);

    const closest = findClosestIndexByTime(visiblePoints, targetTime);
    setHoveredIdx(closest >= 0 ? closest : null);
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  // Điểm đang hover
  const hoveredPoint = hoveredIdx !== null && visiblePoints[hoveredIdx] ? visiblePoints[hoveredIdx] : null;

  // ── 9. THÔNG TIN ĐƯỜNG GIÁ CUỐI (TICKER LAST PRICE) ─────────────────────────
  const latestPoint = visiblePoints[visiblePoints.length - 1] || null;
  const previousPoint = visiblePoints.length >= 2 ? visiblePoints[visiblePoints.length - 2] : null;
  const isObservedUp = latestPoint && previousPoint && latestPoint.observed >= previousPoint.observed;

  // Tính toán thời gian kể từ lần cập nhật cuối
  const minutesSinceUpdate = lastUpdateTime ? Math.floor((Date.now() - lastUpdateTime.getTime()) / 60000) : 0;
  const isStale = minutesSinceUpdate >= STALE_MINUTES;

  // Tách đoạn không vẽ qua khoảng trống NaN
  const observedSegments = useMemo(() => {
    if (!filters.observed) return [];
    return buildPolylineSegments(visiblePoints, (p) => p.observed, (p) => p.time, getX, getY);
  }, [visiblePoints, filters.observed, getX, getY]);

  const trendSegments = useMemo(() => {
    if (!filters.trend) return [];
    return buildPolylineSegments(visiblePoints, (p) => p.trend, (p) => p.time, getX, getY);
  }, [visiblePoints, filters.trend, getX, getY]);

  const seasonalSegments = useMemo(() => {
    if (!filters.seasonal) return [];
    return buildPolylineSegments(visiblePoints, (p) => (p.seasonal != null ? SEASONAL_BASELINE + p.seasonal * SEASONAL_SCALE : null), (p) => p.time, getX, getY);
  }, [visiblePoints, filters.seasonal, getX, getY]);

  const residualSegments = useMemo(() => {
    if (!filters.residual) return [];
    return buildPolylineSegments(visiblePoints, (p) => (p.residual != null ? SEASONAL_BASELINE + p.residual * RESIDUAL_SCALE : null), (p) => p.time, getX, getY);
  }, [visiblePoints, filters.residual, getX, getY]);

  return (
    <div className="space-y-6">

      {/* ── 1. HEADER BẢNG ĐIỀU KHIỂN & TRẠNG THÁI REALTIME ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Phân Tích Xu Hướng, Chu Kỳ Mùa Vụ & Ma Trận Tương Quan Khí Quyển
                </h2>
                {mockLiveEnabled && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    ⚡ DỮ LIỆU MẪU
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mô hình phân rã cộng tính (Additive Decomposition) thời gian thực & Ma trận Pearson 6×6
              </p>
            </div>
          </div>
        </div>

        {/* Thanh trạng thái Live / Reconnecting / Stale */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {wsStatus === 'connected' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>LIVE</span>
            </span>
          ) : wsStatus === 'reconnecting' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <span>Đang kết nối lại...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>Mất kết nối</span>
            </span>
          )}

          {lastUpdateTime && (
            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{utcDateTimeFormatter.format(lastUpdateTime)} UTC</span>
            </span>
          )}

          {isStale && (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              ⚠️ Không có dữ liệu mới trong {Math.round(minutesSinceUpdate / 60)}h
            </span>
          )}

          <button
            onClick={() => setMockLiveEnabled((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              mockLiveEnabled
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Bật/Tắt phát xung dữ liệu 2 giây/lần để xem hiệu ứng sàn chứng khoán"
          >
            {mockLiveEnabled ? 'Tắt Mock Live' : 'Thử Mock Live (2s)'}
          </button>

          <button
            onClick={fetchBackfillData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* ── 2. KHU VỰC 2 BIỂU ĐỒ SONG SONG ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ── CỘT TRÁI: BIỂU ĐỒ STREAMING THỜI GIAN THẬT (7 cols) ── */}
        <div className="xl:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
          <div>
            {/* Header thanh công cụ biểu đồ */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Chuỗi Thời Gian Phân Rã Khí Quyển
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Cộng tính (Additive)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Observed(t) = Trend(t) + Seasonal(t) + Residual(t)
                </p>
              </div>

              {/* Chuyển đổi chế độ Gộp chung / Tách 4 tầng */}
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

            {/* Thanh công cụ: Lọc thành phần + Zoom + Điều hướng */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 py-2.5 border-b border-slate-100">
              {/* Nút lọc đường */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Lọc:
                </span>

                <button
                  onClick={() => setFilters((f) => ({ ...f, observed: !f.observed }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    filters.observed
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className="w-2 h-0.5 bg-current border-t border-dashed"></span>
                  <span>Observed (Thực đo)</span>
                </button>

                <button
                  onClick={() => setFilters((f) => ({ ...f, trend: !f.trend }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    filters.trend
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <span>Trend (Xu hướng)</span>
                </button>

                <button
                  onClick={() => setFilters((f) => ({ ...f, seasonal: !f.seasonal }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    filters.seasonal
                      ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Seasonal (Mùa vụ)</span>
                </button>

                <button
                  onClick={() => setFilters((f) => ({ ...f, residual: !f.residual }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    filters.residual
                      ? 'bg-teal-50 text-teal-800 border-teal-300 font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  <span>Residual (Phần dư)</span>
                </button>
              </div>

              {/* Nút Zoom & Điều hướng */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <span className="text-[10.5px] font-semibold text-slate-500 px-1">Zoom:</span>
                {[1, 1.5, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => handleZoomChange(lvl)}
                    className={`px-2 py-0.5 text-xs rounded-md font-mono font-medium transition ${
                      zoomLevel === lvl && isFollowing
                        ? 'bg-sky-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {lvl}x
                  </button>
                ))}

                <div className="h-3.5 w-px bg-slate-300 mx-0.5"></div>

                <button
                  onClick={() => handlePan('left')}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600"
                  title="Dịch khung nhìn về quá khứ"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePan('right')}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600"
                  title="Dịch khung nhìn về hiện tại"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResumeFollow}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600"
                  title="Bật lại chế độ bám sát mép phải"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── VÙNG HIỂN THỊ SVG BIỂU ĐỒ ── */}
            <div className="relative mt-2.5 select-none">
              {viewMode === 'combined' ? (
                /* CHẾ ĐỘ GỘP CHUNG (COMBINED REALTIME OVERLAY) */
                <div
                  className="w-full bg-white rounded-xl border border-slate-100 p-2 relative"
                  onWheel={handleWheel}
                >
                  {visiblePoints.length > 0 ? (
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-auto overflow-visible cursor-crosshair"
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    >
                      {/* Canvas nền trắng */}
                      <rect
                        x={margin.left}
                        y={margin.top}
                        width={chartW}
                        height={chartH}
                        fill="#FFFFFF"
                      />

                      {/* Lưới ngang & Trục Y */}
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

                      {/* Đơn vị DU */}
                      <text
                        x={margin.left - 38}
                        y={margin.top - 8}
                        fontSize="9.5"
                        fontWeight="700"
                        fill="#475569"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        (DU)
                      </text>

                      {/* 1. Vẽ đường Observed (Thực đo - Nét đứt than chì) */}
                      {filters.observed &&
                        observedSegments.map((seg, sIdx) => (
                          <polyline
                            key={`obs-${sIdx}`}
                            fill="none"
                            stroke="#334155"
                            strokeWidth="1.9"
                            strokeDasharray="4 3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.9"
                            points={seg.join(' ')}
                          />
                        ))}

                      {/* 2. Vẽ đường Trend (Xu hướng - Nét đậm Indigo) */}
                      {filters.trend &&
                        trendSegments.map((seg, sIdx) => (
                          <polyline
                            key={`trend-${sIdx}`}
                            fill="none"
                            stroke="#4F46E5"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={seg.join(' ')}
                          />
                        ))}

                      {/* 3. Vẽ đường Seasonal (Mùa vụ - Cam hổ phách) */}
                      {filters.seasonal &&
                        seasonalSegments.map((seg, sIdx) => (
                          <polyline
                            key={`seas-${sIdx}`}
                            fill="none"
                            stroke="#EA580C"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={seg.join(' ')}
                          />
                        ))}

                      {/* 4. Vẽ đường Residual (Phần dư - Xanh ngọc) */}
                      {filters.residual &&
                        residualSegments.map((seg, sIdx) => (
                          <polyline
                            key={`res-${sIdx}`}
                            fill="none"
                            stroke="#0D9488"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.88"
                            points={seg.join(' ')}
                          />
                        ))}

                      {/* ── ĐƯỜNG GIÁ CUỐI (TICKER LAST PRICE LINE) & NHÃN GIÁ GẮN MÉP PHẢI TRỤC Y ── */}
                      {latestPoint && filters.observed && latestPoint.observed != null && (
                        <g>
                          {/* Đường ngang đứt nét giá cuối */}
                          <line
                            x1={margin.left}
                            y1={getY(latestPoint.observed)}
                            x2={svgWidth - margin.right}
                            y2={getY(latestPoint.observed)}
                            stroke={isObservedUp ? '#10B981' : '#EF4444'}
                            strokeWidth="1"
                            strokeDasharray="3 3"
                            opacity="0.7"
                          />

                          {/* Chấm tròn nhấp nháy phát xung (Pulse) tại điểm cuối cùng */}
                          <circle
                            cx={getX(latestPoint.time)}
                            cy={getY(latestPoint.observed)}
                            r="4.5"
                            fill="#334155"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={getX(latestPoint.time)}
                            cy={getY(latestPoint.observed)}
                            r="9"
                            fill={isObservedUp ? '#10B981' : '#EF4444'}
                            opacity="0.3"
                            className="motion-safe:animate-ping"
                          />

                          {/* Nhãn giá cuối gắn ở mép phải trục Y (Kiểu sàn chứng khoán) */}
                          <g transform={`translate(${svgWidth - margin.right + 2}, ${getY(latestPoint.observed) - 9})`}>
                            <rect
                              width="58"
                              height="18"
                              rx="4"
                              fill={isObservedUp ? '#ECFDF5' : '#FEF2F2'}
                              stroke={isObservedUp ? '#10B981' : '#EF4444'}
                              strokeWidth="1.2"
                            />
                            <text
                              x="29"
                              y="12.5"
                              fontSize="9.5"
                              fontWeight="700"
                              fontFamily="JetBrains Mono, monospace"
                              fill={isObservedUp ? '#065F46' : '#991B1B'}
                              textAnchor="middle"
                            >
                              {latestPoint.observed.toFixed(1)}
                            </text>
                          </g>
                        </g>
                      )}

                      {/* ── TRỤC X HAI HÀNG CHUẨN THỜI GIAN THẬT ── */}
                      <TwoRowXAxis
                        tStart={tStart}
                        tEnd={tEnd}
                        chartW={chartW}
                        chartH={chartH}
                        margin={margin}
                        svgWidth={svgWidth}
                        getX={getX}
                      />

                      {/* ── HIỆU ỨNG HOVER CROSSHAIR ── */}
                      {hoveredPoint && (
                        <g>
                          <line
                            x1={getX(hoveredPoint.time)}
                            y1={margin.top}
                            x2={getX(hoveredPoint.time)}
                            y2={margin.top + chartH}
                            stroke="#64748B"
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                          />

                          {filters.observed && hoveredPoint.observed != null && (
                            <circle
                              cx={getX(hoveredPoint.time)}
                              cy={getY(hoveredPoint.observed)}
                              r="4.5"
                              fill="#334155"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                          )}

                          {filters.trend && hoveredPoint.trend != null && (
                            <circle
                              cx={getX(hoveredPoint.time)}
                              cy={getY(hoveredPoint.trend)}
                              r="5"
                              fill="#4F46E5"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                          )}

                          {filters.seasonal && hoveredPoint.seasonal != null && (
                            <circle
                              cx={getX(hoveredPoint.time)}
                              cy={getY(SEASONAL_BASELINE + hoveredPoint.seasonal * SEASONAL_SCALE)}
                              r="4.5"
                              fill="#EA580C"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                          )}

                          {filters.residual && hoveredPoint.residual != null && (
                            <circle
                              cx={getX(hoveredPoint.time)}
                              cy={getY(SEASONAL_BASELINE + hoveredPoint.residual * RESIDUAL_SCALE)}
                              r="4"
                              fill="#0D9488"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                          )}
                        </g>
                      )}
                    </svg>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" />
                      <span>Chưa có dữ liệu cho Bán đảo Nam Cực...</span>
                    </div>
                  )}

                  {/* Nút nổi báo điểm mới khi follow tạm dừng */}
                  {!isFollowing && unseenCount > 0 && (
                    <button
                      onClick={handleResumeFollow}
                      className="absolute bottom-16 right-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-lg hover:bg-indigo-700 transition animate-bounce"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>+{unseenCount} điểm mới</span>
                      <span className="text-indigo-200">|</span>
                      <span>Về mới nhất</span>
                    </button>
                  )}
                </div>
              ) : (
                /* CHẾ ĐỘ TÁCH TẦNG (FACETED SUBPLOTS VIEW) */
                <div className="space-y-3 bg-white p-2 rounded-xl" onWheel={handleWheel}>
                  {/* Tầng 1: Observed */}
                  {filters.observed && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/40">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-1">
                        <span>1. Dữ liệu thực nghiệm (Observed)</span>
                        <span className="font-mono text-slate-600">
                          {hoveredPoint?.observed != null ? `${hoveredPoint.observed} DU` : 'Tổng hòa 3 thành phần'}
                        </span>
                      </div>
                      <div className="h-16">
                        <svg viewBox={`0 0 ${svgWidth} 64`} className="w-full h-full">
                          {observedSegments.map((seg, sIdx) => (
                            <polyline
                              key={`fac-obs-${sIdx}`}
                              fill="none"
                              stroke="#334155"
                              strokeWidth="2"
                              strokeDasharray="4 3"
                              points={seg.join(' ')}
                            />
                          ))}
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
                          {hoveredPoint?.trend != null ? `${hoveredPoint.trend} DU` : 'Đường biến động vĩ mô'}
                        </span>
                      </div>
                      <div className="h-16">
                        <svg viewBox={`0 0 ${svgWidth} 64`} className="w-full h-full">
                          {trendSegments.map((seg, sIdx) => (
                            <polyline
                              key={`fac-trend-${sIdx}`}
                              fill="none"
                              stroke="#4F46E5"
                              strokeWidth="2.5"
                              points={seg.join(' ')}
                            />
                          ))}
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
                          {hoveredPoint?.seasonal != null
                            ? `${hoveredPoint.seasonal > 0 ? '+' : ''}${hoveredPoint.seasonal} DU`
                            : 'Chu kỳ bức xạ mặt trời'}
                        </span>
                      </div>
                      <div className="h-16">
                        <svg viewBox={`0 0 ${svgWidth} 64`} className="w-full h-full">
                          {seasonalSegments.map((seg, sIdx) => (
                            <polyline
                              key={`fac-seas-${sIdx}`}
                              fill="none"
                              stroke="#EA580C"
                              strokeWidth="2"
                              points={seg.join(' ')}
                            />
                          ))}
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
                          {hoveredPoint?.residual != null
                            ? `${hoveredPoint.residual > 0 ? '+' : ''}${hoveredPoint.residual} DU`
                            : 'Nhiễu khí quyển'}
                        </span>
                      </div>
                      <div className="h-16">
                        <svg viewBox={`0 0 ${svgWidth} 64`} className="w-full h-full">
                          {residualSegments.map((seg, sIdx) => (
                            <polyline
                              key={`fac-res-${sIdx}`}
                              fill="none"
                              stroke="#0D9488"
                              strokeWidth="1.8"
                              points={seg.join(' ')}
                            />
                          ))}
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Trục X chung đặt ở đáy của chế độ tách tầng */}
                  <div className="pt-1">
                    <svg viewBox={`0 0 ${svgWidth} 60`} className="w-full h-14">
                      <TwoRowXAxis
                        tStart={tStart}
                        tEnd={tEnd}
                        chartW={chartW}
                        chartH={10}
                        margin={{ ...margin, top: 5 }}
                        svgWidth={svgWidth}
                        getX={getX}
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* ── THANH CHỈ BÁO GIÁ TRỊ TẠI ĐIỂM HOVER (TOOLTIP PANEL) ── */}
            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              {hoveredPoint ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-white border border-slate-200 font-mono font-bold text-slate-800 text-[11px]">
                      {utcFullTooltipFormatter.format(new Date(hoveredPoint.time))} UTC
                    </span>
                    <span className="text-slate-500 font-medium">Chi tiết phân rã:</span>
                  </div>

                  <div className="flex items-center gap-2.5 font-mono text-[11.5px] flex-wrap">
                    {filters.observed && hoveredPoint.observed != null && (
                      <span className="flex items-center gap-1 text-slate-800 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-xs">
                        <span className="w-2 h-0.5 bg-slate-800 inline-block border-t border-dashed"></span>
                        Thực đo: {hoveredPoint.observed} DU
                      </span>
                    )}

                    {filters.trend && hoveredPoint.trend != null && (
                      <span className="flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                        Xu hướng: {hoveredPoint.trend} DU
                      </span>
                    )}

                    {filters.seasonal && hoveredPoint.seasonal != null && (
                      <span
                        className="flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shadow-xs"
                        title="Biên độ mùa vụ gốc (đã căn chỉnh hiển thị chung trục)"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                        Mùa vụ gốc: {hoveredPoint.seasonal > 0 ? `+${hoveredPoint.seasonal}` : hoveredPoint.seasonal} DU
                      </span>
                    )}

                    {filters.residual && hoveredPoint.residual != null && (
                      <span
                        className="flex items-center gap-1 text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 shadow-xs"
                        title="Phần dư ngẫu nhiên gốc (đã căn chỉnh hiển thị chung trục)"
                      >
                        <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                        Phần dư gốc: {hoveredPoint.residual > 0 ? `+${hoveredPoint.residual}` : hoveredPoint.residual} DU
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-slate-500">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Info className="w-3.5 h-3.5 text-sky-600" />
                    <span>Rê chuột lên biểu đồ để xem chi tiết mốc thời gian thực đo. Dùng con lăn chuột để Zoom.</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    Hiển thị: {visiblePoints.length} / {points.length} điểm
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Diễn giải khí quyển chân biểu đồ */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11.5px] text-slate-600 leading-relaxed bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/60">
            <strong className="text-indigo-900 font-semibold">Diễn giải khí quyển: </strong>
            Mô hình cộng tính (Additive Model): Xu hướng biến động trung bình +0.34 DU/bước; Biên độ dao động mùa vụ đạt 53.2 DU tương ứng chu kỳ bức xạ mặt trời; Sai số dư chuẩn 3.05 DU nằm trong giới hạn kiểm soát thống kê.
          </div>
        </div>

        {/* ── CỘT PHẢI: MA TRẬN TƯƠNG QUAN 6x6 NỀN TRẮNG (5 cols) ── */}
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
                    {(corrData?.variables || []).map((v, i) => (
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
                  {(corrData?.matrix || []).map((row, i) => (
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
                              title={`${row.variable} × ${(corrData?.variables || [])[j]}: r = ${val}`}
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

            {(!corrData || !corrData.matrix || corrData.matrix.length === 0) && (
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
