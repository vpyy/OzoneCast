import React, { useState } from 'react';
import { Layers, Play, CheckCircle2, Sparkles, MapPin, Eye } from 'lucide-react';
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
      alert('Clustering error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  };

  // Group clusters for summary display
  const clusterGroups = {};
  clusters.forEach(c => {
    const key = c.cluster_id;
    if (!clusterGroups[key]) {
      clusterGroups[key] = {
        id: key,
        tag: c.tag || `Cụm ${key + 1}`,
        characteristic: c.characteristic || 'Vùng bề mặt khí quyển thông thường',
        count: 0,
        totalOzone: 0,
        totalRefl: 0
      };
    }
    clusterGroups[key].count += 1;
    clusterGroups[key].totalOzone += (c.mean_ozone || 0);
    clusterGroups[key].totalRefl += (c.mean_reflectivity || 20);
  });

  const getClusterBadge = (charStr = '') => {
    if (charStr.includes('băng tuyết') || charStr.includes('mây')) {
      return 'bg-cyan-50 text-cyan-800 border-cyan-300';
    }
    if (charStr.includes('suy giảm') || charStr.includes('thủng')) {
      return 'bg-rose-50 text-rose-800 border-rose-300';
    }
    if (charStr.includes('nhiệt đới') || charStr.includes('xích đạo')) {
      return 'bg-amber-50 text-amber-800 border-amber-300';
    }
    return 'bg-emerald-50 text-emerald-800 border-emerald-300';
  };

  return (
    <div className="space-y-6">

      {/* Control Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              <span>Phân cụm Khu vực Khí quyển & Bề mặt (Spatial Clustering Service)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tần suất chạy tự động: <strong>1 ngày / lần</strong> &bull; Thuật toán phân cụm dựa trên 4 biến số: <strong>Latitude, Longitude, Ozone</strong> và <strong>Reflectivity331</strong>.
            </p>
          </div>
          <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200 font-semibold">
            Chu kỳ: 1 ngày / lần
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Thuật toán phân cụm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="KMeans">K-Means (Phân cụm tâm đại diện)</option>
              <option value="DBSCAN">DBSCAN (Phân cụm mật độ không gian)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {algorithm === 'KMeans' ? 'Số lượng cụm (K)' : 'Bán kính Epsilon (Eps)'}
            </label>
            <input
              type="number"
              step={algorithm === 'KMeans' ? '1' : '0.1'}
              value={algorithm === 'KMeans' ? nClusters : eps}
              onChange={(e) => algorithm === 'KMeans' ? setNClusters(e.target.value) : setEps(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              onClick={handleRun}
              disabled={running}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-sm disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{running ? 'Đang thực thi phân cụm...' : 'Thực thi Phân cụm Không gian ngay'}</span>
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
              <span>Đã phân cụm thành công: <strong>{result.cluster_count}</strong> nhóm đặc trưng từ {result.total_points_clustered} điểm quan trắc.</span>
            </span>
          </div>
        )}
      </div>

      {/* Cluster Summary Cards */}
      <div>
        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Các Nhóm Đặc trưng Khí quyển / Bề mặt đã nhận diện
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(clusterGroups).length > 0 ? (
            Object.values(clusterGroups).map((grp, idx) => {
              const avgO3 = grp.count > 0 ? (grp.totalOzone / grp.count).toFixed(1) : '290';
              const avgRefl = grp.count > 0 ? (grp.totalRefl / grp.count).toFixed(1) : '20';
              return (
                <div key={idx} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        Cụm {idx + 1}
                      </span>
                      <span className="text-xs text-slate-400">{grp.count} điểm</span>
                    </div>
                    <div className={`text-xs font-bold p-2 rounded-xl border mb-3 ${getClusterBadge(grp.characteristic)}`}>
                      {grp.characteristic}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100 font-mono">
                    <div className="flex justify-between">
                      <span>Ozone TB:</span>
                      <strong className="text-slate-900">{avgO3} DU</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Độ phản xạ 331:</span>
                      <strong className="text-slate-900">{avgRefl}%</strong>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-4 p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              Chưa có dữ liệu phân cụm. Hãy bấm "Thực thi Phân cụm Không gian ngay" ở trên.
            </div>
          )}
        </div>
      </div>

      {/* Clusters Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <h4 className="font-semibold text-slate-800 text-xs flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            Chi tiết Điểm Phân cụm Không gian ({clusters.length} records)
          </h4>
          <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
            KMeans L2
          </span>
        </div>

        <div className="overflow-x-auto max-h-[360px]">
          <table className="min-w-full text-xs text-left text-slate-600">
            <thead className="bg-slate-100/80 text-slate-700 uppercase font-semibold sticky top-0 text-[11px]">
              <tr>
                <th className="px-4 py-2.5">Mã Cụm</th>
                <th className="px-4 py-2.5">Vĩ độ</th>
                <th className="px-4 py-2.5">Kinh độ</th>
                <th className="px-4 py-2.5">Ozone (DU)</th>
                <th className="px-4 py-2.5">Độ phản xạ 331 (%)</th>
                <th className="px-4 py-2.5">Đặc trưng Phân loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clusters.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">
                    Chưa có bản ghi phân cụm nào trong Database.
                  </td>
                </tr>
              ) : (
                clusters.slice(0, 100).map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded font-bold font-mono text-[10.5px] ${
                        c.cluster_id === -1 ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {c.cluster_id === -1 ? 'Noise' : `C-${c.cluster_id + 1}`}
                      </span>
                    </td>
                    <td className="px-4 py-2">{c.latitude?.toFixed(2)}°</td>
                    <td className="px-4 py-2">{c.longitude?.toFixed(2)}°</td>
                    <td className="px-4 py-2 font-semibold text-slate-800">{c.mean_ozone?.toFixed(1)} DU</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{(c.mean_reflectivity || 20.0).toFixed(1)}%</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getClusterBadge(c.characteristic || c.tag)}`}>
                        {c.characteristic || c.tag || 'Bình thường'}
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
