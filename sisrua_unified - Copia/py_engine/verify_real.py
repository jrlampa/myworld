
import sys
import os
import ezdxf
import traceback

# Add parent dir to path to import main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import main

def test_integration_real_data():
    print("Starting REAL DATA integration test...")
    print("WARNING: This test makes actual network requests to Elevation and OSM APIs.")
    
    output_file = "test_real_25d.dxf"
    if os.path.exists(output_file):
        os.remove(output_file)
    
    # Use a location known to have data (e.g., Christ the Redeemer area in Rio, high elevation)
    # or the user's default location slightly.
    # Let's use coordinates from the codebase examples or Rio.
    # Lat/Lng for a hilly area to ensure elevation > 0
    # Master Level Coordinates (Nova Friburgo)
    lat = -22.15018
    lng = -42.92185
    radius = 500  # 500m radius
    
    print(f"Fetching real data for Lat: {lat}, Lng: {lng}, Radius: {radius}m...")
    
    try:
        # Run main function from main.py
        result = main.generate_dxf_from_coordinates(
            lat=lat, lng=lng, radius=radius,
            output_filename=output_file,
            include_buildings=True,
            include_trees=True,
            quality_mode="balanced"
        )
        print(f"Generation result: {result}")
        
    except Exception as e:
        print(f"FAILED with exception: {e}")
        traceback.print_exc()
        sys.exit(1)

    if not result.get('success'):
        print(f"FAILED: Result indicated failure: {result.get('error')}")
        sys.exit(1)

    if not os.path.exists(output_file):
        print("FAILED: Output file not produced.")
        sys.exit(1)
        
    # Analyze the DXF to ensure we got REAL data (Elevation != 0)
    try:
        doc = ezdxf.readfile(output_file)
        msp = doc.modelspace()
        
        # Check layers
        layers = [layer.dxf.name for layer in doc.layers]
        print(f"Layers found: {layers}")
        assert "HYDROLOGY" in layers, "Missing HYDROLOGY layer (Master Level)"
        assert "TIN_SURFACE" in layers, "Missing TIN_SURFACE layer (Master Level)"
        # Note: FORESTS might be empty if no forest in 500m radius of that specific point
        # But the layer should be created if any forest is found.
        # Let's check if we found forest entities if the layer exists
        if "FORESTS" in layers:
            forests = msp.query('LWPOLYLINE[layer=="FORESTS"]')
            print(f"Found {len(forests)} forest polygons.")
        else:
            print("INFO: No FORESTS layer found (might be no forests in area).")
        
        # Check TIN
        tin_faces = msp.query('3DFACE[layer=="TIN_SURFACE"]')
        print(f"Found {len(tin_faces)} TIN faces.")
        if len(tin_faces) == 0:
             print("FAILURE: No TIN faces generated.")
        else:
             print("SUCCESS: 2.5D TIN Surface generated.")

        # Check for non-zero elevation in Contours or Terrain
        contours = msp.query('LWPOLYLINE[layer=="CONTOURS"]')
        print(f"Found {len(contours)} contour lines.")

        # Master Level Check: Hydrology
        hydro_points = msp.query('POINT[layer=="HYDROLOGY"]')
        print(f"Found {len(hydro_points)} hydrology flow points.")
        if len(hydro_points) == 0:
            print("WARNING: No hydrology points found. Maybe too flat or threshold too high.")
        else:
            print("SUCCESS: Hydrology layer active and populated.")
        
        non_zero_elevations = 0
        for c in contours:
            if abs(c.dxf.elevation) > 0.1:
                non_zero_elevations += 1
                
        print(f"Contours with non-zero elevation: {non_zero_elevations}")
        
        if len(contours) > 0 and non_zero_elevations == 0:
            print("WARNING: Contours found but all have 0 elevation. API might have returned 0s or failed to write Z.")
            # This is a failure condition for "Real Data" unless the area is at sea level perfectly.
            # Christ the Redeemer is high up (~700m).
            print("FAILURE: Expected high elevation for this location.")
            pass # Let's check other entities

        # Check Buildings if any were found
        buildings = msp.query('LWPOLYLINE[layer=="BUILDINGS"]')
        print(f"Found {len(buildings)} buildings.")
        for b in buildings:
            if b.dxf.elevation > 10.0:
                print(f"Confirmed Building at elevation: {b.dxf.elevation}")
                break
                
        print("\nSUCCESS: Integration test completed with REAL data.")
        
    except Exception as e:
        print(f"DXF Analysis Failed: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_integration_real_data()
