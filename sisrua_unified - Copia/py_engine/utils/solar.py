import numpy as np
import math

def calculate_shadows(
    grid: np.ndarray, 
    cell_size: float, 
    sun_alt_deg: float, 
    sun_az_deg: float
) -> np.ndarray:
    """
    Calculate physical shadows blocked by terrain using ray-casting.
    1.0 = in sun, 0.0 = in shadow.
    """
    rows, cols = grid.shape
    shadow_map = np.ones_like(grid, dtype=float)
    
    # Sun vector in grid coordinates
    alt_rad = np.radians(sun_alt_deg)
    az_rad = np.radians(sun_az_deg)
    
    dx = -np.sin(az_rad) * np.cos(alt_rad)
    dy = -np.cos(az_rad) * np.cos(alt_rad)
    dz = np.sin(alt_rad)
    
    # If sun is below horizon, everything is in shadow
    if sun_alt_deg <= 0:
        return np.zeros_like(grid)
        
    # Step size for ray casting (half cell size for accuracy)
    step_m = cell_size / 2.0
    step_x = dx * (step_m / cell_size)
    step_y = dy * (step_m / cell_size)
    step_z = dz * step_m
    
    # Max ray length (diagonal of grid)
    max_steps = int((math.sqrt(rows**2 + cols**2) * cell_size) / step_m)
    
    for r in range(rows):
        for c in range(cols):
            curr_r, curr_c, curr_z = float(r), float(c), grid[r, c] + 0.1 # Slight offset to avoid self-shadow
            
            # Trace ray
            for _ in range(max_steps):
                curr_r += step_x
                curr_c += step_y
                curr_z += step_z
                
                ir, ic = int(round(curr_r)), int(round(curr_c))
                
                if 0 <= ir < rows and 0 <= ic < cols:
                    if grid[ir, ic] > curr_z:
                        shadow_map[r, c] = 0.0
                        break
                else:
                    break # Ray left the grid
                    
    return shadow_map

def solar_exposure_master(
    grid: np.ndarray,
    cell_size: float,
    latitude: float,
    aspect_degrees: np.ndarray,
    slope_degrees: np.ndarray
) -> np.ndarray:
    """
    Calculate master solar exposure combining aspect/slope and physical shadows.
    Physical shadows are calculated for 9 AM, 12 PM, and 3 PM (approximate).
    """
    # 1. Aspect/Slope factor (Standard GIS approach)
    # Cosine of incidence angle
    # Zenith angle z = 90 - altitude
    # Aspect and target comparison
    # Ideal solar angle in southern hemisphere is north-facing (0 deg)
    target_aspect = 0.0 if latitude < 0 else 180.0
    aspect_diff = np.radians(aspect_degrees - target_aspect)
    slope_rad = np.radians(slope_degrees)
    
    exposure_potential = np.cos(aspect_diff) * np.sin(slope_rad)
    exposure_potential = (exposure_potential + 1) / 2.0 # 0-1 scale
    
    # 2. Physical Shadows for 3 times of day (Simplified solar position)
    # 9 AM: Azimuth ~45 (SE) / 135 (NE), Altitude ~30
    # 12 PM: Azimuth ~0 (N) / 180 (S), Altitude ~60
    # 3 PM: Azimuth ~315 (NW) / 225 (SW), Altitude ~30
    if latitude < 0: # Southern Hemisphere
        shadows_9am = calculate_shadows(grid, cell_size, 30, 45)
        shadows_12pm = calculate_shadows(grid, cell_size, 60, 0)
        shadows_3pm = calculate_shadows(grid, cell_size, 30, 315)
    else: # Northern Hemisphere
        shadows_9am = calculate_shadows(grid, cell_size, 30, 135)
        shadows_12pm = calculate_shadows(grid, cell_size, 60, 180)
        shadows_3pm = calculate_shadows(grid, cell_size, 30, 225)
        
    combined_shadows = (shadows_9am + shadows_12pm + shadows_3pm) / 3.0
    
    # 3. Final Result: Weighted average of potential and actual shadows
    # Most weight on shadows (0.7) and some on incidence angle (0.3)
    final_exposure = (combined_shadows * 0.7) + (exposure_potential * 0.3)
    
    return np.clip(final_exposure, 0.0, 1.0)
