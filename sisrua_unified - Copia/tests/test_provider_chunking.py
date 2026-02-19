import sys
import os
import json
import time

# Add py_engine to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'py_engine')))

try:
    from utils.satellite_topography import OpenElevationProvider, ElevationSample
except ImportError:
    # Fallback for direct execution
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from py_engine.utils.satellite_topography import OpenElevationProvider, ElevationSample

def test_chunking():
    print("Testing OpenElevationProvider Chunking...")
    
    # Initialize provider
    # User might not have OPEN_ELEVATION_URL set, so it defaults to public API or None
    # If using public API, we should be gentle.
    provider = OpenElevationProvider()
    print(f"Provider: {provider.name}")
    print(f"Base URL: {provider.base_url}")
    
    # Generate 450 points (Chunk size is 200, so this should trigger 3 chunks: 200, 200, 50)
    # Use a small area around Rio to avoid sparking spam filters
    lat_start = -22.9
    lng_start = -43.2
    
    points = []
    for i in range(450):
        points.append((lat_start + i*0.0001, lng_start + i*0.0001))
        
    print(f"Requesting {len(points)} points...")
    start_time = time.time()
    
    try:
        samples = provider.sample_batch(points)
    except Exception as e:
        print(f"FAILED with exception: {e}")
        return

    duration = time.time() - start_time
    print(f"Finished in {duration:.2f} seconds")
    
    if len(samples) != 450:
        print(f"❌ Mismatch: Expected 450 samples, got {len(samples)}")
        sys.exit(1)
        
    # Check for valid data
    valid_count = sum(1 for s in samples if s.elevation_m != 0.0) # Assuming not all are 0
    print(f"Valid non-zero elevations: {valid_count}")
    
    print("✓ Chunking Verification Passed")

if __name__ == "__main__":
    test_chunking()
