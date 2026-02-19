import numpy as np
from typing import Tuple
from scipy import ndimage

def calculate_slope_aspect(
    grid: np.ndarray, 
    cell_size: float
) -> Tuple[np.ndarray, np.ndarray]:
    """Calculate slope and aspect using vectorized Sobel operators (optimized)."""
    if len(grid.shape) != 2 or grid.shape[0] < 3 or grid.shape[1] < 3:
        return np.zeros_like(grid), np.zeros_like(grid)
    
    # Vectorized gradient calculation using convolve
    kernel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=float) / (8 * cell_size)
    kernel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=float) / (8 * cell_size)
    
    dz_dx = ndimage.convolve(grid, kernel_x, mode='reflect')
    dz_dy = ndimage.convolve(grid, kernel_y, mode='reflect')
    
    slope_radians = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
    slope_degrees = np.degrees(slope_radians)
    aspect_degrees = np.degrees(np.arctan2(dz_dy, -dz_dx)) % 360
    
    return slope_degrees, aspect_degrees

def terrain_ruggedness_index(grid: np.ndarray) -> np.ndarray:
    """Calculate TRI using optimized neighborhood variance."""
    if grid.size < 9:
        return np.zeros_like(grid)
    
    # Optimized TRI calculation using ndimage filters
    def square_diff(window):
        center = window[window.size // 2]
        return np.sqrt(np.mean((window - center)**2))
    
    # Faster TRI approximation: sqrt(sum(diff^2))
    # Standard TRI is the square root of the sum of the squared differences 
    # between a central pixel and its eight neighbors.
    tri = np.zeros_like(grid, dtype=float)
    for dr in [-1, 0, 1]:
        for dc in [-1, 0, 1]:
            if dr == 0 and dc == 0: continue
            neighbor = np.roll(grid, shift=(-dr, -dc), axis=(0, 1))
            tri += (grid - neighbor)**2
            
    return np.sqrt(tri)

def calculate_tpi(grid: np.ndarray, radius_cells: int = 3) -> np.ndarray:
    """Calculate Topographic Position Index."""
    kernel = np.ones((2 * radius_cells + 1, 2 * radius_cells + 1))
    kernel /= kernel.size
    mean_elev = ndimage.convolve(grid, kernel, mode='reflect')
    return grid - mean_elev

def classify_landforms_weiss(grid: np.ndarray, slope: np.ndarray) -> np.ndarray:
    """
    Classify 10 Landforms based on Weiss (2001) using Multiscale TPI.
    Standard deviations are used to define thresholds.
    """
    # 1. Calculate TPI at two scales
    tpi_small = calculate_tpi(grid, radius_cells=3)
    tpi_large = calculate_tpi(grid, radius_cells=10)
    
    # 2. Standardize TPI
    std_small = np.std(tpi_small)
    if std_small == 0: std_small = 1.0
    z_small = tpi_small / std_small
    
    std_large = np.std(tpi_large)
    if std_large == 0: std_large = 1.0
    z_large = tpi_large / std_large
    
    # 3. Apply Classification Logic (Weiss 2001)
    landforms = np.full(grid.shape, 4, dtype=int) # Default to Plains (4)
    
    # Valleys / Canyons (Small TPI < -1 SD)
    landforms[(z_small < -1) & (z_large < -1)] = 0            # Canyons, deeply incised valleys
    landforms[(z_small < -1) & (z_large > -1) & (z_large < 1)] = 1 # Midslope drainages, shallow valleys
    landforms[(z_small < -1) & (z_large > 1)] = 2             # Upland drainages, headwaters
    
    # U-shaped valleys
    landforms[(z_small > -1) & (z_small < 1) & (z_large < -1)] = 3 # U-shaped valleys
    
    # Plains vs Open Slopes
    landforms[(z_small > -1) & (z_small < 1) & (z_large > -1) & (z_large < 1) & (slope > 5)] = 5 # Open slopes
    landforms[(z_small > -1) & (z_small < 1) & (z_large > -1) & (z_large < 1) & (slope <= 5)] = 4 # Plains
    
    # Upper Slopes / Mesas
    landforms[(z_small > -1) & (z_small < 1) & (z_large > 1)] = 6 # Upper slopes, mesas
    
    # Ridges
    landforms[(z_small > 1) & (z_large < -1)] = 7             # Local ridges/hills in valleys
    landforms[(z_small > 1) & (z_large > -1) & (z_large < 1)] = 8  # midslope ridges, small hills in plains
    landforms[(z_small > 1) & (z_large > 1)] = 9              # Mountain tops, high ridges
    
    return landforms

def classify_terrain_slope(slope_degrees: np.ndarray) -> np.ndarray:
    """Classify terrain by slope steepness (Geotechnical standard)."""
    cls = np.zeros_like(slope_degrees, dtype=int)
    cls[slope_degrees > 2] = 1   # Gentle
    cls[slope_degrees > 5] = 2   # Moderate
    cls[slope_degrees > 15] = 3  # Steep
    cls[slope_degrees > 30] = 4  # Very Steep
    return cls
