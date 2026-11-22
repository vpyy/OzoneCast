/**
 * Cấu hình vùng mục tiêu và các ngưỡng chuẩn cho dự án OzoneCast.
 * Vùng quan trắc trọng tâm: Bán đảo Nam Cực (Antarctic Peninsula)
 */

export const REGION = {
  latMin: Number(import.meta.env.VITE_REGION_LAT_MIN ?? -70),
  latMax: Number(import.meta.env.VITE_REGION_LAT_MAX ?? -63),
  lonMin: Number(import.meta.env.VITE_REGION_LON_MIN ?? -75),
  lonMax: Number(import.meta.env.VITE_REGION_LON_MAX ?? -55),
  name: "Bán đảo Nam Cực",
  product: "OMI/Aura L2G OMTO3G (0.25° x 0.25°)"
};

// Khung giới hạn Leaflet dạng [[latMin, lonMin], [latMax, lonMax]]
export const REGION_BOUNDS = [
  [REGION.latMin, REGION.lonMin],
  [REGION.latMax, REGION.lonMax]
];

// Khung giới hạn tối đa có padding (~3 độ) để khóa map, không cho kéo đi khắp thế giới
export const REGION_MAX_BOUNDS = [
  [REGION.latMin - 3, REGION.lonMin - 3],
  [REGION.latMax + 3, REGION.lonMax + 3]
];

// Tâm vùng quan sát
export const REGION_CENTER = [
  (REGION.latMin + REGION.latMax) / 2,
  (REGION.lonMin + REGION.lonMax) / 2
];

// Các ngưỡng lọc và phân loại chất lượng Ozone
export const OZONE_VALID_MIN = 50.0;
export const OZONE_VALID_MAX = 700.0;
export const OZONE_HOLE_THRESHOLD = 220.0;

// Thang màu chuẩn theo Dobson Units (DU)
export const OZONE_COLOR_SCALE = [
  { max: 200, color: '#7f1d1d', label: '< 200 DU (Thủng nghiêm trọng)', bg: 'bg-red-900' },
  { max: 220, color: '#b91c1c', label: '200-220 DU (Lỗ thủng Ozone)', bg: 'bg-red-700' },
  { max: 240, color: '#dc2626', label: '220-240 DU (Suy giảm)', bg: 'bg-red-600' },
  { max: 280, color: '#f59e0b', label: '240-280 DU (Thấp)', bg: 'bg-amber-500' },
  { max: 330, color: '#10b981', label: '280-330 DU (Bình thường)', bg: 'bg-emerald-500' },
  { max: 380, color: '#0284c7', label: '330-380 DU (Cao)', bg: 'bg-sky-600' },
  { max: 9999, color: '#4338ca', label: '> 380 DU (Rất cao)', bg: 'bg-indigo-700' },
];

export function getOzoneColor(du) {
  if (du == null || isNaN(du)) return '#94a3b8';
  for (const tier of OZONE_COLOR_SCALE) {
    if (du < tier.max) return tier.color;
  }
  return '#4338ca';
}
