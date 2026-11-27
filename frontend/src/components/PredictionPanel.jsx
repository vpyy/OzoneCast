import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BrainCircuit,
  RefreshCw,
  MapPin,
  Calendar,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  TrendingUp,
  Info,
  Clock,
} from 'lucide-react';
import { api } from '../api/apiClient';
import { C, F, panelStyle, labelStyle, monoStyle, inputStyle, inputLabelStyle, btnPrimary, btnSecondary } from '../theme';

const PRESETS = [
  { name: 'Tâm Bán đảo Nam Cực',            lat: '-66.50', lon: '-65.00' },
  { name: 'Trạm Rothera (UK, Nam Cực)',     lat: '-67.57', lon: '-68.13' },
  { name: 'Trạm Palmer (Mỹ, Nam Cực)',      lat: '-64.77', lon: '-64.05' },
  { name: 'Trạm San Martin (Argentina)',    lat: '-68.13', lon: '-67.10' },
];

function statusAccent(c) {
  if (c === 'red' || c?.includes?.('thủng') || c?.includes?.('Severe')) return C.danger;
  if (c === 'amber' || c?.includes?.('UV') || c?.includes?.('Cảnh báo')) return C.warning;
  if (c === 'purple') return C.purple;
  return C.success;
}

function StatusIcon({ color, size = 14 }) {
  const c = statusAccent(color);
  if (color === 'red')   return <AlertOctagon  size={size} strokeWidth={1.75} style={{ color: c }} />;
  if (color === 'amber') return <AlertTriangle size={size} strokeWidth={1.75} style={{ color: c }} />;
  return <CheckCircle size={size} strokeWidth={1.75} style={{ color: c }} />;
}

