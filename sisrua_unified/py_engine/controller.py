import os
import json
import pandas as pd
import osmnx as ox
from shapely.geometry import Point
import numpy as np
from pyproj import Transformer

from osmnx_client import fetch_osm_data
from dxf_generator import DXFGenerator
from spatial_audit import run_spatial_audit
from elevation_client import fetch_elevation_grid
from contour_generator import generate_contours
from utils.logger import Logger

class OSMController:
    def __init__(self, lat, lon, radius, output_file, layers_config, crs, export_format='dxf', selection_mode='circle', polygon=None):
        self.lat = lat
        self.lon = lon
        self.radius = radius
        self.output_file = output_file
        self.layers_config = layers_config
        self.crs = crs
        self.export_format = export_format.lower()
        self.selection_mode = selection_mode
        self.polygon = polygon
        self.project_metadata = {
            'client': 'CLIENTE PADRÃO',
            'project': 'EXTRACAO ESPACIAL'
        }
        self.audit_summary = {"violations": 0, "coverageScore": 0}

    def run(self):
        """Orchestrates the Osm2Dxf flow."""
        Logger.info(f"OSM Audit & Export Starting (Format: {self.export_format})", progress=5)
        
        # 1. Prepare Layers
        tags = self._build_tags()
        if not tags:
            Logger.error("No infrastructure layers selected!")
            return

        # 2. Fetch Features
        Logger.info("Step 1/5: Fetching OSM features...", progress=10)
        gdf = self._fetch_features(tags)
        if gdf is None or gdf.empty:
            Logger.info("No architectural features found in radius.", "warning")
            return

        # 3. Spatial GIS Audit (Authoritative Logic)
        Logger.info("Step 2/5: Running spatial audit...", progress=30)
        analysis_gdf = self._run_audit(gdf)

        # 4. Preview Data (GeoJSON)
        self._send_geojson_preview(gdf, analysis_gdf)

        # 5. Coordinate Offset & CAD Export
        Logger.info("Step 3/5: Initializing DXF Generation...", progress=50)
        dxf_gen = DXFGenerator(self.output_file)
        dxf_gen.add_features(gdf) # Features set the AUTHORITATIVE OFFSET

        # 6. Terrain & Contours (Optional)
        if self.layers_config.get('terrain', False):
            self._process_terrain(gdf, dxf_gen)

        # 7. Cartographic Elements
        if dxf_gen.bounds is not None:
            self._add_cad_essentials(dxf_gen)

        # 8. Save & Cleanup
        Logger.info("Step 5/5: Finalizing export package...", progress=90)
        dxf_gen.save()
        self._export_csv_metadata(gdf)
        Logger.success(f"Audit Complete: Generated {self.output_file}")

    def _fetch_features(self, tags):
        try:
            if self.selection_mode == 'polygon':
                 return fetch_osm_data(self.lat, self.lon, self.radius, tags, crs=self.crs, polygon=self.polygon)
            return fetch_osm_data(self.lat, self.lon, self.radius, tags, crs=self.crs)
        except Exception as e:
            Logger.error(f"OSM Fetch Error: {str(e)}")
            return None

    def _run_audit(self, gdf):
        try:
            audit_summary, analysis_gdf = run_spatial_audit(gdf)
            self.audit_summary = audit_summary
            Logger.info(f"Spatial Audit: {audit_summary['violations']} violations detected.")
            return analysis_gdf
        except Exception as se:
            Logger.error(f"Spatial Audit internal failure: {se}")
            return None

    def _process_terrain(self, gdf, dxf_gen):
        try:
            # AUTHORITATIVE FIX: Convert project-space bounds to Lat/Lon for elevation API
            gdf_4326 = gdf.to_crs(epsg=4326)
            b = gdf_4326.total_bounds
            north, south, east, west = b[3], b[1], b[2], b[0]
            
            # Resolution-aware expansion
            margin = 0.0005 # Degrees
            elev_points, rows, cols = fetch_elevation_grid(north + margin, south - margin, east + margin, west - margin, resolution=100) 
            
            if elev_points:
                Logger.info(f"Reconstructing {rows}x{cols} terrain grid...", progress=60)
                transformer = Transformer.from_crs("EPSG:4326", gdf.crs, always_xy=True)
                
                grid_rows = []
                current_row = []
                for lat, lon, z in elev_points:
                    x, y = transformer.transform(lon, lat)
                    current_row.append((x, y, z))
                    if len(current_row) >= cols:
                        grid_rows.append(current_row)
                        current_row = []
                
                if current_row: grid_rows.append(current_row)
                dxf_gen.add_terrain_from_grid(grid_rows)
                
                # Contours
                if self.layers_config.get('contours', False):
                    self._add_contours(grid_rows, dxf_gen)
        except Exception as e:
            Logger.error(f"Terrain submodule failure: {str(e)}")

    def _add_contours(self, grid_rows, dxf_gen):
        try:
            interval = 1.0 if not self.layers_config.get('high_res_contours') else 0.5
            contours = generate_contours(grid_rows, interval=interval)
            if contours:
                dxf_gen.add_contour_lines(contours)
                Logger.info(f"Integrated {len(contours)} contour lines.")
        except Exception as ce:
            Logger.error(f"Contour math error: {ce}")

    def _add_cad_essentials(self, dxf_gen):
        min_x, min_y, max_x, max_y = dxf_gen.bounds
        dxf_gen.add_coordinate_grid(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)
        dxf_gen.add_cartographic_elements(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)

    def _export_csv_metadata(self, gdf):
        try:
            csv_file = self.output_file.replace('.dxf', '_metadata.csv')
            df = gdf.copy()
            df['area_m2'] = df.geometry.area
            df['length_m'] = df.geometry.length
            df_csv = pd.DataFrame(df.drop(columns='geometry'))
            df_csv.to_csv(csv_file, index=False)
            Logger.info(f"Metadata exported to {os.path.basename(csv_file)}")
        except Exception as e:
            Logger.error(f"CSV Metadata Export failed: {e}")

    def _build_tags(self):
        tags = {}
        if self.layers_config.get('buildings', True): tags['building'] = True
        if self.layers_config.get('roads', True): tags['highway'] = True
        if self.layers_config.get('nature', True):
            tags['natural'] = ['tree', 'wood', 'scrub', 'water']
            tags['landuse'] = ['forest', 'grass', 'park']
        if self.layers_config.get('furniture', False):
            tags['amenity'] = ['bench', 'waste_basket', 'bicycle_parking', 'fountain', 'bus_station']
            tags['highway'] = ['street_lamp']
        return tags

    def _send_geojson_preview(self, gdf, analysis_gdf=None):
        if Logger.SKIP_GEOJSON: return
        try:
            preview_gdf = gdf.copy()
            preview_gdf['area'] = preview_gdf.geometry.area
            preview_gdf['length'] = preview_gdf.geometry.length
            def get_type(row):
                if row.get('building'): return 'building'
                if row.get('highway'): return 'highway'
                return 'other'
            preview_gdf['feature_type'] = preview_gdf.apply(get_type, axis=1)
            gdf_wgs84 = preview_gdf.to_crs(epsg=4326)
            payload = json.loads(gdf_wgs84.to_json())
            if analysis_gdf is not None and not analysis_gdf.empty:
                analysis_wgs84 = analysis_gdf.to_crs(epsg=4326)
                analysis_json = json.loads(analysis_wgs84.to_json())
                for f in analysis_json['features']: f['properties']['is_analysis'] = True
                payload['features'].extend(analysis_json['features'])
            payload['audit_summary'] = self.audit_summary
            Logger.geojson(payload)
        except Exception as e:
            Logger.error(f"GeoJSON Sync Error: {str(e)}")
