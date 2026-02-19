import sys
import os
import json
from pathlib import Path

# Add py_engine to path to simulate package execution if needed
sys.path.append(str(Path(__file__).parent / "py_engine"))

try:
    from py_engine.main import generate_dxf_from_coordinates
    print("[SUCCESS] Found generate_dxf_from_coordinates")
except ImportError as e:
    print(f"[ERROR] Import failed: {e}")
    sys.exit(1)

def test_modular_engine():
    print("\n--- Testing Modular Engine ---")
    test_lat, test_lng = -22.9068, -43.1729 # Rio de Janeiro
    test_radius = 100
    output_file = "phase12_test.dxf"
    
    try:
        result = generate_dxf_from_coordinates(
            lat=test_lat,
            lng=test_lng,
            radius=test_radius,
            output_filename=output_file,
            quality_mode="low", # Faster for test
            target_elevation=5.0
        )
        
        if result and "analysis" in result:
            print("[SUCCESS] Analysis completed")
            analysis = result["analysis"]
            
            # Check for new modular fields
            required_fields = ["elevation_range", "slope_degrees", "aspect_degrees", "watersheds", "tpi", "landforms"]
            for field in required_fields:
                if field in analysis:
                    print(f"  [OK] Field '{field}' present")
                else:
                    print(f"  [FAIL] Field '{field}' missing")
            
            # Check file creation
            if Path(output_file).exists():
                print(f"[SUCCESS] DXF file generated: {output_file}")
                # cleanup
                os.remove(output_file)
            else:
                print("[FAIL] DXF file not generated")
                
            # Check earthworks
            if "earthworks" in result:
                print("[SUCCESS] Earthworks calculated")
                print(f"  Volume Net: {result['earthworks'].get('net_volume_m3')}")
            else:
                print("[FAIL] Earthworks missing")
                
        else:
            print("[FAIL] Result structure invalid")
            print(json.dumps(result, indent=2)[:500])
            
    except Exception as ex:
        print(f"[CRITICAL] Test crashed: {ex}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_modular_engine()
    print("\nVerification Finished.")
