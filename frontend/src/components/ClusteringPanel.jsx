import React, { useState } from 'react';
import { Layers, Play, CheckCircle2 } from 'lucide-react';
import { api } from '../api/apiClient';

export default function ClusteringPanel({ clusters = [], onClustersUpdated }) {
  const [algorithm, setAlgorithm] = useState('DBSCAN');
  const [eps, setEps] = useState(1.2);
  const [nClusters, setNClusters] = useState(4);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.runClustering(algorithm, parseFloat(eps), parseInt(nClusters));
      setResult(res);
      if (onClustersUpdated) onClustersUpdated();
    } catch (err) {
      alert('Clustering error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800 mb-2 flex items-center space-x-2">
          <Layers className="h-5 w-5 text-indigo-500" />
          <span>Spatial-Temporal Ozone Clustering Microservice</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Identifies spatial density clusters of severe ozone depletion (ozone hole areas) and regional concentrations.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500"
            >
              <option value="DBSCAN">DBSCAN (Density-based)</option>
              <option value="KMeans">K-Means (Centroid-based)</option>
            </select>
          </div>

          {algorithm === 'DBSCAN' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Epsilon (Eps)</label>
              <input
                type="number"
                step="0.1"
                value={eps}
                onChange={(e) => setEps(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Number of Clusters (K)</label>
              <input
                type="number"
                value={nClusters}
                onChange={(e) => setNClusters(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <button
              onClick={handleRun}
              disabled={running}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition shadow-sm disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{running ? 'Running Clustering...' : 'Execute Spatial Clustering'}</span>
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
              <span>Clustering finished: Found <b>{result.cluster_count}</b> clusters across {result.total_points_clustered} points.</span>
            </span>
          </div>
        )}
      </div>

      {/* Clusters Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h4 className="font-semibold text-slate-800 text-sm">Cluster Data Points & Anomaly Tags</h4>
          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
            {clusters.length} records
          </span>
        </div>

        <div className="overflow-x-auto max-h-[420px]">
          <table className="min-w-full text-xs text-left text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0">
              <tr>
                <th className="px-4 py-3">Cluster ID</th>
                <th className="px-4 py-3">Algorithm</th>
                <th className="px-4 py-3">Latitude</th>
                <th className="px-4 py-3">Longitude</th>
                <th className="px-4 py-3">Ozone (DU)</th>
                <th className="px-4 py-3">Classification Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clusters.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">
                    No cluster records available. Click "Execute Spatial Clustering" to run analysis.
                  </td>
                </tr>
              ) : (
                clusters.slice(0, 100).map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        c.cluster_id === -1 ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {c.cluster_id === -1 ? 'Noise' : `C-${c.cluster_id}`}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono">{c.algorithm}</td>
                    <td className="px-4 py-2">{c.latitude.toFixed(2)}°</td>
                    <td className="px-4 py-2">{c.longitude.toFixed(2)}°</td>
                    <td className="px-4 py-2 font-semibold text-slate-800">{c.mean_ozone.toFixed(1)} DU</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        c.tag?.includes('Depleted') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.tag || 'Standard'}
                      </span>
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

