import ezdxf
import os
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point
import geopandas as gpd
import math
try:
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager
from ezdxf.enums import TextEntityAlignment
try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

class DXFGenerator:
    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new('R2013')
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]  # Standard bounding box
        
        # Setup CAD standards via StyleManager (SRP Refactor)
        DXFStyleManager.setup_all(self.doc)
        
        self.msp = self.doc.modelspace()
        self.project_info = {} # Store metadata for title block
        self._offset_initialized = False

    # Legacy setup methods removed (handled by StyleManager)

    def add_features(self, gdf):
        """
        Iterates over a GeoDataFrame and adds entities to the DXF.
        Assumes the GDF is projected (units in meters).
        """
        if gdf.empty:
            return

        # Center the drawing roughly around (0,0) based on the first feature
        # AUTHORITATIVE OFFSET: Once set, it applies to everything (features, terrain, labels)
        if not self._offset_initialized:
            centroids = gdf.geometry.centroid
            cx = centroids.x.dropna().mean() if not centroids.x.dropna().empty else 0.0
            cy = centroids.y.dropna().mean() if not centroids.y.dropna().empty else 0.0
            self.diff_x = self._safe_v(cx)
            self.diff_y = self._safe_v(cy)
            self._offset_initialized = True

        # Validate and store bounds
        b = gdf.total_bounds
        if any(math.isnan(v) or math.isinf(v) for v in b):
             self.bounds = [0.0, 0.0, 100.0, 100.0]
        else:
             self.bounds = [float(v) for v in b]

        for _, row in gdf.iterrows():
            geom = row.geometry
            tags = row.drop('geometry')
            
            layer = self.determine_layer(tags, row)
            
            self._draw_geometry(geom, layer, self.diff_x, self.diff_y, tags)

    def determine_layer(self, tags, row):
        """Maps OSM tags to DXF Layers"""
        # Power Infrastructure
        if 'power' in tags and not pd.isna(tags['power']):
            if tags['power'] in ['line', 'tower', 'substation']: # High Voltage usually
                return 'INFRA_POWER_HV'
            return 'INFRA_POWER_LV' # poles, minor_lines

        # Telecom Infrastructure
        if 'telecom' in tags and not pd.isna(tags['telecom']):
            return 'INFRA_TELECOM'

        # Street Furniture
        furniture_amenities = ['bench', 'waste_basket', 'bicycle_parking', 'fountain', 'drinking_water']
        if ('amenity' in tags and tags['amenity'] in furniture_amenities) or \
           ('highway' in tags and tags['highway'] == 'street_lamp'):
            return 'MOBILIARIO_URBANO'

        if 'building' in tags and not pd.isna(tags['building']):
            return 'EDIFICACAO'
        if 'highway' in tags and not pd.isna(tags['highway']):
            return 'VIAS'
        if 'natural' in tags and tags['natural'] in ['tree', 'wood', 'scrub']:
            return 'VEGETACAO'
        if 'amenity' in tags:
            return 'EQUIPAMENTOS'
        if 'leisure' in tags:
             return 'VEGETACAO' # Parks, etc
        if 'waterway' in tags or 'natural' in tags and tags['natural'] == 'water':
            return 'HIDROGRAFIA'
            
        return '0' # Default layer

    def _safe_v(self, v, default=0.0):
        """Absolute guard for float values"""
        try:
            val = float(v)
            if math.isnan(val) or math.isinf(val) or abs(val) > 1e11:
                return default
            return val
        except:
            return default

    def _safe_p(self, p, default=(0.0, 0.0)):
        """Absolute guard for point tuples"""
        try:
            return tuple(self._safe_v(v) for v in p)
        except:
            return default

    def _validate_points(self, points, min_points=2, is_3d=False):
        """Validate points list for DXF entities to prevent read errors"""
        if not points or len(points) < min_points:
            return None
            
        valid_points = []
        last_p = None
        for p in points:
            try:
                # Use our safe helper for each coordinate
                vals = [self._safe_v(v, default=None) for v in p]
                if None in vals:
                    continue
                curr_p = tuple(vals)
                if curr_p != last_p:
                    valid_points.append(curr_p)
                    last_p = curr_p
            except:
                continue
        
        if len(valid_points) < min_points:
            return None
            
        return valid_points

    def _draw_geometry(self, geom, layer, diff_x, diff_y, tags):
        """Recursive geometry drawing with text support"""
        if geom.is_empty:
            return

        # Ensure layer exists in the document, or fallback to '0'
        if layer not in self.doc.layers:
            layer = '0'

        # Draw Labels for Streets
        if (layer == 'VIAS' or layer == '0') and 'name' in tags:
            name = str(tags['name'])
            if name.lower() != 'nan' and name.strip():
                # Use centroid of the line to place text
                rotation = 0.0
                centroid = geom.centroid
                if not centroid.is_empty and not math.isnan(centroid.x) and not math.isnan(centroid.y):
                    if isinstance(geom, LineString) and geom.length > 0.1:
                        try:
                            # Get point at 45% and 55% to determine vector
                            p1 = geom.interpolate(0.45, normalized=True)
                            p2 = geom.interpolate(0.55, normalized=True)
                            if p1 and p2:
                                dx = p2.x - p1.x
                                dy = p2.y - p1.y
                                if abs(dx) > 1e-5 or abs(dy) > 1e-5:
                                    angle = np.degrees(np.arctan2(dy, dx))
                                    # Ensure text is readable (not upside down)
                                    rotation = angle if -90 <= angle <= 90 else angle + 180
                        except Exception:
                            pass

                    try:
                        safe_val = self._safe_v(rotation)
                        safe_align = (self._safe_v(centroid.x - diff_x), self._safe_v(centroid.y - diff_y))
                        text = self.msp.add_text(
                            name, 
                            dxfattribs={
                                'layer': 'TEXTO', 
                                'height': 2.5,
                                'rotation': safe_val,
                                'style': 'PRO_STYLE'
                            }
                        )
                        # AutoCAD REQUIRES both insert and align_point to be the same for centered text
                        text.dxf.halign = 1 # Center
                        text.dxf.valign = 2 # Middle
                        text.dxf.insert = safe_align
                        text.dxf.align_point = safe_align
                    except Exception as te:
                        Logger.info(f"Label creation failed: {te}")

        if isinstance(geom, Polygon):
            self._draw_polygon(geom, layer, diff_x, diff_y, tags)
        elif isinstance(geom, MultiPolygon):
            for poly in geom.geoms:
                self._draw_polygon(poly, layer, diff_x, diff_y, tags)
        if isinstance(geom, LineString):
            self._draw_linestring(geom, layer, diff_x, diff_y)
            # Draw offsets for streets
            if layer == 'VIAS' and 'highway' in tags:
                 self._draw_street_offsets(geom, tags, diff_x, diff_y) # Call offset method

        elif isinstance(geom, MultiLineString):
            for line in geom.geoms:
                self._draw_linestring(line, layer, diff_x, diff_y)
                if layer == 'VIAS' and 'highway' in tags:
                     self._draw_street_offsets(line, tags, diff_x, diff_y)

        elif isinstance(geom, Point):
            self._draw_point(geom, layer, diff_x, diff_y, tags)

    def _draw_street_offsets(self, line, tags, diff_x, diff_y):
        """Draws parallel lines (curbs) for streets using authoritative widths."""
        highway = tags.get('highway', 'residential')
        if highway in ['footway', 'path', 'cycleway', 'steps']:
            return # Skip thin paths
            
        # Get width from centralized StyleManager
        width = DXFStyleManager.get_street_width(highway)
        
        try:
            # Shapely 2.0+ uses offset_curve
            if hasattr(line, 'offset_curve'):
                 left = line.offset_curve(width, join_style=2)
                 right = line.offset_curve(-width, join_style=2)
            else:
                 left = line.parallel_offset(width, 'left', join_style=2)
                 right = line.parallel_offset(width, 'right', join_style=2)
            
            for side_geom in [left, right]:
                if side_geom.is_empty: continue
                
                if isinstance(side_geom, LineString):
                     pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in side_geom.coords]
                     pts = self._validate_points(pts, min_points=2)
                     if pts:
                        self.msp.add_lwpolyline(pts, dxfattribs={'layer': 'VIAS_MEIO_FIO'})
                elif isinstance(side_geom, MultiLineString):
                     for subline in side_geom.geoms:
                           pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in subline.coords]
                           pts = self._validate_points(pts, min_points=2)
                           if pts:
                                self.msp.add_lwpolyline(pts, dxfattribs={'layer': 'VIAS_MEIO_FIO'})
        except Exception as e:
            Logger.info(f"Street offset failed: {e}")

    def _get_thickness(self, tags, layer):
        """Calculates extrusion height based on OSM tags"""
        if layer != 'EDIFICACAO':
            return 0.0
            
        try:
            # Try specific height first
            if 'height' in tags:
                # Handle "10 m" or "10"
                h = str(tags['height']).split(' ')[0]
                val = float(h)
                return self._safe_v(val, default=3.5)
            
            # Try levels
            if 'building:levels' in tags:
                val = float(tags['building:levels']) * 3.0
                return self._safe_v(val, default=3.5)
            
            if 'levels' in tags:
                 val = float(tags['levels']) * 3.0
                 return self._safe_v(val, default=3.5)

            # Default for buildings
            return 3.5
        except:
            return 3.5

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags):
        # Calculate thickness (height)
        thickness = self._get_thickness(tags, layer)
        dxf_attribs = {'layer': layer, 'thickness': thickness}

        # Exterior
        points = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in poly.exterior.coords]
        points = self._validate_points(points, min_points=3)  # Polygons need at least 3 points
        if not points:
            return  # Skip invalid polygon
        self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)
        
        if layer == 'EDIFICACAO':
            try:
                area = poly.area
                centroid = poly.centroid
                if centroid and not (math.isnan(area) or math.isinf(area) or math.isnan(centroid.x) or math.isnan(centroid.y)):
                    safe_p = (self._safe_v(centroid.x - diff_x), self._safe_v(centroid.y - diff_y))
                    txt = self.msp.add_text(
                        f"{area:.1f} m2",
                        dxfattribs={
                            'layer': 'ANNOT_AREA',
                            'height': 1.5,
                            'color': 7
                        }
                    )
                    txt.dxf.halign = 1
                    txt.dxf.valign = 2
                    txt.dxf.insert = safe_p
                    txt.dxf.align_point = safe_p
            except Exception as e:
                Logger.info(f"Area annotation failed: {e}")

            # High-Fidelity Hatching (ANSI31) - Use validated points
            # AutoCAD's hatch engine hates micro-gaps (< 0.001 units)
            # We deduplicate points with a small epsilon
            try:
                def deduplicate_epsilon(pts, eps=0.001):
                    if not pts: return []
                    res = [pts[0]]
                    for i in range(1, len(pts)):
                        if math.dist(pts[i], res[-1]) > eps:
                            res.append(pts[i])
                    return res

                clean_points = deduplicate_epsilon(points)
                if clean_points and len(clean_points) >= 3:
                    hatch = self.msp.add_hatch(color=253, dxfattribs={'layer': 'EDIFICACAO_HATCH'})
                    hatch.set_pattern_fill('ANSI31', scale=0.5, angle=45.0)
                    hatch.paths.add_polyline_path(clean_points, is_closed=True)
            except Exception as he:
                Logger.info(f"Hatch failed for building: {he}")

        # Holes (optional, complex polygons)
        for interior in poly.interiors:
             points = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in interior.coords]
             points = self._validate_points(points, min_points=3)
             if points:
                 self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)

    def _draw_linestring(self, line, layer, diff_x, diff_y):
        points = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords]
        points = self._validate_points(points, min_points=2)
        if not points:
            return  # Skip invalid linestring
        self.msp.add_lwpolyline(points, close=False, dxfattribs={'layer': layer})
        
        # Annotate length for roads
        if layer == 'VIAS':
            try:
                length = line.length
                if not (math.isnan(length) or math.isinf(length)):
                    mid = line.interpolate(0.5, normalized=True)
                    if mid and not (math.isnan(mid.x) or math.isnan(mid.y)):
                        safe_mid = (self._safe_v(mid.x - diff_x), self._safe_v(mid.y - diff_y))
                        ltxt = self.msp.add_text(
                            f"{length:.1f}m",
                            dxfattribs={
                                'layer': 'ANNOT_LENGTH',
                                'height': 2.0,
                                'color': 7,
                                'rotation': 0.0
                            }
                        )
                        ltxt.dxf.halign = 1
                        ltxt.dxf.valign = 2
                        ltxt.dxf.insert = safe_mid
                        ltxt.dxf.align_point = safe_mid
            except Exception as e:
                Logger.info(f"Length annotation failed: {e}")

    def _sanitize_attribs(self, attribs):
        """Helper to ensure no 'nan' values are sent as attributes"""
        sanitized = {}
        for k, v in attribs.items():
            val = str(v)
            if val.lower() == 'nan' or not val.strip():
                sanitized[k] = "N/A"
            else:
                sanitized[k] = val
        return sanitized

    def _draw_point(self, point, layer, diff_x, diff_y, tags):
        # Draw a small circle or block for points
        if math.isnan(point.x) or math.isnan(point.y):
            return
            
        x, y = self._safe_v(point.x - diff_x), self._safe_v(point.y - diff_y)
        
        # Prepare attributes with non-empty defaults (AutoCAD stability)
        attribs = self._sanitize_attribs({
            'ID': tags.get('osmid', '999'),
            'TYPE': tags.get('power', tags.get('amenity', 'UNKNOWN')),
            'V_LEVEL': tags.get('voltage', '0V')
        })

        if layer == 'VEGETACAO':
             self.msp.add_blockref('ARVORE', (x, y))
        elif layer == 'MOBILIARIO_URBANO':
             amenity = tags.get('amenity')
             highway = tags.get('highway')
             if amenity == 'bench':
                 self.msp.add_blockref('BANCO', (x, y))
             elif amenity == 'waste_basket':
                 self.msp.add_blockref('LIXEIRA', (x, y))
             elif highway == 'street_lamp':
                 self.msp.add_blockref('POSTE_LUZ', (x, y))
             else:
                 self.msp.add_circle((x, y), radius=0.3, dxfattribs={'layer': layer, 'color': 40})
        elif layer == 'EQUIPAMENTOS':
             self.msp.add_blockref('POSTE', (x, y)).add_auto_attribs(attribs)
        elif 'INFRA_POWER' in layer:
             if layer == 'INFRA_POWER_HV' or tags.get('power') == 'tower':
                 self.msp.add_blockref('TORRE', (x, y)).add_auto_attribs(attribs)
             else:
                 self.msp.add_blockref('POSTE', (x, y)).add_auto_attribs(attribs)
        elif layer == 'INFRA_TELECOM':
             self.msp.add_blockref('POSTE', (x, y), dxfattribs={'xscale': 0.8, 'yscale': 0.8}).add_auto_attribs(attribs)
        else:
             self.msp.add_circle((x, y), radius=0.5, dxfattribs={'layer': layer})

    def add_terrain_from_grid(self, grid_rows):
        """
        grid_rows: List of rows, where each row is a list of (x, y, z) tuples.
        """
        if not grid_rows or not grid_rows[0]:
            return
            
        rows = len(grid_rows)
        cols = len(grid_rows[0])
        
        # Ensure dimensions are valid for polymesh (min 2x2)
        if rows < 2 or cols < 2:
            return

        mesh = self.msp.add_polymesh(size=(rows, cols), dxfattribs={'layer': 'TERRENO', 'color': 252})
        
        for r, row in enumerate(grid_rows):
            for c, p in enumerate(row):
                try:
                    # Apply AUTHORITATIVE OFFSET with absolute safety
                    x = self._safe_v(float(p[0]) - self.diff_x)
                    y = self._safe_v(float(p[1]) - self.diff_y)
                    z = self._safe_v(float(p[2]))
                    mesh.set_mesh_vertex((r, c), (x, y, z))
                except:
                    mesh.set_mesh_vertex((r, c), (0.0, 0.0, 0.0))

    def add_contour_lines(self, contour_lines):
        """
        Draws contour lines.
        contour_lines: List of points [(x, y, z), ...] or list of lists of points.
        """
        for line_points in contour_lines:
             if len(line_points) < 2:
                 continue
             
             # Draw as 3D Polyline (polyline with elevation)
             # ezdxf add_lwpolyline is 2D with constant elevation.
             # If points have different Z (unlikely for a contour line), we need Polyline.
             # Use simple 3D Polyline
             valid_line = self._validate_points(line_points, min_points=2, is_3d=True)
             if valid_line:
                 self.msp.add_polyline3d(
                     valid_line, 
                     dxfattribs={'layer': 'TOPOGRAFIA_CURVAS', 'color': 8}
                 )

    def add_cartographic_elements(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Adds North Arrow and Scale Bar to the drawing"""
        try:
            # Place North Arrow at top-right with margin
            margin = 10.0
            na_x = self._safe_v(max_x - diff_x - margin)
            na_y = self._safe_v(max_y - diff_y - margin)
            self.msp.add_blockref('NORTE', (na_x, na_y))

            # Place Scale Bar at bottom-right
            sb_x = self._safe_v(max_x - diff_x - 30.0)
            sb_y = self._safe_v(min_y - diff_y + margin)
            self.msp.add_blockref('ESCALA', (sb_x, sb_y))
        except Exception as e:
            Logger.info(f"Cartographic elements failed: {e}")

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Draws a boundary frame with coordinate labels"""
        # Strictly validate all grid inputs
        min_x, max_x = self._safe_v(min_x), self._safe_v(max_x)
        min_y, max_y = self._safe_v(min_y), self._safe_v(max_y)
        diff_x, diff_y = self._safe_v(diff_x), self._safe_v(diff_y)

        # Outer Frame
        frame_pts = [
            (min_x - diff_x - 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, max_y - diff_y + 5),
            (min_x - diff_x - 5, max_y - diff_y + 5)
        ]
        self.msp.add_lwpolyline(frame_pts, close=True, dxfattribs={'layer': 'QUADRO', 'color': 7})

        # Tick marks and labels (every 50m)
        step = 50.0
        # horizontal ticks (x)
        x_range = np.arange(np.floor(min_x/step)*step, max_x + 1, step)
        for x in x_range[:50]: # Limit to 50 ticks max per axis
            dx = self._safe_v(x - diff_x)
            if min_x - 5 <= x <= max_x + 5:
                # Bottom label
                try:
                    self.msp.add_text(f"E: {x:.0f}", dxfattribs={'height': 2, 'layer': 'QUADRO'}).set_placement(
                        (dx, min_y - diff_y - 8), align=TextEntityAlignment.CENTER
                    )
                except: pass
        # vertical ticks (y)
        y_range = np.arange(np.floor(min_y/step)*step, max_y + 1, step)
        for y in y_range[:50]:
            dy = self._safe_v(y - diff_y)
            if min_y - 5 <= y <= max_y + 5:
                # Left label
                try:
                    self.msp.add_text(f"N: {y:.0f}", dxfattribs={'height': 2, 'layer': 'QUADRO', 'rotation': 90.0}).set_placement(
                        (min_x - diff_x - 8, dy), align=TextEntityAlignment.CENTER
                    )
                except: pass

    def add_legend(self):
        """Adds a professional legend to the Model Space"""
        min_x, min_y, max_x, max_y = self.bounds
        # Place to the right of the drawing with safety
        start_x = self._safe_v(max_x - self.diff_x + 20)
        start_y = self._safe_v(max_y - self.diff_y)
        
        # Legend Header
        self.msp.add_text("LEGENDA TÉCNICA", dxfattribs={'height': 4, 'style': 'PRO_STYLE', 'layer': 'QUADRO'}).set_placement((start_x, start_y))
        
        items = [
            ("EDIFICAÇÕES", "EDIFICACAO", 5),
            ("VIAS / RUAS", "VIAS", 1),
            ("MEIO-FIO", "VIAS_MEIO_FIO", 9),
            ("VEGETAÇÃO", "VEGETACAO", 3),
            ("ILUMINAÇÃO PÚBLICA", "MOBILIARIO_URBANO", 2),
            ("REDE ELÉTRICA (AT)", "INFRA_POWER_HV", 1),
            ("REDE ELÉTRICA (BT)", "INFRA_POWER_LV", 30),
            ("TELECOMUNICAÇÕES", "INFRA_TELECOM", 90),
            ("CURVAS DE NÍVEL", "TOPOGRAFIA_CURVAS", 8)
        ]
        
        y_offset = -10
        for label, layer, color in items:
            # Sample Geometry
            self.msp.add_line((start_x, start_y + y_offset), (start_x + 10, start_y + y_offset), dxfattribs={'layer': layer, 'color': color})
            self.msp.add_text(label, dxfattribs={'height': 2.5, 'layer': 'QUADRO'}).set_placement((start_x + 12, start_y + y_offset - 1))
            y_offset -= 8

    def add_title_block(self, client="N/A", project="Projeto Urbanístico", designer="sisRUA AI"):
        """Creates a professional A3 Title Block in Paper Space"""
        # 1. Create Layout
        layout = self.doc.layout('Layout1')
        
        # A3 is roughly 420x297 units (mm)
        width, height = 420, 297
        
        # 2. Draw A3 Border
        layout.add_lwpolyline([(0, 0), (width, 0), (width, height), (0, height)], close=True, dxfattribs={'layer': 'QUADRO', 'lineweight': 50})
        
        # 3. Create Viewport (Visualizing Model Space)
        # Place it inside the border
        vp = layout.add_viewport(
            center=(width/2, height/2 + 20),
            size=(width - 40, height - 80),
            view_center_point=(0, 0),
            view_height=200 # Zoom level
        )
        vp.dxf.status = 1
        
        # 4. Draw Title Block (Carimbo) - Bottom Right Corner
        cb_x, cb_y = width - 185, 0
        cb_w, cb_h = 185, 50
        
        # Main box
        layout.add_lwpolyline([(cb_x, cb_y), (cb_x + cb_w, cb_y), (cb_x + cb_w, cb_y + cb_h), (cb_x, cb_y + cb_h)], close=True, dxfattribs={'layer': 'QUADRO'})
        
        # Sub-divisions
        layout.add_line((cb_x, cb_y + 25), (cb_x + cb_w, cb_y + 25), dxfattribs={'layer': 'QUADRO'})
        layout.add_line((cb_x + 100, cb_y), (cb_x + 100, cb_y + 25), dxfattribs={'layer': 'QUADRO'})
        
        # Add Text Fields (Sanitized)
        import datetime
        date_str = datetime.date.today().strftime("%d/%m/%Y")
        
        # Project Title with standardized alignment
        p_name = str(project).upper()
        c_name = str(client)
        d_name = str(designer)
        
        def add_layout_text(text, pos, height, style='PRO_STYLE'):
            t = layout.add_text(text, dxfattribs={'height': height, 'style': style})
            t.dxf.halign = 0 # Left
            t.dxf.valign = 0 # Baseline
            t.dxf.insert = pos
            t.dxf.align_point = pos
            return t

        add_layout_text(f"PROJETO: {p_name[:50]}", (cb_x + 5, cb_y + 35), 4)
        add_layout_text(f"CLIENTE: {c_name[:50]}", (cb_x + 5, cb_y + 15), 3)
        add_layout_text(f"DATA: {date_str}", (cb_x + 105, cb_y + 15), 2.5)
        add_layout_text(f"ENGINE: sisRUA Unified v1.5", (cb_x + 105, cb_y + 5), 2)
        add_layout_text(f"RESPONSÁVEL: {d_name[:50]}", (cb_x + 5, cb_y + 5), 2.5)
        
        # Logo
        try:
            layout.add_blockref('LOGO', (cb_x + cb_w - 20, cb_y + cb_h - 10))
        except: pass


    def save(self):
        # Professional finalization
        try:
            self.add_legend()
            self.add_title_block(
                client=self.project_info.get('client', 'CLIENTE PADRÃO'),
                project=self.project_info.get('project', 'EXTRACAO ESPACIAL OSM')
            )
            self.doc.saveas(self.filename)
            Logger.info(f"DXF saved successfully: {os.path.basename(self.filename)}")
        except Exception as e:
            Logger.error(f"DXF Save Error: {e}")
