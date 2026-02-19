import math

def is_point_in_polygon(x, y, polygon):
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def polygon_grid_points(bounds, quality_mode):
    lats = [p[1] for p in bounds]
    lngs = [p[0] for p in bounds]
    min_lat, max_lat = min(lats), max(lats)
    min_lng, max_lng = min(lngs), max(lngs)

    # Estimate step size (degrees) from quality
    # 1 deg lat ~= 111km. 40m ~= 0.00036 deg
    step_meters = {"ultra": 20, "high": 40, "balanced": 80}.get(quality_mode, 40)
    step = step_meters / 111000.0

    points = []
    lat = min_lat
    while lat <= max_lat:
        lng = min_lng
        while lng <= max_lng:
            if is_point_in_polygon(lng, lat, bounds):
                points.append((lat, lng))
            lng += step
        lat += step
        
    return points

def test():
    print("Testing Isolated Polygon Logic...")
    
    # 1. Square Test
    square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    assert is_point_in_polygon(5, 5, square) == True, "Center fail"
    assert is_point_in_polygon(15, 5, square) == False, "Outside fail"
    
    # 2. Grid Test (Small polygon)
    bounds = [
        [-42.0, -22.0], 
        [-41.999, -22.0], 
        [-41.999, -21.999], 
        [-42.0, -21.999], 
        [-42.0, -22.0]
    ]
    points = polygon_grid_points(bounds, "high")
    print(f"Generated {len(points)} points")
    
    if len(points) > 0:
        print("✓ Logic Verification Passed")
    else:
        print("❌ Logic Verification Failed: No points generated")
        exit(1)

if __name__ == "__main__":
    test()
