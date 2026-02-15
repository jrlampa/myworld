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
        Logger.info(f"OSM Extraction Starting (Format: {self.export_format})", progress=5)
        Logger.info(f"Fetching data for {self.lat}, {self.lon} (r={self.radius}m)...", "starting")

        # 1. Build Tags
        tags = self._build_tags()
        if not tags:
            Logger.error("No layers selected!")
            return

        # 2. Fetch Data
        Logger.info("Step 1/5: Fetching OSM features...", progress=10)
        try:
            if self.selection_mode == 'polygon':
                 gdf = fetch_osm_data(self.lat, self.lon, self.radius, tags, crs=self.crs, polygon=self.polygon)
            else:
                 gdf = fetch_osm_data(self.lat, self.lon, self.radius, tags, crs=self.crs)
        except Exception:
            import traceback
            Logger.error(f"Fetch failed: {traceback.format_exc()}")
            return

        if gdf.empty:
            Logger.info("No features found in this area.", "warning")
            return

        # 3. Spatial GIS Audit (Heavy Logic move to Backend)
        Logger.info("Step 2/5: Running spatial audit...", progress=30)
        try:
            audit_summary, analysis_gdf = run_spatial_audit(gdf)
            self.audit_summary = audit_summary
            Logger.info(f"Audit completed: {audit_summary['violations']} violations found.")
        except Exception as se:
            Logger.error(f"Spatial Audit failed: {se}")
            analysis_gdf = None

        # 4. GeoJSON Preview (Enriched)
        self._send_geojson_preview(gdf, analysis_gdf)

        if self.layers_config.get('terrain', False): 
            try:
                north, south, east, west = gdf.limit_area_bbox() if hasattr(gdf, 'limit_area_bbox') else (gdf.total_bounds[3], gdf.total_bounds[1], gdf.total_bounds[2], gdf.total_bounds[0])
                
                # Expand slightly for mesh connectivity
                margin = 0.001
                north += margin; south -= margin; east += margin; west -= margin

                Logger.info("Step 3/5: Estimating terrain...", progress=50)
                elev_points = fetch_elevation_grid(north, south, east, west, resolution=100) 
                
                if elev_points:
                    Logger.info(f"Processing {len(elev_points)} terrain points...")
                    transformer = Transformer.from_crs("EPSG:4326", gdf.crs, always_xy=True)
                    
                    # Re-calc 'step' to deduce columns for grid reconstruction
                    step = (100 / 111000.0)
                    cols = len(np.arange(west, east, step))
                    if cols <= 0: cols = 1
                    
                    grid_rows = []
                    current_row = []
                    
                    for lat, lon, z in elev_points:
                        x, y = transformer.transform(lon, lat)
                        current_row.append((x, y, z))
                        if len(current_row) >= cols:
                            grid_rows.append(current_row)
                            current_row = []
                    
                    if current_row:
                        grid_rows.append(current_row)
                        
                    dxf_gen = DXFGenerator(self.output_file)
                    dxf_gen.add_features(gdf) # Features set the AUTHORITATIVE OFFSET
                    
                    # Cartographic Essentials
                    if dxf_gen.bounds is not None:
                        min_x, min_y, max_x, max_y = dxf_gen.bounds
                        dxf_gen.add_coordinate_grid(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)
                        dxf_gen.add_cartographic_elements(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)

                    Logger.info("Step 4/5: Generating 3D Mesh...", progress=70)
                    dxf_gen.add_terrain_from_grid(grid_rows)
                    
                    # Generate Contours
                    try:
                        contours = generate_contours(grid_rows, interval=1.0 if not self.layers_config.get('high_res_contours') else 0.5)
                        if contours:
                            dxf_gen.add_contour_lines(contours)
                            Logger.info(f"Generated {len(contours)} contour lines.")
                    except Exception as ce:
                        Logger.error(f"Contour generation error: {ce}")

                    dxf_gen.save()
                    self._export_csv_metadata(gdf) 
                    Logger.success(f"Saved {len(gdf)} objects + Terrain to {self.output_file}")
                    return 

            except Exception:
                import traceback
                Logger.error(f"Terrain generation failed: {traceback.format_exc()}")

        # 4. Export logic based on Format (Fallback for non-terrain or failure)
        Logger.info("Step 5/5: Exporting CAD package...", progress=90)
        try:
            if self.export_format == 'geojson':
                Logger.info(f"Exporting to GeoJSON: {self.output_file}", "exporting")
                gdf_wgs84 = gdf.to_crs(epsg=4326)
                gdf_wgs84.to_file(self.output_file, driver='GeoJSON')
                return

            if self.export_format == 'kml':
                Logger.info(f"Exporting to KML: {self.output_file}", "exporting")
                try:
                    import fiona
                    fiona.drvsupport.supported_drivers['KML'] = 'rw'
                    gdf_wgs84 = gdf.to_crs(epsg=4326)
                    gdf_wgs84.to_file(self.output_file, driver='KML')
                except Exception as e:
                    Logger.warning(f"KML export failed or driver unavailable: {e}. Falling back to GeoJSON.")
                    gdf_wgs84 = gdf.to_crs(epsg=4326)
                    gdf_wgs84.to_file(self.output_file + ".geojson", driver='GeoJSON')
                return

            if self.export_format == 'shapefile':
                Logger.info(f"Exporting to Shapefile: {self.output_file}", "exporting")
                gdf_shp = gdf.copy()
                new_cols = {col: col[:10] for col in gdf_shp.columns if col != 'geometry'}
                gdf_shp = gdf_shp.rename(columns=new_cols)
                for col in gdf_shp.columns:
                    if col != 'geometry' and gdf_shp[col].apply(lambda x: isinstance(x, list)).any():
                        gdf_shp[col] = gdf_shp[col].apply(lambda x: str(x) if isinstance(x, list) else x)
                gdf_shp.to_file(self.output_file, driver='ESRI Shapefile')
                return

            # Default: DXF Flow
            dxf_gen = DXFGenerator(self.output_file)
            dxf_gen.add_features(gdf)
            if dxf_gen.bounds is not None:
                min_x, min_y, max_x, max_y = dxf_gen.bounds
                dxf_gen.add_coordinate_grid(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)
                dxf_gen.add_cartographic_elements(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)
            dxf_gen.project_info = self.project_metadata
            dxf_gen.save()
            self._export_csv_metadata(gdf)
            Logger.success(f"Saved {len(gdf)} objects to {self.output_file}")
            
        except Exception:
            import traceback
            Logger.error(f"Export failed: {traceback.format_exc()}")

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
            Logger.error(f"CSV Export failed: {e}")

    def _build_tags(self):
        tags = {}
        if self.layers_config.get('buildings', True): tags['building'] = True
        if self.layers_config.get('roads', True): tags['highway'] = True
        if self.layers_config.get('trees', True):
            tags['natural'] = ['tree', 'wood']
            tags['landuse'] = ['forest', 'grass']
        if self.layers_config.get('amenities', True):
            tags['amenity'] = True
            tags['leisure'] = True
            tags['power'] = True
            tags['telecom'] = True
        if self.layers_config.get('furniture', False):
            tags['amenity'] = ['bench', 'waste_basket', 'bicycle_parking', 'fountain']
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
            Logger.error(f"GeoJSON Error: {str(e)}")
