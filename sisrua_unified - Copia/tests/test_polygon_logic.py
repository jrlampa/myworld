import sys
import os
import json

# Add py_engine to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'py_engine')))

from utils.topography_service import TopographyService

def test_polygon_logic():
    print("Testing TopographyService Polygon Logic...")
    service = TopographyService()
    
    # 1. Test Point in Polygon (Square)
    square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    assert service._is_point_in_polygon(5, 5, square) == True, "Center should be inside"
    assert service._is_point_in_polygon(15, 5, square) == False, "Outside should be outside"
    assert service._is_point_in_polygon(0, 0, square) == True, "Corner (0,0) should be inside/boundary"
    print("✓ Point in Polygon (Square) passed")
    
    # 2. Test Grid Generation
    # Create a small polygon (approx 100m x 100m) near equator
    # 0.001 deg is approx 111m
    bounds = [
        [-42.0, -22.0], 
        [-41.999, -22.0], 
        [-41.999, -21.999], 
        [-42.0, -21.999], 
        [-42.0, -22.0]
    ]
    
    # "high" quality = ~40m step
    points = service._polygon_grid_points(bounds, "high")
    print(f"Generated {len(points)} points for small polygon")
    
    if len(points) == 0:
        print("❌ Error: No points generated")
        exit(1)
        
    for lat, lng in points:
        if not service._is_point_in_polygon(lng, lat, bounds):
            print(f"❌ Error: Point {lat},{lng} is outside bounds")
            exit(1)
            
    print("✓ Grid Generation passed")

    # 3. Test Center Calculation
    center = service._get_polygon_center(bounds)
    print(f"Center: {center}")
    assert -22.0 <= center[0] <= -21.999, "Center Lat invalid"
    assert -42.0 <= center[1] <= -41.999, "Center Lng invalid"
    print("✓ Center Calculation passed")

    print("All TopographyService Polygon tests passed!")

if __name__ == "__main__":
    try:
        test_polygon_logic()
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"FAILED: {e}")
        sys.exit(1)
