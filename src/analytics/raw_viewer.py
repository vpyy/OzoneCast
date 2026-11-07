import os
import json
import webbrowser
from pathlib import Path
from typing import Optional
import h5py
import numpy as np
import pandas as pd
from datetime import datetime

from config.settings import settings
from src.db.models import engine

class RawDataViewer:
    """Extracts raw granule swaths directly into SQLite and Interactive Web Table"""

    @staticmethod
    def extract_raw_dataframe(file_path: str, max_rows: int = 5000) -> pd.DataFrame:
        """Reads raw arrays from HDF-EOS5 without filtering or modifying values"""
        p = Path(file_path)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        with h5py.File(file_path, "r") as h5:
            # Find swath root
            swaths_root = "HDFEOS/SWATHS"
            if swaths_root not in h5:
                # Fallback to scanning all datasets
                datasets = {}
                def visitor(name, obj):
                    if isinstance(obj, h5py.Dataset):
                        datasets[name] = obj
                h5.visititems(visitor)
                raise ValueError(f"HDFEOS/SWATHS not found in {file_path}. Found datasets: {list(datasets.keys())[:5]}")

            subswath = list(h5[swaths_root].keys())[0]
            swath_base = f"{swaths_root}/{subswath}"
            geo_base = f"{swath_base}/Geolocation Fields"
            data_base = f"{swath_base}/Data Fields"

            lats = np.array(h5[f"{geo_base}/Latitude"]).flatten()
            lons = np.array(h5[f"{geo_base}/Longitude"]).flatten()
            ozone = np.array(h5[f"{data_base}/ColumnAmountO3"]).flatten()

            times = None
            if f"{geo_base}/Time" in h5:
                times = np.array(h5[f"{geo_base}/Time"]).flatten()

            quality = None
            for qf in ["QualityFlags", "AlgorithmFlags", "ProcessingFlags"]:
                if f"{data_base}/{qf}" in h5:
                    quality = np.array(h5[f"{data_base}/{qf}"]).flatten()
                    break

        total_points = len(lats)
        # Limit rows for interactive preview table if dataset has millions of points
        step = max(1, total_points // max_rows)
        indices = np.arange(0, total_points, step)[:max_rows]

        df = pd.DataFrame({
            "point_index": indices,
            "latitude": np.round(lats[indices], 4),
            "longitude": np.round(lons[indices], 4),
            "ozone_column_raw": np.round(ozone[indices], 2),
            "quality_flag": quality[indices] if quality is not None else 0,
            "time_raw": times[indices] if times is not None else 0
        })

        return df, total_points

    @classmethod
    def save_raw_to_db(cls, file_path: str, table_name: str = "raw_measurements"):
        """Saves raw measurement rows into SQLite database table"""
        df, total_points = cls.extract_raw_dataframe(file_path, max_rows=10000)
        df["source_file"] = Path(file_path).name
        df["extracted_at"] = datetime.utcnow()

        df.to_sql(table_name, con=engine, if_exists="replace", index=False)
        print(f"[DB] Đã lưu {len(df)} dòng dữ liệu thô vào bảng '{table_name}' trong SQLite (Tổng điểm quét gốc: {total_points:,}).")

    @classmethod
    def generate_raw_web_viewer(cls, file_path: str, output_html: Optional[str] = None) -> str:
        """Generates a rich interactive web viewer with DataTables and Leaflet Map"""
        df, total_points = cls.extract_raw_dataframe(file_path, max_rows=3000)
        output_html = output_html or str(Path(settings.DATA_RAW_DIR).parent / "raw_data_viewer.html")

        # Save to SQLite table as well
        cls.save_raw_to_db(file_path)

        # Statistics
        valid_o3 = df[df["ozone_column_raw"] > 0]["ozone_column_raw"]
        mean_o3 = f"{valid_o3.mean():.2f} DU" if not valid_o3.empty else "N/A"
        min_o3 = f"{valid_o3.min():.2f} DU" if not valid_o3.empty else "N/A"
        max_o3 = f"{valid_o3.max():.2f} DU" if not valid_o3.empty else "N/A"

        records_json = df.to_json(orient="records")

        html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NASA Satellite Raw Data Viewer - {Path(file_path).name}</title>
    <!-- DataTables CSS & Leaflet -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body {{ background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
        .stat-card {{ background: white; border-radius: 10px; padding: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 20px; }}
        .stat-val {{ font-size: 24px; font-weight: 700; color: #0284c7; }}
        .stat-lbl {{ font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; }}
        #map {{ height: 420px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 25px; }}
        .badge-good {{ background-color: #22c55e; }}
        .badge-flag {{ background-color: #ef4444; }}
    </style>
</head>
<body class="p-4">
    <div class="container-fluid">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
            <div>
                <h3 class="fw-bold mb-1">NASA Satellite Raw Data Viewer</h3>
                <div class="text-muted small">File thô: <code>{Path(file_path).name}</code> | Tổng số điểm quét vệ tinh: <strong>{total_points:,}</strong></div>
            </div>
            <span class="badge bg-primary px-3 py-2 fs-6">Định dạng: HDF-EOS5 / HDF5</span>
        </div>

        <!-- Metrics Cards -->
        <div class="row">
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-lbl">Số dòng hiển thị mẫu</div>
                    <div class="stat-val">{len(df):,} <small class="text-muted fs-6">/{total_points:,}</small></div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-lbl">Ozone Trung bình (Raw)</div>
                    <div class="stat-val">{mean_o3}</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-lbl">Nồng độ Nhỏ nhất (Min)</div>
                    <div class="stat-val text-success">{min_o3}</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-lbl">Nồng độ Lớn nhất (Max)</div>
                    <div class="stat-val text-danger">{max_o3}</div>
                </div>
            </div>
        </div>

        <!-- Map Section -->
        <div class="card mb-4 border-0 shadow-sm">
            <div class="card-header bg-white fw-bold py-3">Vị trí các điểm quét thô của quỹ đạo vệ tinh (Orbit Swath Points)</div>
            <div class="card-body p-0">
                <div id="map"></div>
            </div>
        </div>

        <!-- Raw Data Table -->
        <div class="card border-0 shadow-sm">
            <div class="card-header bg-white fw-bold py-3 d-flex justify-content-between align-items-center">
                <span>Bảng dữ liệu trường thô nguyên bản (Đã lưu vào SQLite bảng <code>raw_measurements</code>)</span>
                <span class="badge bg-secondary">Hỗ trợ tìm kiếm, sắp xếp & phân trang</span>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table id="rawTable" class="table table-hover table-striped align-middle" style="width:100%">
                        <thead class="table-light">
                            <tr>
                                <th># Index</th>
                                <th>Latitude (Vĩ độ)</th>
                                <th>Longitude (Kinh độ)</th>
                                <th>ColumnAmountO3 (Ozone DU)</th>
                                <th>Quality Flags</th>
                                <th>Raw Time Stamp</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.7/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

    <script>
        const rawData = {records_json};

        // Render Table
        $('#rawTable').DataTable({{
            data: rawData,
            columns: [
                {{ data: 'point_index' }},
                {{ data: 'latitude', render: d => `<strong>${{d}}°</strong>` }},
                {{ data: 'longitude', render: d => `<strong>${{d}}°</strong>` }},
                {{ data: 'ozone_column_raw', render: d => {{
                    if (d < 0) return `<span class="badge bg-warning text-dark">${{d}} (FillValue)</span>`;
                    return `<span class="badge bg-info text-dark">${{d}} DU</span>`;
                }} }},
                {{ data: 'quality_flag', render: d => `<span class="badge ${{d === 0 ? 'badge-good' : 'badge-flag'}}">Flag: ${{d}}</span>` }},
                {{ data: 'time_raw' }}
            ],
            pageLength: 15,
            lengthMenu: [10, 15, 25, 50, 100]
        }});

        // Render Leaflet Map
        const map = L.map('map').setView([15.0, 105.0], 3);
        L.tileLayer('https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png', {{
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap &copy; CARTO &copy; NASA Earthdata'
        }}).addTo(map);

        // Add swath points
        const step = Math.max(1, Math.floor(rawData.length / 500));
        const bounds = [];
        for (let i = 0; i < rawData.length; i += step) {{
            const p = rawData[i];
            bounds.push([p.latitude, p.longitude]);
            L.circleMarker([p.latitude, p.longitude], {{
                radius: 4,
                fillColor: p.ozone_column_raw > 0 ? '#0284c7' : '#94a3b8',
                color: '#fff',
                weight: 0.5,
                fillOpacity: 0.8
            }}).bindPopup(`
                <b>Điểm quét:</b> #${{p.point_index}}<br>
                <b>Tọa độ:</b> ${{p.latitude}}°, ${{p.longitude}}°<br>
                <b>Ozone:</b> ${{p.ozone_column_raw}} DU<br>
                <b>Quality Flag:</b> ${{p.quality_flag}}
            `).addTo(map);
        }}

        if (bounds.length > 0) {{
            map.fitBounds(bounds);
        }}
    </script>
</body>
</html>
"""
        with open(output_html, "w", encoding="utf-8") as f:
            f.write(html)

        print(f"[VIEWER] Đã tạo trang web xem dữ liệu thô: {output_html}")
        return output_html

