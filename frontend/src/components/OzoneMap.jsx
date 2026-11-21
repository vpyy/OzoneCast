import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api/apiClient';

export default function OzoneMap({ gridData = [], rawData = [], mode = 'grid' }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(null);
  const orbitLayer = useRef(null);

  const [baseMap, setBaseMap] = useState('satellite'); // 'satellite' | 'osm' | 'topo'
  const [showOrbit, setShowOrbit] = useState(true);
  const [orbitData, setOrbitData] = useState(null);
  const [loadingOrbit, setLoadingOrbit] = useState(false);

  // Thang màu nồng độ Ozone (Dobson Units - DU)
  const getOzoneColor = (du) => {
    if (du < 200) return '#7f1d1d'; // Thủng tầng ozone (< 200 DU)
    if (du < 240) return '#b91c1c'; // Cảnh báo thấp (< 240 DU)
    if (du < 280) return '#f59e0b'; // Trung bình (240 - 280 DU)
    if (du < 330) return '#10b981'; // Mức an toàn chuẩn (280 - 330 DU)
    if (du < 380) return '#0284c7'; // Nồng độ cao (330 - 380 DU)
    return '#4338ca';               // Rất cao (> 380 DU)
  };

  // Tải dữ liệu quỹ đạo bay từ Database API
  const fetchOrbit = useCallback(async () => {
    setLoadingOrbit(true);
    try {
      const data = await api.getOrbitTrack(6000);
      setOrbitData(data);
    } catch (err) {
      console.warn('[OzoneMap] Không thể tải dữ liệu orbit track:', err.message);
    } finally {
      setLoadingOrbit(false);
    }
  }, []);

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!leafletMap.current && mapRef.current && window.L) {
      // Mặc định tiêu điểm tại Bán đảo Nam Cực [-70°, -60°]
      leafletMap.current = window.L.map(mapRef.current).setView([-70.0, -60.0], 3);

      markersLayer.current = window.L.layerGroup().addTo(leafletMap.current);
      orbitLayer.current = window.L.layerGroup().addTo(leafletMap.current);
    }

    fetchOrbit();

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [fetchOrbit]);

  // Cập nhật Base Layer không cần API key (ESRI World Imagery / OSM / Topo)
  useEffect(() => {
    if (!leafletMap.current || !window.L) return;

    if (tileLayerRef.current) {
      try {
        leafletMap.current.removeLayer(tileLayerRef.current);
      } catch (e) {
        console.warn('Error removing tile layer:', e);
      }
    }

    let tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    let tileAttr = '&copy; Esri World Imagery &bull; NASA Aura/OMI';

    if (baseMap === 'osm') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      tileAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &bull; NASA Aura/OMI';
    } else if (baseMap === 'topo') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
      tileAttr = '&copy; Esri World Topo &bull; NASA Aura/OMI';
    }

    tileLayerRef.current = window.L.tileLayer(tileUrl, {
      maxZoom: 18,
      attribution: tileAttr
    }).addTo(leafletMap.current);

    // Đưa layer quỹ đạo và markers lên trên lớp nền (kiểm tra tồn tại và có method trước khi gọi)
    if (orbitLayer.current && typeof orbitLayer.current.bringToFront === 'function') {
      orbitLayer.current.bringToFront();
    }
    if (markersLayer.current && typeof markersLayer.current.bringToFront === 'function') {
      markersLayer.current.bringToFront();
    }
  }, [baseMap]);

  // Cập nhật các điểm đo (Grid Cells hoặc Raw Measurements)
  useEffect(() => {
    if (!leafletMap.current || !markersLayer.current || !window.L) return;

    markersLayer.current.clearLayers();

    const points = mode === 'grid'
      ? gridData.map(d => ({ lat: d.lat_bin, lon: d.lon_bin, val: d.ozone_column_mean, label: 'Grid Mean Cell (0.5°×0.5°)' }))
      : rawData.map(d => ({ lat: d.latitude, lon: d.longitude, val: d.ozone_column_raw, label: 'Raw Swath Point' }));

    const step = Math.max(1, Math.floor(points.length / 500));
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      if (p.lat == null || p.lon == null) continue;

      const color = getOzoneColor(p.val);
      const circle = window.L.circleMarker([p.lat, p.lon], {
        radius: mode === 'grid' ? 5 : 3.5,
        fillColor: color,
        color: '#ffffff',
        weight: 0.5,
        opacity: 0.9,
        fillOpacity: 0.85
      });

      circle.bindPopup(`
        <div class="text-xs p-1 leading-relaxed">
          <div class="font-bold text-slate-800">${p.label}</div>
          <div class="text-slate-600">Tọa độ: <b>${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°</b></div>
          <div>Nồng độ: <span class="font-bold" style="color: ${color}">${p.val.toFixed(1)} DU</span></div>
          ${p.val < 220 ? '<div class="text-rose-600 font-bold mt-0.5">⚠️ Vùng suy giảm tầng Ozone</div>' : ''}
        </div>
      `);

      markersLayer.current.addLayer(circle);
    }
  }, [gridData, rawData, mode]);

  // Vẽ Quỹ đạo Vệ tinh Aura (Nadir Track) + Dải quét Swath (~2600 km)
  useEffect(() => {
    if (!leafletMap.current || !orbitLayer.current || !window.L) return;

    orbitLayer.current.clearLayers();

    if (!showOrbit || !orbitData) return;

    const { nadir_track = [], left_edge = [], right_edge = [] } = orbitData;
    if (nadir_track.length === 0) return;

    // Helper: Tách Polyline khi băng qua đường đổi ngày quốc tế (Antimeridian Crossing)
    // Tránh lỗi kẻ ngang cắt đôi bản đồ khi kinh độ nhảy giữa +180° và -180°
    const splitAtAntimeridian = (pts) => {
      const segments = [];
      let currentSeg = [];

      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (currentSeg.length > 0) {
          const prev = currentSeg[currentSeg.length - 1];
          if (Math.abs(pt.lon - prev.lon) > 180) {
            segments.push(currentSeg);
            currentSeg = [];
          }
        }
        currentSeg.push(pt);
      }
      if (currentSeg.length > 0) segments.push(currentSeg);
      return segments;
    };

    // 1. Vẽ Dải quét (Swath Polygon) nếu có mép trái và mép phải
    if (left_edge.length > 0 && right_edge.length > 0) {
      // Ghép: mép trái xuôi thời gian + mép phải ngược thời gian
      const leftSegs = splitAtAntimeridian(left_edge);
      const rightSegs = splitAtAntimeridian(right_edge);

      const numSegs = Math.min(leftSegs.length, rightSegs.length);
      for (let s = 0; s < numSegs; s++) {
        const lPts = leftSegs[s].map(p => [p.lat, p.lon]);
        const rPts = rightSegs[s].slice().reverse().map(p => [p.lat, p.lon]);
        const polygonCoords = [...lPts, ...rPts];

        if (polygonCoords.length >= 3) {
          const swathPolygon = window.L.polygon(polygonCoords, {
            color: '#0891b2',
            weight: 1.2,
            dashArray: '4, 4',
            fillColor: '#06b6d4',
            fillOpacity: 0.15
          });

          swathPolygon.bindPopup(`
            <div class="text-xs p-1">
              <div class="font-bold text-cyan-800">🛰️ Dải quét quang phổ OMI Swath</div>
              <div class="text-slate-600">Độ rộng vệt quét: <b>~2.600 km</b> (60 cross-track pixels)</div>
              <div class="text-slate-500 text-[11px] mt-0.5">Vùng thu nhận phổ bức xạ cực tím đo Ozone</div>
            </div>
          `);

          orbitLayer.current.addLayer(swathPolygon);
        }
      }
    }

    // 2. Vẽ Đường bay trung tâm (Nadir Orbit Track Polyline)
    const nadirSegments = splitAtAntimeridian(nadir_track);
    nadirSegments.forEach((seg) => {
      const latlngs = seg.map(p => [p.lat, p.lon]);
      const polyline = window.L.polyline(latlngs, {
        color: '#0284c7',
        weight: 3,
        opacity: 0.9,
        dashArray: '6, 6'
      });

      polyline.bindPopup(`
        <div class="text-xs p-1">
          <div class="font-bold text-sky-800">🛰️ Đường bay trung tâm Nadir (Aura OMI)</div>
          <div class="text-slate-600">Góc quét: <b>Nadir (Pixel 29/30)</b></div>
          <div class="text-slate-500 text-[11px]">Quỹ đạo cực đồng bộ Mặt Trời (705 km, 98.2°)</div>
        </div>
      `);

      orbitLayer.current.addLayer(polyline);
    });

    // 3. Đặt Marker vệ tinh 🛰️ tại vị trí mới nhất (seconds_in_day lớn nhất)
    const latestPoint = nadir_track.reduce((latest, curr) => {
      return (curr.seconds_in_day > (latest?.seconds_in_day || 0)) ? curr : latest;
    }, nadir_track[nadir_track.length - 1]);

    if (latestPoint && latestPoint.lat != null && latestPoint.lon != null) {
      const satIcon = window.L.divIcon({
        className: 'satellite-icon',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
            <div style="position: absolute; width: 28px; height: 28px; background: rgba(14, 165, 233, 0.35); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">🛰️</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const satMarker = window.L.marker([latestPoint.lat, latestPoint.lon], { icon: satIcon });
      satMarker.bindPopup(`
        <div class="text-xs p-1 leading-relaxed">
          <div class="font-bold text-sky-900 flex items-center gap-1.5 text-sm">
            <span>🛰️</span> Vệ tinh NASA Aura (OMI)
          </div>
          <div class="mt-1 text-slate-700">Tọa độ tức thời: <b>${latestPoint.lat.toFixed(2)}°, ${latestPoint.lon.toFixed(2)}°</b></div>
          <div class="text-slate-600">Thời điểm quét UTC: <b>${latestPoint.seconds_in_day.toFixed(0)} giây trong ngày</b></div>
          <div class="text-[11px] text-slate-500 mt-1 border-t pt-1">
            Khu vực khảo sát: Bán đảo Nam Cực ([-90°, -55°])
          </div>
        </div>
      `);

      orbitLayer.current.addLayer(satMarker);
    }
  }, [showOrbit, orbitData]);

  // Nút đưa góc nhìn về Bán đảo Nam Cực
  const resetToAntarctica = () => {
    if (leafletMap.current) {
      leafletMap.current.setView([-70.0, -60.0], 3.5, { animate: true });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[560px]">
      {/* Header Điều khiển */}
      <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between bg-slate-50 gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <span>🌍</span> Bản đồ Không gian Ozone & Quỹ đạo Vệ tinh Aura (Bán đảo Nam Cực)
          </h3>
          <p className="text-[11px] text-slate-500">
            Tọa độ [-90°, -55°] — Tích hợp Polyline đường bay Nadir, dải quét Swath ~2.600 km và vị trí vệ tinh tức thời
          </p>
        </div>

        {/* Nút chọn Lớp nền bản đồ & Bật/tắt Quỹ đạo & Focus Nam Cực */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lớp nền không cần API key */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-semibold text-slate-700">
            <button
              onClick={() => setBaseMap('satellite')}
              className={`px-2 py-1 rounded-md transition ${
                baseMap === 'satellite' ? 'bg-white text-sky-700 shadow-sm' : 'hover:text-slate-900'
              }`}
              title="Ảnh vệ tinh địa hình ESRI World Imagery (Miễn phí, không cần API Key)"
            >
              🛰️ Vệ tinh
            </button>
            <button
              onClick={() => setBaseMap('osm')}
              className={`px-2 py-1 rounded-md transition ${
                baseMap === 'osm' ? 'bg-white text-sky-700 shadow-sm' : 'hover:text-slate-900'
              }`}
              title="Bản đồ OpenStreetMap chuẩn (Miễn phí, không cần API Key)"
            >
              🗺️ Bản đồ
            </button>
            <button
              onClick={() => setBaseMap('topo')}
              className={`px-2 py-1 rounded-md transition ${
                baseMap === 'topo' ? 'bg-white text-sky-700 shadow-sm' : 'hover:text-slate-900'
              }`}
              title="Bản đồ địa hình ESRI Topo (Miễn phí, không cần API Key)"
            >
              ⛰️ Địa hình
            </button>
          </div>

          <button
            onClick={() => setShowOrbit(!showOrbit)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              showOrbit
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
            title="Bật/Tắt hiển thị quỹ đạo bay Aura và dải quét quang phổ"
          >
            <span>🛰️</span>
            <span>{showOrbit ? 'Tắt Quỹ đạo' : 'Hiện Quỹ đạo Vệ tinh'}</span>
            {loadingOrbit && <span className="animate-spin text-[10px]">⏳</span>}
          </button>

          <button
            onClick={resetToAntarctica}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1"
            title="Đưa tiêu điểm bản đồ về Bán đảo Nam Cực"
          >
            <span>❄️</span>
            <span>Về Nam Cực</span>
          </button>
        </div>
      </div>

      {/* Thang màu Chú giải Dobson Units */}
      <div className="px-4 py-1.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-slate-700">Mức Ozone (DU):</span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-[#7f1d1d]"></span><span>&lt;200 (Thủng)</span></span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-[#b91c1c]"></span><span>200-240</span></span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span><span>240-280</span></span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span><span>280-330 (Chuẩn)</span></span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]"></span><span>330-380</span></span>
          <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-[#4338ca]"></span><span>&gt;380 DU</span></span>
        </div>

        {showOrbit && (
          <div className="flex items-center space-x-3 text-[11px] text-slate-500">
            <span className="flex items-center space-x-1">
              <span className="inline-block w-3 border-t-2 border-dashed border-sky-600"></span>
              <span>Đường bay Nadir</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="inline-block w-2.5 h-2.5 bg-cyan-400/30 border border-cyan-600 rounded-sm"></span>
              <span>Dải quét Swath (~2600km)</span>
            </span>
          </div>
        )}
      </div>

      {/* Container Leaflet Map */}
      <div ref={mapRef} className="flex-1 w-full" id="map"></div>
    </div>
  );
}
