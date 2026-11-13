import React, { useState } from 'react';
import { Download, Play, Filter, CheckCircle2 } from 'lucide-react';
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
      setMessage({ type: 'success', text: `Ingested new NASA granule: ${res.file}` });
      if (onDataMutated) onDataMutated();
    } catch (err) {
      setMessage({ type: 'error', text: 'Ingestion failed: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setIngesting(false);
    }
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setMessage(null);
    try {
      const res = await api.runAnalysis(filterGranule || null);
      setMessage({ type: 'success', text: `Analysis complete: ${res.cells_processed} grid cells processed.` });
      if (onDataMutated) onDataMutated();
    } catch (err) {
      setMessage({ type: 'error', text: 'Analysis failed: ' + (err.response?.data?.detail || err.message) });
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleIngestMock}
            disabled={ingesting}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{ingesting ? 'Ingesting Granule...' : 'Trigger Data Ingestion'}</span>
          </button>

          <button
            onClick={handleRunAnalysis}
            disabled={analyzing || rawData.length === 0}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            <span>{analyzing ? 'Analyzing & Binning...' : 'Run Analysis (ETL)'}</span>
          </button>
        </div>

        {granules.length > 0 && (
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterGranule}
              onChange={(e) => setFilterGranule(e.target.value)}
              className="border border-slate-300 rounded-lg text-xs py-1.5 px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Granules ({granules.length})</option>
              {granules.map(g => (
                <option key={g.id} value={g.filename}>{g.filename}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Raw Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Raw Sounding Measurements</h3>
            <p className="text-xs text-slate-500">Unfiltered point-level data directly from NASA HDF-EOS5 swaths</p>
          </div>
          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
            {filtered.length} points
          </span>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="min-w-full text-xs text-left text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0">
              <tr>
                <th className="px-4 py-3">Point Index</th>
                <th className="px-4 py-3">Latitude</th>
                <th className="px-4 py-3">Longitude</th>
                <th className="px-4 py-3">Ozone Column (DU)</th>
                <th className="px-4 py-3">Quality Flag</th>
                <th className="px-4 py-3">Source Granule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">
                    No raw measurements found. Click "Trigger Data Ingestion" above to fetch NASA data.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 150).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2 font-mono text-slate-400">#{r.point_index}</td>
                    <td className="px-4 py-2 font-medium">{r.latitude.toFixed(3)}°</td>
                    <td className="px-4 py-2 font-medium">{r.longitude.toFixed(3)}°</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        r.ozone_column_raw < 220 ? 'bg-rose-100 text-rose-700' :
                        r.ozone_column_raw > 400 ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {r.ozone_column_raw.toFixed(1)} DU
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${r.quality_flag === 0 ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
                        Flag {r.quality_flag}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-500 truncate max-w-[200px]" title={r.granule_name}>
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

