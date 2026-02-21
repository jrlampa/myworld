import requests
import numpy as np
from utils.logger import Logger

BATCH_SIZE = 100 # Open-Elevation limit is often around 100-150 locations per request

def fetch_elevation_grid(north, south, east, west, resolution=50):
    """
    Generates a grid of points and fetches elevation from Open-Elevation API.
    
    Returns:
        tuple: (list of (lat, lon, elev), rows, cols)
    """
    Logger.info("Generating terrain grid...", "info")
    
    # 1 degree approx 111km. 
    # CRITICAL: If resolution and distance mismatch (e.g. UTM vs Degrees), step could be tiny
    # Ensure step is at least 0.0001 (approx 11m) to prevent millions of points
    step = max(0.0001, (resolution / 111000.0))
    
    # Calculate dimensions and cap them to prevent memory explosions
    # Calculate dimensions and cap them to 10,000 points total budget (100x100)
    # This prevents astronomical grids while maintaining complete coverage for the requested resolution
    rows = min(100, int(np.ceil((north - south) / step)))
    cols = min(100, int(np.ceil((east - west) / step)))
    
    lats = np.linspace(south, north, rows)
    lons = np.linspace(west, east, cols)
    
    # Create grid points using meshgrid (avoids slow nested Python loops)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing='ij')
    locations = [
        {'latitude': float(lat), 'longitude': float(lon)}
        for lat, lon in zip(lat_grid.ravel(), lon_grid.ravel())
    ]
            
    total_points = len(locations)
    Logger.info(f"Querying elevation for {total_points} points ({rows}x{cols} grid)...")
    
    from concurrent.futures import ThreadPoolExecutor
    
    def fetch_batch(batch):
        try:
            resp = requests.post(
                "https://api.open-elevation.com/api/v1/lookup",
                json={"locations": batch},
                headers={'Content-Type': 'application/json'},
                timeout=15
            )
            if resp.status_code == 200:
                return [(r['latitude'], r['longitude'], r['elevation']) for r in resp.json()['results']]
        except Exception as e:
            Logger.error(f"Elevation batch failed: {e}")
        return [(loc['latitude'], loc['longitude'], 0) for loc in batch]

    batches = [locations[i:i+BATCH_SIZE] for i in range(0, total_points, BATCH_SIZE)]
    elevations = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(fetch_batch, batches))
        for res in results:
            elevations.extend(res)
                
    return elevations, rows, cols
