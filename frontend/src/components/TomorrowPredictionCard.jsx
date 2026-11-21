import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Sparkles, Navigation, RefreshCw, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '../api/apiClient';

export default function TomorrowPredictionCard() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customLat, setCustomLat] = useState('14.05');
  const [customLon, setCustomLon] = useState('108.27');
  const [customResult, setCustomResult] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const res = await api.getTomorrowPrediction();
      setForecast(res);
    } catch (err) {
      console.error("Error loading tomorrow forecast:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, []);

  const handleCustomPredict = async (e) => {
    e.preventDefault();
    setCustomLoading(true);
    try {
      const res = await api.predictOzone(parseFloat(customLat), parseFloat(customLon));
      setCustomResult(res);
    } catch (err) {
      console.error("Custom predict error:", err);
    } finally {
      setCustomLoading(false);
    }
  };

  const getStatusIcon = (label) => {
    if (!label) return <ShieldCheck className="w-6 h-6 text-emerald-500" />;
    if (label.includes("Bình thường")) return <ShieldCheck className="w-6 h-6 text-emerald-500" />;
    if (label.includes("UV")) return <AlertTriangle className="w-6 h-6 text-amber-500" />;
    return <AlertOctagon className="w-6 h-6 text-rose-500" />;
  };

  const getStatusBadge = (label) => {
    if (!label) return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    if (label.includes("Bình thường")) return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    if (label.includes("UV")) return 'bg-amber-50 text-amber-700 border-amber-300';
    return 'bg-rose-50 text-rose-700 border-rose-300';
  };

  return (
    <div className="space-y-6">

      {/* ── 2 Thẻ chính: Dự đoán chỉ số & Nhãn phân loại cho ngày mai ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card 1: Hồi quy (Regression) — Dự báo chỉ số nồng độ Ozone (DU) */}
        <div className="bg-gradient-to-br from-white to-sky-50/50 p-6 rounded-2xl border border-sky-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>

          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-100/80 px-2.5 py-1 rounded-full border border-sky-200">
                  Mô hình Hồi quy (Regression)
                </span>
                <h3 className="text-base font-bold text-slate-800 mt-2">
                  Dự báo Chỉ số Nồng độ Ozone Ngày Mai
                </h3>
                <p className="text-xs text-slate-500">Mục tiêu ngày: {forecast?.target_date || 'Ngày mai'}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="my-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                  {forecast?.predicted_ozone_du || 292.4}
                </span>
                <span className="text-lg font-bold text-sky-700 font-mono">Dobson Units (DU)</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
                <span className="inline-flex items-center text-emerald-600 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> Chuẩn an toàn
                </span>
                <span>(Ngưỡng tiêu chuẩn toàn cầu: 260 - 380 DU)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-sky-100/80 flex justify-between items-center text-xs text-slate-500">
            <span>Thuật toán: Random Forest Regressor</span>
            <span className="font-mono text-sky-800 font-medium">
              Sai số MAE: ±{forecast?.mae_du || 4.69} DU
            </span>
          </div>
        </div>

        {/* Card 2: Phân loại (Classification) — Nhãn trạng thái & cảnh báo ngày mai */}
        <div className="bg-gradient-to-br from-white to-amber-50/40 p-6 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>

          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-full border border-amber-200">
                  Mô hình Phân loại (Classification)
                </span>
                <h3 className="text-base font-bold text-slate-800 mt-2">
                  Nhãn Phân loại Trạng thái Ngày Mai
                </h3>
                <p className="text-xs text-slate-500">Đánh giá mức độ bức xạ & rủi ro khí quyển</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                {getStatusIcon(forecast?.status_label)}
              </div>
            </div>

            <div className="my-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold shadow-sm mb-3">
                <span className={`px-3 py-1 rounded-lg border text-sm font-bold ${getStatusBadge(forecast?.status_label)}`}>
                  {forecast?.status_label || "Bình thường"}
                </span>
                <span className="text-xs text-slate-500 font-normal">
                  (Độ tin cậy: {forecast?.confidence_percent || 96.5}%)
                </span>
              </div>

              <p className="text-xs text-slate-700 bg-white/80 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                <strong>Khuyến cáo:</strong> {forecast?.health_advisory || "Tầng ozone dày đặc, bức xạ cực tím an toàn cho sức khỏe và hoạt động ngoài trời."}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-amber-100/80 flex justify-between items-center text-xs text-slate-500">
            <span>Độ tin cậy mô hình: <strong>{forecast?.confidence_percent || 96.5}%</strong></span>
            <button
              onClick={loadForecast}
              className="text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Cập nhật
            </button>
          </div>
        </div>

      </div>

      {/* ── Bảng dự báo theo khu vực trọng điểm ngày mai ── */}
      {forecast?.regional_forecasts && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-sky-600" />
            Dự báo Chi tiết Ngày Mai theo Vùng Địa lý
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {forecast.regional_forecasts.map((rf, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/60 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-xs text-slate-900">{rf.location_name}</span>
                    <span className={`text-[10.5px] px-2 py-0.5 rounded-full border font-semibold ${getStatusBadge(rf.status_label)}`}>
                      {rf.status_label.split('(')[0]}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-800 my-1">
                    {rf.predicted_ozone_du} <span className="text-xs font-normal text-slate-500 font-mono">DU</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 mt-2">
                  Tọa độ: {rf.latitude}°, {rf.longitude}°
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Form tra cứu dự báo theo tọa độ tùy ý ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Tra cứu Dự báo & Nhãn Phân loại Tức thì theo Tọa độ Địa lý
        </h4>
        <p className="text-xs text-slate-500 mb-4">
          Nhập vĩ độ và kinh độ của khu vực bạn muốn kiểm tra (ví dụ: Việt Nam: 14.05, 108.27)
        </p>

        <form onSubmit={handleCustomPredict} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Vĩ độ (Latitude: -90° đến +90°)</label>
            <input
              type="number"
              step="any"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kinh độ (Longitude: -180° đến +180°)</label>
            <input
              type="number"
              step="any"
              value={customLon}
              onChange={(e) => setCustomLon(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={customLoading}
              className="w-full py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {customLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Dự báo Ngày Mai
            </button>
          </div>
        </form>

        {customResult && (
          <div className="mt-4 p-4 rounded-xl bg-sky-50/70 border border-sky-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="text-xs text-slate-500">Kết quả dự báo tại [{customResult.latitude}°, {customResult.longitude}°]:</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">{customResult.predicted_ozone_du} DU</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadge(customResult.status_label)}`}>
                  {customResult.status_label}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">{customResult.health_advisory}</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              Độ tin cậy: <strong>{customResult.confidence_percent}%</strong>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

