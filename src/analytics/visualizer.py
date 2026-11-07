import os
import json
from pathlib import Path
from typing import Optional
import pandas as pd
import numpy as np

from config.settings import settings
from src.db.models import SessionLocal, OzoneGridSummary

class OzoneVisualizer:
    """Gold Layer: Visualizes spatial Ozone distributions & time-series trends"""

    def __init__(self):
        self.db = SessionLocal()

    def get_latest_grid_dataframe(self) -> pd.DataFrame:
        """Loads latest processed spatial summary from database"""
        query = self.db.query(OzoneGridSummary).all()
        if not query:
            return pd.DataFrame()
        
        data = [{
            "lat": r.lat_bin,
            "lon": r.lon_bin,
            "ozone_du": r.ozone_column_mean,
            "count": r.valid_pixel_count,
            "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        } for r in query]
        
        return pd.DataFrame(data)

    def generate_static_plot(self, output_path: Optional[str] = None) -> str:
        """
        Generates a 2D spatial heatmap of Ozone concentrations using Matplotlib.
        """
        import matplotlib.pyplot as plt

        df = self.get_latest_grid_dataframe()
        if df.empty:
            print("[VISUALIZER] No data found in database to plot.")
            return ""

        output_path = output_path or str(Path(settings.DATA_SILVER_DIR).parent / "ozone_spatial_map.png")

        plt.figure(figsize=(14, 7))
        scatter = plt.scatter(
            df["lon"], df["lat"],
            c=df["ozone_du"],
            cmap="turbo",
            s=25,
            edgecolors="none",
            alpha=0.85
        )
        cbar = plt.colorbar(scatter, pad=0.02)
        cbar.set_label("Total Column Ozone (Dobson Units - DU)", fontsize=11, fontweight="bold")

        plt.title("NASA Satellite Total Ozone Column Distribution (L2 Granule Summary)", fontsize=14, fontweight="bold", pad=12)
        plt.xlabel("Longitude (°)", fontsize=11)
        plt.ylabel("Latitude (°)", fontsize=11)
        plt.xlim(-180, 180)
        plt.ylim(-90, 90)
        plt.grid(True, linestyle="--", alpha=0.5)

        plt.tight_layout()
        plt.savefig(output_path, dpi=200)
        plt.close()
        print(f"[VISUALIZER] Static map generated: {output_path}")
        return output_path

    def generate_interactive_html_map(self, output_path: Optional[str] = None) -> str:
        """
        Generates a self-contained Leaflet.js interactive web map.
        Can be opened immediately in any browser with pan, zoom, and coordinate tooltips.
        """
        df = self.get_latest_grid_dataframe()
        if df.empty:
            print("[VISUALIZER] No data to render HTML map.")
            return ""

        output_path = output_path or str(Path(settings.DATA_SILVER_DIR).parent / "ozone_interactive_map.html")

        # Convert points to JSON
        points = []
        for _, row in df.iterrows():
            points.append({
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
                "val": round(float(row["ozone_du"]), 1),
                "time": str(row["timestamp"])
            })

        points_json = json.dumps(points)

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NASA Satellite Ozone Interactive Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body, html {{ margin: 0; padding: 0; height: 100%; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }}
        #map {{ height: 100vh; width: 100vw; }}
        .legend {{
            background: white;
            padding: 12px 16px;
            line-height: 1.5;
            box-shadow: 0 0 15px rgba(0,0,0,0.2);
            border-radius: 8px;
            font-size: 13px;
        }}
        .legend-bar {{
            height: 18px;
            width: 180px;
            background: linear-gradient(to right, #30123b, #4686fb, #1ae4b6, #a2fc3c, #fbb41a, #e4460a, #7a0403);
            border-radius: 4px;
            margin: 6px 0;
        }}
        .legend-labels {{
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            font-weight: bold;
        }}
        .header-panel {{
            position: absolute;
            top: 15px;
            left: 60px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.95);
            padding: 10px 18px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        }}
    </style>
</head>
<body>
    <div class="header-panel">
        <h3 style="margin: 0; color: #1e293b;">NASA Satellite Ozone Layer Map</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Total Column Ozone (Dobson Units - DU)</p>
    </div>
    <div id="map"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        const map = L.map('map').setView([15.0, 105.0], 3);

        L.tileLayer('https://{{s}}.basemaps.cartocdn.com/light_all/{{z}}/{{x}}/{{y}}{{r}}.png', {{
            attribution: '&copy; OpenStreetMap, &copy; CARTO, NASA Ozone GSFC',
            maxZoom: 18
        }}).addTo(map);

        const dataPoints = {points_json};

        function getColor(du) {{
            // Scale from 150 DU to 450 DU
            if (du < 200) return '#30123b';
            if (du < 250) return '#4686fb';
            if (du < 300) return '#1ae4b6';
            if (du < 350) return '#a2fc3c';
            if (du < 400) return '#fbb41a';
            return '#e4460a';
        }}

        dataPoints.forEach(p => {{
            const circle = L.circleMarker([p.lat, p.lon], {{
                radius: 5,
                fillColor: getColor(p.val),
                color: '#333',
                weight: 0.5,
                opacity: 0.8,
                fillOpacity: 0.85
            }}).addTo(map);

            circle.bindPopup(`
                <b>Latitude:</b> ${{p.lat}}°<br>
                <b>Longitude:</b> ${{p.lon}}°<br>
                <b>Ozone Column:</b> <span style="font-weight:bold; color:#0284c7;">${{p.val}} DU</span><br>
                <b>Timestamp:</b> ${{p.time}}
            `);
        }});

        // Add Legend
        const legend = L.control({{ position: 'bottomright' }});
        legend.onAdd = function (map) {{
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <b>Ozone Column (DU)</b>
                <div class="legend-bar"></div>
                <div class="legend-labels">
                    <span>150</span>
                    <span>250</span>
                    <span>300</span>
                    <span>350</span>
                    <span>450+</span>
                </div>
            `;
            return div;
        }};
        legend.addTo(map);
    </script>
</body>
</html>
"""
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        print(f"[VISUALIZER] Interactive map generated: {output_path}")
        return output_path

