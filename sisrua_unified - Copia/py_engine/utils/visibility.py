import numpy as np
import math
from typing import Tuple, Optional

def viewshed_analysis(
    grid: np.ndarray,
    observer_pos: Tuple[int, int],  # (row, col) in grid
    observer_height: float = 1.7,  # meters above ground
    cell_size: float = 30.0,
    max_range: Optional[float] = None
) -> np.ndarray:
    """Simple viewshed analysis from observer position."""
    rows, cols = grid.shape
    visibility = np.zeros_like(grid, dtype=int)
    r0, c0 = observer_pos
    
    if not (0 <= r0 < rows and 0 <= c0 < cols):
        return visibility
        
    visibility[r0, c0] = 1
    obs_z = grid[r0, c0] + observer_height
    
    # Bresenham-like ray casting to all edge cells for a full viewshed
    # For a master-level analysis, we sample the perimeter
    perimeter = []
    for c in range(cols):
        perimeter.append((0, c))
        perimeter.append((rows - 1, c))
    for r in range(1, rows - 1):
        perimeter.append((r, 0))
        perimeter.append((r, cols - 1))
        
    for r1, c1 in perimeter:
        # Trace line from (r0, c0) to (r1, c1)
        # Using a simple DDA-like approach
        dr = r1 - r0
        dc = c1 - c0
        steps = max(abs(dr), abs(dc))
        if steps == 0: continue
        
        step_r = dr / steps
        step_c = dc / steps
        
        max_slope = -999.0
        
        for s in range(1, steps + 1):
            curr_r = int(round(r0 + s * step_r))
            curr_c = int(round(c0 + s * step_c))
            
            if not (0 <= curr_r < rows and 0 <= curr_c < cols): break
            
            dist = math.sqrt((s * step_r)**2 + (s * step_c)**2) * cell_size
            if max_range and dist > max_range: break
            
            elev = grid[curr_r, curr_c]
            slope = (elev - obs_z) / dist
            
            if slope >= max_slope:
                visibility[curr_r, curr_c] = 1
                max_slope = slope
                
    return visibility
