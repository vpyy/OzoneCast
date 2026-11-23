import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
  REGION, 
  REGION_BOUNDS, 
  REGION_CENTER, 
  OZONE_VALID_MIN, 
  OZONE_VALID_MAX, 
  OZONE_HOLE_THRESHOLD, 
  OZONE_COLOR_SCALE, 
  getOzoneColor 
} from '../config/region';
import { RotateCcw, Globe, MapPin, Flame, Grid as GridIcon, CircleDot, AlertTriangle, Calendar, Info, RefreshCw } from 'lucide-react';

// Sửa lỗi đường dẫn icon mặc định của Leaflet trong môi trường Vite
if (typeof window !== 'undefined' && window.L && window.L.Icon && window.L.Icon.Default) {
  delete window.L.Icon.Default.prototype._getIconUrl;
  window.L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export default function OzoneMap({ 
  gridData = [], 
  rawData = [], 
  mode = 'grid',
  loading = false,
  onRefresh = null 
}) {
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const regionBoundaryLayerRef = useRef(null);
  const featureLayerGroupRef = useRef(null);
  const heatLayerRef = useRef(null);

  // ── States ─────────────────────────────────────────────────────────────────
  const [baseMap, setBaseMap] = useState('satellite'); // 'satellite' | 'osm' | 'topo'
  const [activeLayer, setActiveLayer] = useState(mode || 'grid'); // 'grid' | 'heat' | 'raw'
  const [selectedDate, setSelectedDate] = useState('all');
  const [currentZoom, setCurrentZoom] = useState(4);
  const [cursorCoords, setCursorCoords] = useState(null); // { lat: number, lon: number } | null

  // Đồng bộ prop mode từ component cha
  useEffect(() => {
    if (mode === 'grid' || mode === 'raw') {
      setActiveLayer(mode);
    }
  }, [mode]);

  // ── 1. Lọc và chuẩn hóa dữ liệu Bán đảo Nam Cực ─────────────────────────────
  const { cleanPoints, droppedCount, availableDates, stats } = useMemo(() => {
    const candidates = [];

    // Lấy dữ liệu từ rawData (ưu tiên) hoặc gridData
    if (Array.isArray(rawData) && rawData.length > 0) {
      for (let i = 0; i < rawData.length; i++) {
        const p = rawData[i];
        candidates.push({
          lat: p.latitude,
          lon: p.longitude,
          val: p.ozone_column_raw,
          granule: p.granule_name,
          createdAt: p.created_at,
          sza: p.solar_zenith_angle,
          cloud: p.radiative_cloud_fraction,
          reflectivity: p.reflectivity331,
          quality: p.quality_flag,
          source: 'raw'
        });
      }
    } else if (Array.isArray(gridData) && gridData.length > 0) {
      for (let i = 0; i < gridData.length; i++) {
        const g = gridData[i];
        candidates.push({
          lat: g.lat_bin,
          lon: g.lon_bin,
          val: g.ozone_column_mean,
          granule: g.source_filename,
          createdAt: g.timestamp,
          source: 'grid'
        });
      }
    }

    let dropped = 0;
    const valid = [];
    const dateSet = new Set();

    for (let i = 0; i < candidates.length; i++) {
      const pt = candidates[i];
      const lat = Number(pt.lat);
      const lon = Number(pt.lon);
      const val = Number(pt.val);

      // Kiểm tra tính hợp lệ của tọa độ và giá trị số
      if (isNaN(lat) || isNaN(lon) || isNaN(val) || pt.lat === null || pt.lon === null || pt.val === null) {
        dropped++;
        continue;
      }

      // Giới hạn trong vùng Bán đảo Nam Cực
      if (lat < REGION.latMin || lat > REGION.latMax || lon < REGION.lonMin || lon > REGION.lonMax) {
        dropped++;
        continue;
      }

      // Lọc bỏ fill value hoặc ngoài ngưỡng vật lý [OZONE_VALID_MIN, OZONE_VALID_MAX]
      if (val < OZONE_VALID_MIN || val > OZONE_VALID_MAX) {
        dropped++;
        continue;
      }

      // Trích xuất ngày quan sát (YYYY-MM-DD)
      let dateStr = null;
      if (pt.createdAt) {
        dateStr = String(pt.createdAt).substring(0, 10);
      } else if (pt.granule) {
        const m = String(pt.granule).match(/_(\d{4})m(\d{2})(\d{2})/);
        if (m) {
          dateStr = m[1] + '-' + m[2] + '-' + m[3];
        }
      }

      if (dateStr) {
        dateSet.add(dateStr);
      }

      valid.push({
        ...pt,
        lat: lat,
        lon: lon,
        val: val,
        dateStr: dateStr || 'N/A'
      });
    }

    const sortedDates = Array.from(dateSet).sort().reverse();

    // Thống kê nhanh trong vùng
    let sum = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    let holeCount = 0;

    for (let i = 0; i < valid.length; i++) {
      const v = valid[i];
      sum += v.val;
      if (v.val < minVal) minVal = v.val;
      if (v.val > maxVal) maxVal = v.val;
      if (v.val < OZONE_HOLE_THRESHOLD) holeCount++;
    }

    const pointStats = valid.length > 0 ? {
      avg: Number((sum / valid.length).toFixed(1)),
      min: Number(minVal.toFixed(1)),
      max: Number(maxVal.toFixed(1)),
      holeCount: holeCount,
      count: valid.length
    } : { avg: 0, min: 0, max: 0, holeCount: 0, count: 0 };

    return {
      cleanPoints: valid,
      droppedCount: dropped,
      availableDates: sortedDates,
      stats: pointStats
    };
  }, [rawData, gridData]);

  // Giữ mặc định 'all' để theo dõi dữ liệu real-time nạp vào liên tục
  useEffect(() => {
    if (selectedDate !== 'all' && availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate('all');
    }
  }, [availableDates, selectedDate]);

  // Lọc theo ngày được chọn
  const filteredPoints = useMemo(() => {
    if (!selectedDate || selectedDate === 'all') {
      return cleanPoints;
    }
    return cleanPoints.filter(function (p) {
      return p.dateStr === selectedDate;
    });
  }, [cleanPoints, selectedDate]);

  // ── 2. Gom ô lưới 0.25° x 0.25° theo chuẩn OMI OMTO3G ─────────────────────
  const gridCells = useMemo(() => {
    const cellMap = new Map();

    for (let i = 0; i < filteredPoints.length; i++) {
      const p = filteredPoints[i];
      const r = Math.floor((p.lat - (-90.0)) / 0.25);
      const c = Math.floor((p.lon - (-180.0)) / 0.25);
      const cellKey = r + '_' + c;

      const latMin = -90.0 + r * 0.25;
      const latMax = latMin + 0.25;
      const lonMin = -180.0 + c * 0.25;
      const lonMax = lonMin + 0.25;
      const centerLat = latMin + 0.125;
      const centerLon = lonMin + 0.125;

      if (!cellMap.has(cellKey)) {
        cellMap.set(cellKey, {
          key: cellKey,
          bounds: [[latMin, lonMin], [latMax, lonMax]],
          center: [centerLat, centerLon],
          latMin: latMin,
          latMax: latMax,
          lonMin: lonMin,
          lonMax: lonMax,
          sumVal: p.val,
          minVal: p.val,
          maxVal: p.val,
          count: 1,
          dateStr: p.dateStr,
          granule: p.granule
        });
      } else {
        const item = cellMap.get(cellKey);
        item.sumVal += p.val;
        item.count += 1;
        if (p.val < item.minVal) item.minVal = p.val;
        if (p.val > item.maxVal) item.maxVal = p.val;
      }
    }

    const cellList = [];
    cellMap.forEach(function (cell) {
      const avg = Number((cell.sumVal / cell.count).toFixed(1));
      cellList.push({
        ...cell,
        avgVal: avg
      });
    });

    return cellList;
  }, [filteredPoints]);

  // ── 3. Khởi tạo Bản đồ Thế giới Toàn Cầu (Toàn Map, Không Giới Hạn) ─────────
  const initMap = useCallback(() => {
    const L = window.L;
    if (!mapContainerRef.current || !L || leafletMapRef.current) return;

    // Bản đồ TOÀN CẦU: cho phép pan/zoom tự do từ zoom 1 (toàn cầu) đến zoom 18
    const map = L.map(mapContainerRef.current, {
      center: REGION_CENTER,
      zoom: 4,
      minZoom: 1,
      maxZoom: 18,
      worldCopyJump: true,
      preferCanvas: true,
      zoomControl: false
    });

    // Nút điều khiển zoom ở góc trên bên phải
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Vẽ khung chữ nhật đánh dấu phạm vi Bán đảo Nam Cực trên bản đồ thế giới
    const boundary = L.rectangle(REGION_BOUNDS, {
      color: '#0284c7',
      weight: 2,
      dashArray: '6, 6',
      fill: false,
      interactive: true
    }).bindTooltip('📍 Khu vực trắc địa Bán đảo Nam Cực (-70° đến -63° vĩ Nam, -75° đến -55° kinh Tây)', {
      permanent: false,
      direction: 'top',
      className: 'bg-slate-900 text-white text-xs px-2 py-1 rounded shadow'
    });
    boundary.addTo(map);
    regionBoundaryLayerRef.current = boundary;

    // LayerGroup chứa các đối tượng dữ liệu quan trắc
    const group = L.layerGroup().addTo(map);
    featureLayerGroupRef.current = group;

    // Lắng nghe thay đổi mức zoom
    map.on('zoomend', function () {
      setCurrentZoom(map.getZoom());
    });

    // Lắng nghe di chuyển con trỏ chuột trên bản đồ để cập nhật tọa độ
    map.on('mousemove', function (e) {
      if (e && e.latlng) {
        setCursorCoords({
          lat: Number(e.latlng.lat.toFixed(4)),
          lon: Number(e.latlng.lng.toFixed(4))
        });
      }
    });

    map.on('mouseout', function () {
      setCursorCoords(null);
    });

    leafletMapRef.current = map;
  }, []);

  useEffect(() => {
    initMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [initMap]);

  // ── 4. Quản lý Lớp Nền Bản Đồ Toàn Cầu ─────────────────────────────────────
  useEffect(() => {
    const L = window.L;
    if (!leafletMapRef.current || !L) return;

    if (tileLayerRef.current) {
      leafletMapRef.current.removeLayer(tileLayerRef.current);
    }

    const tileSources = {
      satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri World Imagery • NASA Aura OMI'
      },
      osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors • OzoneCast'
      },
      topo: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri World Topo Map • NASA Aura'
      }
    };

    const selectedTile = tileSources[baseMap] || tileSources.satellite;

    // Tile Layer phủ kín toàn cầu, không giới hạn bounds
    tileLayerRef.current = L.tileLayer(selectedTile.url, {
      maxZoom: 18,
      minZoom: 1,
      attribution: selectedTile.attribution
    }).addTo(leafletMapRef.current);

    tileLayerRef.current.bringToBack();
  }, [baseMap]);

  // ── 5. Vẽ dữ liệu lên bản đồ: Grid 0.25° / Heat Map / Raw Points ────────────
  useEffect(() => {
    const L = window.L;
    if (!leafletMapRef.current || !featureLayerGroupRef.current || !L) return;

    // Xóa layer cũ
    featureLayerGroupRef.current.clearLayers();
    if (heatLayerRef.current) {
      leafletMapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (filteredPoints.length === 0) return;

    // ── LỚP 1: Ô LƯỚI 0.25° x 0.25° ──────────────────────────────────────────
    if (activeLayer === 'grid') {
      for (let i = 0; i < gridCells.length; i++) {
        const cell = gridCells[i];
        const color = getOzoneColor(cell.avgVal);
        const isDepleted = cell.avgVal < OZONE_HOLE_THRESHOLD;

        const rect = L.rectangle(cell.bounds, {
          color: isDepleted ? '#ef4444' : '#ffffff',
          weight: isDepleted ? 2.5 : 0.6,
          fillColor: color,
          fillOpacity: 0.78,
          smoothFactor: 0
        });

        rect.bindPopup(`
          <div style="font-family:system-ui,sans-serif;font-size:12px;padding:6px;line-height:1.6;min-width:180px;">
            <div style="font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;">
              🧊 Ô lưới OMI L2G (0.25° x 0.25°)
            </div>
            <div>Tọa độ tâm: <b>${cell.center[0].toFixed(2)}°S, ${Math.abs(cell.center[1]).toFixed(2)}°W</b></div>
            <div>Nồng độ Ozone TB: <b style="color:${color};font-size:13px;">${cell.avgVal} DU</b></div>
            <div>Số quan sát gộp: <b>${cell.count} điểm</b></div>
            <div>Biên độ ô: <b>${cell.minVal} - ${cell.maxVal} DU</b></div>
            ${isDepleted ? '<div style="margin-top:4px;padding:2px 6px;background:#fee2e2;color:#b91c1c;border-radius:4px;font-weight:700;text-align:center;">🚨 Lỗ thủng Ozone (&lt;220 DU)</div>' : ''}
            <div style="color:#64748b;font-size:11px;margin-top:4px;">Ngày đo: ${cell.dateStr}</div>
          </div>
        `);

        featureLayerGroupRef.current.addLayer(rect);
      }

    // ── LỚP 2: HEAT MAP (LEAFLET.HEAT) ────────────────────────────────────────
    } else if (activeLayer === 'heat') {
      if (typeof L.heatLayer !== 'function') {
        console.warn('Plugin leaflet.heat chưa sẵn sàng!');
        return;
      }

      // Ozone càng thấp càng NÓNG (Đỏ): intensity = clamp((380 - DU) / (380 - 150), 0, 1)
      const heatData = [];
      for (let i = 0; i < filteredPoints.length; i++) {
        const p = filteredPoints[i];
        const intensity = Math.max(0, Math.min(1, (380.0 - p.val) / (380.0 - 150.0)));
        heatData.push([p.lat, p.lon, intensity]);
      }

      const dynRadius = Math.max(14, Math.min(42, Math.round(Math.pow(1.6, currentZoom - 3) * 6)));
      const dynBlur = Math.max(10, Math.round(dynRadius * 0.75));

      heatLayerRef.current = L.heatLayer(heatData, {
        radius: dynRadius,
        blur: dynBlur,
        maxZoom: 18,
        max: 1.0,
        minOpacity: 0.35,
        gradient: {
          0.0:  '#0284c7', // Ozone cao >= 380 DU
          0.25: '#10b981', // 330 DU
          0.50: '#f59e0b', // 280 DU
          0.75: '#f97316', // 240 DU
          0.90: '#ef4444', // 220 DU (Ngưỡng Lỗ thủng)
          1.00: '#7f1d1d'  // < 150 DU (Thủng nghiêm trọng)
        }
      }).addTo(leafletMapRef.current);

    // ── LỚP 3: RAW MEASUREMENT POINTS (CIRCLE MARKERS) ───────────────────────
    } else if (activeLayer === 'raw') {
      const step = Math.max(1, Math.floor(filteredPoints.length / 2000));
      for (let i = 0; i < filteredPoints.length; i += step) {
        const p = filteredPoints[i];
        const color = getOzoneColor(p.val);
        const isDepleted = p.val < OZONE_HOLE_THRESHOLD;

        const circle = L.circleMarker([p.lat, p.lon], {
          radius: isDepleted ? 4.5 : 3.5,
          fillColor: color,
          color: isDepleted ? '#ef4444' : '#ffffff',
          weight: isDepleted ? 1.5 : 0.5,
          opacity: 0.95,
          fillOpacity: 0.85
        });

        circle.bindPopup(`
          <div style="font-family:system-ui,sans-serif;font-size:12px;padding:4px;line-height:1.5;">
            <div style="font-weight:700;color:#0f172a;">Quan trắc vệ tinh Aura OMI</div>
            <div>Tọa độ: <b>${p.lat.toFixed(3)}°S, ${Math.abs(p.lon).toFixed(3)}°W</b></div>
            <div>Cột Ozone: <b style="color:${color};">${p.val.toFixed(1)} DU</b></div>
            ${p.sza ? `<div>Góc mặt trời (SZA): <b>${Number(p.sza).toFixed(1)}°</b></div>` : ''}
            ${p.reflectivity ? `<div>Phản xạ 331nm: <b>${Number(p.reflectivity).toFixed(1)}%</b></div>` : ''}
            ${isDepleted ? '<div style="color:#dc2626;font-weight:700;margin-top:3px;">🚨 Suy giảm tầng Ozone (&lt;220 DU)</div>' : ''}
            <div style="color:#64748b;font-size:11px;margin-top:3px;">Thời điểm: ${p.createdAt || p.dateStr}</div>
          </div>
        `);

        featureLayerGroupRef.current.addLayer(circle);
      }
    }
  }, [filteredPoints, gridCells, activeLayer, currentZoom]);

  // ── 6. Chức năng Bay Về Nam Cực & Bay Ra Toàn Cầu ───────────────────────────
  const flyToAntarctica = useCallback(() => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.flyToBounds(REGION_BOUNDS, { padding: [40, 40], duration: 1.2 });
  }, []);

  const flyToGlobal = useCallback(() => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.flyTo([-20, 0], 2, { duration: 1.2 });
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[620px] relative">
      
      {/* ── HEADER BẢN ĐỒ ─────────────────────────────────────────────────── */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
        
        {/* Hàng 1: Tiêu đề và Phím điều hướng góc nhìn */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sky-600" />
                Bản đồ Không gian Ozone Toàn cầu — Trọng tâm Bán đảo Nam Cực
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                Lưới 0.25° OMI OMTO3
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Bản đồ toàn cầu tự do • Vùng quan trắc: {REGION.latMin}°S đến {REGION.latMax}°S, {Math.abs(REGION.lonMin)}°W đến {Math.abs(REGION.lonMax)}°W
            </p>
          </div>

          {/* Phím điều hướng: Về Nam Cực & Xem Toàn cầu */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            <button
              onClick={flyToGlobal}
              title="Xem toàn bộ quả địa cầu"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-sky-700 shadow-sm transition-all"
            >
              <Globe className="w-3.5 h-3.5 text-slate-600" />
              <span>Toàn cầu</span>
            </button>

            <button
              onClick={flyToAntarctica}
              title="Lướt nhanh về vùng quan sát Bán đảo Nam Cực"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
              <span>Về Nam Cực</span>
            </button>

            {/* Bộ chọn ngày quan trắc */}
            {availableDates.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
                >
                  <option value="all">Tất cả ngày ({cleanPoints.length} điểm)</option>
                  {availableDates.map(function (d) {
                    const cnt = cleanPoints.filter(p => p.dateStr === d).length;
                    return <option key={d} value={d}>Ngày {d} ({cnt} điểm)</option>;
                  })}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Hàng 2: Các chế độ lớp dữ liệu và nền bản đồ */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
          
          {/* Lựa chọn lớp dữ liệu: Grid 0.25° / Heatmap / Raw */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 mr-1">Chế độ xem:</span>
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg gap-1">
              <button
                onClick={() => setActiveLayer('grid')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeLayer === 'grid'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GridIcon className="w-3.5 h-3.5" />
                <span>Grid 0.25° ({gridCells.length})</span>
              </button>

              <button
                onClick={() => setActiveLayer('heat')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeLayer === 'heat'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Heat Map</span>
              </button>

              <button
                onClick={() => setActiveLayer('raw')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeLayer === 'raw'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CircleDot className="w-3.5 h-3.5" />
                <span>Điểm thô ({filteredPoints.length})</span>
              </button>
            </div>
          </div>

          {/* Lựa chọn nền bản đồ (Satellite, OSM, Topo) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 mr-1">Nền bản đồ:</span>
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg gap-0.5">
              {[
                ['satellite', 'Vệ tinh (Esri)'],
                ['osm', 'Bản đồ (OSM)'],
                ['topo', 'Địa hình']
              ].map(function (item) {
                const k = item[0];
                const label = item[1];
                return (
                  <button
                    key={k}
                    onClick={() => setBaseMap(k)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      baseMap === k
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Hàng 3: Chú giải nồng độ Ozone */}
        <div className="flex flex-wrap items-center justify-between gap-y-1 text-xs pt-1 border-t border-slate-200/50">
          {activeLayer === 'heat' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700 shrink-0">Thang nhiệt Ozone:</span>
              <div 
                className="w-36 h-2.5 rounded shadow-inner"
                style={{
                  background: 'linear-gradient(to right, #0284c7, #10b981, #f59e0b, #f97316, #ef4444, #7f1d1d)'
                }}
              />
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-sky-700 font-semibold">Ozone dày (An toàn &gt;330 DU)</span>
                <span className="text-slate-400">→</span>
                <span className="text-red-700 font-bold">Lỗ thủng Ozone (&lt;220 DU, Nguy hiểm)</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold text-slate-700 shrink-0">Ozone (DU):</span>
              {OZONE_COLOR_SCALE.map(function (item) {
                return (
                  <span key={item.label} className="flex items-center gap-1 text-[11px]">
                    <span className={`w-2.5 h-2.5 rounded-sm ${item.bg} shrink-0 border border-slate-300/50`} />
                    <span className="text-slate-600">{item.label}</span>
                  </span>
                );
              })}
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 border-l border-slate-300 pl-2">
                🚨 Ngưỡng thủng: 220 DU
              </span>
            </div>
          )}

          {droppedCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              <Info className="w-3 h-3 text-slate-400" />
              <span>Đã lọc {droppedCount.toLocaleString()} điểm ngoài vùng / lỗi</span>
            </div>
          )}
        </div>
      </div>

      {/* ── MAP CANVAS (TOÀN MAP THẾ GIỚI) ────────────────────────────────── */}
      <div className="flex-1 w-full h-full relative" style={{ minHeight: '380px' }}>
        <div ref={mapContainerRef} className="w-full h-full" id="ozone-leaflet-map" />

        {/* Empty State */}
        {!loading && filteredPoints.length === 0 && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[500] flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-700 shadow-xl max-w-md">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-slate-100">Chưa có dữ liệu cho Bán đảo Nam Cực</h4>
              <p className="text-xs text-slate-300 mt-1">
                Không tìm thấy quan trắc hợp lệ trong phạm vi tọa độ vĩ Nam [-70°, -63°] và kinh Tây [-75°, -55°].
              </p>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 mx-auto transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tải lại dữ liệu</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="absolute top-3 left-3 z-[500] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-md flex items-center gap-2 text-xs font-semibold text-slate-700">
            <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" />
            <span>Đang nạp dữ liệu Bán đảo Nam Cực...</span>
          </div>
        )}

        {/* Thống kê vùng góc dưới bên trái */}
        {filteredPoints.length > 0 && (
          <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/85 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[11px] shadow-lg border border-slate-700 flex items-center gap-3">
            <div>
              <span className="text-slate-400">Trung bình vùng: </span>
              <span className="font-bold text-sky-400">{stats.avg} DU</span>
            </div>
            <div className="border-l border-slate-700 pl-3">
              <span className="text-slate-400">Dao động: </span>
              <span className="font-semibold text-slate-200">{stats.min} - {stats.max} DU</span>
            </div>
            {stats.holeCount > 0 && (
              <div className="border-l border-slate-700 pl-3 text-red-400 font-bold flex items-center gap-1">
                <span>🚨 {stats.holeCount} điểm &lt;220 DU</span>
              </div>
            )}
          </div>
        )}

        {/* Hiển thị Tọa độ Con trỏ chuột Realtime (Góc dưới bên phải) */}
        {cursorCoords && (
          <div className="absolute bottom-3 right-3 z-[400] bg-slate-900/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[11px] font-mono shadow-lg border border-slate-700 flex items-center gap-2 pointer-events-none select-none">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Vĩ độ (Lat):</span>
            <span className="font-semibold text-slate-100">{cursorCoords.lat > 0 ? `+${cursorCoords.lat}°N` : `${cursorCoords.lat}°S`}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Kinh độ (Lon):</span>
            <span className="font-semibold text-slate-100">{cursorCoords.lon > 0 ? `+${cursorCoords.lon}°E` : `${cursorCoords.lon}°W`}</span>
          </div>
        )}
      </div>

    </div>
  );
}
