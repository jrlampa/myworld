"""
Advanced contour generation with interpolation and multiple detail levels.
Creates professional-grade topographic maps with precise elevation curves.
"""

import numpy as np
from typing import List, Tuple, Dict
from scipy.ndimage import zoom
from scipy.interpolate import griddata
import math


class ContourGenerator:
    """Generate sophisticated contour lines from elevation data."""
    
    @staticmethod
    def generate_contours_interpolated(
        elevation_data: List[Tuple[float, float, float]],  # (x, y, elevation)
        contour_interval: float = 5.0,  # meters between contours
        smoothing: bool = True,
        min_contours: int = 10,
        max_contours: int = 50
    ) -> Dict[float, List[List[Tuple[float, float]]]]:
        """
        Generate contour lines with automatic level selection.
        
        Returns:
            Dictionary mapping elevation levels to lists of contour polylines
        """
        if not elevation_data or len(elevation_data) < 4:
            return {}
        
        try:
            # Extract components
            points = np.array([(p[0], p[1]) for p in elevation_data])
            elevations = np.array([p[2] for p in elevation_data])
            
            # Create grid for interpolation
            x_range = np.max(points[:, 0]) - np.min(points[:, 0])
            y_range = np.max(points[:, 1]) - np.min(points[:, 1])
            grid_size = max(50, int(np.sqrt(len(elevation_data)) * 2))
            
            x_grid = np.linspace(np.min(points[:, 0]), np.max(points[:, 0]), grid_size)
            y_grid = np.linspace(np.min(points[:, 1]), np.max(points[:, 1]), grid_size)
            xx, yy = np.meshgrid(x_grid, y_grid)
            
            # Interpolate using griddata (more sophisticated than IDW)
            try:
                zz = griddata(points, elevations, (xx, yy), method='cubic', fill_value=np.mean(elevations))
            except:
                zz = griddata(points, elevations, (xx, yy), method='linear', fill_value=np.mean(elevations))
            
            # Apply optional smoothing
            if smoothing:
                from scipy.ndimage import gaussian_filter
                zz = gaussian_filter(zz, sigma=1.0)
            
            # Determine contour levels
            min_elev = np.nanmin(zz)
            max_elev = np.nanmax(zz)
            elev_range = max_elev - min_elev
            
            # Adjust contour interval for data range
            if elev_range / contour_interval > max_contours:
                contour_interval = elev_range / max_contours
            elif elev_range / contour_interval < min_contours:
                contour_interval = elev_range / min_contours
            
            # Generate contours
            levels = np.arange(
                np.floor(min_elev / contour_interval) * contour_interval,
                np.ceil(max_elev / contour_interval) * contour_interval + contour_interval,
                contour_interval
            )
            
            contours_dict = {}
            
            try:
                import matplotlib
                matplotlib.use('Agg')  # Non-display backend
                from matplotlib import pyplot as plt
                
                fig, ax = plt.subplots(figsize=(10, 10))
                cs = ax.contour(xx, yy, zz, levels=levels, colors='black')
                
                # cs.collections or cs.collections attribute depending on mpl version
                collections = cs.collections if hasattr(cs, 'collections') else [cs]
                
                for idx, level in enumerate(cs.levels):
                    if idx < len(collections):
                        collection = collections[idx]
                        paths = collection.get_paths() if hasattr(collection, 'get_paths') else []
                        polylines = []
                        
                        for path in paths:
                            vertices = path.vertices
                            if len(vertices) >= 2:
                                polylines.append([(float(v[0]), float(v[1])) for v in vertices])
                        
                        if polylines:
                            contours_dict[float(level)] = polylines
                
                plt.close(fig)
            except ImportError:
                # Fallback without matplotlib
                for level in levels:
                    contours = ContourGenerator._marching_squares(xx, yy, zz, level)
                    if contours:
                        contours_dict[float(level)] = contours
            
            return contours_dict
        
        except Exception as e:
            print(f"[Contours] Generation error: {e}")
            return {}
    
    @staticmethod
    def _marching_squares(
        x: np.ndarray,
        y: np.ndarray,
        z: np.ndarray,
        level: float
    ) -> List[List[Tuple[float, float]]]:
        """
        Simplified marching squares algorithm for contour extraction.
        """
        contours = []
        rows, cols = z.shape
        
        # Find all contour segments
        segments = []
        
        for i in range(rows - 1):
            for j in range(cols - 1):
                # Four corners of cell
                z00, z10 = z[i, j], z[i+1, j]
                z01, z11 = z[i, j+1], z[i+1, j+1]
                
                # Check if contour crosses this cell
                if not ((min(z00, z10, z01, z11) <= level <= max(z00, z10, z01, z11)) and
                        (z00 <= level or z10 <= level or z01 <= level or z11 <= level)):
                    continue
                
                # Interpolate contour intersections
                x00, x10 = x[j, i], x[j, i+1]
                x01, x11 = x[j+1, i], x[j+1, i+1]
                y00, y10 = y[i, j], y[i+1, j]
                y01, y11 = y[i, j+1], y[i+1, j+1]
                
                # Find edge intersections
                edges = []
                
                # Bottom edge
                if (z00 - level) * (z01 - level) <= 0:
                    t = (level - z00) / (z01 - z00) if z01 != z00 else 0.5
                    edges.append((x00 + t * (x01 - x00), y00))
                
                # Right edge
                if (z01 - level) * (z11 - level) <= 0:
                    t = (level - z01) / (z11 - z01) if z11 != z01 else 0.5
                    edges.append((x01, y00 + t * (y10 - y00)))
                
                # Top edge
                if (z10 - level) * (z11 - level) <= 0:
                    t = (level - z10) / (z11 - z10) if z11 != z10 else 0.5
                    edges.append((x10 + t * (x11 - x10), y10))
                
                # Left edge
                if (z00 - level) * (z10 - level) <= 0:
                    t = (level - z00) / (z10 - z00) if z10 != z00 else 0.5
                    edges.append((x00, y00 + t * (y10 - y00)))
                
                # Create segments
                if len(edges) == 2:
                    segments.append((edges[0], edges[1]))
        
        # Connect segments into contours
        if segments:
            contours = ContourGenerator._connect_segments(segments)
        
        return contours
    
    @staticmethod
    def _connect_segments(
        segments: List[Tuple[Tuple[float, float], Tuple[float, float]]]
    ) -> List[List[Tuple[float, float]]]:
        """
        Connect contour segments into continuous polylines.
        """
        if not segments:
            return []
        
        contours = []
        remaining = list(segments)
        
        while remaining:
            # Start new contour
            current_seg = remaining.pop(0)
            contour = [current_seg[0], current_seg[1]]
            
            # Extend contour
            while True:
                found = False
                end_point = contour[-1]
                
                for i, seg in enumerate(remaining):
                    # Check if segment connects
                    if ContourGenerator._points_close(seg[0], end_point):
                        contour.append(seg[1])
                        remaining.pop(i)
                        found = True
                        break
                    elif ContourGenerator._points_close(seg[1], end_point):
                        contour.append(seg[0])
                        remaining.pop(i)
                        found = True
                        break
                
                if not found:
                    break
            
            if len(contour) >= 2:
                contours.append(contour)
        
        return contours
    
    @staticmethod
    def _points_close(p1: Tuple[float, float], p2: Tuple[float, float], threshold: float = 1e-4) -> bool:
        """Check if two points are approximately equal."""
        return (abs(p1[0] - p2[0]) < threshold and abs(p1[1] - p2[1]) < threshold)
    
    @staticmethod
    def generate_filtered_contours(
        contours: Dict[float, List[List[Tuple[float, float]]]],
        min_length: float = 10.0  # minimum contour length in units
    ) -> Dict[float, List[List[Tuple[float, float]]]]:
        """
        Filter contours to remove noise/short lines.
        """
        filtered = {}
        
        for level, polylines in contours.items():
            valid_polylines = []
            
            for polyline in polylines:
                # Calculate length
                length = sum(
                    math.sqrt((polyline[i+1][0] - polyline[i][0])**2 + 
                             (polyline[i+1][1] - polyline[i][1])**2)
                    for i in range(len(polyline)-1)
                )
                
                if length >= min_length:
                    valid_polylines.append(polyline)
            
            if valid_polylines:
                filtered[level] = valid_polylines
        
        return filtered
    
    @staticmethod
    def generate_major_minor_contours(
        elevation_data: List[Tuple[float, float, float]],
        contour_interval: float = 5.0,
        major_interval_factor: int = 5  # Major every 5 contours
    ) -> Tuple[Dict[float, List[List[Tuple[float, float]]]], 
               Dict[float, List[List[Tuple[float, float]]]]]:
        """
        Generate separate major and minor contours for better visualization.
        
        Returns:
            (major_contours, minor_contours)
        """
        all_contours = ContourGenerator.generate_contours_interpolated(
            elevation_data,
            contour_interval=contour_interval,
            smoothing=True
        )
        
        major = {}
        minor = {}
        major_interval = contour_interval * major_interval_factor
        
        for level, polylines in all_contours.items():
            if abs(level % major_interval) < 0.01:
                major[level] = polylines
            else:
                minor[level] = polylines
        
        return major, minor
