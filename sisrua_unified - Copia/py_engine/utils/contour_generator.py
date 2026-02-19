from typing import List, Tuple, Dict, Optional
import math

class ContourGenerator:
    """
    Simple implementation of Marching Squares for generating contour lines from a 2D grid.
    Designed to work without heavy dependencies like matplotlib or skimage.
    """

    @staticmethod
    def generate_contours(grid: list, 
                          min_x: float, max_x: float, 
                          min_y: float, max_y: float, 
                          interval: float,
                          levels: Optional[List[float]] = None) -> List[Tuple[float, float, float]]:
        """
        Generates contour segments for the given grid.
        Returns a list of line segments: [((x1, y1, z), (x2, y2, z)), ...]
        """
        if not grid or not grid[0]:
            return []

        rows = len(grid)
        cols = len(grid[0])
        
        # Calculate cell size
        dx = (max_x - min_x) / (cols - 1)
        dy = (max_y - min_y) / (rows - 1)

        # Determine levels
        if levels is None:
            min_val = min(min(row) for row in grid)
            max_val = max(max(row) for row in grid)
            start = math.ceil(min_val / interval) * interval
            levels = []
            curr = start
            while curr <= max_val:
                levels.append(curr)
                curr += interval

        segments = []

        # Marching Squares Look-up Table
        # Key: Binary state of corners (TL, TR, BR, BL)
        # Value: List of edge pairs to connect. 
        # Edges: 0=Top, 1=Right, 2=Bottom, 3=Left
        case_map = {
            0: [], 
            1: [(3, 2)], 
            2: [(2, 1)], 
            3: [(3, 1)], 
            4: [(1, 0)], 
            5: [(1, 0), (3, 2)], # Ambiguous case, simple connect
            6: [(2, 0)], 
            7: [(3, 0)], 
            8: [(0, 3)], 
            9: [(0, 2)], 
            10: [(0, 3), (2, 1)], # Ambiguous
            11: [(0, 1)], 
            12: [(1, 3)], 
            13: [(1, 2)], 
            14: [(2, 3)], 
            15: []
        }

        for level in levels:
            for r in range(rows - 1):
                y_base = min_y + r * dy
                for c in range(cols - 1):
                    x_base = min_x + c * dx
                    
                    # Values at corners
                    # TL___TR
                    # |     |
                    # BL___BR
                    # Be careful with Y direction! usually grid[0] is top or bottom?
                    # Typically grid[0][0] is min_x, min_y?
                    # Let's assume grid orientation matches: r increases Y, c increases X?
                    # Wait, usually r is Y (row), c is X (col). 
                    # If grid[0][0] is min_x, min_y (bottom-left)
                    # Then r+1 is "up".
                    
                    v_bl = grid[r][c]
                    v_br = grid[r][c+1]
                    v_tl = grid[r+1][c]
                    v_tr = grid[r+1][c+1]
                    
                    # Binary index: 8*TL + 4*TR + 2*BR + 1*BL
                    case_idx = 0
                    if v_tl >= level: case_idx |= 8
                    if v_tr >= level: case_idx |= 4
                    if v_br >= level: case_idx |= 2
                    if v_bl >= level: case_idx |= 1
                    
                    edge_pairs = case_map.get(case_idx, [])
                    
                    for e1, e2 in edge_pairs:
                        p1 = ContourGenerator._get_edge_point(e1, x_base, y_base, dx, dy, v_bl, v_br, v_tr, v_tl, level)
                        p2 = ContourGenerator._get_edge_point(e2, x_base, y_base, dx, dy, v_bl, v_br, v_tr, v_tl, level)
                        segments.append((p1, p2))
                        
        # Merging Logic using Shapely
        try:
            from shapely.geometry import LineString
            from shapely.ops import linemerge
            
            # Group segments by level to merge strictly within same elevation
            # Segments: list of ((x1, y1, z), (x2, y2, z))
            by_level = {}
            for p1, p2 in segments:
                z = p1[2]
                if z not in by_level:
                    by_level[z] = []
                by_level[z].append(LineString([p1, p2]))
            
            merged_polylines = []
            
            for z, lines in by_level.items():
                merged = linemerge(lines)
                
                # linemerge returns LineString or MultiLineString
                if merged.geom_type == 'LineString':
                    # Extract coords. Shapely keeps Z if inputs have Z.
                    coords = list(merged.coords)
                    merged_polylines.append(coords)
                elif merged.geom_type == 'MultiLineString':
                    for geom in merged.geoms:
                        coords = list(geom.coords)
                        merged_polylines.append(coords)
                        
            return merged_polylines
            
        except ImportError:
            # Fallback if shapely not found (though it should be)
            print("Shapely not found, returning raw segments as separate polylines")
            return [[p1, p2] for p1, p2 in segments]
    @staticmethod
    def _get_edge_point(edge_idx, x, y, dx, dy, v_bl, v_br, v_tr, v_tl, level):
        """Linearly interpolates position along an edge (0=top, 1=right, 2=bottom, 3=left)."""
        if edge_idx == 0:  # Top (tl to tr)
            t = (level - v_tl) / (v_tr - v_tl) if v_tr != v_tl else 0.5
            return (x + t * dx, y + dy, level)
        elif edge_idx == 1:  # Right (br to tr)
            t = (level - v_br) / (v_tr - v_br) if v_tr != v_br else 0.5
            return (x + dx, y + t * dy, level)
        elif edge_idx == 2:  # Bottom (bl to br)
            t = (level - v_bl) / (v_br - v_bl) if v_br != v_bl else 0.5
            return (x + t * dx, y, level)
        elif edge_idx == 3:  # Left (bl to tl)
            t = (level - v_bl) / (v_tl - v_bl) if v_tl != v_bl else 0.5
            return (x, y + t * dy, level)
        return (x, y, level)