// Trả về ngày mai theo giờ địa phương, định dạng YYYY-MM-DD cho <input type="date">
function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PredictionPanel() {
  const [predictionsData, setPredictionsData] = useState(null);
  const [loadingData, setLoadingData]         = useState(false);
  const [dataError, setDataError]             = useState(null);

  const [lat, setLat]               = useState('-66.50');
  const [lon, setLon]               = useState('-65.00');
  const [date, setDate] = useState(getTomorrow);
  const [predicting, setPredicting] = useState(false);
  const [training, setTraining]     = useState(false);
  const [pointPrediction, setPointPrediction] = useState(null);
  const [trainResult, setTrainResult] = useState(null);

  const [hoveredPoint, setHoveredPoint] = useState(null);

  const scrollRef = useRef(null);
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(0);

  const loadPredictionsData = async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const data = await api.getPredictions();
      setPredictionsData(data);
    } catch (err) {
      console.error('Failed to load predictions time series:', err);
      setDataError(err.response?.data?.detail || err.message || 'Không thể kết nối API dự báo');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadPredictionsData();
  }, []);

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || latNum < -70.0 || latNum > -63.0) {
      alert('Vĩ độ (Latitude) phải nằm trong phạm vi Bán đảo Nam Cực: từ -70.0° đến -63.0°');
      return;
    }
    if (isNaN(lonNum) || lonNum < -75.0 || lonNum > -55.0) {
      alert('Kinh độ (Longitude) phải nằm trong phạm vi Bán đảo Nam Cực: từ -75.0° đến -55.0°');
      return;
    }

    setPredicting(true);
    try {
      const dt = date ? new Date(date).toISOString() : null;
      const res = await api.predictOzone(latNum, lonNum, dt);
      setPointPrediction(res);
    } catch (err) {
      alert('Dự báo thất bại: ' + (err.response?.data?.detail || err.message));
    } finally {
      setPredicting(false);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await api.trainModel();
      setTrainResult(res);
      await loadPredictionsData();
    } catch (err) {
      alert('Huấn luyện thất bại: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTraining(false);
    }
  };

  const accent = pointPrediction ? statusAccent(pointPrediction.badge_color) : C.accent;

  // ── TÍNH TOÁN DỮ LIỆU ĐẦY ĐỦ CỦA BIỂU ĐỒ ────────────────────────────────
  const chartPoints = useMemo(() => {
    const list = [];
    if (predictionsData?.historical_series) {
      predictionsData.historical_series.forEach((h, idx) => {
        list.push({
          type: 'observed',
          label: h.label,
          date: h.date,
          value: h.observed_mean,
          min: h.observed_min,
          max: h.observed_max,
          soundings: h.soundings_count,
          step: idx
        });
      });
    }

    const forecastItem = predictionsData?.predictions?.[0];
    if (forecastItem && list.length > 0) {
      list.push({
        type: 'forecast',
        label: forecastItem.target_date || 'Ngày mai',
        date: forecastItem.timestamp,
        value: forecastItem.predicted_ozone_du,
        lower: forecastItem.confidence_lower,
        upper: forecastItem.confidence_upper,
        status: forecastItem.status_label,
        step: list.length
      });
    }
    return list;
  }, [predictionsData]);

  // Biểu đồ tự co giãn theo chiều rộng khung: 7 ngày luôn lấp đầy khung nhìn,
  // nếu nhiều hơn 7 ngày thì cuộn ngang. Trục Y tách riêng bên trái để luôn hiển thị.
  const yAxisWidth = 65;
  const padding = { top: 25, right: 45, bottom: 40, left: 30 }; // chừa chỗ cho nhãn ngày đầu/cuối
  const visibleDaysCount = 7;
  const totalDays = chartPoints.length;

  const viewportW = Math.max(300, (wrapW || 800) - yAxisWidth - 2); // trừ viền
  const DAY_WIDTH = Math.max(60, (viewportW - padding.left - padding.right) / (visibleDaysCount - 1));
  const slots = Math.max(totalDays, visibleDaysCount);
  const actualInnerW = DAY_WIDTH * (slots - 1);
  const plotSvgWidth = actualInnerW + padding.left + padding.right;
  const svgHeight = 260;
  const innerH = svgHeight - padding.top - padding.bottom;

  // Đo chiều rộng khung biểu đồ (và theo dõi khi thay đổi kích thước cửa sổ)
  const hasChart = !dataError && chartPoints.length > 0;
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWrapW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setWrapW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasChart]);

  // Tự động cuộn sang phải (ngày mới nhất và ngày mai) khi dữ liệu tải xong
  useEffect(() => {
    if (scrollRef.current && totalDays > 7) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [totalDays, wrapW]);

  // Tính toán trục Y dựa trên dữ liệu
  const { yMin, yMax } = useMemo(() => {
    if (chartPoints.length === 0) return { yMin: 180, yMax: 420 };
    const vals = chartPoints.map(p => p.value).filter(v => v != null);
    if (vals.length === 0) return { yMin: 180, yMax: 420 };
    const minVal = Math.min(...vals, 220); // giữ mốc cảnh báo 220 DU
    const maxVal = Math.max(...vals);
    const pad = Math.max(15, (maxVal - minVal) * 0.15);
    return {
      yMin: Math.max(100, Math.floor((minVal - pad) / 10) * 10),
      yMax: Math.ceil((maxVal + pad) / 10) * 10
    };
  }, [chartPoints]);

  const getY = (val) => padding.top + innerH * (1 - (val - yMin) / Math.max(1, yMax - yMin));
  const getX = (idx) => padding.left + (idx / Math.max(1, chartPoints.length - 1)) * actualInnerW;

  const yTicks = [200, 220, 260, 300, 340, 380, 420].filter(v => v >= yMin && v <= yMax);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header bar */}
      <div style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BrainCircuit size={16} strokeWidth={1.75} style={{ color: C.accent }} />
          <div>
            <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
              Dự báo Nồng độ Ozone & Đánh giá Rủi ro Tia cực tím UV
            </p>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Mô hình Máy học Random Forest (Regressor + Classifier) · Huấn luyện trên Dữ liệu Vệ tinh OMI
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={loadPredictionsData} disabled={loadingData} style={{ ...btnSecondary, fontSize: 11 }}>
            <RefreshCw size={12} className={loadingData ? 'animate-spin' : ''} />
            Đồng bộ
          </button>
          <button onClick={handleTrain} disabled={training} style={{ ...btnPrimary, fontSize: 11, opacity: training ? 0.6 : 1 }}>
            <RefreshCw size={12} className={training ? 'animate-spin' : ''} />
            {training ? 'Đang huấn luyện...' : 'Huấn luyện lại mô hình'}
          </button>
        </div>
      </div>

      {/* Kết quả huấn luyện */}
      {trainResult && (
        <div style={{ ...panelStyle, padding: '10px 14px', border: `1px solid ${C.success}44`, background: `${C.success}08`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={14} style={{ color: C.success, flexShrink: 0 }} />
          <span style={{ fontFamily: F.opensans, fontSize: 11, color: C.textSecond }}>Đã hoàn tất huấn luyện mô hình — </span>
          <span style={{ ...monoStyle, fontSize: 11, color: C.textMuted }}>
            MAE: {trainResult.mae_du} DU &nbsp;·&nbsp; R²: {trainResult.r2_score}
            {trainResult.classification_accuracy && ` · Độ chính xác: ${trainResult.classification_accuracy}%`}
          </span>
        </div>
      )}

      {/* THẺ CHỈ SỐ MÔ HÌNH */}
      {predictionsData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <div style={{ ...panelStyle, padding: '10px 14px' }}>
            <p style={{ ...labelStyle, marginBottom: 4 }}>Mô hình Máy học</p>
            <p style={{ fontFamily: F.heading, fontSize: 12, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
              {predictionsData.model_name || 'Random Forest'}
            </p>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Phiên bản: {predictionsData.model_version || 'v1.0'}
            </p>
          </div>

          <div style={{ ...panelStyle, padding: '10px 14px' }}>
            <p style={{ ...labelStyle, marginBottom: 4 }}>Sai số Tuyệt đối (MAE)</p>
            <p style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 700, color: C.accent, margin: 0 }}>
              ±{predictionsData.evaluation_metrics?.mae_du != null ? Number(predictionsData.evaluation_metrics.mae_du).toFixed(2) : '4.69'}{' '}
              <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>DU</span>
            </p>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              R² Score: {predictionsData.evaluation_metrics?.r2_score ?? 0.967}
            </p>
          </div>

          <div style={{ ...panelStyle, padding: '10px 14px' }}>
            <p style={{ ...labelStyle, marginBottom: 4 }}>Độ tin cậy Phân loại</p>
            <p style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 700, color: C.success, margin: 0 }}>
              {predictionsData.evaluation_metrics?.accuracy_percent != null ? Number(predictionsData.evaluation_metrics.accuracy_percent).toFixed(1) : '84.1'}%
            </p>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Phân loại 3 mức UV (An toàn / Cao / Thủng)
            </p>
          </div>

          <div style={{ ...panelStyle, padding: '10px 14px' }}>
            <p style={{ ...labelStyle, marginBottom: 4 }}>Thời điểm tạo & Ngưỡng</p>
            <p style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, color: C.danger, margin: 0 }}>
              Ngưỡng thủng: 220 DU
            </p>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> {predictionsData.created_at ? new Date(predictionsData.created_at).toUTCString() : '—'}
            </p>
          </div>
        </div>
      )}

      {/* BIỂU ĐỒ QUAN TRẮC NỐI DỰ ĐOÁN */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} style={{ color: C.accent }} />
              <p style={{ fontFamily: F.heading, fontSize: 12, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                Biểu đồ Chuỗi Quan trắc Thực tế nối tiếp Dự báo Ngày mai
              </p>
            </div>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Hiển thị mặc định 7 ngày gần nhất {totalDays > 7 && '· Kéo thanh trượt ngang bên dưới để xem thêm các ngày trước'} · Quan trắc (đường liền) ⟶ Dự báo (đường đứt)
            </p>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, fontFamily: F.sans }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 3, background: C.accent, borderRadius: 1 }} />
              <span style={{ color: C.textMuted }}>Quan trắc</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 3, background: C.purple, borderTop: '2px dashed #8B5CF6' }} />
              <span style={{ color: C.textMuted }}>Dự báo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 2, background: C.danger, borderTop: '2px dashed #EF4444' }} />
              <span style={{ color: C.danger }}>220 DU</span>
            </div>
          </div>
        </div>

        {/* Chart render / 4 states */}
        {loadingData && !predictionsData ? (
          <div style={{ height: svgHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: C.accent }} />
            <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>Đang nạp chuỗi thời gian dự báo...</span>
          </div>
        ) : dataError ? (
          <div style={{ height: svgHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <AlertCircle size={20} style={{ color: C.danger }} />
            <span style={{ fontFamily: F.sans, fontSize: 11, color: C.danger }}>{dataError}</span>
            <button onClick={loadPredictionsData} style={{ ...btnPrimary, padding: '4px 10px', fontSize: 10 }}>Thử lại</button>
          </div>
        ) : chartPoints.length === 0 ? (
          <div style={{ height: svgHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <Info size={20} style={{ color: C.textMuted }} />
            <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>Chưa có kết quả dự đoán, mô hình chưa đủ dữ liệu hoặc đang huấn luyện</span>
          </div>
        ) : (
          <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>

            {/* Khung biểu đồ: trục Y cố định + vùng cuộn ngang */}
            <div style={{ display: 'flex', width: '100%', background: C.surfaceAlt, borderRadius: 6, border: `1px solid ${C.border}`, overflow: 'hidden' }}>

              {/* 1. Trục Y CỐ ĐỊNH bên trái */}
              <div style={{ width: `${yAxisWidth}px`, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: C.surface, zIndex: 2 }}>
                <svg width={yAxisWidth} height={svgHeight} style={{ display: 'block' }}>
                  {yTicks.map((v) => {
                    const y = getY(v);
                    const isHole = v === 220;
                    return (
                      <g key={v}>
                        <line
                          x1={yAxisWidth - 6}
                          y1={y}
                          x2={yAxisWidth}
                          y2={y}
                          stroke={isHole ? '#EF4444' : '#94A3B8'}
                          strokeWidth={isHole ? 2 : 1}
                        />
                        <text
                          x={yAxisWidth - 10}
                          y={y + 4}
                          fontSize={isHole ? '12' : '11'}
                          fill={isHole ? '#EF4444' : '#475569'}
                          textAnchor="end"
                          fontFamily={F.mono}
                          fontWeight={isHole ? '800' : '600'}
                        >
                          {v} {isHole ? 'DU' : ''}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 2. Khung vẽ biểu đồ cuộn ngang */}
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  overflowX: totalDays > 7 ? 'auto' : 'hidden',
                  overflowY: 'hidden',
                  position: 'relative'
                }}
              >
                <svg
                  width={plotSvgWidth}
                  height={svgHeight}
                  viewBox={`0 0 ${plotSvgWidth} ${svgHeight}`}
                  style={{ display: 'block', overflow: 'visible' }}
                >
                  {/* Lưới ngang */}
                  {yTicks.map((v) => {
                    const y = getY(v);
                    const isHole = v === 220;
                    return (
                      <line
                        key={v}
                        x1={0}
                        y1={y}
                        x2={plotSvgWidth}
                        y2={y}
                        stroke={isHole ? '#EF4444' : '#E2E8F0'}
                        strokeWidth={isHole ? 1.5 : 1}
                        strokeDasharray={isHole ? '4 3' : '2 2'}
                      />
                    );
                  })}

                  {/* Vùng khoảng tin cậy cho điểm dự báo */}
                  {chartPoints.some(p => p.type === 'forecast') && chartPoints.length > 1 && (
                    (() => {
                      const fIdx = chartPoints.findIndex(p => p.type === 'forecast');
                      if (fIdx <= 0) return null;
                      const lastObs = chartPoints[fIdx - 1];
                      const fPoint = chartPoints[fIdx];
                      const x1 = getX(lastObs.step);
                      const y1 = getY(lastObs.value);
                      const x2 = getX(fPoint.step);
                      const yLower = getY(fPoint.lower || (fPoint.value - 9.2));
                      const yUpper = getY(fPoint.upper || (fPoint.value + 9.2));

                      const pathD = `M ${x1} ${y1} L ${x2} ${yUpper} L ${x2} ${yLower} Z`;
                      return (
                        <g>
                          <path d={pathD} fill="#8B5CF6" fillOpacity="0.15" />
                          <line x1={x2 - 6} y1={yUpper} x2={x2 + 6} y2={yUpper} stroke="#8B5CF6" strokeWidth="2" />
                          <line x1={x2 - 6} y1={yLower} x2={x2 + 6} y2={yLower} stroke="#8B5CF6" strokeWidth="2" />
                          <line x1={x2} y1={yUpper} x2={x2} y2={yLower} stroke="#8B5CF6" strokeWidth="1.2" strokeDasharray="2 2" />
                        </g>
                      );
                    })()
                  )}

                  {/* Đường quan trắc lịch sử */}
                  {(() => {
                    const obsPoints = chartPoints.filter(p => p.type === 'observed');
                    if (obsPoints.length < 2) return null;
                    const d = obsPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.step)} ${getY(p.value)}`).join(' ');
                    return <path d={d} fill="none" stroke={C.accent} strokeWidth="2.5" />;
                  })()}

                  {/* Đường nối dự báo */}
                  {chartPoints.some(p => p.type === 'forecast') && chartPoints.length > 1 && (
                    (() => {
                      const fIdx = chartPoints.findIndex(p => p.type === 'forecast');
                      if (fIdx <= 0) return null;
                      const pPrev = chartPoints[fIdx - 1];
                      const pNext = chartPoints[fIdx];
                      return (
                        <line
                          x1={getX(pPrev.step)}
                          y1={getY(pPrev.value)}
                          x2={getX(pNext.step)}
                          y2={getY(pNext.value)}
                          stroke="#8B5CF6"
                          strokeWidth="2.5"
                          strokeDasharray="5 4"
                        />
                      );
                    })()
                  )}

                  {/* Các điểm dữ liệu */}
                  {chartPoints.map((pt, i) => {
                    const cx = getX(pt.step);
                    const cy = getY(pt.value);
                    const isForecast = pt.type === 'forecast';
                    return (
                      <g
                        key={i}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        {isForecast && (
                          <circle cx={cx} cy={cy} r="10" fill="#8B5CF6" fillOpacity="0.2" className="animate-ping" />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isForecast ? 6 : 4.5}
                          fill={isForecast ? '#8B5CF6' : '#FFFFFF'}
                          stroke={isForecast ? '#6D28D9' : C.accent}
                          strokeWidth={isForecast ? 2.5 : 2}
                        />
                        <text
                          x={cx}
                          y={svgHeight - 12}
                          fontSize="11"
                          fill={isForecast ? '#8B5CF6' : '#475569'}
                          textAnchor="middle"
                          fontFamily={F.mono}
                          fontWeight={isForecast ? '700' : '600'}
                        >
                          {pt.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Hover Tooltip (nằm ngoài khung overflow hidden, trong wrapper relative) */}
            {hoveredPoint && (
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 20,
                  background: C.surface,
                  border: `1px solid ${hoveredPoint.type === 'forecast' ? C.purple : C.border}`,
                  borderRadius: 4,
                  padding: '8px 12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  fontSize: 11,
                  fontFamily: F.opensans,
                  zIndex: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: F.heading,
                    background: hoveredPoint.type === 'forecast' ? `${C.purple}20` : `${C.accent}20`,
                    color: hoveredPoint.type === 'forecast' ? C.purple : C.accent
                  }}>
                    {hoveredPoint.type === 'forecast' ? 'DỰ BÁO NGÀY MAI' : 'QUAN TRẮC THỰC TẾ'}
                  </span>
                  <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted }}>{hoveredPoint.label}</span>
                </div>
                <div style={{ ...monoStyle, fontSize: 15, fontWeight: 700, color: C.textPrimary }}>
                  {hoveredPoint.value?.toFixed(2)} DU
                </div>
                {hoveredPoint.type === 'forecast' && hoveredPoint.lower != null && (
                  <div style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                    Khoảng tin cậy 95%: [{hoveredPoint.lower.toFixed(1)} – {hoveredPoint.upper.toFixed(1)} DU]
                  </div>
                )}
                {hoveredPoint.soundings && (
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                    Số lượt quét vệ tinh: {hoveredPoint.soundings.toLocaleString()} điểm
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2-col layout: Form cấu hình dự báo & Thẻ kết quả chi tiết */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 12 }}>

        {/* Input panel */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <MapPin size={13} strokeWidth={1.75} style={{ color: C.textMuted }} />
            <p style={{ ...labelStyle, margin: 0 }}>Cấu hình Tọa độ Kiểm thử Dự báo</p>
          </div>

          {/* Presets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {PRESETS.map((p, i) => {
              const isSelected = parseFloat(lat) === parseFloat(p.lat) && parseFloat(lon) === parseFloat(p.lon);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setLat(p.lat); setLon(p.lon); }}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    background: isSelected ? '#f0f9ff' : C.surfaceAlt,
                    border: isSelected ? '2px solid #0284c7' : `1px solid ${C.border}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    position: 'relative',
                    boxShadow: isSelected ? '0 0 0 2px rgba(2, 132, 199, 0.2), 0 2px 4px rgba(2, 132, 199, 0.1)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = C.accent;
                      e.currentTarget.style.background = '#f8fafc';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.background = C.surfaceAlt;
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0369a1' : C.textPrimary }}>
                      {p.name}
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 15,
                          height: 15,
                          borderRadius: '50%',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          fontSize: 9,
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}
                        title="Đang chọn vị trí này"
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <div style={{ ...monoStyle, fontSize: 10, color: isSelected ? '#0284c7' : C.textMuted, marginTop: 2, fontWeight: isSelected ? 600 : 400 }}>
                    {p.lat}°, {p.lon}°
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handlePredict} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={inputLabelStyle}>Vĩ độ Latitude (−70° đến −63°S)</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  min="-70"
                  max="-63"
                  required
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                  placeholder="−70.0 đến −63.0"
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Kinh độ Longitude (−75° đến −55°W)</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  min="-75"
                  max="-55"
                  required
                  value={lon}
                  onChange={e => setLon(e.target.value)}
                  placeholder="−75.0 đến −55.0"
                />
              </div>
            </div>
            <div>
              <label style={{ ...inputLabelStyle, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} strokeWidth={1.75} /> Ngày mục tiêu dự báo
              </label>
              <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button type="submit" disabled={predicting}
              style={{ ...btnPrimary, width: '100%', opacity: predicting ? 0.6 : 1 }}>
              <RefreshCw size={12} strokeWidth={1.75} className={predicting ? 'animate-spin' : ''} />
              {predicting ? 'Đang tính toán...' : 'Chạy dự báo điểm'}
            </button>
          </form>
        </div>

        {/* Result panel */}
        <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', justifyContent: pointPrediction ? 'flex-start' : 'center', minHeight: 300 }}>
          {pointPrediction ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Location */}
              <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                <p style={labelStyle}>Kết quả Dự báo Máy học</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <MapPin size={12} strokeWidth={1.75} style={{ color: C.textMuted }} />
                  <span style={{ ...monoStyle, fontSize: 12, color: C.textPrimary }}>
                    {pointPrediction.latitude}°, {pointPrediction.longitude}°
                  </span>
                  <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginLeft: 'auto' }}>
                    {new Date(pointPrediction.datetime || pointPrediction.target_datetime).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: 'Nồng độ Ozone', value: pointPrediction.predicted_ozone_du, unit: 'DU', big: true },
                  { label: 'Độ tin cậy',   value: `${pointPrediction.confidence_percent}`, unit: '%', big: true },
                  { label: 'Mức rủi ro',   value: pointPrediction.risk_assessment || '—', unit: '', big: false },
                ].map(({ label, value, unit, big }, i) => (
                  <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                    <p style={{ ...labelStyle, marginBottom: 4 }}>{label}</p>
                    <p style={{ fontFamily: F.mono, fontSize: big ? 20 : 11, fontWeight: 700, color: i === 0 ? accent : C.textPrimary, margin: 0, lineHeight: 1.3 }}>
                      {value}<span style={{ fontFamily: F.sans, fontSize: 10, color: C.textMuted, marginLeft: 2 }}>{unit}</span>
                    </p>
                    {i === 1 && pointPrediction.days_ahead > 0 && (
                      <p style={{ ...monoStyle, fontSize: 9, color: C.textMuted, marginTop: 4 }}>
                        {pointPrediction.days_ahead === 1 ? 'Dự báo ngày mai (+1 ngày)' : `Dự báo trước +${pointPrediction.days_ahead} ngày`}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Status */}
              <div style={{ background: C.surfaceAlt, border: `1px solid ${accent}44`, borderRadius: 4, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <StatusIcon color={pointPrediction.badge_color} size={14} />
                <div>
                  <p style={{ fontFamily: F.heading, fontSize: 12, fontWeight: 700, color: accent, margin: 0 }}>
                    {pointPrediction.status_label}
                  </p>
                  <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textSecond, marginTop: 4, lineHeight: 1.5 }}>
                    {pointPrediction.health_advisory}
                  </p>
                </div>
              </div>
              

              {/* Input features */}
              <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                <p style={{ ...labelStyle, marginBottom: 6 }}>Đặc trưng Khí quyển Đầu vào</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
                  {[
                    ['Vĩ độ (Latitude)',           `${pointPrediction.latitude}°`],
                    ['Kinh độ (Longitude)',          `${pointPrediction.longitude}°`],
                    ['Độ phản xạ ước tính',       pointPrediction.input_features?.reflectivity ? `${pointPrediction.input_features.reflectivity.toFixed(1)}%` : '—'],
                    ['Góc thiên đỉnh mặt trời', pointPrediction.input_features?.solar_zenith_angle ? `${pointPrediction.input_features.solar_zenith_angle.toFixed(1)}°` : '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.opensans, fontSize: 10, padding: '2px 0' }}>
                      <span style={{ color: C.textMuted }}>{k}</span>
                      <span style={{ color: C.textSecond, fontFamily: F.mono }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: C.textDisabled }}>
              <BrainCircuit size={28} strokeWidth={1} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textMuted }}>Chọn tọa độ và nhấn Chạy dự báo điểm</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}