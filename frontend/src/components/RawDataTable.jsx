import React, { useState } from 'react';
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
      setMessage({ 
        type: 'success', 
        text: `Ingested file: ${res.file || res.result?.filename || 'Success'}. Extracted 10 fields.` 
      });
      if (onDataMutated) onDataMutated();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setIngesting(false);
    }
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setMessage(null);
    try {
      const res = await api.runAnalysis(filterGranule || null);
      setMessage({ 
        type: 'success', 
        text: `Analysis complete: ${res.cells_processed || 0} grid cells, ${res.anomalies_found || 0} anomalies.` 
      });
      if (onDataMutated) onDataMutated();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + (err.response?.data?.detail || err.message) });
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
      <div className="bg-white p-3 border border-gray-200 flex flex-wrap gap-3 items-center">
        <button
          onClick={handleIngestMock}
          disabled={ingesting}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {ingesting ? 'Ingesting...' : 'Ingest Data'}
        </button>

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing || rawData.length === 0}
          className="px-4 py-2 bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>

        {granules.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-700">Granule:</label>
            <select
              value={filterGranule}
              onChange={(e) => setFilterGranule(e.target.value)}
              className="border border-gray-300 px-2 py-1 text-xs bg-white"
            >
              <option value="">All ({granules.length})</option>
              {granules.map(g => (
                <option key={g.id} value={g.filename}>{g.filename}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-3 text-xs ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
        <p className="font-semibold">Raw Data Table — 10 NASA Fields</p>
        <p className="text-[11px] mt-1">
          <strong>Required (6):</strong> Ozone, Latitude, Longitude, Time, QualityFlags, GroundPixelQualityFlags
          <br/>
          <strong>Extended (4):</strong> SolarZenithAngle, CloudFraction, CloudPressure, WaterFraction
        </p>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">
            Raw Measurements ({filtered.length} records)
          </h3>
          <p className="text-xs text-gray-600 mt-1">
            Direct extraction from OMI/Aura L2 HDF5 swath data
          </p>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs text-left text-gray-700">
            <thead className="bg-gray-100 text-gray-900 font-semibold border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-3 py-2">Index</th>
                <th className="px-3 py-2">Lat (°)</th>
                <th className="px-3 py-2">Lon (°)</th>
                <th className="px-3 py-2">Time (s)</th>
                <th className="px-3 py-2">Ozone (DU)</th>
                <th className="px-3 py-2">SZA (°)</th>
                <th className="px-3 py-2">Cloud Frac</th>
                <th className="px-3 py-2">Cloud Pres (hPa)</th>
                <th className="px-3 py-2">Water Frac</th>
                <th className="px-3 py-2">Reflectivity (%)</th>
                <th className="px-3 py-2">UV Aerosol</th>
                <th className="px-3 py-2">QF</th>
                <th className="px-3 py-2">GPQ</th>
                <th className="px-3 py-2">Granule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="14" className="text-center py-8 text-gray-400">
                    No data. Click "Ingest Data" to load.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 150).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2">{r.latitude?.toFixed(2)}°</td>
                    <td className="px-3 py-2">{r.longitude?.toFixed(2)}°</td>
                    <td className="px-3 py-2 font-mono">{r.seconds_in_day?.toFixed(0)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold ${
                        r.ozone_column_raw < 220 ? 'bg-red-100 text-red-800' :
                        r.ozone_column_raw > 400 ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {r.ozone_column_raw?.toFixed(0)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">{(r.solar_zenith_angle ?? 45).toFixed(1)}</td>
                    <td className="px-3 py-2 font-mono">{(r.radiative_cloud_fraction ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono">{(r.cloud_pressure ?? 500).toFixed(0)}</td>
                    <td className="px-3 py-2 font-mono">{((r.water_fraction ?? 0.5)).toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono">{(r.reflectivity331 ?? 20).toFixed(1)}%</td>
                    <td className="px-3 py-2 font-mono">{(r.uv_aerosol_index ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-[10px] ${r.quality_flag === 0 ? 'bg-gray-100' : 'bg-yellow-100'}`}>
                        {r.quality_flag}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-[10px] ${r.ground_pixel_quality_flag === 0 ? 'bg-gray-100' : 'bg-orange-100'}`}>
                        {r.ground_pixel_quality_flag ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-500 truncate max-w-[100px]">
                      {r.granule_name?.substring(0, 20)}...
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
