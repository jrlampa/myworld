
import numpy as np
from typing import List, Tuple, Dict
from ..terrain.interpolators import idw_interpolation

class ProfileEngine:
    """
    Core engine for calculating topographic cross-sections (Profiles).
    Given a path and a grid, it returns elevation samples along that path.
    """

    @staticmethod
    def calculate_profile(
        path: List[Tuple[float, float]], 
        grid: np.ndarray, 
        grid_bounds: Tuple[float, float, float, float],
        sample_spacing_m: float = 1.0
    ) -> List[Dict]:
        """
        Samples elevation along a 2D path at regular intervals.
        path: List of points in local XY.
        grid: Elevation grid.
        grid_bounds: (min_x, min_y, max_x, max_y)
        """
        if len(path) < 2:
            return []

        rows, cols = grid.shape
        min_x, min_y, max_x, max_y = grid_bounds
        dx = (max_x - min_x) / (rows - 1)
        dy = (max_y - min_y) / (cols - 1)

        profile = []
        cumulative_dist = 0.0

        for i in range(len(path) - 1):
            p1 = np.array(path[i])
            p2 = np.array(path[i+1])
            segment_vec = p2 - p1
            segment_len = np.linalg.norm(segment_vec)
            
            if segment_len == 0: continue

            # Number of steps for this segment
            num_steps = int(np.ceil(segment_len / sample_spacing_m))
            step_vec = segment_vec / num_steps
            
            for j in range(num_steps):
                curr_p = p1 + step_vec * j
                # Distance from start of segment
                dist_in_segment = np.linalg.norm(step_vec * j)
                
                # Bilinear interpolation or IDW?
                # For high performance on grid, bilinear is standard.
                ele = ProfileEngine._bilinear_interpolate(curr_p[0], curr_p[1], grid, grid_bounds)
                
                profile.append({
                    "distance": float(cumulative_dist + dist_in_segment),
                    "elevation": float(ele),
                    "x": float(curr_p[0]),
                    "y": float(curr_p[1])
                })
            
            cumulative_dist += segment_len
            
        # Add last point
        last_p = path[-1]
        last_ele = ProfileEngine._bilinear_interpolate(last_p[0], last_p[1], grid, grid_bounds)
        profile.append({
            "distance": float(cumulative_dist),
            "elevation": float(last_ele),
            "x": float(last_p[0]),
            "y": float(last_p[1])
        })

        return profile

    @staticmethod
    def _bilinear_interpolate(x, y, grid, bounds):
        min_x, min_y, max_x, max_y = bounds
        rows, cols = grid.shape
        
        # Convert world to grid index (float)
        # Assuming grid covers [min_x, max_x]
        gx = (x - min_x) / (max_x - min_x) * (rows - 1)
        gy = (y - min_y) / (max_y - min_y) * (cols - 1)
        
        if gx < 0 or gx >= rows - 1 or gy < 0 or gy >= cols - 1:
            # Boundary check
            gx_clamped = max(0, min(rows - 1, gx))
            gy_clamped = max(0, min(cols - 1, gy))
            return grid[int(gx_clamped), int(gy_clamped)]

        x1 = int(np.floor(gx))
        y1 = int(np.floor(gy))
        x2 = x1 + 1
        y2 = y1 + 1
        
        dx = gx - x1
        dy = gy - y1
        
        # 4 surrounding points
        q11 = grid[x1, y1]
        q12 = grid[x1, y2]
        q21 = grid[x2, y1]
        q22 = grid[x2, y2]
        
        # Bilinear formula
        val = (q11 * (1 - dx) * (1 - dy) +
               q21 * dx * (1 - dy) +
               q12 * (1 - dx) * dy +
               q22 * dx * dy)
        return val
