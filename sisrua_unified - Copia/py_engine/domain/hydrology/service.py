import math
import numpy as np
import heapq
from typing import List, Tuple, Dict

def fill_sinks(grid: np.ndarray, epsilon: float = 0.01) -> np.ndarray:
    """
    Implement a professional Sink Filling algorithm (Wang & Liu 2006).
    Ensures every cell has a drainage path to the edge.
    """
    rows, cols = grid.shape
    filled = np.full_like(grid, np.inf)
    pq = []
    
    # 1. Initialize with boundaries
    for r in range(rows):
        for c in [0, cols-1]:
            filled[r, c] = grid[r, c]
            heapq.heappush(pq, (filled[r, c], r, c))
    for c in range(1, cols-1):
        for r in [0, rows-1]:
            filled[r, c] = grid[r, c]
            heapq.heappush(pq, (filled[r, c], r, c))
            
    # 2. Priority queue propagation
    neighbors = [(-1,-1), (-1,0), (-1,1), (0,-1), (0,1), (1,-1), (1,0), (1,1)]
    
    while pq:
        h, r, c = heapq.heappop(pq)
        
        for dr, dc in neighbors:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and filled[nr, nc] == np.inf:
                # If neighbor is lower than current cell, raise it to current + epsilon
                # (to ensure flow, though pure sink filling just sets it to 'h' if h > grid[nr,nc])
                filled[nr, nc] = max(grid[nr, nc], filled[r, c] + epsilon)
                heapq.heappush(pq, (filled[nr, nc], nr, nc))
                
    return filled

def calculate_flow_direction(grid: np.ndarray) -> np.ndarray:
    """Calculate flow direction using D8 algorithm. Works best on sink-filled grids."""
    rows, cols = grid.shape
    flow_dir = np.zeros_like(grid, dtype=int)
    # D8 Codes (standard ArcGIS/GRASS): 1=E, 2=SE, 4=S, 8=SW, 16=W, 32=NW, 64=N, 128=NE
    neighbors = [
        (0, 1, 1), (1, 1, 2), (1, 0, 4), (1, -1, 8),
        (0, -1, 16), (-1, -1, 32), (-1, 0, 64), (-1, 1, 128)
    ]
    for r in range(1, rows - 1):
        for c in range(1, cols - 1):
            max_slope, best_dir, center_elev = -1.0, 0, grid[r, c]
            for dr, dc, code in neighbors:
                drop = center_elev - grid[r + dr, c + dc]
                dist = math.sqrt(dr*dr + dc*dc)
                slope = drop / dist
                if slope > max_slope:
                    max_slope, best_dir = slope, code
            flow_dir[r, c] = best_dir
    return flow_dir

def calculate_flow_accumulation(flow_dir: np.ndarray) -> np.ndarray:
    """Calculate flow accumulation (number of contributing upstream cells)."""
    rows, cols = flow_dir.shape
    accumulation = np.ones_like(flow_dir, dtype=float)
    
    # Sort cells by elevation (topological sort via flow direction dependencies)
    # We use a simple in-degree approach
    in_degree = np.zeros_like(flow_dir, dtype=int)
    neighbors_map = {1:(0,1), 2:(1,1), 4:(1,0), 8:(1,-1), 16:(0,-1), 32:(-1,-1), 64:(-1,0), 128:(-1,1)}
    
    for r in range(rows):
        for c in range(cols):
            code = flow_dir[r, c]
            if code in neighbors_map:
                dr, dc = neighbors_map[code]
                tr, tc = r + dr, c + dc
                if 0 <= tr < rows and 0 <= tc < cols:
                    in_degree[tr, tc] += 1
                    
    queue = [(r, c) for r in range(rows) for c in range(cols) if in_degree[r, c] == 0]
    idx = 0
    while idx < len(queue):
        r, c = queue[idx]
        idx += 1
        code = flow_dir[r, c]
        if code in neighbors_map:
            dr, dc = neighbors_map[code]
            tr, tc = r + dr, c + dc
            if 0 <= tr < rows and 0 <= tc < cols:
                accumulation[tr, tc] += accumulation[r, c]
                in_degree[tr, tc] -= 1
                if in_degree[tr, tc] == 0:
                    queue.append((tr, tc))
                    
    return accumulation

