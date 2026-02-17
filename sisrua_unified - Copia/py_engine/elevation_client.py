import requests
import numpy as np
from typing import Any, Dict, List, Tuple
from utils.logger import Logger

BATCH_SIZE = 100 # Open-Elevation limit is often around 100-150 locations per request
OPEN_METEO_URL = "https://api.open-meteo.com/v1/elevation"


def _chunk_list(items: List[Any], size: int) -> List[List[Any]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def fetch_open_meteo_elevations_batched(
    coords: List[Tuple[float, float]],
    batch_size: int = 100,
    timeout_seconds: int = 15
) -> Dict[str, Any]:
    """
    Fetch elevations from Open-Meteo with batching to avoid URL length limits.

    Args:
        coords: list of (lat, lon) tuples in the original order.
        batch_size: max points per request.
        timeout_seconds: request timeout.

    Returns:
        dict with keys:
            - success: bool
            - elevations: list[float] (when success)
            - error: str (when failure)
    """
    elevations: List[float] = []

    try:
        for batch in _chunk_list(coords, batch_size):
            lats = ",".join(f"{lat:.6f}" for lat, _ in batch)
            lons = ",".join(f"{lon:.6f}" for _, lon in batch)

            params = {
                "latitude": lats,
                "longitude": lons
            }

            response = requests.get(OPEN_METEO_URL, params=params, timeout=timeout_seconds)
            response.raise_for_status()
            data = response.json()

            if "elevation" not in data:
                return {
                    "success": False,
                    "error": "Falha ao obter elevacoes do Open-Meteo (resposta invalida)."
                }

            elevations.extend(data["elevation"])

        return {"success": True, "elevations": elevations}

    except requests.RequestException as exc:
        Logger.error(f"Open-Meteo request failed: {exc}")
        return {
            "success": False,
            "error": f"Falha ao obter elevacoes do Open-Meteo: {str(exc)}"
        }

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
    
    # Create grid points
    locations = []
    # Grid order: for each latitude (row), all longitudes (cols)
    for lat in lats:
        for lon in lons:
            locations.append({'latitude': float(lat), 'longitude': float(lon)})
            
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
