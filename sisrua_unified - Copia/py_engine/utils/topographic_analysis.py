"""
Advanced topographic analysis: slope, aspect, viewshed, solar exposure.
Converts elevation data into professional-grade terrain metrics.
"""

import math
import numpy as np
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass


@dataclass
class TerrainMetrics:
    """Comprehensive terrain analysis results."""
    elevation_range: Tuple[float, float]  # (min, max)
    mean_elevation: float
    slope_degrees: List[List[float]]  # slope in degrees per point
    aspect_degrees: List[List[float]]  # aspect (direction) per point
    terrain_ruggedness: float  # TRI (Terrain Ruggedness Index)
    mean_slope: float
    max_slope: float
    surface_roughness: float


class TopographicAnalyzer:
    """Analyze elevation data for professional-grade metrics."""
    
    @staticmethod
    def idw_interpolation(
        points: List[Tuple[float, float, float]],  # (x, y, elevation)
        grid_points: List[Tuple[float, float]],  # (x, y) to interpolate
        power: float = 2.0,
        radius: Optional[float] = None
    ) -> List[float]:
        """
        Inverse Distance Weighting interpolation.
        
        Args:
            points: Known elevation points
            grid_points: Points to interpolate
            power: IDW power factor (default 2.0)
            radius: Search radius in meters (None = use all points)
        
        Returns:
            List of interpolated elevations
        """
        if not points:
            return [0.0] * len(grid_points)
        
        interpolated = []
        
        for grid_x, grid_y in grid_points:
            weighted_sum = 0.0
            weight_sum = 0.0
            
            for point_x, point_y, elevation in points:
                distance = math.sqrt((grid_x - point_x)**2 + (grid_y - point_y)**2)
                
                # Skip exact matches (avoid division by zero)
                if distance < 0.001:
                    interpolated.append(elevation)
                    weighted_sum = None
                    break
                
                # Apply radius filter if specified
                if radius and distance > radius:
                    continue
                
                # IDW formula: w = 1 / d^p
                weight = 1.0 / (distance ** power)
                weighted_sum += weight * elevation
                weight_sum += weight
            
            if weighted_sum is not None:
                interpolated.append(weighted_sum / weight_sum if weight_sum > 0 else 0.0)
        
        return interpolated
    
    @staticmethod
    def calculate_slope_aspect(
        grid: np.ndarray,  # 2D elevation array
        cell_size: float  # size of each grid cell in meters
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calculate slope and aspect using Sobel operators.
        
        Returns:
            (slope_degrees, aspect_degrees) - both as numpy arrays
        """
        if len(grid.shape) != 2 or grid.shape[0] < 3 or grid.shape[1] < 3:
            return np.zeros_like(grid), np.zeros_like(grid)
        
        # Sobel operators for gradients
        sobelx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=float)
        sobely = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=float)
        
        # Convolve with grid
        dz_dx = np.zeros_like(grid)
        dz_dy = np.zeros_like(grid)
        
        for i in range(1, grid.shape[0] - 1):
            for j in range(1, grid.shape[1] - 1):
                window = grid[i-1:i+2, j-1:j+2]
                dz_dx[i, j] = np.sum(sobelx * window) / (8 * cell_size)
                dz_dy[i, j] = np.sum(sobely * window) / (8 * cell_size)
        
        # Calculate slope in degrees
        slope_radians = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
        slope_degrees = np.degrees(slope_radians)
        
        # Calculate aspect in degrees (0=North, 90=East, 180=South, 270=West)
        aspect_degrees = np.degrees(np.arctan2(dz_dy, -dz_dx)) % 360
        
        return slope_degrees, aspect_degrees
    
    @staticmethod
    def terrain_ruggedness_index(
        grid: np.ndarray,
        cell_size: float = 30.0
    ) -> float:
        """
        Calculate Terrain Ruggedness Index (TRI).
        Measures the sum of absolute changes in elevation.
        
        Lower = smoother, Higher = more rugged
        """
        if grid.size < 4:
            return 0.0
        
        tri_sum = 0.0
        count = 0
        
        for i in range(1, grid.shape[0] - 1):
            for j in range(1, grid.shape[1] - 1):
                center = grid[i, j]
                neighbors = [
                    grid[i-1, j-1], grid[i-1, j], grid[i-1, j+1],
                    grid[i, j-1],                 grid[i, j+1],
                    grid[i+1, j-1], grid[i+1, j], grid[i+1, j+1]
                ]
                
                # Sum of absolute elevation changes
                elevation_changes = sum(abs(n - center) for n in neighbors)
                tri_sum += elevation_changes
                count += 1
        
        if count == 0:
            return 0.0
        
        return tri_sum / count
    
    @staticmethod
    def solar_exposure(
        aspect_degrees: np.ndarray,
        slope_degrees: np.ndarray,
        latitude: float
    ) -> np.ndarray:
        """
        Estimate relative solar exposure (0-1 scale).
        Based on aspect and slope relative to latitude.
        
        North-facing slopes in northern hemisphere = low exposure
        South-facing slopes in northern hemisphere = high exposure
        """
        # Hemisphere factor
        hemisphere_factor = -1 if latitude < 0 else 1
        
        # Beam radiation factor based on aspect
        # Optimal aspect = latitude dependent
        optimal_aspect = 180 + (latitude * hemisphere_factor * 45)
        aspect_diff = np.abs(aspect_degrees - optimal_aspect)
        aspect_diff = np.minimum(aspect_diff, 360 - aspect_diff)  # Shortest angle
        
        # Aspect factor: 1 at optimal, 0 at worst
        aspect_factor = 1 - (aspect_diff / 180)
        
        # Slope factor: cosine of slope (more slope = less direct radiation)
        slope_radians = np.radians(slope_degrees)
        slope_factor = np.cos(slope_radians)
        slope_factor = np.maximum(slope_factor, 0.1)  # Minimum even on vertical
        
        # Combined exposure (0-1)
        exposure = (aspect_factor * 0.6 + slope_factor * 0.4)
        exposure = np.clip(exposure, 0, 1)
        
        return exposure
    
    @staticmethod
    def viewshed_analysis(
        grid: np.ndarray,
        observer_pos: Tuple[int, int],  # (row, col) in grid
        observer_height: float = 1.7,  # meters above ground
        cell_size: float = 30.0,
        max_range: Optional[float] = None
    ) -> np.ndarray:
        """
        Simple viewshed analysis from observer position.
        Returns visibility map (1 = visible, 0 = not visible).
        
        Note: Simplified algorithm for speed; production would use
        more advanced algorithms like Visible Surface Determination.
        """
        if grid.size == 0:
            return np.zeros_like(grid)
        
        rows, cols = grid.shape
        observer_row, observer_col = observer_pos
        
        # Check bounds
        if not (0 <= observer_row < rows and 0 <= observer_col < cols):
            return np.zeros_like(grid)
        
        visibility = np.zeros_like(grid, dtype=float)
        observer_elev = grid[observer_row, observer_col] + observer_height
        
        # Simplified: check line of sight to each point
        for i in range(rows):
            for j in range(cols):
                if i == observer_row and j == observer_col:
                    visibility[i, j] = 1.0
                    continue
                
                # Check maximum range
                distance = math.sqrt((i - observer_row)**2 + (j - observer_col)**2) * cell_size
                if max_range and distance > max_range:
                    visibility[i, j] = 0.0
                    continue
                
                # Simple ray casting (Bresenham-like)
                target_elev = grid[i, j]
                
                # Check if line of sight is obstructed
                steps = max(abs(i - observer_row), abs(j - observer_col))
                if steps == 0:
                    visibility[i, j] = 1.0
                    continue
                
                is_visible = True
                for step in range(1, steps):
                    # Interpolate point along line
                    interp_row = observer_row + (i - observer_row) * step / steps
                    interp_col = observer_col + (j - observer_col) * step / steps
                    
                    r, c = int(round(interp_row)), int(round(interp_col))
                    if 0 <= r < rows and 0 <= c < cols:
                        # Check if terrain blocks view
                        dist_to_observer = math.sqrt((r - observer_row)**2 + (c - observer_col)**2) * cell_size
                        dist_to_target = distance
                        
                        blocking_elev = grid[r, c]
                        expected_elev = observer_elev - (observer_elev - target_elev) * (dist_to_observer / dist_to_target)
                        
                        if blocking_elev > expected_elev + 0.5:  # 0.5m threshold
                            is_visible = False
                            break
                
                visibility[i, j] = 1.0 if is_visible else 0.0
        
        return visibility
    
    @staticmethod
    def classify_terrain_slope(slope_degrees: np.ndarray) -> np.ndarray:
        """
        Classify terrain by slope steepness.
        
        Returns:
            Classification array where:
            0 = Flat (0-2°)
            1 = Gentle (2-5°)
            2 = Moderate (5-15°)
            3 = Steep (15-30°)
            4 = Very Steep (>30°)
        """
        classifications = np.zeros_like(slope_degrees, dtype=int)
        
        classifications[slope_degrees <= 2] = 0
        classifications[(slope_degrees > 2) & (slope_degrees <= 5)] = 1
        classifications[(slope_degrees > 5) & (slope_degrees <= 15)] = 2
        classifications[(slope_degrees > 15) & (slope_degrees <= 30)] = 3
        classifications[slope_degrees > 30] = 4
        
        return classifications
    
    @staticmethod
    def analyze_full(
        elevation_data: List[Tuple[float, float, float]],  # (x, y, elevation)
        grid_size: int = 50,
        cell_size: float = 30.0,
        latitude: float = 0.0
    ) -> TerrainMetrics:
        """
        Perform comprehensive terrain analysis.
        
        Returns:
            TerrainMetrics with all calculated values
        """
        if not elevation_data:
            return TerrainMetrics(
                elevation_range=(0, 0),
                mean_elevation=0.0,
                slope_degrees=[],
                aspect_degrees=[],
                terrain_ruggedness=0.0,
                mean_slope=0.0,
                max_slope=0.0,
                surface_roughness=0.0
            )
        
        # Extract components
        xs = [p[0] for p in elevation_data]
        ys = [p[1] for p in elevation_data]
        elevs = [p[2] for p in elevation_data]
        
        min_elev = min(elevs)
        max_elev = max(elevs)
        mean_elev = np.mean(elevs)
        
        # Create grid
        grid_xs = np.linspace(min(xs), max(xs), grid_size)
        grid_ys = np.linspace(min(ys), max(ys), grid_size)
        grid_points = [(x, y) for x in grid_xs for y in grid_ys]
        
        # Interpolate elevations
        interpolated = TopographicAnalyzer.idw_interpolation(elevation_data, grid_points)
        grid = np.array(interpolated).reshape(grid_size, grid_size)
        
        # Calculate metrics
        slope, aspect = TopographicAnalyzer.calculate_slope_aspect(grid, cell_size)
        tri = TopographicAnalyzer.terrain_ruggedness_index(grid, cell_size)
        
        return TerrainMetrics(
            elevation_range=(float(min_elev), float(max_elev)),
            mean_elevation=float(mean_elev),
            slope_degrees=slope.tolist(),
            aspect_degrees=aspect.tolist(),
            terrain_ruggedness=float(tri),
            mean_slope=float(np.mean(slope)),
            max_slope=float(np.max(slope)),
            surface_roughness=float(np.std(slope))
        )
