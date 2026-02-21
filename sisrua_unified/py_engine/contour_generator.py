import numpy as np
import matplotlib
matplotlib.use('Agg') # Headless mode
import matplotlib.pyplot as plt
from shapely.geometry import LineString

def generate_contours(grid_points, interval=1.0):
    """
    Generates contour lines from a grid of (x, y, z) points.
    
    Args:
        grid_points: List of lists of (x, y, z) tuples.
                     Rows are Y-axis (approx), Cols are X-axis.
        interval: Elevation interval for contours.
        
    Returns:
        List of polylines, each polyline being a list of (x, y, z) tuples.
    """
    try:
        # Convert to numpy arrays for matplotlib
        arr = np.array(grid_points, dtype=float)  # shape: (rows, cols, 3)
        X = arr[:, :, 0]
        Y = arr[:, :, 1]
        Z = arr[:, :, 2]
                
        # Determine levels
        min_z = np.min(Z)
        max_z = np.max(Z)
        
        # Avoid creating 0 levels if flat
        if max_z - min_z < 0.1:
            return []
            
        levels = np.arange(np.floor(min_z), np.ceil(max_z) + interval, interval)
        
        # Generate contours using matplotlib (headless via Agg backend)
        fig = plt.figure()
        ax = fig.add_subplot(111)
        cs = ax.contour(X, Y, Z, levels=levels)
        
        contour_lines = []
        
        # Use allsegs API (compatible with matplotlib >= 3.8)
        # allsegs[i] = list of segment arrays for level cs.levels[i]
        # Each segment array has shape (N, 2) with (x, y) coords
        for i, level_segs in enumerate(cs.allsegs):
            level = float(cs.levels[i])
            for seg in level_segs:
                if len(seg) > 1:
                    points_3d = [(float(pt[0]), float(pt[1]), level) for pt in seg]
                    contour_lines.append(points_3d)
                        
        plt.close(fig)
        return contour_lines

    except Exception as e:
        print(f"Error generating contours: {e}")
        return []
