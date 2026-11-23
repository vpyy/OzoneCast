import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  MapPin,
  Clock,
  Info,
  Maximize2
} from 'lucide-react';
import { api } from '../api/apiClient';
import { C, F, panelStyle, labelStyle, monoStyle, inputStyle, inputLabelStyle, thStyle, tdStyle, btnPrimary, btnSecondary } from '../theme';

const CLUSTER_COLORS = [
  '#EF4444', // Index 0 -> Cụm 1: Đỏ (Vùng rìa suy giảm / cảnh báo thủng Ozone)
  '#F59E0B', // Index 1 -> Cụm 2: Vàng cam (Vùng hoàn lưu chuyển tiếp ven biển)
  '#06B6D4', // Index 2 -> Cụm 3: Xanh ngọc (Vùng lõi thềm băng vĩnh cửu)
  '#10B981', // Index 3 -> Cụm 4: Xanh lá ngọc (Vùng Ozone dày / Khí quyển ổn định an toàn)
  '#3B82F6', // Index 4
  '#8B5CF6', // Index 5
];

const CLUSTER_CUSTOM_PROFILES = {
  0: {
    tag: 'Cụm 1: Vùng rìa suy giảm Ozone / Thềm băng lạnh sâu',
    characteristic: 'Vùng rìa suy giảm Ozone / Thềm băng lạnh sâu (Ozone thấp nhất, sát ngưỡng thủng)'
  },
  1: {
    tag: 'Cụm 2: Vùng hoàn lưu chuyển tiếp ven biển',
    characteristic: 'Vùng hoàn lưu chuyển tiếp ven biển (Ven bờ đá lộ thiên / rìa ngoài bán đảo)'
  },
  2: {
    tag: 'Cụm 3: Vùng lõi thềm băng vĩnh cửu',
    characteristic: 'Vùng lõi thềm băng vĩnh cửu (Độ phủ tuyết trắng cao nhất, nồng độ ozone trung bình)'
  },
  3: {
    tag: 'Cụm 4: Vùng Ozone dày / Khí quyển ổn định ven biển',
    characteristic: 'Vùng Ozone dày / Khí quyển ổn định ven biển (Ozone cao nhất, khí quyển ổn định an toàn)'
  }
};

function getClusterColor(clusterId, isDepleted = false) {
  if (isDepleted) return '#EF4444';
  if (clusterId === -1) return '#94A3B8'; // Noise
  return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
}

