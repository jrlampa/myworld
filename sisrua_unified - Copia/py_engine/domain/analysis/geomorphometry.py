import numpy as np
from typing import Tuple, List, Optional
from scipy import ndimage

class GeomorphometryEngine:
    """
    Advanced geomorphometric analysis engine.
    Computes terrain indices like aspect, plan and profile curvature.
    """

    @staticmethod
    def calculate_aspect(grid: np.ndarray, cell_size: float) -> np.ndarray:
        """Calculates terrain aspect (direction of steepest descent)."""
        dz_dx = ndimage.sobel(grid, axis=1, mode='reflect') / (8 * cell_size)
        dz_dy = ndimage.sobel(grid, axis=0, mode='reflect') / (8 * cell_size)
        
        # Aspect in degrees (0-360, 0=North)
        aspect = np.degrees(np.arctan2(dz_dy, -dz_dx)) % 360
        return aspect

    @staticmethod
    def calculate_curvatures(grid: np.ndarray, cell_size: float) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calculates Plan Curvature and Profile Curvature using Zevenbergen & Thorne (1987).
        Positive = Convex, Negative = Concave.
        """
        L = cell_size
        # 3x3 Window Coefficients
        # [ 1  2  3 ]
        # [ 4  5  6 ]
        # [ 7  8  9 ]
        # Using shift for vectorization
        Z5 = grid
        Z1 = np.roll(grid, shift=(1, 1), axis=(0, 1))
        Z2 = np.roll(grid, shift=(1, 0), axis=(0, 1))
        Z3 = np.roll(grid, shift=(1, -1), axis=(0, 1))
        Z4 = np.roll(grid, shift=(0, 1), axis=(0, 1))
        Z6 = np.roll(grid, shift=(0, -1), axis=(0, 1))
        Z7 = np.roll(grid, shift=(-1, 1), axis=(0, 1))
        Z8 = np.roll(grid, shift=(-1, 0), axis=(0, 1))
        Z9 = np.roll(grid, shift=(-1, -1), axis=(0, 1))

        # Partial Derivatives (Zevenbergen & Thorne)
        # p = (Z3 + Z6 + Z9 - Z1 - Z4 - Z7) / (6 * L) # Incorrect in original Thorne? 
        # Actually standard finite differences:
        p = (Z6 - Z4) / (2 * L)
        q = (Z2 - Z8) / (2 * L)
        r = (Z4 + Z6 - 2*Z5) / (L**2)
        s = (Z3 + Z7 - Z1 - Z9) / (4 * L**2)
        t = (Z2 + Z8 - 2*Z5) / (L**2)

        # Numerical stability
        p_q_sq = p**2 + q**2 + 1e-10
        
        # Profile Curvature (K_prof)
        prof_curvature = -2.0 * (p**2 * r + p * q * s + q**2 * t) / (p_q_sq * (1 + p_q_sq))
        
        # Plan Curvature (K_plan)
        plan_curvature = 2.0 * (q**2 * r - p * q * s + p**2 * t) / (p_q_sq**1.5)

        return plan_curvature, prof_curvature

# --- Legacy Functions (Restored for orchestrator compatibility) ---

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
    """Classify 10 Landforms based on Weiss (2001) using Multiscale TPI."""
    tpi_small = calculate_tpi(grid, radius_cells=3)
    tpi_large = calculate_tpi(grid, radius_cells=10)
    
    std_small = np.std(tpi_small)
    if std_small == 0: std_small = 1.0
    z_small = tpi_small / std_small
    
    std_large = np.std(tpi_large)
    if std_large == 0: std_large = 1.0
    z_large = tpi_large / std_large
    
    landforms = np.full(grid.shape, 4, dtype=int) # Default to Plains (4)
    landforms[(z_small < -1) & (z_large < -1)] = 0            # Canyons
    landforms[(z_small < -1) & (z_large > -1) & (z_large < 1)] = 1 # Midslope drainages
    landforms[(z_small < -1) & (z_large > 1)] = 2             # Upland drainages
    landforms[(z_small > -1) & (z_small < 1) & (z_large < -1)] = 3 # U-shaped valleys
    landforms[(z_small > -1) & (z_small < 1) & (z_large > -1) & (z_large < 1) & (slope > 5)] = 5 # Open slopes
    landforms[(z_small > -1) & (z_small < 1) & (z_large > -1) & (z_large < 1) & (slope <= 5)] = 4 # Plains
    landforms[(z_small > -1) & (z_small < 1) & (z_large > 1)] = 6 # Upper slopes
    landforms[(z_small > 1) & (z_large < -1)] = 7             # Local ridges
    landforms[(z_small > 1) & (z_large > -1) & (z_large < 1)] = 8  # midslope ridges
    landforms[(z_small > 1) & (z_large > 1)] = 9              # Mountain tops
    
    return landforms

def classify_terrain_slope(slope_degrees: np.ndarray) -> np.ndarray:
    """Classify terrain by slope steepness (Geotechnical standard)."""
    cls = np.zeros_like(slope_degrees, dtype=int)
    cls[slope_degrees > 2] = 1   # Gentle
    cls[slope_degrees > 5] = 2   # Moderate
    cls[slope_degrees > 15] = 3  # Steep
    cls[slope_degrees > 30] = 4  # Very Steep
    return cls
