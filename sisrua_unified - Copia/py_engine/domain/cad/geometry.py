from typing import List, Tuple, Union
from shapely.geometry import LineString, Polygon, MultiLineString, MultiPolygon
from shapely.ops import clip_by_rect

class GeometryUtil:
    """Utility for advanced geometric operations like strict polygon clipping."""

    @staticmethod
    def clip_polyline(polyline: List[Tuple[float, float, float]], clip_poly_coords: List[Tuple[float, float]]) -> List[List[Tuple[float, float, float]]]:
        """
        Clips a 3D polyline by a 2D polygon.
        Returns a list of clipped polylines (since clipping can split one line into many).
        """
        if not clip_poly_coords:
            return [polyline]
            
        try:
            line = LineString(polyline)
            clip_poly = Polygon(clip_poly_coords)
            
            if not clip_poly.is_valid:
                clip_poly = clip_poly.buffer(0)
                
            clipped = line.intersection(clip_poly)
            
            result = []
            if clipped.is_empty:
                return []
            
            if clipped.geom_type == 'LineString':
                result.append(list(clipped.coords))
            elif clipped.geom_type == 'MultiLineString':
                for geom in clipped.geoms:
                    result.append(list(geom.coords))
            elif clipped.geom_type == 'GeometryCollection':
                for geom in clipped.geoms:
                    if geom.geom_type == 'LineString':
                        result.append(list(geom.coords))
                    elif geom.geom_type == 'MultiLineString':
                         for subgeom in geom.geoms:
                            result.append(list(subgeom.coords))
                            
            return result
        except Exception as e:
            print(f"Clipping failed: {e}")
            return [polyline]

    @staticmethod
    def clip_polygon(poly_coords: List[Tuple[float, float]], clip_poly_coords: List[Tuple[float, float]]) -> List[List[Tuple[float, float]]]:
        """
        Clips a 2D polygon by another 2D polygon.
        """
        if not clip_poly_coords:
            return [poly_coords]
            
        try:
            poly = Polygon(poly_coords)
            clip_poly = Polygon(clip_poly_coords)
            
            if not poly.is_valid: poly = poly.buffer(0)
            if not clip_poly.is_valid: clip_poly = clip_poly.buffer(0)
            
            clipped = poly.intersection(clip_poly)
            
            result = []
            if clipped.is_empty:
                return []
                
            if clipped.geom_type == 'Polygon':
                result.append(list(clipped.exterior.coords))
            elif clipped.geom_type == 'MultiPolygon':
                for geom in clipped.geoms:
                    result.append(list(geom.exterior.coords))
                    
            return result
        except Exception as e:
            print(f"Polygon clipping failed: {e}")
            return [poly_coords]

    @staticmethod
    def calculate_area(coords: List[Tuple[float, float]]) -> float:
        """Calculates area of a 2D polygon using Shapely."""
        try:
            if not coords or len(coords) < 3: return 0.0
            p = Polygon(coords)
            if not p.is_valid: p = p.buffer(0)
            return p.area
        except Exception:
            return 0.0

    @staticmethod
    def calculate_length(coords: List[Tuple[float, ...]]) -> float:
        """Calculates length of a 2D or 3D line using Shapely."""
        try:
            if not coords or len(coords) < 2: return 0.0
            return LineString(coords).length
        except Exception:
            return 0.0
