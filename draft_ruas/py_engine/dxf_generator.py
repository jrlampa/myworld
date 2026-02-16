import ezdxf
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point
import geopandas as gpd
try:
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager
from ezdxf.enums import TextEntityAlignment

class DXFGenerator:
    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new('R2013')
        self.diff_x = 0
        self.diff_y = 0
        self.bounds = None
        
        # Setup CAD standards via StyleManager (SRP Refactor)
        DXFStyleManager.setup_all(self.doc)
        
        self.msp = self.doc.modelspace()
        self.project_info = {} # Store metadata for title block

    # Legacy setup methods removed (handled by StyleManager)

    def add_features(self, gdf):
        """
        Iterates over a GeoDataFrame and adds entities to the DXF.
        Assumes the GDF is projected (units in meters).
        """
        if gdf.empty:
            return

        # Center the drawing roughly around (0,0) based on the first feature
        self.diff_x = gdf.geometry.centroid.x.mean()
        self.diff_y = gdf.geometry.centroid.y.mean()
        self.bounds = gdf.total_bounds # [minx, miny, maxx, maxy]

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

    def _draw_geometry(self, geom, layer, diff_x, diff_y, tags):
        """Recursive geometry drawing with text support"""
        if geom.is_empty:
            return

        # Draw Labels for Streets
        if layer == 'VIAS' and 'name' in tags:
            # Use centroid of the line to place text
            # Better: Find the longest segment or middle segment for rotation
            rotation = 0
            centroid = geom.centroid
            
            if isinstance(geom, LineString):
                try:
                    # Get point at 45% and 55% to determine vector
                    p1 = geom.interpolate(0.45, normalized=True)
                    p2 = geom.interpolate(0.55, normalized=True)
                    dx = p2.x - p1.x
                    dy = p2.y - p1.y
                    angle = np.degrees(np.arctan2(dy, dx))
                    
                    # Ensure text is readable (not upside down)
                    if -90 <= angle <= 90:
                         rotation = angle
                    else:
                         rotation = angle + 180
                except Exception as e:
                    Logger.info(f"Label orientation skipped for complex geometry: {e}")
                    pass

            text = self.msp.add_text(
                tags['name'], 
                dxfattribs={
                    'layer': 'TEXTO_RUAS', 
                    'height': 2.5,
                    'rotation': rotation,
                    'style': 'PRO_STYLE'
                }
            )
            # Alignment MIDDLE_CENTER (halign=1, valign=2)
            # For these alignments, insert point is ignored, align_point is used.
            text.dxf.halign = 1
            text.dxf.valign = 2
            text.dxf.align_point = (centroid.x - diff_x, centroid.y - diff_y)

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
        """Draws parallel lines (curbs) for streets"""
        # Determine width (half-width)
        highway = tags.get('highway', 'residential')
        width = 4.0 # Default residential 8m
        
        if highway in ['motorway', 'trunk']:
            width = 10.0
        elif highway in ['primary', 'secondary']:
            width = 7.0
        elif highway in ['tertiary']:
            width = 5.0
        elif highway in ['service', 'living_street', 'track']:
            width = 3.0
        elif highway in ['footway', 'path', 'cycleway', 'pedestrian', 'steps']:
            return # Don't draw curbs for paths
            
        try:
            # Create offsets
            # Shapely's parallel_offset was deprecated for offset_curve in 2.0
            # Check version or use offset_curve if available, otherwise parallel_offset
            if hasattr(line, 'offset_curve'):
                 left = line.offset_curve(width, join_style=2) # 2=mitre/round?
                 right = line.offset_curve(-width, join_style=2)
            else:
                 # Fallback for older shapely
                 left = line.parallel_offset(width, 'left', join_style=2)
                 right = line.parallel_offset(width, 'right', join_style=2)
            
            # Draw them
            for side_geom in [left, right]:
                if side_geom.is_empty: continue
                
                if isinstance(side_geom, LineString):
                     pts = [(p[0] - diff_x, p[1] - diff_y) for p in side_geom.coords]
                     self.msp.add_lwpolyline(pts, dxfattribs={'layer': 'VIAS_MEIO_FIO', 'color': 9})
                elif isinstance(side_geom, MultiLineString):
                     for subline in side_geom.geoms:
                         pts = [(p[0] - diff_x, p[1] - diff_y) for p in subline.coords]
                         self.msp.add_lwpolyline(pts, dxfattribs={'layer': 'VIAS_MEIO_FIO', 'color': 9})
        except Exception as e:
            # Offset can fail on complex geometries or self-intersections
            Logger.info(f"Vias offset skipped for segment: {e}")
            pass

    def _get_thickness(self, tags, layer):
        """Calculates extrusion height based on OSM tags"""
        if layer != 'EDIFICACAO':
            return 0.0
            
        try:
            # Try specific height first
            if 'height' in tags:
                # Handle "10 m" or "10"
                h = str(tags['height']).split(' ')[0]
                return float(h)
            
            # Try levels
            if 'building:levels' in tags:
                return float(tags['building:levels']) * 3.0 # Assume 3m per floor
            
            if 'levels' in tags:
                 return float(tags['levels']) * 3.0

            # Default for buildings
            return 3.5
        except:
            return 3.5

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags):
        # Calculate thickness (height)
        thickness = self._get_thickness(tags, layer)
        dxf_attribs = {'layer': layer, 'thickness': thickness}

        # Exterior
        points = [(p[0] - diff_x, p[1] - diff_y) for p in poly.exterior.coords]
        self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)
        
        if layer == 'EDIFICACAO':
            area = poly.area
            centroid = poly.centroid
            self.msp.add_text(
                f"{area:.1f} m2",
                dxfattribs={
                    'layer': 'ANNOT_AREA',
                    'height': 1.5,
                    'color': 7
                }
            ).set_placement((centroid.x - diff_x, centroid.y - diff_y), align=TextEntityAlignment.CENTER)

            # High-Fidelity Hatching (ANSI31)
            hatch = self.msp.add_hatch(color=253, dxfattribs={'layer': 'EDIFICACAO_HATCH'})
            hatch.set_pattern_fill('ANSI31', scale=0.5, angle=45)
            hatch.paths.add_polyline_path(points, is_closed=True)

        # Holes (optional, complex polygons)
        for interior in poly.interiors:
             points = [(p[0] - diff_x, p[1] - diff_y) for p in interior.coords]
             self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)

    def _draw_linestring(self, line, layer, diff_x, diff_y):
        points = [(p[0] - diff_x, p[1] - diff_y) for p in line.coords]
        self.msp.add_lwpolyline(points, close=False, dxfattribs={'layer': layer})
        
        # Annotate length for roads
        if layer == 'VIAS':
            length = line.length
            mid = line.interpolate(0.5, normalized=True)
            self.msp.add_text(
                f"{length:.1f}m",
                dxfattribs={
                    'layer': 'ANNOT_LENGTH',
                    'height': 1.2,
                    'color': 7
                }
            ).set_placement((mid.x - diff_x, mid.y - diff_y), align=TextEntityAlignment.CENTER)

    def _draw_point(self, point, layer, diff_x, diff_y, tags):
        # Draw a small circle or block for points
        x, y = point.x - diff_x, point.y - diff_y
        
        # Prepare attributes
        attribs = {
            'ID': str(tags.get('osmid', 'N/A')),
            'TYPE': str(tags.get('power', tags.get('amenity', 'N/A'))),
            'V_LEVEL': str(tags.get('voltage', 'N/A'))
        }

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

    def draw_terrain_mesh(self, points_3d, center_x, center_y):
        """
        Draws a 3D Mesh from a list of (lat, lon, elev) tuples.
        Points should be a grid.
        
        This implementation creates a Polyface Mesh.
        For a grid, we need to know rows/cols.
        But points_3d is a flat list from elevation_client.
        
        We need to assume they are ordered (row by row).
        """
        if not points_3d:
            return

        # Simple triangulation is hard without structure.
        # But our grid generation was:
        # for lat in lats: for lon in lons:
        # So it is a structured grid.
        
        # We need to project these lat/lon to the same CRS as the other features (UTM)
        # to match the drawing coordinates.
        # This is tricky because DXFGenerator receives projected coords, but points_3d are Lat/Lon.
        # We should project them BEFORE calling this, or handle projection here.
        # Let's project here using osmnx/shapely utils? 
        # Better: Pass projected points to this function.
        
        # Create the mesh
        mesh = self.msp.add_polyface_mesh(dxfattribs={'layer': 'TERRENO', 'color': 252})
        
        # Add vertices
        # We need to reuse vertices for efficiency in PolyfaceMesh?
        # Expected input: 3D points (x, y, z)
        # We assume points_3d are ALREADY projected and centered by the caller.
        
        # For a grid of N rows and M cols
        # We need to reconstruct the grid shape to create faces.
        # This is getting complex to assume shape from list.
        # Let's just create 3DFACES for now between adjacent points if we can infer neighbor.
        
        # Alternative: Delaunay Triangulation?
        # Too heavy to implement from scratch.
        
        # Simpler approach: Just draw points for now to verify Z?
        # No, user wants terrain.
        
        # Let's assume the caller passes a 2D array of points [[(x,y,z), ...], ...]
        pass

    def add_terrain_from_grid(self, grid_points):
        """
        grid_points: List of rows, where each row is a list of (x, y, z) tuples.
        """
        if not grid_points:
            return
            
        mesh = self.msp.add_polyface_mesh(dxfattribs={'layer': 'TERRENO', 'color': 252})
        
        # Flatten points for appending to mesh
        # And keep track of indices
        
        rows = len(grid_points)
        cols = len(grid_points[0]) if rows > 0 else 0
        
        # Add all vertices
        for row in grid_points:
             for p in row:
                 mesh.append_vertex(p)
                 
        # Add faces (quads)
        # Vertex indices are 0-based in ezdxf logic (but 1-based in DXF spec, ezdxf handles it)
        for r in range(rows - 1):
            for c in range(cols - 1):
                # Indices in the flattened list
                i1 = r * cols + c
                i2 = r * cols + (c + 1)
                i3 = (r + 1) * cols + (c + 1)
                i4 = (r + 1) * cols + c
                
                # Add quad face
                mesh.append_face([i1, i2, i3, i4])

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
             self.msp.add_polyline3d(
                 line_points, 
                 dxfattribs={'layer': 'TOPOGRAFIA_CURVAS', 'color': 8}
             )

    def add_cartographic_elements(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Adds North Arrow and Scale Bar to the drawing"""
        # Place North Arrow at top-right with margin
        margin = 10
        na_x = max_x - diff_x - margin
        na_y = max_y - diff_y - margin
        self.msp.add_blockref('NORTE', (na_x, na_y))

        # Place Scale Bar at bottom-right
        sb_x = max_x - diff_x - 30 # 30m from right
        sb_y = min_y - diff_y + margin
        self.msp.add_blockref('ESCALA', (sb_x, sb_y))

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Draws a boundary frame with coordinate labels"""
        # Outer Frame
        frame_pts = [
            (min_x - diff_x - 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, max_y - diff_y + 5),
            (min_x - diff_x - 5, max_y - diff_y + 5)
        ]
        self.msp.add_lwpolyline(frame_pts, close=True, dxfattribs={'layer': 'QUADRO', 'color': 7})

        # Tick marks and labels (every 50m)
        step = 50
        # horizontal ticks (x)
        for x in np.arange(np.floor(min_x/step)*step, max_x, step):
            dx = x - diff_x
            if min_x - 5 <= x <= max_x + 5:
                # Bottom label
                self.msp.add_text(f"E: {x:.0f}", dxfattribs={'height': 2, 'layer': 'QUADRO'}).set_placement(
                    (dx, min_y - diff_y - 8), align=TextEntityAlignment.CENTER
                )
        # vertical ticks (y)
        for y in np.arange(np.floor(min_y/step)*step, max_y, step):
            dy = y - diff_y
            if min_y - 5 <= y <= max_y + 5:
                # Left label
                self.msp.add_text(f"N: {y:.0f}", dxfattribs={'height': 2, 'layer': 'QUADRO', 'rotation': 90}).set_placement(
                    (min_x - diff_x - 8, dy), align=TextEntityAlignment.CENTER
                )

    def add_legend(self):
        """Adds a professional legend to the Model Space"""
        if self.bounds is None: return
        
        min_x, min_y, max_x, max_y = self.bounds
        # Place to the right of the drawing
        start_x = max_x - self.diff_x + 20
        start_y = max_y - self.diff_y
        
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
        
        # Add Text Fields
        import datetime
        date_str = datetime.date.today().strftime("%d/%m/%Y")
        
        # Project Title
        layout.add_text(f"PROJETO: {project.upper()}", dxfattribs={'height': 4, 'style': 'PRO_STYLE'}).set_placement((cb_x + 5, cb_y + 35))
        layout.add_text(f"CLIENTE: {client}", dxfattribs={'height': 3}).set_placement((cb_x + 5, cb_y + 15))
        layout.add_text(f"DATA: {date_str}", dxfattribs={'height': 2.5}).set_placement((cb_x + 105, cb_y + 15))
        layout.add_text(f"ENGINE: sisRUA v1.5", dxfattribs={'height': 2}).set_placement((cb_x + 105, cb_y + 5))
        
        # Designer
        layout.add_text(f"RESPONSÁVEL: {designer}", dxfattribs={'height': 2.5}).set_placement((cb_x + 5, cb_y + 5))
        
        # Logo
        layout.add_blockref('LOGO', (cb_x + cb_w - 20, cb_y + cb_h - 10))

    def add_terrain_from_grid(self, grid_rows):
        """Adds a 3D Polyface Mesh from an elevation grid."""
        if not grid_rows or not grid_rows[0]: return
        
        try:
            rows = len(grid_rows)
            cols = len(grid_rows[0])
            # Use add_polymesh for R2010 compatibility
            mesh = self.msp.add_polymesh(size=(rows, cols), dxfattribs={'layer': 'TERRENO', 'color': 252})
            for r, row in enumerate(grid_rows):
                for c, (x, y, z) in enumerate(row):
                    mesh.set_mesh_vertex((r, c), (x, y, z))
        except Exception as e:
            print(f"Mesh generation error: {e}")

    def save(self):
        # Professional finalization
        self.add_legend()
        self.add_title_block(
            client=self.project_info.get('client', 'CLIENTE PADRÃO'),
            project=self.project_info.get('project', 'EXTRACAO ESPACIAL OSM')
        )
        self.doc.saveas(self.filename)
