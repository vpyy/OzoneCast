import React, { useEffect, useRef } from 'react';

export default function OzoneMap({ gridData = [], rawData = [], mode = 'grid' }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersLayer = useRef(null);

  const getOzoneColor = (du) => {
    if (du < 200) return '#7f1d1d'; // severe depletion
    if (du < 240) return '#b91c1c'; // warning low
    if (du < 280) return '#f59e0b'; // moderate
    if (du < 330) return '#10b981'; // normal safe
    if (du < 380) return '#0284c7'; // elevated
    return '#4338ca'; // high
  };

  useEffect(() => {
    if (!leafletMap.current && mapRef.current && window.L) {
      leafletMap.current = window.L.map(mapRef.current).setView([15.0, 105.0], 3);
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap &copy; CARTO &copy; NASA'
      }).addTo(leafletMap.current);

      markersLayer.current = window.L.layerGroup().addTo(leafletMap.current);
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!leafletMap.current || !markersLayer.current || !window.L) return;

    markersLayer.current.clearLayers();
    const bounds = [];

    const points = mode === 'grid' 
      ? gridData.map(d => ({ lat: d.lat_bin, lon: d.lon_bin, val: d.ozone_column_mean, label: 'Grid Mean' }))
      : rawData.map(d => ({ lat: d.latitude, lon: d.longitude, val: d.ozone_column_raw, label: 'Raw Point' }));

    const step = Math.max(1, Math.floor(points.length / 450));
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      if (p.lat == null || p.lon == null) continue;

      bounds.push([p.lat, p.lon]);
      const color = getOzoneColor(p.val);

      const circle = window.L.circleMarker([p.lat, p.lon], {
        radius: mode === 'grid' ? 6 : 4,
        fillColor: color,
        color: '#ffffff',
        weight: 0.5,
        opacity: 0.9,
        fillOpacity: 0.85
      });

      circle.bindPopup(`
        <div class="text-xs p-1">
          <div class="font-bold text-slate-800">${p.label}</div>
          <div>Coord: <b>${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°</b></div>
          <div>Ozone: <span class="font-bold" style="color: ${color}">${p.val.toFixed(1)} DU</span></div>
        </div>
      `);

      markersLayer.current.addLayer(circle);
    }

    if (bounds.length > 0) {
      leafletMap.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });
    }
  }, [gridData, rawData, mode]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px]">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Spatial Ozone Distribution Map (NASA L2 Swath)</h3>
          <p className="text-xs text-slate-500">Visualizing total column ozone in Dobson Units (DU)</p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="flex items-center space-x-1"><span className="w-3 h-3 rounded-full bg-[#7f1d1d] inline-block"></span><span>&lt;200</span></span>
          <span className="flex items-center space-x-1"><span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block"></span><span>240-280</span></span>
          <span className="flex items-center space-x-1"><span className="w-3 h-3 rounded-full bg-[#10b981] inline-block"></span><span>280-330 (Normal)</span></span>
          <span className="flex items-center space-x-1"><span className="w-3 h-3 rounded-full bg-[#0284c7] inline-block"></span><span>330-380</span></span>
          <span className="flex items-center space-x-1"><span className="w-3 h-3 rounded-full bg-[#4338ca] inline-block"></span><span>&gt;380 DU</span></span>
        </div>
      </div>
      <div ref={mapRef} className="flex-1 w-full" id="map"></div>
    </div>
  );
}

