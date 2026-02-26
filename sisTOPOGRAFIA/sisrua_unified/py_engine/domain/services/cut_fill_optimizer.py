import numpy as np
from pyproj import Transformer
from shapely.geometry import Polygon, Point
import math

try:
    from utils.geo import sirgas2000_utm_epsg
    from domain.elevation_processor import fetch_elevation_grid
except ImportError:  # pragma: no cover
    from ..utils.geo import sirgas2000_utm_epsg
    from .elevation_processor import fetch_elevation_grid

class CutFillOptimizer:
    def __init__(self, polygon_points, target_z=None, auto_balance=False):
        self.polygon_points = polygon_points
        self.target_z = target_z
        self.auto_balance = auto_balance

    def calculate(self):
        if not self.polygon_points or len(self.polygon_points) < 3:
            raise ValueError("Polygon must have at least 3 points")

        # Normalize to list of [lat, lon]
        norm_pts = []
        for p in self.polygon_points:
            if isinstance(p, dict):
                lat = p.get('lat', 0.0)
                lon = p.get('lng', p.get('lon', 0.0))
                norm_pts.append([lat, lon])
            elif isinstance(p, (list, tuple)):
                norm_pts.append(list(p))
            else:
                raise ValueError(f"Unsupported point format: {type(p)}")

        lats = [p[0] for p in norm_pts]
        lons = [p[1] for p in norm_pts]
        
        north, south = max(lats), min(lats)
        east, west = max(lons), min(lons)
        
        buffer = 0.0001 
        elevations, rows, cols = fetch_elevation_grid(
            north + buffer, south - buffer, 
            east + buffer, west - buffer, 
            resolution=2 
        )
        
        if not elevations:
            raise Exception("No elevation data received for the target area.")

        center_lat = sum(lats) / len(lats)
        center_lon = sum(lons) / len(lons)
        epsg = sirgas2000_utm_epsg(center_lat, center_lon)
        transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        
        utm_poly_points = [transformer.transform(p[1], p[0]) for p in norm_pts]
        shapely_poly = Polygon(utm_poly_points)
        poly_area = shapely_poly.area
        
        if poly_area <= 0: raise ValueError("Invalid polygon area.")

        x1, y1 = transformer.transform(west - buffer, south - buffer)
        x2, y2 = transformer.transform(east + buffer, north + buffer)
        dx = abs(x2 - x1) / (cols - 1) if cols > 1 else 1.0
        dy = abs(y2 - y1) / (rows - 1) if rows > 1 else 1.0
        cell_area = dx * dy

        # Filter internal elevations
        internal_elevs = []
        for (lat, lon, elev) in elevations:
            x, y = transformer.transform(lon, lat)
            if shapely_poly.contains(Point(x, y)):
                internal_elevs.append(elev)

        if not internal_elevs:
            center_elev = sum([p[2] for p in elevations]) / len(elevations)
            internal_elevs = [center_elev]

        avg_elevation = sum(internal_elevs) / len(internal_elevs)

        # Se auto_balance for requisitado, a cota alvo (optimal_z) 
        # será iterativamente ajustada até o balanço se anular.
        # Aproximação primária: Z ótimo é a média das cotas da malha DENTRO do polígono.
        if self.auto_balance or self.target_z is None:
            self.target_z = self._find_optimal_pad_elevation(internal_elevs, cell_area, poly_area)

        # Cálculo Final com o target_z resolvido
        total_cut, total_fill = self._compute_volumes(internal_elevs, cell_area, poly_area, self.target_z)

        return {
            "cut_volume": float(total_cut),
            "fill_volume": float(total_fill),
            "net_volume": float(total_fill - total_cut),
            "area_m2": float(poly_area),
            "stats": {
                "pointsSampled": len(internal_elevs),
                "avgElevation": avg_elevation,
                "optimized_z": self.auto_balance,
                "target_z": self.target_z
            }
        }

    def _compute_volumes(self, internal_elevs, cell_area, poly_area, target_z):
        total_cut = 0.0
        total_fill = 0.0

        if len(internal_elevs) == 1:
            dz = target_z - internal_elevs[0]
            vol = abs(dz) * poly_area
            if dz > 0: total_fill = vol
            else: total_cut = vol
            return total_cut, total_fill

        for elev in internal_elevs:
            dz = target_z - elev
            volume = abs(dz) * cell_area
            if dz > 0:
                total_fill += volume
            elif dz < 0:
                total_cut += volume
                
        return total_cut, total_fill

    def _find_optimal_pad_elevation(self, internal_elevs, cell_area, poly_area):
        """
        Calcula a cota de balanço ideal (Corte == Aterro) por busca binária iterativa.
        """
        z_min = min(internal_elevs)
        z_max = max(internal_elevs)
        
        # Convergência numérica
        optimal_z = (z_min + z_max) / 2.0
        tolerance = 0.01  # 1 cm de tolerância na cota
        max_iters = 50
        
        for _ in range(max_iters):
            cut, fill = self._compute_volumes(internal_elevs, cell_area, poly_area, optimal_z)
            net = fill - cut
            
            # Se net for positivo, há mais aterro que corte -> precisa abaixar a cota
            # Se net for negativo, há mais corte que aterro -> precisa subir a cota
            if abs(net) < 1.0: # Tolerância de 1 m³
                break
                
            if net > 0:
                z_max = optimal_z
            else:
                z_min = optimal_z
                
            optimal_z = (z_min + z_max) / 2.0
            
        return optimal_z
