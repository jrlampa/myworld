import sys
import os
import json

# Add py_engine to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'py_engine')))

try:
    from utils.topography_service import TopographyService
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

def test_api_contours():
    print("Testing TopographyService Contour Generation...")
    
    service = TopographyService()
    
    # Mocking data to avoid real API calls would be best, 
    # but TopographyService logic is tightly coupled with fetching.
    # However, if we pass bounds, it tries to fetch.
    # We can try to rely on the fallback mechanism or mock sample_elevation_batch.
    
    # Let's monkeypatch sample_elevation_batch to return a flat plane
    # to ensure predictable contours (none or specific).
    # Or actually, let's just make a simple mock of internal methods if possible,
    # or just run it and expect *structure* correctness even if data is zero.
    
    # Let's try to run with a very small radius so it doesn't hit external APIs too hard 
    # (or fails and uses fallback which is 0.0 elevation).
    # If elevation is 0, no contours.
    
    # Better: Mock `sample_elevation_batch`
    import utils.topography_service as ts
    from utils.satellite_topography import ElevationSample
    
    def mock_sample(points):
        # Create a slope
        return [ElevationSample(lat=p[0], lng=p[1], elevation_m=p[0]*1000) for p in points]
        
    ts.sample_elevation_batch = mock_sample
    
    # Mock fetch_osm_features
    def mock_features(lat, lng, radius):
        return None
    ts.fetch_osm_features = mock_features
    
    # Run analysis
    # location: slightly changing lat/lng to verify slope
    lat, lng = 0.0, 0.0
    radius = 100
    
    try:
        result = service.get_analysis(lat, lng, radius, quality_mode="low")
        
        if "contours" not in result:
            print("❌ 'contours' key missing in response")
            sys.exit(1)
            
        contours = result["contours"]
        if "major" not in contours or "minor" not in contours:
            print("❌ 'major' or 'minor' keys missing in contours")
            sys.exit(1)
            
        print(f"✓ Contours keys present. Minor: {len(contours['minor'])}, Major: {len(contours['major'])}")
        
        # Check segment structure
        if len(contours['minor']) > 0:
            seg = contours['minor'][0]
            # Expected: ((x1, y1, z), (x2, y2, z))
            print(f"Sample Segment: {seg}")
            if len(seg) != 2 or len(seg[0]) != 3:
                print("❌ Invalid segment structure")
                sys.exit(1)
                
        print("✓ API Contour Structure Verified")
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_api_contours()