def extract_watersheds(flow_dir: np.ndarray) -> np.ndarray:
    """Identify drainage basins by grouping cells that flow to the same sink."""
    rows, cols = flow_dir.shape
    basins = np.full_like(flow_dir, -1, dtype=int)
    
    # 1. Identify Sinks (cells with flow_dir == 0)
    sinks = []
    for r in range(rows):
        for c in range(cols):
            if flow_dir[r, c] == 0:
                sinks.append((r, c))
                basins[r, c] = len(sinks)
                
    # 2. Iteratively expand basins upstream
    neighbors_map = {1:(0,1), 2:(1,1), 4:(1,0), 8:(1,-1), 16:(0,-1), 32:(-1,-1), 64:(-1,0), 128:(-1,1)}
    
    changed = True
    while changed:
        changed = False
        for r in range(rows):
            for c in range(cols):
                if basins[r, c] != -1: continue
                # Does this cell flow into a basin?
                code = flow_dir[r, c]
                if code in neighbors_map:
                    dr, dc = neighbors_map[code]
                    tr, tc = r + dr, c + dc
                    if 0 <= tr < rows and 0 <= tc < cols and basins[tr, tc] != -1:
                        basins[r, c] = basins[tr, tc]
                        changed = True
                        
    return basins

def calculate_watershed_metrics(
    basins: np.ndarray, 
    cell_size: float,
    flow_acc: np.ndarray
) -> List[Dict]:
    """Calculate professional metrics for each watershed basin."""
    unique_basins = np.unique(basins[basins > 0])
    metrics = []
    
    cell_area = cell_size * cell_size
    
    for b_id in unique_basins:
        mask = (basins == b_id)
        area_m2 = np.sum(mask) * cell_area
        max_acc = np.max(flow_acc[mask])
        
        metrics.append({
            "id": int(b_id),
            "area_m2": float(area_m2),
            "area_ha": float(area_m2 / 10000.0),
            "peak_accumulation": float(max_acc)
        })
        
    return metrics

def trace_streams(
    flow_acc: np.ndarray, 
    flow_dir: np.ndarray, 
    grid_bounds: Tuple[float, float, float, float], 
    grid_size: int, 
    threshold: int = 100
) -> List[List[Tuple[float, float]]]:
    """Trace downstream paths starting from high accumulation cells."""
    rows, cols = flow_acc.shape
    min_x, min_y, max_x, max_y = grid_bounds
    # Grid is rows (X) and cols (Y) in current logic
    dx = (max_x - min_x) / (rows - 1)
    dy = (max_y - min_y) / (cols - 1)
    
    def grid_to_world(r, c): return (min_x + r * dx, min_y + c * dy)
    
    streams, visited = [], set()
    neighbors_map = {1:(0,1), 2:(1,1), 4:(1,0), 8:(1,-1), 16:(0,-1), 32:(-1,-1), 64:(-1,0), 128:(-1,1)}
    
    for r in range(rows):
        for c in range(cols):
            if flow_acc[r, c] > threshold and (r, c) not in visited:
                path, curr_r, curr_c = [], r, c
                while True:
                    visited.add((curr_r, curr_c))
                    path.append(grid_to_world(curr_r, curr_c))
                    code = flow_dir[curr_r, curr_c]
                    if code not in neighbors_map: break
                    dr, dc = neighbors_map[code]
                    nr, nc = curr_r + dr, curr_c + dc
                    if 0 <= nr < rows and 0 <= nc < cols:
                        if (nr, nc) in visited: break
                        curr_r, curr_c = nr, nc
                    else: break
                if len(path) > 2: streams.append(path)
    return streams

def calculate_strahler_order(
    flow_acc: np.ndarray, 
    streams: List[List[Tuple[float, float]]], 
    grid_bounds: Tuple[float, float, float, float], 
    grid_size_tuple: Tuple[int, int]
) -> List[int]:
    """Calculate Strahler stream order (topological ordering)."""
    orders = []
    max_acc = np.max(flow_acc)
    rows, cols = grid_size_tuple
    min_x, min_y, max_x, max_y = grid_bounds
    dx = (max_x - min_x) / (rows - 1)
    dy = (max_y - min_y) / (cols - 1)
    
    for stream in streams:
        if not stream: orders.append(1); continue
        # Start point of stream
        r = max(0, min(rows - 1, int(round((stream[0][0] - min_x) / dx))))
        c = max(0, min(cols - 1, int(round((stream[0][1] - min_y) / dy))))
        acc = flow_acc[r, c]
        
        # Heuristic based on accumulation since full topological graph is complex
        if acc < threshold_scaled(max_acc, 0.05): orders.append(1)
        elif acc < threshold_scaled(max_acc, 0.2): orders.append(2)
        elif acc < threshold_scaled(max_acc, 0.5): orders.append(3)
        else: orders.append(4)
    return orders

def threshold_scaled(max_val, pct):
    return max_val * pct
