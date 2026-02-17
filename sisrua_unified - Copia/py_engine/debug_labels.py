import sys
import os
import numpy as np
from shapely.geometry import LineString, Point

# Simulate the logic
def calculate_rotation(geom):
    try:
        if isinstance(geom, LineString):
            p1 = geom.interpolate(0.45, normalized=True)
            p2 = geom.interpolate(0.55, normalized=True)
            dx = p2.x - p1.x
            dy = p2.y - p1.y
            angle = np.degrees(np.arctan2(dy, dx))
            
            print(f"  Points: ({p1.x}, {p1.y}) -> ({p2.x}, {p2.y})")
            print(f"  Delta: ({dx}, {dy})")
            print(f"  Angle (deg): {angle}")
            
            if -90 <= angle <= 90:
                 return angle
            else:
                 return angle + 180
    except Exception as e:
        print(f"Error: {e}")
        return 0
    return 0

print("Testing Horizontal (0,0) -> (10,0)")
l1 = LineString([(0,0), (10,0)])
r1 = calculate_rotation(l1)
print(f"Rotation: {r1}")

print("\nTesting Vertical (0,0) -> (0,10)")
l2 = LineString([(0,0), (0,10)])
r2 = calculate_rotation(l2)
print(f"Rotation: {r2}")

print("\nTesting Inverted (10,0) -> (0,0)")
l3 = LineString([(10,0), (0,0)])
r3 = calculate_rotation(l3)
print(f"Rotation: {r3}")

print("\nTesting Diagonal (0,0) -> (10,10)")
l4 = LineString([(0,0), (10,10)])
r4 = calculate_rotation(l4)
print(f"Rotation: {r4}")
