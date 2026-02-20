import math
import numpy as np
from typing import Dict, List, Optional, Tuple
from pyproj import Geod, Transformer
from ..domain.terrain.satellite_provider import ElevationSample, sample_elevation_batch, sample_elevation_with_fallback
from ..domain.analysis.orchestrator import TopographicAnalyzer
from ..domain.terrain.osm_repository import fetch_osm_features
from ..domain.engineering.profile_engine import ProfileEngine

class TopographyAppService:
    """
    Handles core topographic data fetching and analysis.
    Following SRP, this service does NOT know about DXF or CAD.
    """
    
    def __init__(self):
        self.geod = Geod(ellps="WGS84")

    def get_analysis(
        self, 
        lat: float, 
        lng: float, 
        radius: float, 
        quality_mode: str = "high", 
        bounds: Optional[List[List[float]]] = None,
        target_elevation: Optional[float] = None,
        profile_path: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Main entry point for topographic analysis.
        Returns a rich dictionary with elevation, features, and metrics.
        """
        if bounds:
            # Polygon Sampling
            points = self._polygon_grid_points(bounds, quality_mode)
            # Update center for consistent local projection
            lat, lng = self._get_polygon_center(bounds)
            radius = self._get_polygon_radius(bounds, lat, lng)
        else:
            # Geodesic Ring Sampling
            sample_count = self._quality_to_samples(quality_mode)
            points = self._geodesic_ring_points(lat, lng, radius, sample_count)
        
        # 3. Fetch Elevation (Optimized with GridTiler & Cache)
        from ..domain.terrain.tiler import GridTiler
        tiler = GridTiler()
        samples = tiler.fetch_points(points)

        # 4. Fetch OSM Features
        feature_collection = fetch_osm_features(lat, lng, radius)
        
        # 5. Topographic Analysis
        to_local_xy = self.build_local_projector(lat, lng)
        local_points = [(to_local_xy(s.lat, s.lng)[0], to_local_xy(s.lat, s.lng)[1], s.elevation_m) for s in samples]
        
        grid_size = self._get_grid_size(radius, quality_mode)
        analysis_result = TopographicAnalyzer.analyze_full(
            local_points,
            grid_size=grid_size,
            cell_size=radius * 2 / grid_size if grid_size > 0 else 30.0,
            latitude=lat
        )

        profile_data = None
        if profile_path and analysis_result.elevation_grid is not None:
             local_path = []
             for p in profile_path:
                 lx, ly = to_local_xy(p["lat"], p["lng"])
                 local_path.append((lx, ly))
             
             profile_data = ProfileEngine.calculate_profile(
                 local_path, 
                 analysis_result.elevation_grid, 
                 (-radius, -radius, radius, radius)
             )
        
        # 5.1 Earthworks Analysis (Phase 11)
        earthworks = None
        if target_elevation is not None:
            from ..domain.engineering.earthworks import EarthworksAnalyzer
            clip_poly_local = None
            if bounds:
                clip_poly_local = [to_local_xy(p[1], p[0]) for p in bounds] #lat, lng to x, y
            
            earthworks = EarthworksAnalyzer.calculate_volumes(
                analysis_result.elevation_grid,
                cell_size=radius * 2 / grid_size if grid_size > 0 else 30.0,
                target_elevation=target_elevation,
                clip_poly=clip_poly_local,
                origin=(-radius, -radius)
            )
        
        # 6. Generate Contours (Smart Backend)
        try:
            from ..domain.cad.contour_generator import ContourGenerator
            
            # Use local coordinates limits [-radius, radius]
            # Grid needs to be converted to list if it's numpy
            grid = analysis_result.elevation_grid
            grid_list = grid.tolist() if hasattr(grid, 'tolist') else grid
            
            # Generate Minor (1m) and Major (5m) - configurable?
            # For now, hardcode standard intervals or use quality
            contours_minor = ContourGenerator.generate_contours(
                grid_list, -radius, radius, -radius, radius, 1.0
            ) # Returns list of segments ((x1,y1,z), (x2,y2,z))
            
            contours_major = ContourGenerator.generate_contours(
                grid_list, -radius, radius, -radius, radius, 5.0
            )
            
            # Pack for JSON (Array of arrays or similar)
            # Segment: [[x1, y1, z1], [x2, y2, z2]]
            # Deep convert analysis_result to dict with lists for JSON serialization
            def numpy_to_list(obj):
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                if isinstance(obj, (list, tuple)):
                    return [numpy_to_list(x) for x in obj]
                if hasattr(obj, '__dict__'):
                    return {k: numpy_to_list(v) for k, v in obj.__dict__.items()}
                return obj

            analysis_dict = numpy_to_list(analysis_result)

            return {
                "samples": samples,
                "feature_collection": feature_collection,
                "analysis": analysis_dict,
                "earthworks": earthworks,
                "grid_size": grid_size,
                "to_local_xy": to_local_xy,
                "profile": profile_data,
                "metadata": {"lat": lat, "lng": lng, "radius": radius, "bounds": bounds}
            }
            
        except Exception as e:
            import sys
            print(f"Backend contour generation failed: {e}", file=sys.stderr)
            # Return without contours if fails
            return {
                "samples": samples,
                "feature_collection": feature_collection,
                "analysis": analysis_result,
                "earthworks": earthworks,
                "grid_size": grid_size,
                "to_local_xy": to_local_xy,
                "metadata": {"lat": lat, "lng": lng, "radius": radius, "bounds": bounds}
            }

    def _quality_to_samples(self, quality_mode: str) -> int:
        quality = (quality_mode or "high").lower().strip()
        if quality == "ultra": return 32
        if quality == "high": return 16
        return 8

    def _get_grid_size(self, radius: float, quality_mode: str) -> int:
        target_res = {"ultra": 15.0, "high": 30.0, "low": 80.0}.get(quality_mode, 30.0)
        calc_grid_size = int((radius * 2) / target_res)
        return max(30, min(150, calc_grid_size))

    def _geodesic_ring_points(self, lat: float, lng: float, radius: float, samples: int) -> List[Tuple[float, float]]:
        points = []
        for idx in range(samples):
            azimuth = (360.0 * idx) / samples
            dest_lng, dest_lat, _ = self.geod.fwd(lng, lat, azimuth, radius)
            points.append((dest_lat, dest_lng))
        points.append((lat, lng))
        return points

    @staticmethod
    def build_local_projector(lat: float, lng: float):
        zone = int((lng + 180.0) // 6.0) + 1
        epsg = (32700 if lat < 0 else 32600) + zone
        transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        center_x, center_y = transformer.transform(lng, lat)

        def to_local_xy(point_lat: float, point_lng: float) -> Tuple[float, float]:
            x, y = transformer.transform(point_lng, point_lat)
            return x - center_x, y - center_y

        return to_local_xy

    def _polygon_grid_points(self, bounds: List[List[float]], quality_mode: str) -> List[Tuple[float, float]]:
        """
        Generates a grid of points within the polygon bounds.
        """
        lats = [p[1] for p in bounds]
        lngs = [p[0] for p in bounds]
        min_lat, max_lat = min(lats), max(lats)
        min_lng, max_lng = min(lngs), max(lngs)

        # Estimate step size (degrees) from quality
        # 1 deg lat ~= 111km. 30m ~= 0.00027 deg
        step_meters = {"ultra": 20, "high": 40, "balanced": 80}.get(quality_mode, 40)
        step = step_meters / 111000.0

        points = []
        lat = min_lat
        while lat <= max_lat:
            lng = min_lng
            while lng <= max_lng:
                if self._is_point_in_polygon(lng, lat, bounds):
                    points.append((lat, lng))
                lng += step
            lat += step
            
        # Ensure at least some points if polygon is too small
        if not points:
            points.append(((min_lat + max_lat) / 2, (min_lng + max_lng) / 2))
            
        return points

    def _get_polygon_center(self, bounds: List[List[float]]) -> Tuple[float, float]:
        lats = [p[1] for p in bounds]
        lngs = [p[0] for p in bounds]
        return sum(lats) / len(lats), sum(lngs) / len(lngs)

    def _get_polygon_radius(self, bounds: List[List[float]], center_lat: float, center_lng: float) -> float:
        """
        Calculates approximate radius to cover the polygon (for OSM fetching).
        """
        max_dist = 0
        for p in bounds:
            _, _, dist = self.geod.inv(center_lng, center_lat, p[0], p[1])
            if dist > max_dist:
                max_dist = dist
        return max_dist + 50 # Buffer

    def _is_point_in_polygon(self, x: float, y: float, polygon: List[List[float]]) -> bool:
        """
        Ray-casting algorithm for Point-in-Polygon.
        x: lng, y: lat
        """
        n = len(polygon)
        inside = False
        p1x, p1y = polygon[0]
        for i in range(n + 1):
            p2x, p2y = polygon[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside
