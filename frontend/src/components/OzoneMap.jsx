import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function OzoneMap({ gridData = [], rawData = [], mode = 'grid' }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(null);
  const orbitLayer = useRef(null);
  const heatLayer = useRef(null);

  const [baseMap, setBaseMap] = useState('satellite');
  const [showOrbit, setShowOrbit] = useState(true);
  const [regionFilter, setRegionFilter] = useState('all');
  const [enableHeatmap, setEnableHeatmap] = useState(false);

  // ── Màu theo DU ──────────────────────────────────────────────────────────────
  const getOzoneColor = (du) => {
    if (du == null) return '#94a3b8';
    if (du < 200) return '#7f1d1d';
    if (du < 240) return '#b91c1c';
    if (du < 280) return '#f59e0b';
    if (du < 330) return '#10b981';
    if (du < 380) return '#0284c7';
    return '#4338ca';
  };

  // ── Vùng địa lý ──────���───────────────────────────────────────────────────────
  const getRegion = (lat) => {
    if (lat >= 55) return 'arctic';
    if (lat >= -55) return 'tropical';
    return 'antarctic';
  };

  // ── Zoom theo vùng ───────────────────────────────────────────────────────────
  const zoomToRegion = useCallback((region) => {
    if (!leafletMap.current) return;
    const configs = {
      all:        { center: [20, 0],    zoom: 2 },
      arctic:     { center: [80, 0],    zoom: 3 },
      tropical:   { center: [15, 100],  zoom: 3 },
      antarctic:  { center: [-75, 0],   zoom: 3 },
    };
    const cfg = configs[region] || configs.all;
    leafletMap.current.setView(cfg.center, cfg.zoom, { animate: true });
  }, []);

  // ── Khởi tạo map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (leafletMap.current || !mapRef.current || !window.L) return;

    leafletMap.current = window.L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      maxBoundsViscosity: 1.0,
    });

    markersLayer.current = window.L.layerGroup().addTo(leafletMap.current);
    orbitLayer.current   = window.L.layerGroup().addTo(leafletMap.current);

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // ── Tile layer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletMap.current || !window.L) return;
    if (tileLayerRef.current) leafletMap.current.removeLayer(tileLayerRef.current);

    const urls = {
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      osm:       'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      topo:      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    };
    const attrs = {
      satellite: '&copy; Esri World Imagery • NASA Aura/OMI',
      osm:       '&copy; OpenStreetMap contributors • NASA Aura/OMI',
      topo:      '&copy; Esri World Topo • NASA Aura/OMI',
    };

    tileLayerRef.current = window.L.tileLayer(urls[baseMap] || urls.satellite, {
      maxZoom: 18,
      attribution: attrs[baseMap] || attrs.satellite,
    }).addTo(leafletMap.current);
  }, [baseMap]);

  // ── Vẽ điểm đo (circles hoặc heatmap canvas) ─────────────────────────────────
  useEffect(() => {
    if (!leafletMap.current || !markersLayer.current || !window.L) return;

    // Xóa layer cũ
    markersLayer.current.clearLayers();
    if (heatLayer.current) {
      leafletMap.current.removeLayer(heatLayer.current);
      heatLayer.current = null;
    }

    const allPoints = mode === 'grid'
      ? gridData.map(d => ({ lat: d.lat_bin, lon: d.lon_bin, val: d.ozone_column_mean }))
      : rawData.map(d => ({ lat: d.latitude,  lon: d.longitude,  val: d.ozone_column_raw }));

    // Lọc theo vùng
    const points = allPoints.filter(p => {
      if (p.lat == null || p.lon == null) return false;
      if (regionFilter === 'all') return true;
      return getRegion(p.lat) === regionFilter;
    });

    // Giới hạn 800 điểm để tránh lag
    const step = Math.max(1, Math.floor(points.length / 800));
    const sampled = points.filter((_, i) => i % step === 0);

    if (enableHeatmap) {
      // ── HEATMAP dùng leaflet.heat ─────────────────────────────────────────
      // Mỗi điểm = [lat, lon, intensity]
      // intensity = 1 - ozone_du/500 → vùng ozone thấp (suy giảm) = intensity CAO = màu đỏ
      // vùng ozone cao (an toàn) = intensity thấp = màu xanh
      // Giống ảnh heat map: đỏ = nguy hiểm, xanh = an toàn
      if (!window.L.heatLayer) return; // Plugin chưa load

      const heatData = sampled
        .filter(p => p.val != null)
        .map(p => {
          // Normalize: ozone thấp → intensity cao (nóng đỏ), ozone cao → intensity thấp (xanh)
          const minDU = 120, maxDU = 400;
          const clamped = Math.max(minDU, Math.min(maxDU, p.val));
          const intensity = 1 - (clamped - minDU) / (maxDU - minDU); // 0=xanh lạnh, 1=đỏ nóng
          return [p.lat, p.lon, intensity];
        });

      heatLayer.current = window.L.heatLayer(heatData, {
        radius:    25,     // Bán kính mỗi điểm (px) - lớn để phủ liền nhau
        blur:      20,     // Mờ viền để blend liền mạch
        maxZoom:   10,
        max:       1.0,
        minOpacity: 0.4,   // Luôn thấy dù vùng thưa
        gradient: {
          // Màu từ ozone cao (xanh lam/xanh lục) → thấp (vàng → đỏ → đen)
          // Tương tự ảnh: xanh dương=lạnh/an toàn, đỏ=nóng/nguy hiểm
          0.0:  '#313695', // xanh đậm - ozone rất cao (> 380 DU)
          0.2:  '#4575b4', // xanh dương - cao (330-380 DU)
          0.4:  '#74add1', // xanh nhạt - chuẩn (280-330 DU)
          0.55: '#abd9e9', // xanh cyan - bình thường
          0.65: '#fee090', // vàng nhạt - trung bình (240-280 DU)
          0.75: '#fdae61', // cam - thấp (220-240 DU)
          0.85: '#f46d43', // cam đậm - cảnh báo (200-220 DU)
          0.92: '#d73027', // đỏ - nguy hiểm (< 200 DU)
          1.0:  '#a50026', // đỏ sẫm - rất nguy hiểm (< 170 DU)
        },
      });

      heatLayer.current.addTo(leafletMap.current);

    } else {
      // ── CIRCLE MARKERS thường ────────────────────────────────────────────────
      sampled.forEach(p => {
        const color = getOzoneColor(p.val);
        const circle = window.L.circleMarker([p.lat, p.lon], {
          radius:      mode === 'grid' ? 5 : 3.5,
          fillColor:   color,
          color:       '#ffffff',
          weight:      0.5,
          opacity:     0.9,
          fillOpacity: 0.8,
        });
        circle.bindPopup(`
          <div style="font-size:12px;padding:4px;line-height:1.5">
            <div style="color:#475569">Tọa độ: <b>${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°</b></div>
            <div>Ozone: <b style="color:${color}">${p.val != null ? p.val.toFixed(1) : 'N/A'} DU</b></div>
          </div>
        `);
        markersLayer.current.addLayer(circle);
      });
    }
  }, [gridData, rawData, mode, regionFilter, enableHeatmap]);

  // ── Quỹ đạo vệ tinh ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletMap.current || !orbitLayer.current || !window.L) return;
    orbitLayer.current.clearLayers();
    if (!showOrbit || !rawData || rawData.length === 0) return;

    const sorted = [...rawData].sort(
      (a, b) => (a.seconds_in_day || a.point_index || 0) - (b.seconds_in_day || b.point_index || 0)
    );

    const nadirPts = sorted.filter((p, i) => {
      if (p.pixel_index != null) return p.pixel_index === 29 || p.pixel_index === 30;
      return i % 10 === 0;
    });
    const trackSrc = nadirPts.length >= 2 ? nadirPts : sorted.filter((_, i) => i % 5 === 0);
    const trackPoints = trackSrc.map(p => ({ lat: p.latitude, lon: p.longitude, sec: p.seconds_in_day || 0 }));

    if (trackPoints.length < 2) return;

    // Tách đoạn khi vượt antimeridian
    const segments = [];
    let seg = [];
    trackPoints.forEach(pt => {
      if (seg.length && Math.abs(pt.lon - seg[seg.length - 1].lon) > 180) {
        segments.push(seg); seg = [];
      }
      seg.push(pt);
    });
    if (seg.length) segments.push(seg);

    segments.forEach(s => {
      const polyline = window.L.polyline(s.map(p => [p.lat, p.lon]), {
        color: '#38bdf8', weight: 2, opacity: 0.9, dashArray: '6 5',
      });
      polyline.bindPopup('<div style="font-size:12px">Đường bay Nadir — Vệ tinh Aura OMI</div>');
      orbitLayer.current.addLayer(polyline);
    });

    // Marker vệ tinh tại điểm cuối
    const latest = trackPoints[trackPoints.length - 1];
    if (latest?.lat != null) {
      const icon = window.L.divIcon({
        className: '',
        html: `<div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center">
                 <div style="position:absolute;width:26px;height:26px;background:rgba(14,165,233,0.35);border-radius:50%;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite"></div>
                 <div style="font-size:18px">🛰️</div>
               </div>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      const marker = window.L.marker([latest.lat, latest.lon], { icon });
      marker.bindPopup(`
        <div style="font-size:12px;padding:4px;line-height:1.6">
          <b>Vệ tinh NASA Aura (OMI)</b><br/>
          Tọa độ: <b>${latest.lat.toFixed(2)}°, ${latest.lon.toFixed(2)}°</b>
        </div>
      `);
      orbitLayer.current.addLayer(marker);
    }
  }, [showOrbit, rawData]);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const regionLabels = {
    all:       'Toàn cầu',
    arctic:    'Bắc Cực',
    tropical:  'Nhiệt đới',
    antarctic: 'Nam Cực',
  };
  const regionDesc = {
    all:       'Cực Bắc → Xích Đạo → Cực Nam',
    arctic:    '> 55°N — 200-240 DU',
    tropical:  '-55° ~ +55° — 240-330 DU',
    antarctic: '< -55°S — 120-220 DU (Suy giảm)',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[560px]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="p-3 border-b border-slate-100 bg-slate-50 flex flex-col gap-2.5">

        {/* Title */}
        <div>
          <h3 className="font-bold text-slate-800 text-sm">
            Bản đồ Không gian Ozone — Vệ tinh Aura (Toàn Cầu)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            14-15 quỹ đạo/ngày • Phủ sóng từ Cực Bắc (+90°) đến Cực Nam (-90°)
          </p>
        </div>

        {/* Row 1: Lọc vùng */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 shrink-0">Vùng:</span>
          <div className="flex items-center bg-slate-200 p-0.5 rounded-lg gap-0.5">
            {(['all','arctic','tropical','antarctic']).map(r => (
              <button
                key={r}
                onClick={() => { setRegionFilter(r); zoomToRegion(r); }}
                title={regionDesc[r]}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                  regionFilter === r
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {regionLabels[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Điều khiển */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lớp nền */}
          <div className="flex items-center bg-slate-200 p-0.5 rounded-lg gap-0.5">
            {[['satellite','Vệ tinh'],['osm','Bản đồ'],['topo','Địa hình']].map(([k,l]) => (
              <button
                key={k}
                onClick={() => setBaseMap(k)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
                  baseMap === k
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Quỹ đạo toggle */}
          <button
            onClick={() => setShowOrbit(v => !v)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
              showOrbit
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Quỹ đạo
          </button>

          {/* Heatmap toggle */}
          <button
            onClick={() => setEnableHeatmap(v => !v)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
              enableHeatmap
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
            title="Chế độ Heat Map: vẽ vùng tỏa màu theo nồng độ Ozone"
          >
            {enableHeatmap ? 'Heat Map (Bật)' : 'Heat Map'}
          </button>
        </div>

        {/* Row 3: Chú giải DU */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          {enableHeatmap ? (
            <>
              <span className="font-semibold text-slate-700 shrink-0">Heat Map (Ozone DU):</span>
              <span className="flex items-center gap-1"><span className="w-14 h-2 rounded" style={{background:'linear-gradient(to right,#313695,#4575b4,#74add1,#fee090,#f46d43,#d73027,#a50026)'}}></span></span>
              <span className="text-slate-500">Xanh đậm = Ozone cao (an toàn)</span>
              <span className="text-slate-500">→</span>
              <span className="text-red-600 font-semibold">Đỏ sẫm = Ozone thấp (suy giảm)</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-700 shrink-0">Ozone (DU):</span>
              {[
                ['bg-red-900','< 200 (Thủng)'],
                ['bg-red-600','200-240'],
                ['bg-amber-500','240-280'],
                ['bg-emerald-500','280-330 (Chuẩn)'],
                ['bg-sky-500','330-380'],
                ['bg-indigo-600','> 380'],
              ].map(([cls, lbl]) => (
                <span key={lbl} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${cls} shrink-0`}></span>
                  <span>{lbl}</span>
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Map container ───────────────────────────────────────────────────── */}
      <div ref={mapRef} className="flex-1 w-full" id="map" />
    </div>
  );
}
