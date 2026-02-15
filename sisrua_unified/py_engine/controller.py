import json
import os
import pandas as pd
from osmnx_client import fetch_osm_data
from dxf_generator import DXFGenerator
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
            try:
                from .spatial_audit import run_spatial_audit
            except (ImportError, ValueError):
                from spatial_audit import run_spatial_audit
            
            audit_summary, analysis_gdf = run_spatial_audit(gdf)
            self.audit_summary = audit_summary
            Logger.info(f"Audit completed: {audit_summary['violations']} violations found.")
        except Exception as se:
            Logger.error(f"Spatial Audit failed: {se}")
            self.audit_summary = {"violations": 0, "coverageScore": 0}
            analysis_gdf = None

        # 4. GeoJSON Preview (Enriched)
        self._send_geojson_preview(gdf, analysis_gdf)

        if self.layers_config.get('terrain', False): # Check for terrain config
            try:
                try:
                    from .elevation_client import fetch_elevation_grid
                except (ImportError, ValueError):
                    from elevation_client import fetch_elevation_grid
                import osmnx as ox
                from shapely.geometry import Point
                import numpy as np

                # Calculate bounds
                north, south, east, west = gdf.limit_area_bbox() if hasattr(gdf, 'limit_area_bbox') else (gdf.total_bounds[3], gdf.total_bounds[1], gdf.total_bounds[2], gdf.total_bounds[0])
                
                # Expand slightly
                margin = 0.001
                north += margin; south -= margin; east += margin; west -= margin

                # Fetch grid (lat, lon, z)
                Logger.info("Step 3/5: Estimating terrain...", progress=50)
                elev_points = fetch_elevation_grid(north, south, east, west, resolution=100) # 100m resolution for speed
                
                if elev_points:
                    Logger.info(f"Processing {len(elev_points)} terrain points...")
                    
                    # We need to project these points to the same CRS as the GDF
                    # Using osmnx projection logic or direct transformation
                    # gdf.crs is the target CRS
                    
                    # Reshape into grid
                    # We know fetch_elevation_grid returns row by row
                    # But we need to calculate rows/cols based on bounds and step
                    # Let's rely on the fact that the client generates them systematically.
                    # Reconstructing the grid structure from the flat list might be error prone 
                    # if we don't know the exact row count.
                    
                    # Better: logic in elevation_client should return grid structure or matrix.
                    # But for now, let's assume sqrt or calculated width.
                    
                    # Alternatively, simpler: elevation_client returns (lats, lons, elevs) arrays
                    # Let's stick to valid engineering:
                    # Rerun project logic manually for each point? Slow.
                    # Batch project?
                    
                    # Let's use Transformer
                    from pyproj import Transformer
                    transformer = Transformer.from_crs("EPSG:4326", gdf.crs, always_xy=True)
                    
                    projected_grid = []
                    
                    # To reconstruct the grid, we need to know the number of columns (pts per row)
                    # From elevation_client: lons = np.arange(west, east, step)
                    # We can re-calculate len(lons) here or verify.
                    
                    # Let's just pass flat points for now if we can't reliably grid them?
                    # No, 3D Mesh needs topology.
                    
                    # Hack: Deduce cols from sorting?
                    # Or modify elevation_client to return shape.
                    
                    # Let's modify elevation_client in a separate step? 
                    # NO, I am in replace_content. I have to work with what I have.
                    # I will assume square-ish grid or re-calculate cols.
                    
                    # Re-calc 'step' used in client:
                    # step = (resolution / 111000.0)
                    step = (100 / 111000.0)
                    lons_count = len(np.arange(west, east, step))
                    
                    cols = lons_count
                    if cols == 0: cols = 1
                    
                    current_row = []
                    grid_rows = []
                    
                    # Calculate center locally for DXF
                    center_x = gdf.geometry.centroid.x.mean()
                    center_y = gdf.geometry.centroid.y.mean()
                    
                    for i, (lat, lon, z) in enumerate(elev_points):
                        x, y = transformer.transform(lon, lat)
                        # Center it
                        x -= center_x
                        y -= center_y
                        
                        current_row.append((x, y, z))
                        
                        if len(current_row) >= cols:
                            grid_rows.append(current_row)
                            current_row = []
                            
                    # Add remaining
                    if current_row:
                        grid_rows.append(current_row)
                        
                    dxf_gen = DXFGenerator(self.output_file)
                    dxf_gen.add_features(gdf) # Add normal features first
                    
                    # Cartographic Essentials
                    if dxf_gen.bounds is not None:
                        min_x, min_y, max_x, max_y = dxf_gen.bounds
                        dxf_gen.add_coordinate_grid(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)
                        dxf_gen.add_cartographic_elements(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)

                    Logger.info("Step 4/5: Generating 3D Mesh...", progress=70)
                    dxf_gen.add_terrain_from_grid(grid_rows)
                    
                    # Generate Contours
                    try:
                        try:
                            from .contour_generator import generate_contours
                        except (ImportError, ValueError):
                            from contour_generator import generate_contours
                        # TODO: Make interval configurable in settings
                        contours = generate_contours(grid_rows, interval=1.0 if not self.layers_config.get('high_res_contours') else 0.5)
                        if contours:
                            dxf_gen.add_contour_lines(contours)
                            Logger.info(f"Generated {len(contours)} contour lines.")
                    except Exception as ce:
                        Logger.error(f"Contour generation error: {ce}")

                    dxf_gen.save()
                    self._export_csv_metadata(gdf) # Export CSV here too
                    Logger.success(f"Saved {len(gdf)} objects + Terrain to {self.output_file}")
                    return # Exit after saving with terrain

            except Exception:
                import traceback
                Logger.error(f"Terrain generation failed: {traceback.format_exc()}")
                # Fallback to normal save below

        # 4. Export logic based on Format
        Logger.info("Step 5/5: Exporting CAD package...", progress=90)
        try:
            if self.export_format == 'geojson':
                Logger.info(f"Exporting to GeoJSON: {self.output_file}", "exporting")
                # Ensure it is WGS84 for GeoJSON
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
                # Shapefiles have 10-char column limit and don't like None
                # We must shorten column names
                gdf_shp = gdf.copy()
                
                # Shorten names and handle types
                new_cols = {}
                for col in gdf_shp.columns:
                    if col == 'geometry': continue
                    # Truncate to 10 chars
                    short_name = col[:10]
                    new_cols[col] = short_name
                
                gdf_shp = gdf_shp.rename(columns=new_cols)
                
                # Remove columns with complex types (lists) which SHP doesn't support
                for col in gdf_shp.columns:
                    if col == 'geometry': continue
                    if gdf_shp[col].apply(lambda x: isinstance(x, list)).any():
                        gdf_shp[col] = gdf_shp[col].apply(lambda x: str(x) if isinstance(x, list) else x)
                
                gdf_shp.to_file(self.output_file, driver='ESRI Shapefile')
                return

            # Default: DXF Flow
            dxf_gen = DXFGenerator(self.output_file)
            dxf_gen.add_features(gdf)
            
            # Cartographic Essentials
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
        """Saves a CSV with all feature data alongside the DXF"""
        try:
            csv_file = self.output_file.replace('.dxf', '_metadata.csv')
            # Extract geometry properties
            df = gdf.copy()
            df['area_m2'] = df.geometry.area
            df['length_m'] = df.geometry.length
            # Remove geometry column for clean CSV
            df_csv = pd.DataFrame(df.drop(columns='geometry'))
            df_csv.to_csv(csv_file, index=False)
            Logger.info(f"Metadata exported to {os.path.basename(csv_file)}")
        except Exception as e:
            Logger.error(f"CSV Export failed: {e}")

    def _build_tags(self):
        tags = {}
        if self.layers_config.get('buildings', True):
            tags['building'] = True
        if self.layers_config.get('roads', True):
            tags['highway'] = True
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
        if Logger.SKIP_GEOJSON:
            return
            
        try:
            # Calculate metrics for the dashboard accurate preview
            # We copy to avoid modifying the original projected GDF if needed for DXF
            preview_gdf = gdf.copy()
            preview_gdf['area'] = preview_gdf.geometry.area
            preview_gdf['length'] = preview_gdf.geometry.length
            
            # Identify feature type for easier frontend filtering
            def get_type(row):
                if 'building' in row and row['building']: return 'building'
                if 'highway' in row and row['highway']: return 'highway'
                return 'other'
            
            preview_gdf['feature_type'] = preview_gdf.apply(get_type, axis=1)

            # Always project to WGS84 for Leaflet
            gdf_wgs84 = preview_gdf.to_crs(epsg=4326)
            payload = json.loads(gdf_wgs84.to_json())
            
            # Integrate analysis features if available
            if analysis_gdf is not None and not analysis_gdf.empty:
                analysis_wgs84 = analysis_gdf.to_crs(epsg=4326)
                analysis_json = json.loads(analysis_wgs84.to_json())
                # Flag them as analysis features
                for f in analysis_json['features']:
                    f['properties']['is_analysis'] = True
                payload['features'].extend(analysis_json['features'])

            # Add summary to payload
            payload['audit_summary'] = getattr(self, 'audit_summary', {})
            
            Logger.geojson(payload)
        except Exception as e:
            Logger.error(f"GeoJSON Error: {str(e)}")
