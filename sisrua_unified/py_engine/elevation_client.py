import requests
import numpy as np
from utils.logger import Logger

BATCH_SIZE = 100 # Open-Elevation limit is often around 100-150 locations per request

def fetch_elevation_grid(north, south, east, west, resolution=50):
    """
    Generates a grid of points and fetches elevation from Open-Elevation API.
    
    Args:
        north, south, east, west: Bounding box coordinates
        resolution: Grid spacing in meters (approx)
        
    Returns:
        List of (lat, lon, elev) tuples
    """
    Logger.info("Generating terrain grid...", "info")
    
    # 1 degree approx 111km. 50m ~= 0.00045 degrees
    step = (resolution / 111000.0) 
    
    lats = np.arange(south, north, step)
    lons = np.arange(west, east, step)
    
    # Create grid points
    locations = []
    for lat in lats:
        for lon in lons:
            locations.append({'latitude': lat, 'longitude': lon})
            if len(locations) > 5000: # Safety cap
                break
        if len(locations) > 5000:
            break
            
    total_points = len(locations)
    Logger.info(f"Querying elevation for {total_points} points (res={resolution}m)...")
    
    from concurrent.futures import ThreadPoolExecutor
    
    def fetch_batch(batch):
        try:
            resp = requests.post(
                "https://api.open-elevation.com/api/v1/lookup",
                json={"locations": batch},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            if resp.status_code == 200:
                return [(r['latitude'], r['longitude'], r['elevation']) for r in resp.json()['results']]
        except Exception as e:
            Logger.error(f"Elevation batch failed: {e}")
        return [(loc['latitude'], loc['longitude'], 0) for loc in batch]

    # Create batches
    batches = [locations[i:i+BATCH_SIZE] for i in range(0, total_points, BATCH_SIZE)]
    elevations = []

    # Parallelize
    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(fetch_batch, batches))
        for res in results:
            elevations.extend(res)
                
    return elevations