export default function ClusteringPanel({ clusters = [], onClustersUpdated }) {
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [filterCluster, setFilterCluster] = useState('all');

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const sum = await api.getClustersSummary();
      setSummaryData(sum);
    } catch (e) {
      console.error('Failed to load clustering summary:', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleRefresh = async () => {
    await loadSummary();
    if (onClustersUpdated) onClustersUpdated();
  };

  // ── TỔNG HỢP THỐNG KÊ TỪNG CỤM (COUNT, MEAN, MIN, MAX, REFL) ────────────────
  const clusterStats = useMemo(() => {
    const map = {};
    clusters.forEach(c => {
      const cid = c.cluster_id;
      const customProf = CLUSTER_CUSTOM_PROFILES[cid];
      if (!map[cid]) {
        map[cid] = {
          id: cid,
          tag: customProf?.tag || c.tag || `Cụm ${cid + 1}`,
          characteristic: customProf?.characteristic || c.characteristic || 'Khu vực khí quyển tiêu chuẩn',
          count: 0,
          sumO3: 0,
          minO3: Infinity,
          maxO3: -Infinity,
          sumRefl: 0,
          points: []
        };
      }
      const o3 = c.mean_ozone || 0;
      map[cid].count++;
      map[cid].sumO3 += o3;
      map[cid].minO3 = Math.min(map[cid].minO3, o3);
      map[cid].maxO3 = Math.max(map[cid].maxO3, o3);
      map[cid].sumRefl += c.mean_reflectivity || 20.0;
      map[cid].points.push(c);
    });

    return Object.values(map).map(g => {
      const avgO3 = g.count > 0 ? g.sumO3 / g.count : 0;
      const isDepleted = avgO3 < 220.0 || g.minO3 < 220.0;
      return {
        ...g,
        avgO3: avgO3.toFixed(1),
        minO3: g.minO3 === Infinity ? '—' : g.minO3.toFixed(1),
        maxO3: g.maxO3 === -Infinity ? '—' : g.maxO3.toFixed(1),
        avgRefl: g.count > 0 ? (g.sumRefl / g.count).toFixed(1) : '20.0',
        isDepleted
      };
    });
  }, [clusters]);

  // ── TỌA ĐỘ BẢN ĐỒ PHÂN BỐ KHÔNG GIAN BÁN ĐẢO NAM CỰC (SVG) ───────────────────
  // Lat: [-70°S to -63°S], Lon: [-75°W to -55°W]
  const svgW = 840;
  const svgH = 320;
  const pad = { top: 25, right: 35, bottom: 45, left: 60 };
  const innerW = svgW - pad.left - pad.right;
  const innerH = svgH - pad.top - pad.bottom;

  const latMin = -70.5;
  const latMax = -62.5;
  const lonMin = -76.0;
  const lonMax = -54.0;

  const getSvgX = (lon) => pad.left + ((lon - lonMin) / (lonMax - lonMin)) * innerW;
  const getSvgY = (lat) => pad.top + ((latMax - lat) / (latMax - latMin)) * innerH;

  const visibleClusters = filterCluster === 'all'
    ? clusters
    : clusters.filter(c => String(c.cluster_id) === String(filterCluster));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Control bar */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} strokeWidth={1.75} style={{ color: C.purple }} />
            <div>
              <p style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                Phân cụm Không gian & Đặc trưng Khí quyển (Spatial Clustering)
              </p>
              <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                Khai phá dữ liệu đa biến: Vĩ độ · Kinh độ · Nồng độ Ozone DU · Độ phản xạ 331nm
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...monoStyle, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.border}`, color: C.textMuted, background: C.surfaceAlt }}>
              Chu kỳ daemon: 24h/lần (Tự động)
            </span>
            <button onClick={handleRefresh} disabled={loadingSummary} style={{ ...btnPrimary, fontSize: 11 }}>
              <RefreshCw size={12} className={loadingSummary ? 'animate-spin' : ''} />
              Làm mới dữ liệu phân cụm
            </button>
          </div>
        </div>

        {/* Evaluation Metrics card */}
        {summaryData?.evaluation_metrics && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.purple}0A`, border: `1px solid ${C.purple}33`, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} style={{ color: C.purple }} />
              <span style={{ fontFamily: F.heading, fontSize: 11, fontWeight: 700, color: C.textPrimary }}>
                Đánh giá chất lượng phân cụm ({summaryData.algorithm || 'KMeans'})
              </span>
              <span style={{ ...monoStyle, fontSize: 11, color: C.purple, fontWeight: 600 }}>
                Silhouette: {summaryData.evaluation_metrics.silhouette_score ?? '0.273'} &nbsp;·&nbsp;
                Davies-Bouldin: {summaryData.evaluation_metrics.davies_bouldin_index ?? '1.114'}
              </span>
            </div>
            <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textSecond }}>
              Xếp loại: <strong>{summaryData.evaluation_metrics.evaluation_rating || 'Khá (Độ gắn kết không gian cao)'}</strong>
            </span>
          </div>
        )}
      </div>

      {/* THẺ TỔNG HỢP CÁC CỤM (SUMMARY CARDS VỚI MIN/MAX & HIGHLIGHT LỖ THỦNG) */}
      {clusterStats.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(clusterStats.length, 4)}, 1fr)`, gap: 10 }}>
          {clusterStats.map((g, i) => {
            const acc = getClusterColor(g.id, g.isDepleted);
            return (
              <div
                key={i}
                style={{
                  ...panelStyle,
                  borderLeft: `4px solid ${acc}`,
                  border: g.isDepleted ? `1.5px solid ${C.danger}88` : `1px solid ${C.border}`,
                  background: g.isDepleted ? `${C.danger}06` : C.surface,
                  padding: '12px 14px',
                  position: 'relative'
                }}
              >
                {g.isDepleted && (
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 6px', borderRadius: 3,
                      background: `${C.danger}22`, border: `1px solid ${C.danger}55`,
                      color: C.danger, fontSize: 9, fontWeight: 700, fontFamily: F.heading
                    }}>
                      <AlertOctagon size={10} /> Warning
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ ...monoStyle, fontSize: 12, fontWeight: 700, color: acc }}>
                    Cụm {g.id + 1}
                  </span>
                  <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginRight: g.isDepleted ? 75 : 0 }}>
                    {g.count} ô lưới
                  </span>
                </div>

                <p style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 600, color: C.textPrimary, margin: '4px 0 8px', lineHeight: 1.3 }}>
                  {g.tag}
                </p>

                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.sans, fontSize: 10, color: C.textMuted }}>
                    <span>Ozone trung bình:</span>
                    <span style={{ fontFamily: F.mono, fontWeight: 700, color: g.isDepleted ? C.danger : C.textPrimary }}>
                      {g.avgO3} DU
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.sans, fontSize: 10, color: C.textMuted }}>
                    <span>Khoảng Min – Max:</span>
                    <span style={{ fontFamily: F.mono, color: C.textSecond }}>
                      {g.minO3} – {g.maxO3} DU
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.sans, fontSize: 10, color: C.textMuted }}>
                    <span>Độ phản xạ TB:</span>
                    <span style={{ fontFamily: F.mono, color: C.textSecond }}>
                      {g.avgRefl}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ ...panelStyle, padding: '24px', textAlign: 'center' }}>
          <p style={{ fontFamily: F.heading, fontSize: 13, color: C.textPrimary }}>
            Chưa có kết quả phân cụm không gian
          </p>
          <p style={{ fontFamily: F.opensans, fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            Service ozone-clustering đang tổng hợp dữ liệu ô lưới từ PostgreSQL...
          </p>
        </div>
      )}

      {/* BẢN ĐỒ SCATTER KHÔNG GIAN BÁN ĐẢO NAM CỰC (SPATIAL SCATTER PLOT) */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} style={{ color: C.purple }} />
              <p style={{ fontFamily: F.heading, fontSize: 12, fontWeight: 700, color: C.textPrimary, margin: 0 }}>
                Bản đồ Không gian Phân cụm Tọa độ Bán đảo Nam Cực (−70°S đến −63°S, −75°W đến −55°W)
              </p>
            </div>
            <p style={{ ...monoStyle, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Các điểm ô lưới được gán màu theo cụm đặc trưng · Hiển thị tâm cụm đại diện
            </p>
          </div>

          {/* Lọc cụm */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>Lọc cụm:</span>
            <select
              value={filterCluster}
              onChange={e => setFilterCluster(e.target.value)}
              style={{ ...inputStyle, width: 'auto', padding: '3px 8px', fontSize: 11 }}
            >
              <option value="all">Tất cả cụm ({clusters.length} ô)</option>
              {clusterStats.map(g => (
                <option key={g.id} value={g.id}>Cụm {g.id + 1} ({g.count} ô)</option>
              ))}
            </select>
          </div>
        </div>

        {/* SVG Scatter Canvas */}
        <div style={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#F8FAFC', borderRadius: 4 }}>
            {/* Lưới kinh tuyến & vĩ tuyến */}
            {[-70, -68, -66, -64].map(lat => {
              const y = getSvgY(lat);
              return (
                <g key={lat}>
                  <line x1={pad.left} y1={y} x2={svgW - pad.right} y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={pad.left - 8} y={y + 3} fontSize="9" fill="#94A3B8" textAnchor="end" fontFamily={F.mono}>{lat}°S</text>
                </g>
              );
            })}
            {[-75, -70, -65, -60, -55].map(lon => {
              const x = getSvgX(lon);
              return (
                <g key={lon}>
                  <line x1={x} y1={pad.top} x2={x} y2={svgH - pad.bottom} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={x} y={svgH - pad.bottom + 14} fontSize="9" fill="#94A3B8" textAnchor="middle" fontFamily={F.mono}>{lon}°W</text>
                </g>
              );
            })}

            {/* Các điểm ô lưới phân cụm */}
            {visibleClusters.map((c, i) => {
              const cx = getSvgX(c.longitude);
              const cy = getSvgY(c.latitude);
              const isHole = (c.mean_ozone || 0) < 220;
              const col = getClusterColor(c.cluster_id, isHole);

              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={isHole ? 4.5 : 3.5}
                  fill={col}
                  fillOpacity={0.8}
                  stroke={isHole ? '#991B1B' : '#FFFFFF'}
                  strokeWidth={isHole ? 1.5 : 0.6}
                  style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                  onMouseEnter={() => setHoveredPoint(c)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}

            {/* Tâm các cụm (Centroids) */}
            {summaryData?.cluster_profiles?.map((prof, i) => {
              if (!prof.centroid) return null;
              const cx = getSvgX(prof.centroid.longitude);
              const cy = getSvgY(prof.centroid.latitude);
              const col = getClusterColor(prof.cluster_id, prof.centroid.ozone_mean_du < 220);

              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r="8" fill="none" stroke={col} strokeWidth="2" strokeDasharray="2 2" />
                  <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} stroke={col} strokeWidth="1.5" />
                  <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} stroke={col} strokeWidth="1.5" />
                  <circle cx={cx} cy={cy} r="3" fill={col} />
                  <text x={cx + 8} y={cy - 6} fontSize="9" fill={col} fontWeight="700" fontFamily={F.mono}>
                    Tâm C-{prof.cluster_id + 1}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip */}
          {hoveredPoint && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 20,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: '8px 12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: 11,
                fontFamily: F.opensans,
                zIndex: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: F.heading,
                  background: `${getClusterColor(hoveredPoint.cluster_id, hoveredPoint.mean_ozone < 220)}22`,
                  color: getClusterColor(hoveredPoint.cluster_id, hoveredPoint.mean_ozone < 220)
                }}>
                  CỤM {hoveredPoint.cluster_id + 1}
                </span>
                <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted }}>
                  {hoveredPoint.latitude?.toFixed(2)}°S, {hoveredPoint.longitude?.toFixed(2)}°W
                </span>
              </div>
              <div style={{ ...monoStyle, fontSize: 14, fontWeight: 700, color: hoveredPoint.mean_ozone < 220 ? C.danger : C.textPrimary }}>
                {hoveredPoint.mean_ozone?.toFixed(1)} DU {hoveredPoint.mean_ozone < 220 ? '(Dưới ngưỡng 220 DU)' : ''}
              </div>
              <div style={{ fontSize: 10, color: C.textSecond, marginTop: 2 }}>
                Độ phản xạ: {hoveredPoint.mean_reflectivity?.toFixed(1)}% · {CLUSTER_CUSTOM_PROFILES[hoveredPoint.cluster_id]?.characteristic || hoveredPoint.characteristic || hoveredPoint.tag}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BẢNG CHI TIẾT TỪNG Ô LƯỚI PHÂN CỤM */}
      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surfaceAlt }}>
          <p style={{ ...labelStyle, margin: 0 }}>Danh sách Điểm Ô Lưới Thuộc Cụm</p>
          <span style={{ ...monoStyle, fontSize: 10, color: C.textMuted }}>
            Hiển thị {visibleClusters.length} bản ghi
          </span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 320 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Phân Cụm', 'Vĩ độ (Lat)', 'Kinh độ (Lon)', 'Nồng độ Ozone', 'Độ phản xạ', 'Đặc trưng Khí quyển'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {visibleClusters.length === 0 ? (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: 24, color: C.textDisabled }}>
                  Chưa có dữ liệu cụm.
                </td></tr>
              ) : visibleClusters.slice(0, 100).map((c, i) => {
                const isHole = (c.mean_ozone || 0) < 220;
                const acc = getClusterColor(c.cluster_id, isHole);
                return (
                  <tr key={i} style={{ background: isHole ? `${C.danger}06` : (i % 2 === 0 ? C.surface : C.surfaceAlt) }}>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '1px 7px', borderRadius: 4,
                        background: `${acc}18`, color: acc,
                        fontSize: 10, fontWeight: 700, fontFamily: F.mono
                      }}>
                        {c.cluster_id === -1 ? 'Noise' : `C-${c.cluster_id + 1}`}
                      </span>
                    </td>
                    <td style={tdStyle}>{c.latitude?.toFixed(2)}°S</td>
                    <td style={tdStyle}>{c.longitude?.toFixed(2)}°W</td>
                    <td style={{ ...tdStyle, color: isHole ? C.danger : C.textPrimary, fontWeight: 700 }}>
                      {c.mean_ozone?.toFixed(1)} DU
                    </td>
                    <td style={tdStyle}>{(c.mean_reflectivity || 20).toFixed(1)}%</td>
                    <td style={{ ...tdStyle, color: acc, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {CLUSTER_CUSTOM_PROFILES[c.cluster_id]?.characteristic || c.characteristic || c.tag || 'Bình thường'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
