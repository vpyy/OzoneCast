import React, { useState } from 'react';
import {
  BrainCircuit,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  AlertOctagon,
  RefreshCw,
  MapPin,
  Calendar,
  Activity,
  Shield,
  Gauge
} from 'lucide-react';
import { api } from '../api/apiClient';

export default function PredictionPanel() {
  const [lat, setLat] = useState('10.82'); // Mặc định TP. Hồ Chí Minh
  const [lon, setLon] = useState('106.63');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [predicting, setPredicting] = useState(false);
  const [training, setTraining] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [trainResult, setTrainResult] = useState(null);

  // Danh mục tọa độ trạm quan trắc tiêu biểu để người dùng test nhanh với 1 cú click
  const presets = [
    { name: '🇻🇳 TP. Hồ Chí Minh', lat: '10.82', lon: '106.63' },
    { name: '🇻🇳 Thủ đô Hà Nội', lat: '21.03', lon: '105.85' },
    { name: '🇦🇶 Trạm Nam Cực (Lỗ thủng Ozone)', lat: '-68.50', lon: '0.00' },
    { name: '🌐 Xích đạo (Đông Nam Á)', lat: '0.00', lon: '105.00' }
  ];

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    setPredicting(true);
    try {
      const dt = date ? new Date(date).toISOString() : null;
      const res = await api.predictOzone(parseFloat(lat), parseFloat(lon), dt);
      setPrediction(res);
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
    } catch (err) {
      alert('Huấn luyện mô hình thất bại: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTraining(false);
    }
  };

  const applyPreset = (pLat, pLon) => {
    setLat(pLat);
    setLon(pLon);
  };

  const getStatusIcon = (badgeColor) => {
    switch (badgeColor) {
      case 'red':
        return <AlertOctagon className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />;
      case 'amber':
        return <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />;
      case 'purple':
        return <Activity className="h-6 w-6 text-purple-600 shrink-0 mt-0.5" />;
      default:
        return <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />;
    }
  };

  const getBadgeStyle = (badgeColor) => {
    switch (badgeColor) {
      case 'red':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'amber':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'purple':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  const getCardStyle = (badgeColor) => {
    switch (badgeColor) {
      case 'red':
        return 'bg-rose-50/80 border-rose-200 text-rose-950';
      case 'amber':
        return 'bg-amber-50/80 border-amber-200 text-amber-950';
      case 'purple':
        return 'bg-purple-50/80 border-purple-200 text-purple-950';
      default:
        return 'bg-emerald-50/80 border-emerald-200 text-emerald-950';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Khung tiêu đề phân hệ ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-100 text-sky-700">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-slate-800">
              Phân hệ AI Dự báo Nồng độ Ozone & Đánh giá Nguy cơ Bức xạ UV
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 ml-9">
            Tích hợp bộ đôi mô hình máy học: <strong>Random Forest Regressor</strong> (Dự báo định lượng DU) & <strong>Random Forest Classifier</strong> (Phân cấp cảnh báo bức xạ WMO).
          </p>
        </div>

        {/* Nút Retrain Model */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleTrain}
            disabled={training}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-medium py-2 px-4 rounded-xl text-xs transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${training ? 'animate-spin text-sky-400' : ''}`} />
            <span>{training ? 'Đang huấn luyện lại...' : 'Tái huấn luyện mô hình (Retrain)'}</span>
          </button>
        </div>
      </div>

      {/* Thông tin kết quả huấn luyện mới nhất (nếu có) */}
      {trainResult && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">Mô hình đã được huấn luyện lại thành công trên tập dữ liệu khí quyển mới:</span>
          </div>
          <div className="flex items-center gap-4 font-mono font-bold">
            <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300">
              Sai số MAE: {trainResult.mae_du} DU
            </span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300">
              Hệ số R²: {trainResult.r2_score}
            </span>
            {trainResult.classification_accuracy && (
              <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300">
                Độ chính xác phân loại: {trainResult.classification_accuracy}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Bố cục 2 cột: Bảng điều khiển nhập liệu & Thẻ hiển thị kết quả ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Cột trái: Form điều khiển & Tọa độ mẫu (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              Thiết lập Tọa độ & Thời điểm Dự báo
            </h4>

            {/* Quick Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Chọn nhanh vị trí tiêu biểu:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p.lat, p.lon)}
                    className="text-left p-2 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 transition text-xs font-medium text-slate-700"
                  >
                    <div className="truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      [{p.lat}°, {p.lon}°]
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handlePredict} className="space-y-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vĩ độ (Latitude)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="-90"
                    max="90"
                    required
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    placeholder="-90 đến 90"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kinh độ (Longitude)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="-180"
                    max="180"
                    required
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    placeholder="-180 đến 180"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Ngày mục tiêu dự báo
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={predicting}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {predicting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mô hình đang tính toán...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Chạy Dự báo Ozone & Đánh giá Rủi ro</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Cột phải: Thẻ kết quả phân tích chuyên sâu (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col justify-between">
            {prediction ? (
              <div className="space-y-5">
                {/* Header kết quả */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Vị trí & Thời điểm dự báo
                    </span>
                    <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 mt-0.5">
                      <MapPin className="w-4 h-4 text-sky-600" />
                      Vĩ độ: {prediction.latitude}° | Kinh độ: {prediction.longitude}°
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">
                      Ngày: {new Date(prediction.datetime || prediction.target_datetime).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Nồng độ Ozone ước tính
                    </span>
                    <div className="text-3xl font-black text-sky-600 tracking-tight">
                      {prediction.predicted_ozone_du}{' '}
                      <span className="text-sm font-semibold text-slate-500 font-mono">DU</span>
                    </div>
                  </div>
                </div>

                {/* Card đánh giá rủi ro bức xạ & y tế */}
                <div className={`p-4 rounded-2xl border ${getCardStyle(prediction.badge_color || 'green')}`}>
                  <div className="flex items-start gap-3">
                    {getStatusIcon(prediction.badge_color)}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${getBadgeStyle(prediction.badge_color)}`}>
                          {prediction.status_label || 'Bình thường'}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          Độ tin cậy mô hình: <strong>{prediction.confidence_percent || 95}%</strong>
                        </span>
                      </div>
                      <h5 className="font-bold text-sm text-slate-900 mt-1">
                        {prediction.risk_assessment}
                      </h5>
                      <p className="text-xs mt-1.5 leading-relaxed text-slate-700">
                        {prediction.health_advisory}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Thang đo nồng độ trực quan (Visual Spectrum Gauge) */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-slate-500" />
                      Thang nồng độ chuẩn khí quyển (Dobson Units):
                    </span>
                    <span className="font-mono text-sky-700 font-bold">
                      {prediction.predicted_ozone_du} DU
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative shadow-inner">
                    <div
                      className="bg-gradient-to-r from-rose-500 via-amber-400 via-emerald-500 to-purple-600 h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, Math.max(8, ((prediction.predicted_ozone_du - 100) / 380) * 100))}%`
                      }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-[10.5px] text-slate-400 font-mono">
                    <span>&lt;220 DU (Suy giảm/Thủng)</span>
                    <span>220-265 DU (UV cao)</span>
                    <span>265-420 DU (An toàn)</span>
                    <span>&gt;425 DU (Dày đặc)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 my-auto">
                <BrainCircuit className="h-12 w-12 mx-auto mb-3 opacity-30 text-sky-500" />
                <h5 className="text-sm font-bold text-slate-700">Sẵn sàng thực hiện dự báo</h5>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Chọn một vị trí mẫu bên trái hoặc nhập vĩ độ/kinh độ tùy ý, sau đó nhấn <strong>"Chạy Dự báo Ozone"</strong> để kích hoạt pipeline AI.
                </p>
              </div>
            )}

            {/* Chú thích chân trang */}
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                Quy chuẩn Khí tượng Thế giới (WMO)
              </span>
              <span>Dịch vụ Học máy phân tán (:8004)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
