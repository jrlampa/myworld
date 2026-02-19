
# py_engine/utils/tin_generator.py

import ezdxf
from typing import List, Tuple, Sequence

class TINGenerator:
    """
    Generates TIN (Triangulated Irregular Network) surfaces from elevation grids.
    """
    
    @staticmethod
    def generate_faces_from_grid(
        grid: List[List[float]],
        min_x: float,
        max_x: float,
        min_y: float,
        max_y: float
    ) -> List[Tuple[Tuple[float, float, float], Tuple[float, float, float], Tuple[float, float, float]]]:
        """
        Generates 3D faces (triangles) from a regular grid.
        Each grid cell is split into two triangles.
        
        Returns:
            List of triangles, where each triangle is ((x1,y1,z1), (x2,y2,z2), (x3,y3,z3))
        """
        rows = len(grid)
        if rows < 2:
            return []
        cols = len(grid[0])
        if cols < 2:
            return []
            
        faces = []
        
        # Grid spacing
        if cols > 1:
            step_x = (max_x - min_x) / (cols - 1)
        else:
            step_x = 0
            
        if rows > 1:
            step_y = (max_y - min_y) / (rows - 1)
        else:
            step_y = 0
        
        for r in range(rows - 1):
            for c in range(cols - 1):
                # Vertices of the cell
                # v3 -- v4 (Top-Left, Top-Right in Grid coords r+1)
                # |  /  |
                # v1 -- v2 (Bottom-Left, Bottom-Right in Grid coords r)
                
                # Careful with Y direction. Usually grid[0] is bottom or top depending on generation.
                # In main.py: grid_ys = np.linspace(min(ys), max(ys), grid_size_used)
                # So grid[0] corresponds to min_y (Bottom).
                
                x_c = min_x + c * step_x
                x_next = min_x + (c + 1) * step_x
                
                y_r = min_y + r * step_y
                y_next = min_y + (r + 1) * step_y
                
                z1 = grid[r][c]         # Bottom-Left
                z2 = grid[r][c + 1]     # Bottom-Right
                z3 = grid[r + 1][c]     # Top-Left
                z4 = grid[r + 1][c + 1] # Top-Right
                
                v1 = (x_c, y_r, z1)
                v2 = (x_next, y_r, z2)
                v3 = (x_c, y_next, z3)
                v4 = (x_next, y_next, z4)
                
                # Create two triangles
                # Tri 1: v1, v2, v3
                faces.append((v1, v2, v3))
                
                # Tri 2: v2, v4, v3
                faces.append((v2, v4, v3))
                
        return faces

    @staticmethod
    def export_tin_to_dxf(
        msp, 
        faces: Sequence[Tuple[Tuple[float, float, float], Tuple[float, float, float], Tuple[float, float, float]]],
        layer_name: str = "TIN_SURFACE",
        color: int = 252 # Gray
    ):
        """
        Export generated faces to DXF as 3DFACE entities.
        """
        for face in faces:
            # face is tuple of 3 points: (p1, p2, p3)
            # p1 is (x, y, z)
            msp.add_3dface(face, dxfattribs={"layer": layer_name, "color": color})
