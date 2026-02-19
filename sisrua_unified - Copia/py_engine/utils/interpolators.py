import math
import numpy as np
from typing import List, Tuple, Optional

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
        exact_match_found = False
        exact_elevation = 0.0
        
        for point_x, point_y, elevation in points:
            distance = math.sqrt((grid_x - point_x)**2 + (grid_y - point_y)**2)
            
            # Skip exact matches (avoid division by zero)
            if distance < 0.001:
                exact_match_found = True
                exact_elevation = elevation
                break
            
            # Apply radius filter if specified
            if radius and distance > radius:
                continue
            
            # IDW formula: w = 1 / d^p
            weight = 1.0 / (distance ** power)
            weighted_sum += weight * elevation
            weight_sum += weight
        
        if exact_match_found:
            interpolated.append(exact_elevation)
        elif weight_sum > 0:
            interpolated.append(weighted_sum / weight_sum)
        else:
            interpolated.append(0.0)
    
    return interpolated
