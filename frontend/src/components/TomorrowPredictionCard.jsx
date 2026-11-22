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
    </div>
  );
}