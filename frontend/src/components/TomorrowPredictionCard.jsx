import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Navigation, RefreshCw, Activity, Info, Clock, AlertCircle } from 'lucide-react';
import { api } from '../api/apiClient';
import { C, F, panelStyle, labelStyle, monoStyle, inputStyle, inputLabelStyle, btnPrimary } from '../theme';

function statusAccent(label) {
  if (!label) return C.success;
  if (label.includes('UV') || label.includes('Cảnh báo')) return C.warning;
  if (label.includes('Nghiêm') || label.includes('Severe') || label.includes('Bất thường') || label.includes('Hole')) return C.danger;
  return C.success;
}

function StatusBadge({ label }) {
  const color = statusAccent(label);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 4,
      border: `1px solid ${color}44`,
      background: `${color}12`,
      color, fontSize: 11, fontWeight: 700, fontFamily: F.heading,
    }}>
      {label || 'Bình thường'}
    </span>
  );
}

export default function TomorrowPredictionCard() {
  const [forecast, setForecast]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [customLat, setCustomLat]         = useState('-66.50');
  const [customLon, setCustomLon]         = useState('-65.00');
  const [customResult, setCustomResult]   = useState(null);
  const [customLoading, setCustomLoading] = useState(false);

  const loadForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTomorrowPrediction();
      setForecast(data);
    } catch (e) {
      console.error('Failed to load tomorrow prediction:', e);
      setError(e.response?.data?.detail || e.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, []);

  const handleCustomPredict = async (e) => {
    e.preventDefault();
    const latNum = parseFloat(customLat);
    const lonNum = parseFloat(customLon);

    // Kiểm tra phạm vi nghiêm ngặt theo Vùng Bán đảo Nam Cực (-70 đến -63 vĩ Nam, -75 đến -55 kinh Tây)
    if (isNaN(latNum) || latNum < -70.0 || latNum > -63.0) {
      alert('Vĩ độ (Latitude) phải nằm trong phạm vi Bán đảo Nam Cực: từ -70.0° đến -63.0°');
      return;
    }
    if (isNaN(lonNum) || lonNum < -75.0 || lonNum > -55.0) {
      alert('Kinh độ (Longitude) phải nằm trong phạm vi Bán đảo Nam Cực: từ -75.0° đến -55.0°');
      return;
    }

    setCustomLoading(true);
    try {
      const res = await api.predictOzone(latNum, lonNum);
      setCustomResult(res);
    } catch (e) {
      console.error(e);
      alert('Dự báo thất bại: ' + (e.response?.data?.detail || e.message));
    } finally {
      setCustomLoading(false);
    }
  };

  const divider = { borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 };

  // 1. TRẠNG THÁI LỖI (ERROR STATE)
  if (error) {
    return (
      <div style={{ ...panelStyle, padding: '20px', border: `1px solid ${C.danger}44`, background: `${C.danger}08` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} style={{ color: C.danger }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 700, color: C.danger, margin: 0 }}>
              Không thể tải kết quả dự báo
            </p>
            <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textSecond, marginTop: 4 }}>
              {error}
            </p>
          </div>
          <button onClick={loadForecast} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 11 }}>
            <RefreshCw size={12} /> Thử lại
          </button>
        </div>
      </div>
    );
  }

  // 2. TRẠNG THÁI ĐANG TẢI (LOADING STATE)
  if (loading && !forecast) {
    return (
      <div style={{ ...panelStyle, padding: '36px', textAlign: 'center' }}>
        <RefreshCw size={24} className="animate-spin" style={{ color: C.accent, margin: '0 auto 12px' }} />
        <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
          Đang nạp kết quả dự báo máy học...
        </p>
        <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          Đang đồng bộ dữ liệu từ mô hình Random Forest Regressor & Classifier
        </p>
      </div>
    );
  }

  // 3. TRẠNG THÁI RỖNG (EMPTY STATE)
  if (!loading && !forecast) {
    return (
      <div style={{ ...panelStyle, padding: '36px', textAlign: 'center' }}>
        <Activity size={24} style={{ color: C.textMuted, margin: '0 auto 12px' }} />
        <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
          Chưa có kết quả dự báo
        </p>
        <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          Mô hình chưa đủ dữ liệu hoặc đang chờ lượt chạy kế tiếp của service ozone-prediction.
        </p>
        <button onClick={loadForecast} style={{ ...btnPrimary, margin: '16px auto 0', padding: '6px 14px', fontSize: 11 }}>
          <RefreshCw size={12} /> Làm mới
        </button>
      </div>
    );
  }

  // 4. TRẠNG THÁI CÓ DỮ LIỆU THẬT (DATA STATE)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Dual forecast cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Regression Card */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={labelStyle}>Mô hình Hồi quy (Regression)</p>
              <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: '4px 0 0' }}>
                Nồng độ Ozone — Dự báo Ngày mai
              </p>
              <p style={{ fontFamily: F.opensans, fontSize: 10, color: C.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} /> {forecast.target_date || 'Ngày mai'}
              </p>
            </div>
            <Activity size={15} strokeWidth={1.75} style={{ color: C.accent, marginTop: 2 }} />
          </div>
          <div style={divider}>
            <span style={{ fontFamily: F.heading, fontSize: 32, fontWeight: 700, color: C.textPrimary }}>
              {forecast.predicted_ozone_du != null ? Number(forecast.predicted_ozone_du).toFixed(2) : '—'}
            </span>
            <span style={{ fontFamily: F.opensans, fontSize: 12, fontWeight: 600, color: C.textMuted, marginLeft: 6 }}>DU</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: F.opensans, color: C.textMuted }}>
            <span>Random Forest Regressor</span>
            <span>MAE: ±{forecast.mae_du != null ? Number(forecast.mae_du).toFixed(2) : '4.69'} DU</span>
          </div>
        </div>

        {/* Classification Card */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={labelStyle}>Mô hình Phân loại (Classification)</p>
              <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: '4px 0 0' }}>
                Đánh giá Nguy cơ Bức xạ UV — Ngày mai
              </p>
              <p style={{ fontFamily: F.opensans, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                Chuẩn an toàn WMO / WHO
              </p>
            </div>
            <button onClick={loadForecast} title="Làm mới dự báo" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0 }}>
              <RefreshCw size={13} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div style={divider}>
            <StatusBadge label={forecast.status_label || 'Bình thường'} />
            <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textSecond, marginTop: 8, lineHeight: 1.5 }}>
              {forecast.health_advisory || 'Nồng độ ozone nằm trong phạm vi an toàn, chỉ số bức xạ UV bình thường.'}
            </p>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: F.opensans, color: C.textMuted }}>
            <span>Random Forest Classifier</span>
            <span>Độ tin cậy: {forecast.confidence_percent != null ? `${Number(forecast.confidence_percent).toFixed(1)}%` : '—'}</span>
          </div>
        </div>
      </div>

      {/* Regional forecasts */}
      {forecast.regional_forecasts && forecast.regional_forecasts.length > 0 && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Navigation size={13} strokeWidth={1.75} style={{ color: C.accent }} />
              <p style={{ ...labelStyle, margin: 0 }}>Dự báo Ozone Trọng Điểm Theo Vùng — Ngày mai</p>
            </div>
            {forecast.updated_at && (
              <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted }}>
                Cập nhật: {new Date(forecast.updated_at).toUTCString()}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {forecast.regional_forecasts.map((rf, i) => (
              <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: F.heading, fontSize: 11, fontWeight: 700, color: C.textPrimary }}>{rf.location_name}</span>
                  <StatusBadge label={rf.status_label?.split('(')[0]?.trim()} />
                </div>
                <p style={{ ...monoStyle, fontSize: 20, fontWeight: 700, color: C.textPrimary, margin: '4px 0 0' }}>
                  {rf.predicted_ozone_du != null ? Number(rf.predicted_ozone_du).toFixed(2) : '—'} <span style={{ fontFamily: F.sans, fontSize: 10, color: C.textMuted }}>DU</span>
                </p>
                <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                  {rf.latitude}°, {rf.longitude}°
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chú thích khoa học */}
      <div style={{ padding: '8px 12px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Info size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
        <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textMuted, margin: 0, lineHeight: 1.4 }}>
          <strong>Lưu ý khoa học:</strong> Dự án OzoneCast dự đoán nồng độ khí quyển Ozone (DU). Tầng Ozone bảo vệ Trái Đất khỏi tia UV và ảnh hưởng gián tiếp tới hoàn lưu khí quyển Nam Cực, không phải đo trực tiếp diện tích băng tan.
        </p>
      </div>

      {/* Custom lookup */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <p style={{ ...labelStyle, margin: 0 }}>Dự báo Nồng độ Ozone Theo Tọa độ Tùy chỉnh (Bán đảo Nam Cực)</p>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Vùng giới hạn: Vĩ độ −70.0° đến −63.0°S · Kinh độ −75.0° đến −55.0°W (Tham chiếu ô lưới OMI 0.25°)
            </p>
          </div>
          <span style={{ ...monoStyle, fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${C.accent}15`, color: C.accent, border: `1px solid ${C.accent}33` }}>
            Antarctic Peninsula Bounding Box
          </span>
        </div>

        {/* Nút chọn nhanh các trạm quan trắc tiêu biểu tại Bán đảo Nam Cực */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            { name: 'Tâm Bán đảo', lat: '-66.50', lon: '-65.00' },
            { name: 'Trạm Rothera (UK)', lat: '-67.57', lon: '-68.13' },
            { name: 'Trạm Palmer (Mỹ)', lat: '-64.77', lon: '-64.05' },
            { name: 'Trạm San Martin (Arg)', lat: '-68.13', lon: '-67.10' },
            { name: 'Mũi Cực Bắc Bán đảo', lat: '-63.30', lon: '-57.00' },
          ].map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => { setCustomLat(preset.lat); setCustomLon(preset.lon); }}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                border: `1px solid ${C.border}`,
                background: C.surfaceAlt,
                fontSize: 10,
                fontFamily: F.sans,
                color: C.textSecond,
                cursor: 'pointer'
              }}
            >
              {preset.name} ({preset.lat}°, {preset.lon}°)
            </button>
          ))}
        </div>

        <form onSubmit={handleCustomPredict} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={inputLabelStyle}>Vĩ độ Latitude (−70° đến −63°S)</label>
            <input
              style={inputStyle}
              type="number"
              step="0.01"
              min="-70"
              max="-63"
              value={customLat}
              onChange={e => setCustomLat(e.target.value)}
              placeholder="−70 đến −63"
              required
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
              value={customLon}
              onChange={e => setCustomLon(e.target.value)}
              placeholder="−75 đến −55"
              required
            />
          </div>
          <button type="submit" disabled={customLoading}
            style={{ ...btnPrimary, opacity: customLoading ? 0.6 : 1, padding: '7px 16px', whiteSpace: 'nowrap' }}>
            <RefreshCw size={12} strokeWidth={1.75} className={customLoading ? 'animate-spin' : ''} />
            Dự báo điểm
          </button>
        </form>

        {customResult && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...monoStyle, fontSize: 20, fontWeight: 700, color: C.textPrimary }}>
                {customResult.predicted_ozone_du} <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>DU</span>
              </span>
              <StatusBadge label={customResult.status_label} />
              <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginLeft: 'auto' }}>
                {customResult.latitude}°, {customResult.longitude}°
              </span>
            </div>
            <p style={{ fontFamily: F.sans, fontSize: 11, color: C.textSecond, marginTop: 6 }}>
              {customResult.health_advisory}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
