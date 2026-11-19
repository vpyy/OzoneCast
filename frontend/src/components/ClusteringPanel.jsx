import React, { useState } from 'react';
import { api } from '../api/apiClient';

export default function ClusteringPanel({ clusters = [], onClustersUpdated }) {
  const [algorithm, setAlgorithm] = useState('KMeans');
  const [nClusters, setNClusters] = useState(4);
  const [eps, setEps] = useState(1.2);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.runClustering(algorithm, parseFloat(eps), parseInt(nClusters));
      setResult(res);
      if (onClustersUpdated) onClustersUpdated();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  };

  const clusterGroups = {};
  clusters.forEach(c => {
    const key = c.cluster_id;
    if (!clusterGroups[key]) {
      clusterGroups[key] = {
        id: key,
        count: 0,
        totalOzone: 0,
      };
    }
    clusterGroups[key].count += 1;
    clusterGroups[key].totalOzone += (c.mean_ozone || 0);
  });

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="bg-white p-4 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Spatial Clustering</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="KMeans">K-Means</option>
              <option value="DBSCAN">DBSCAN</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {algorithm === 'KMeans' ? 'K (clusters)' : 'Epsilon'}
            </label>
            <input
              type="number"
              step={algorithm === 'KMeans' ? '1' : '0.1'}
              value={algorithm === 'KMeans' ? nClusters : eps}
              onChange={(e) => algorithm === 'KMeans' ? setNClusters(e.target.value) : setEps(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              onClick={handleRun}
              disabled={running}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {running ? 'Running...' : 'Execute Clustering'}
            </button>
          </div>
        </div>

        {result && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 p-2">
            ✓ Clustered {result.total_points_clustered} points into {result.cluster_count} groups
          </div>
        )}
      </div>

      {/* Cluster Summary Cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Cluster Groups</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(clusterGroups).length > 0 ? (
            Object.values(clusterGroups).map((grp, idx) => {
              const avgO3 = grp.count > 0 ? (grp.totalOzone / grp.count).toFixed(1) : '290';
              return (
                <div key={idx} className="bg-white p-3 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-900">Cluster {idx + 1}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-2">{grp.count}</p>
                  <p className="text-xs text-gray-600 mt-1">Ozone: {avgO3} DU</p>
                </div>
              );
            })
          ) : (
            <div className="col-span-4 text-center p-8 text-gray-400 text-sm">
              No clustering data available
            </div>
          )}
        </div>
      </div>

      {/* Clusters Table */}
      <div className="bg-white border border-gray-200">
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-900">
            Cluster Points ({clusters.length} records)
          </h4>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs text-left text-gray-700">
            <thead className="bg-gray-100 text-gray-900 font-semibold border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-2">Cluster ID</th>
                <th className="px-4 py-2">Latitude</th>
                <th className="px-4 py-2">Longitude</th>
                <th className="px-4 py-2">Ozone (DU)</th>
                <th className="px-4 py-2">Reflectivity (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {clusters.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-400">
                    No cluster data
                  </td>
                </tr>
              ) : (
                clusters.slice(0, 100).map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2 font-mono text-gray-800">
                      {c.cluster_id === -1 ? 'Noise' : `C${c.cluster_id + 1}`}
                    </td>
                    <td className="px-4 py-2">{c.latitude?.toFixed(2)}°</td>
                    <td className="px-4 py-2">{c.longitude?.toFixed(2)}°</td>
                    <td className="px-4 py-2 font-semibold text-gray-900">{c.mean_ozone?.toFixed(1)}</td>
                    <td className="px-4 py-2">{(c.mean_reflectivity || 20.0).toFixed(1)}%</td>
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
