import sys
import os

# Add current directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from osmnx_client import fetch_osm_data
    import traceback
    
    # Define a small polygon (Triangle in a known area - e.g., near Eiffel Tower or similar)
    # Eiffel Tower approx: 48.8584, 2.2945
    # Let's use a small square around it.
    # Format expected by our API: [[lat, lon], ...]
    
    polygon = [
        [48.8580, 2.2940],
        [48.8590, 2.2940],
        [48.8590, 2.2950],
        [48.8580, 2.2950],
        [48.8580, 2.2940] # Close the loop
    ]
    
    tags = {'building': True}
    
    print("Testing fetch_osm_data with polygon...")
    gdf = fetch_osm_data(
        lat=0, # Ignored
        lon=0, # Ignored
        radius=0, # Ignored
        tags=tags,
        crs='EPSG:4326', # Use WGS84 for easy verification
        polygon=polygon
    )
    
    if not gdf.empty:
        print(f"SUCCESS: Fetched {len(gdf)} features.")
        print(gdf.head())
        # Check bounds to ensure they are within the polygon
        minx, miny, maxx, maxy = gdf.total_bounds
        print(f"Bounds: {minx}, {miny}, {maxx}, {maxy}")
        
    else:
        print("FAILURE: No features returned (but some should exist there).")

except Exception as e:
    print("EXCEPTION OCCURRED:")
    traceback.print_exc()
