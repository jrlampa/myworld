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
        List of (elevation, [(x,y), (x,y)...]) tuples representing polylines.
    """
    try:
        # Convert to numpy arrays for matplotlib
        rows = len(grid_points)
        cols = len(grid_points[0])
        
        X = np.zeros((rows, cols))
        Y = np.zeros((rows, cols))
        Z = np.zeros((rows, cols))
        
        for r in range(rows):
            for c in range(cols):
                x, y, z = grid_points[r][c]
                X[r, c] = x
                Y[r, c] = y
                Z[r, c] = z
                
        # Determine levels
        min_z = np.min(Z)
        max_z = np.max(Z)
        
        # Avoid creating 0 levels if flat
        if max_z - min_z < 0.1:
            return []
            
        levels = np.arange(np.floor(min_z), np.ceil(max_z) + interval, interval)
        
        # Generate contours using matplotlib
        # We use a hidden figure to avoid GUI backend issues
        fig = plt.figure()
        ax = fig.add_subplot(111)
        cs = ax.contour(X, Y, Z, levels=levels)
        
        contour_lines = []
        
        # Extract paths
        for i, collection in enumerate(cs.collections):
            level = cs.levels[i]
            for path in collection.get_paths():
                vertices = path.vertices
                codes = path.codes
                
                if codes is None:
                    # Single continuous line
                    points = [tuple(v) for v in vertices]
                    if len(points) > 1:
                        # Append 3D points (x, y, elevation)
                        points_3d = [(p[0], p[1], float(level)) for p in points]
                        contour_lines.append(points_3d)
                else:
                    # Split by MOVETO codes
                    current_line = []
                    for j, code in enumerate(codes):
                        if code == path.MOVETO:
                            if len(current_line) > 1:
                                contour_lines.append(current_line)
                            current_line = [(vertices[j][0], vertices[j][1], float(level))]
                        elif code == path.LINETO:
                            current_line.append((vertices[j][0], vertices[j][1], float(level)))
                        elif code == path.CLOSEPOLY:
                            current_line.append((vertices[j][0], vertices[j][1], float(level)))
                            
                    if len(current_line) > 1:
                        contour_lines.append(current_line)
                        
        plt.close(fig)
        return contour_lines

    except Exception as e:
        print(f"Error generating contours: {e}")
        return []
