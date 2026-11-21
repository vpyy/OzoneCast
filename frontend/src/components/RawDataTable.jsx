import React, { useState } from 'react';
import { Download, Play, Filter, CheckCircle2, Database } from 'lucide-react';
import { api } from '../api/apiClient';

export default function RawDataTable({ rawData = [], granules = [], onDataMutated }) {
  const [filterGranule, setFilterGranule] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState(null);

  const handleIngestMock = async () => {
    setIngesting(true);
    setMessage(null);
    try {
      const res = await api.triggerIngestMock();
      setMessage({ type: 'success', text: `Đã cào granule NASA & bóc tách các trường: ${res.file || res.result?.filename || 'Thành công'}` });
      if (onDataMutated) onDataMutated();
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi cào dữ liệu: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setIngesting(false);
    }
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setMessage(null);
    try {
      const res = await api.runAnalysis(filterGranule || null);
      setMessage({ type: 'success', text: `Phân tích hoàn tất: ${res.cells_processed || 0} ô lưới Silver và ${res.anomalies_found || 0} điểm bất thường.` });
      if (onDataMutated) onDataMutated();
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi phân tích: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setAnalyzing(false);
    }
  };

  const filtered = filterGranule 
    ? rawData.filter(r => r.granule_name === filterGranule)
    : rawData;

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleIngestMock}
            disabled={ingesting}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{ingesting ? 'Đang tải & bóc tách...' : 'Kích hoạt Cào Dữ liệu Vệ tinh (Ingest)'}</span>
          </button>

          <button
            onClick={handleRunAnalysis}
            disabled={analyzing || rawData.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            <span>{analyzing ? 'Đang phân tích...' : 'Kích hoạt Phân tích & Tạo lưới (ETL)'}</span>
          </button>
        </div>

        {granules.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterGranule}
              onChange={(e) => setFilterGranule(e.target.value)}
              className="border border-slate-300 rounded-xl text-xs py-1.5 px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Tất cả Granules ({granules.length})</option>
              {granules.map(g => (
                <option key={g.id} value={g.filename}>{g.filename}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Raw Table with Expanded Variables */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-600" />
              Bảng Dữ liệu Thô Mở rộng (Raw Measurements - 10 Trường Vệ tinh NASA)
            </h3>
            <p className="text-[11px] text-slate-500">
              Trích xuất trực tiếp từ Swath HDF-EOS5: Latitude, Longitude, Ozone, SecondsInDay, QualityFlags, GroundPixelFlags, SZA, CloudFraction, CloudPressure, WaterFraction
            </p>
          </div>
          <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-mono">
            {filtered.length} bản ghi
          </span>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="min-w-full text-xs text-left text-slate-600">
            <thead className="bg-slate-100/90 text-slate-700 uppercase font-semibold sticky top-0 text-[11px]">
              <tr>
                <th className="px-3 py-2.5">Điểm #</th>
                <th className="px-3 py-2.5">Vĩ độ (Lat)</th>
                <th className="px-3 py-2.5">Kinh độ (Lon)</th>
                <th className="px-3 py-2.5">Ozone Column (DU)</th>
                <th className="px-3 py-2.5">Góc MT (SZA)</th>
                <th className="px-3 py-2.5">Mây (RCF)</th>
                <th className="px-3 py-2.5">Áp suất mây (hPa)</th>
                <th className="px-3 py-2.5">Nước/Băng</th>
                <th className="px-3 py-2.5">Cờ QC</th>
                <th className="px-3 py-2.5">Granule Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-10 text-slate-400">
                    Chưa có bản ghi dữ liệu thô. Hãy bấm "Kích hoạt Cào Dữ liệu Vệ tinh" ở trên.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 150).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="px-3 py-2 font-mono text-slate-400 text-[11px]">#{r.point_index}</td>
                    <td className="px-3 py-2 font-medium">{r.latitude?.toFixed(3)}°</td>
                    <td className="px-3 py-2 font-medium">{r.longitude?.toFixed(3)}°</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        !r.ozone_column_raw ? 'bg-slate-100 text-slate-500' :
                        r.ozone_column_raw < 220 ? 'bg-rose-100 text-rose-700' :
                        r.ozone_column_raw > 400 ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {r.ozone_column_raw != null ? `${r.ozone_column_raw.toFixed(1)} DU` : 'NULL'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {(r.solar_zenith_angle ?? 45.0).toFixed(1)}°
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-800 font-semibold">
                      {((r.radiative_cloud_fraction ?? 0.0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {(r.cloud_pressure ?? 0.0).toFixed(0)} hPa
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">
                      {(r.water_fraction ?? 0.0) > 0.5 ? 'Biển/Nước' : 'Đất/Băng'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.quality_flag === 0 ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
                        Flag {r.quality_flag}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10.5px] text-slate-400 truncate max-w-[150px]" title={r.granule_name}>
                      {r.granule_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
