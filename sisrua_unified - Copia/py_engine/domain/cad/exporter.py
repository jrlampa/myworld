import ezdxf
import math
import struct
import numpy as np
from typing import Dict, List, Tuple, Optional
from shapely.geometry import LineString
from .tin_generator import TINGenerator
from .geometry import GeometryUtil

class CADExporter:
    """
    Handles DXF and CAD-related export tasks.
    Following SRP, this service expects clean analysis data.
    """
    
    def __init__(self):
        pass

    def generate_dxf(self, analysis_data: Dict, output_path: str, preset: str = "1:1000") -> Dict:
        """
        Orchestrates DXF generation from analysis results.
        Preset options: "1:500", "1:1000", "1:2000"
        """
        doc = ezdxf.new("R2018")
        msp = doc.modelspace()
        
        self._setup_layers(doc)
        
        metadata = analysis_data["metadata"]
        radius = metadata["radius"]
        samples = analysis_data["samples"]
        to_local_xy = analysis_data["to_local_xy"]
        feature_collection = analysis_data["feature_collection"]
        analysis = analysis_data["analysis"]
        
        # Robust access for both dataclass and dict (from JSON serialization)
        if isinstance(analysis, dict):
            elevation_grid = analysis.get("elevation_grid")
        else:
            elevation_grid = getattr(analysis, "elevation_grid", None)
        
        # Determine clipping polygon (local coordinates)
        clip_poly_local = None
        if "bounds" in metadata and metadata["bounds"]:
            clip_poly_local = [to_local_xy(lat, lng) for lng, lat in metadata["bounds"]]

        # Parse Preset
        contour_interval_minor = 1.0
        contour_interval_major = 5.0
        text_scale = 1.0
        
        if preset == "1:500":
            contour_interval_minor = 0.5
            contour_interval_major = 2.5
            text_scale = 0.5
        elif preset == "1:2000":
            contour_interval_minor = 2.0
            contour_interval_major = 10.0
            text_scale = 2.0
            
        # 1. AOI
        if clip_poly_local:
            msp.add_lwpolyline(clip_poly_local, close=True, dxfattribs={"layer": "TOPO_AOI", "color": 6})
        else:
            msp.add_circle((0.0, 0.0), radius, dxfattribs={"layer": "TOPO_AOI", "color": 6})
        
        # 2. Elevation Points
        for s in samples:
            x, y = to_local_xy(s.lat, s.lng)
            # Skip if clipping is active and point is outside
            if clip_poly_local and not self._is_point_in_local_poly(x, y, clip_poly_local):
                continue
            msp.add_point((x, y, s.elevation_m), dxfattribs={"layer": "TOPO_ELEV", "color": 9})
            
        # 3. Contours
        if elevation_grid is not None:
             self._generate_contours(msp, elevation_grid, radius, contour_interval_minor, contour_interval_major, clip_poly_local)

        # 4. TIN Surface
        if elevation_grid is not None:
            local_pts = [to_local_xy(s.lat, s.lng) for s in samples]
            xs = [p[0] for p in local_pts]
            ys = [p[1] for p in local_pts]
            
            grid_list = elevation_grid.tolist() if hasattr(elevation_grid, 'tolist') else elevation_grid
            
            faces = TINGenerator.generate_faces_from_grid(
                grid_list, 
                min(xs), max(xs), min(ys), max(ys)
            )
            
            # Prepare BIM Metadata for Each Face
            metadata_list = []
            rows = len(elevation_grid)
            cols = len(elevation_grid[0]) if rows > 0 else 0
            
            # Analysis matrices (robust access)
            def get_val(matrix, r, c):
                if matrix is None: return 0.0
                if hasattr(matrix, 'iloc'): # pandas?
                     return matrix.iloc[r, c]
                if hasattr(matrix, 'item'): # numpy
                     return matrix[r, c]
                return matrix[r][c] # list
            
            slopes = analysis.get("slope_degrees") if isinstance(analysis, dict) else getattr(analysis, "slope_degrees", None)
            aspects = analysis.get("aspect") if isinstance(analysis, dict) else getattr(analysis, "aspect", None)
            stabilities = analysis.get("stability_index") if isinstance(analysis, dict) else getattr(analysis, "stability_index", None)
            
            for r in range(rows - 1):
                for c in range(cols - 1):
                    # Each cell has 2 faces. Replicate metadata for both.
                    face_meta = {
                        "Slope_deg": round(float(get_val(slopes, r, c)), 2),
                        "Aspect_deg": round(float(get_val(aspects, r, c)), 2),
                        "Stability_FoS": round(float(get_val(stabilities, r, c)), 2),
                        "Category": "Terrain_Mesh"
                    }
                    metadata_list.append(face_meta) # Tri 1
                    metadata_list.append(face_meta) # Tri 2
            
            TINGenerator.export_tin_to_dxf(msp, faces, layer_name="TOPO_TIN_SURF", metadata_list=metadata_list)
        
        # 4.5 Hydrology
        analysis = analysis_data.get("analysis", {})
        if analysis.get("hydrology_streams"):
            self._draw_streams(msp, analysis["hydrology_streams"], clip_poly_local)
        
        if analysis.get("watersheds"):
             self._draw_watersheds(msp, analysis_data, to_local_xy, clip_poly_local)

        # 5. Features (Buildings, Roads, etc.)
        osm_stats = {"buildings": 0, "roads": 0, "trees": 0}
        if feature_collection:
            osm_stats = self._draw_features(msp, feature_collection, to_local_xy, analysis)

        # 6. Professional Annotations (Legend)
        # Position legend outside the analyzed area (radius + offset)
        self._add_legend_block(msp, radius + 20, radius)

        doc.saveas(output_path)
        return osm_stats

    def _generate_contours(self, msp, grid, radius, interval_minor, interval_major, clip_poly_local=None):
        try:
             from .contour_generator import ContourGenerator
             from .geometry import GeometryUtil
             
             grid_list = grid.tolist() if hasattr(grid, 'tolist') else grid
             
             minors = ContourGenerator.generate_contours(
                 grid_list, -radius, radius, -radius, radius, interval_minor
             )
             
             majors = ContourGenerator.generate_contours(
                 grid_list, -radius, radius, -radius, radius, interval_major
             )
             
             # Add to DXF as LWPOLYLINE (Strict 2.5D)
             for polyline_coords in minors:
                 if not polyline_coords: continue
                 z = polyline_coords[0][2]
                 
                 if abs(z % interval_major) < 0.001: continue
                 
                 # Clip
                 clipped_list = [polyline_coords]
                 if clip_poly_local:
                     clipped_list = GeometryUtil.clip_polyline(polyline_coords, clip_poly_local)
                     
                 for clipped in clipped_list:
                     points_2d = [(p[0], p[1]) for p in clipped]
                     msp.add_lwpolyline(points_2d, dxfattribs={"layer": "TOPO_CONT_MINR", "color": 249, "elevation": z})

             for polyline_coords in majors:
                 if not polyline_coords: continue
                 z = polyline_coords[0][2]
                 
                 clipped_list = [polyline_coords]
                 if clip_poly_local:
                     clipped_list = GeometryUtil.clip_polyline(polyline_coords, clip_poly_local)
                     
                 for clipped in clipped_list:
                     points_2d = [(p[0], p[1]) for p in clipped]
                     msp.add_lwpolyline(points_2d, dxfattribs={"layer": "TOPO_CONT_MAJR", "color": 7, "elevation": z, "lineweight": 30})
                     
                     # Add labels for major contours
                     self._add_contour_label(msp, points_2d, z)
                  
        except Exception as e:
            print(f"Contour generation failed: {e}")

    def _add_contour_label(self, msp, points, elevation):
        """Add text labels to major contours at a reasonable position."""
        if len(points) < 5: return
        
        # Pick middle point for labeling
        mid = len(points) // 2
        p1 = points[mid]
        p2 = points[mid + 1]
        
        # Calculate rotation to align with contour
        angle = math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0]))
        if angle > 90: angle -= 180
        if angle < -90: angle += 180
        
        msp.add_text(
            f"{elevation:.1f}m", 
            dxfattribs={
                "layer": "TOPO_ANNO_CONT", 
                "height": 1.5, 
                "rotation": angle,
                "color": 7
            }
        ).set_placement(p1, align=ezdxf.enums.TextEntityAlignment.MIDDLE)

    def _add_legend_block(self, msp, x_offset, y_offset):
        """Add a professional topographic legend block to the drawing."""
        # Frame
        msp.add_lwpolyline([
            (x_offset, y_offset), (x_offset + 50, y_offset),
            (x_offset + 50, y_offset - 80), (x_offset, y_offset - 80)
        ], close=True, dxfattribs={"layer": "TOPO_ANNO_LEGD", "color": 7})
        
        msp.add_text("TOPOGRAPHIC LEGEND", dxfattribs={"height": 3, "color": 7}).set_placement((x_offset + 25, y_offset - 5), align=ezdxf.enums.TextEntityAlignment.CENTER)
        
        # Items
        items = [
            ("TOPO_CONT_MAJR", "Major Contour (5m)"),
            ("TOPO_CONT_MINR", "Minor Contour (1m)"),
            ("TOPO_ELEV", "Elevation Sample Spot"),
            ("TOPO_HYDR_STRM", "Drainage / Stream"),
            ("TOPO_BLDG", "Building (2.5D)"),
            ("TOPO_ROAD", "Road / Access"),
            ("TOPO_VEGT_TREE", "Vegetation / Tree")
        ]
        
        y = y_offset - 15
        for layer, desc in items:
            # Swatch
            color = 7
            if layer == "TOPO_CONT_MINR": color = 249
            elif layer == "TOPO_HYDR_STRM": color = 5
            elif layer == "TOPO_ELEV": color = 9
            
            msp.add_line((x_offset + 5, y), (x_offset + 15, y), dxfattribs={"layer": layer, "color": color})
            msp.add_text(desc, dxfattribs={"height": 2, "color": 7}).set_placement((x_offset + 18, y - 0.5))
            y -= 8

    def _setup_layers(self, doc):
        """Standardized AutoCAD Layer Naming."""
        layers = {
            "TOPO_AOI": 6, 
            "TOPO_ELEV": 9, 
            "TOPO_BLDG": 1, 
            "TOPO_ROAD": 3, 
            "TOPO_VEGT_TREE": 2, 
            "TOPO_VEGT_FORS": 3,
            "TOPO_TIN_SURF": 252, 
            "TOPO_HYDR_STRM": 5,
            "TOPO_HYDR_BASN": 140, # Dark blue for basins
            "TOPO_HYDR_BASN": 140, 
            "TOPO_CONT_MINR": 249, 
            "TOPO_CONT_MAJR": 7,
            "TOPO_ANNO_CONT": 7,
            "TOPO_ANNO_LEGD": 7
        }
        for name, color in layers.items():
            if name not in doc.layers:
                doc.layers.new(name=name, dxfattribs={"color": color})

        if "SISRUA_BIM" not in doc.appids:
            doc.appids.new("SISRUA_BIM")

    def _add_bim_metadata(self, entity, metadata: Dict):
        """
        Attaches engineering metadata as XData (Extended Data).
        Visible in AutoCAD 'Extended Data' tab or via Properties.
        """
        xdata = []
        for key, value in metadata.items():
            if isinstance(value, float):
                xdata.append((1040, value)) # Double
            elif isinstance(value, int):
                xdata.append((1070, value)) # 16-bit integer
            else:
                xdata.append((1000, f"{key}: {value}")) # String
        
        entity.set_xdata("SISRUA_BIM", xdata)

    def _draw_watersheds(self, msp, analysis_data, to_local_xy, clip_poly_local=None):
        """Vectorizes and draws watershed basins with BIM metadata."""
        from .geometry import GeometryUtil
        analysis = analysis_data.get("analysis", {})
        basins_grid = np.array(analysis.get("watersheds", []))
        if basins_grid.size == 0: return
        
        # Grid parameters
        rows, cols = basins_grid.shape
        metadata = analysis_data.get("metadata", {})
        radius = metadata.get("radius", 500.0)
        
        # We need world bounds to map grid to local XY
        min_x, max_x = -radius, radius
        min_y, max_y = -radius, radius
        dx = (max_x - min_x) / (rows - 1)
        dy = (max_y - min_y) / (cols - 1)
        
        unique_basins = np.unique(basins_grid[basins_grid > 0])
        
        for b_id in unique_basins:
            mask = (basins_grid == b_id)
            coords = np.argwhere(mask)
            if len(coords) < 3: continue
            
            # Reconstruct local XY
            pts = []
            for r, c in coords:
                pts.append((min_x + r * dx, min_y + c * dy))
            
            # Find Convex Hull for the basin polygon
            from shapely.geometry import MultiPoint
            hull = MultiPoint(pts).convex_hull
            if hull.geom_type != 'Polygon': continue
            
            hull_coords = list(hull.exterior.coords)
            
            # Clip if needed
            clipped_list = [hull_coords]
            if clip_poly_local:
                clipped_list = GeometryUtil.clip_polygon(hull_coords, clip_poly_local)
                
            for clipped in clipped_list:
                poly = msp.add_lwpolyline(clipped, close=True, dxfattribs={"layer": "TOPO_HYDR_BASN", "color": 140})
                
                # Attach Metadata
                area = hull.area
                self._add_bim_metadata(poly, {
                    "Type": "Watershed Basin",
                    "ID": int(b_id),
                    "Area_m2": round(area, 2),
                    "Category": "Catchment"
                })

    def _draw_streams(self, msp, streams, clip_poly_local=None):
        from .geometry import GeometryUtil
        for path in streams:
            if not path: continue
            
            clipped_list = [path]
            if clip_poly_local:
                clipped_list = GeometryUtil.clip_polyline([(p[0], p[1], 0) for p in path], clip_poly_local)
                
            for clipped in clipped_list:
                points_2d = [(p[0], p[1]) for p in clipped]
                line = msp.add_lwpolyline(points_2d, dxfattribs={"layer": "TOPO_HYDR_STRM", "color": 5})
                
                # Add BIM metadata for streams if order is available
                # (Simple mapping for now)
                self._add_bim_metadata(line, {
                    "Type": "Stream",
                    "Length_m": round(LineString(points_2d).length, 2),
                    "Phase": "Existing"
                })

    def _is_point_in_local_poly(self, x, y, poly):
        n = len(poly)
        inside = False
        p1x, p1y = poly[0]
        for i in range(n + 1):
            p2x, p2y = poly[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    def _get_z(self, x: float, y: float, analysis: any, radius: float) -> float:
        """Helper to sample elevation from the analysis grid."""
        # analysis can be TerrainMetrics dataclass or dict
        if isinstance(analysis, dict):
            grid = analysis.get('elevation_grid')
        else:
            grid = getattr(analysis, 'elevation_grid', None)
            
        if grid is None: return 0.0
        
        size = len(grid)
        norm_x = (x + radius) / (2 * radius)
        norm_y = (y + radius) / (2 * radius)
        
        if not (0 <= norm_x <= 1 and 0 <= norm_y <= 1): return 0.0
        
        col = min(int(norm_x * (size - 1)), size - 1)
        row = min(int(norm_y * (size - 1)), size - 1)
        return float(grid[row][col])

    def _clip_faces(self, faces, clip_poly):
        # Triangles are simple: keep only if all 3 points are inside or some are inside?
        # Master Level: keep only if centroid is inside
        clipped = []
        for v1, v2, v3 in faces:
            cx = (v1[0] + v2[0] + v3[0]) / 3
            cy = (v1[1] + v2[1] + v3[1]) / 3
            if self._is_point_in_local_poly(cx, cy, clip_poly):
                clipped.append((v1, v2, v3))
        return clipped

    def export_stl(self, analysis_data: Dict, output_path: str):
        """
        Generates a 3D printable STL file from the elevation grid.
        Binary STL format for efficiency.
        """
        analysis = analysis_data["analysis"]
        
        # Robust access
        if isinstance(analysis, dict):
            grid = analysis.get("elevation_grid")
        else:
            grid = getattr(analysis, "elevation_grid", None)
            
        if grid is None: return
        
        metadata = analysis_data["metadata"]
        radius = metadata["radius"]
        size = len(grid)
        step = (radius * 2) / (size - 1)
        
        faces = []
        for r in range(size - 1):
            for c in range(size - 1):
                # Two triangles per cell
                v1 = (c * step - radius, r * step - radius, grid[r][c])
                v2 = ((c+1) * step - radius, r * step - radius, grid[r][c+1])
                v3 = (c * step - radius, (r+1) * step - radius, grid[r+1][c])
                v4 = ((c+1) * step - radius, (r+1) * step - radius, grid[r+1][c+1])
                
                faces.append((v1, v2, v3))
                faces.append((v2, v4, v3))

        # Write Binary STL
        with open(output_path, "wb") as f:
            f.write(b"\0" * 80) # Header
            f.write(struct.pack("<I", len(faces))) # Face count
            for tri in faces:
                # Normal (0,0,0) - optional for most viewers
                f.write(struct.pack("<fff", 0, 0, 0))
                for v in tri:
                    f.write(struct.pack("<fff", v[0], v[1], v[2]))
                f.write(struct.pack("<H", 0)) # Attribute byte count


    def _draw_features(self, msp, collection, to_local_xy, analysis, clip_poly_local=None) -> Dict:
        stats = {"buildings": 0, "roads": 0, "trees": 0}
        
        # Robust radius access
        radius = 500.0
        if isinstance(analysis, dict):
            radius = analysis.get("metadata", {}).get("radius", 500.0)
        else:
            meta = getattr(analysis, "metadata", None)
            if meta: radius = meta.get("radius", 500.0)
        from .geometry import GeometryUtil

        # Buildings
        for bld in collection.buildings:
            local = [to_local_xy(lat, lng) for lat, lng in bld]
            if not local: continue
            
            # Clip polygon
            clipped_list = [local]
            if clip_poly_local:
                clipped_list = GeometryUtil.clip_polygon(local, clip_poly_local)
            
            for clipped in clipped_list:
                cx = sum(p[0] for p in clipped) / len(clipped)
                cy = sum(p[1] for p in clipped) / len(clipped)
                z = self._get_z(cx, cy, analysis, radius)
                
                # Calculate Polygon Area
                area = GeometryUtil.calculate_area(clipped)
                
                poly = msp.add_lwpolyline(clipped, close=True, dxfattribs={"layer": "TOPO_BLDG", "color": 1, "elevation": z, "thickness": 6.0})
                
                # Add BIM Metadata
                self._add_bim_metadata(poly, {
                    "Type": "Building",
                    "Area_m2": round(area, 2),
                    "Elevation": round(z, 2),
                    "Source": "OSM/SISRUA"
                })
                
                stats["buildings"] += 1

        # Roads
        for rd in collection.roads:
            local = [to_local_xy(lat, lng) for lat, lng in rd]
            if not local: continue
            
            clipped_list = [local]
            if clip_poly_local:
                 clipped_list = GeometryUtil.clip_polyline([(p[0], p[1], 0) for p in local], clip_poly_local)
            
            for clipped in clipped_list:
                points_2d = [(p[0], p[1]) for p in clipped]
                self._draw_road_with_offsets(msp, points_2d, "residential", lambda x, y: self._get_z(x, y, analysis, radius))
                stats["roads"] += 1

        # Trees
        for t_lat, t_lng in collection.trees:
            tx, ty = to_local_xy(t_lat, t_lng)
            if clip_poly_local and not self._is_point_in_local_poly(tx, ty, clip_poly_local):
                continue
            tz = self._get_z(tx, ty, analysis, radius)
            msp.add_circle((tx, ty), 1.0, dxfattribs={"layer": "TOPO_VEGT_TREE", "color": 2, "elevation": tz, "thickness": 3.0})
            stats["trees"] += 1

        return stats

    def _draw_road_with_offsets(self, msp, coords, type, elev_func):
        if len(coords) < 2: return
        line = LineString(coords)
        mid = len(coords) // 2
        z = elev_func(coords[mid][0], coords[mid][1])
        msp.add_lwpolyline(coords, dxfattribs={"layer": "TOPO_ROAD", "color": 3, "elevation": z})
        
        width = 3.0
        try:
            l = line.parallel_offset(width, 'left')
            r = line.parallel_offset(width, 'right')
            # Extract coords correctly from possibly MultiLineString
            def add_offset(geom):
                if hasattr(geom, 'coords'):
                    msp.add_lwpolyline(list(geom.coords), dxfattribs={"layer": "TOPO_ROAD", "color": 251, "elevation": z})
                elif hasattr(geom, 'geoms'):
                    for sub in geom.geoms: add_offset(sub)
                    
            add_offset(l)
            add_offset(r)
        except: pass
