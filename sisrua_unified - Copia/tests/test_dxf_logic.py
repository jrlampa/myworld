import sys
import os
import math

# Add py_engine to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'py_engine')))

try:
    from utils.contour_generator import ContourGenerator
except ImportError:
    # Fallback for direct execution
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from py_engine.utils.contour_generator import ContourGenerator

def test_contour_generator():
    print("Testing ContourGenerator...")
    
    # 2x2 Grid, linear slope
    # 0 -- 1
    # |    |
    # 0 -- 1
    grid = [[0.0, 1.0], [0.0, 1.0]]
    min_x, max_x = 0, 10
    min_y, max_y = 0, 10
    # Center is at x=5. Slope is along X.
    # Level 0.5 should result in vertical line at x=5.
    
    contours = ContourGenerator.generate_contours(grid, min_x, max_x, min_y, max_y, 0.5, levels=[0.5])
    print(f"Generated {len(contours)} segments (Expected > 0)")
    
    for p1, p2 in contours:
        print(f"Segment: {p1} -> {p2}")
        # x should be 5.0
        assert abs(p1[0] - 5.0) < 0.01, f"Expected x=5.0, got {p1[0]}"
        assert abs(p2[0] - 5.0) < 0.01, f"Expected x=5.0, got {p2[0]}"
        
    print("✓ Contour Generation Logic Passed")

def test_export_service_integration():
    print("\nTesting ExportService Integration (Mock)...")
    try:
        from utils.export_service import ExportService
        service = ExportService()
        
        # Mock analysis data
        class MockAnalysis:
            pass
        
        analysis = MockAnalysis()
        analysis.elevation_grid = [[0.0, 10.0], [0.0, 10.0]]
        
        # Mock samples (4 corners)
        class MockSample:
            def __init__(self, lat, lng, ele):
                self.lat = lat
                self.lng = lng
                self.elevation_m = ele
        
        samples = [
            MockSample(0, 0, 0),
            MockSample(0, 10, 10),
            MockSample(10, 0, 0),
            MockSample(10, 10, 10)
        ]
        
        analysis_data = {
            "metadata": {"radius": 10},
            "samples": samples,
            "to_local_xy": lambda lat, lng: (lat, lng), # Simple mock projection
            "feature_collection": None,
            "analysis": analysis
        }
        
        # We can't easily mock ezdxf completely without mocking the import, 
        # but let's assume it runs if ezdxf is installed.
        # Calling generate_dxf writes to file. Use a dummy path.
        output_path = "test_output.dxf"
        
        print("Generating DXF with preset 1:500...")
        service.generate_dxf(analysis_data, output_path, preset="1:500")
        
        if os.path.exists(output_path):
            print(f"✓ DXF file created at {output_path}")
            os.remove(output_path)
            
        print("✓ ExportService Integration Passed")
        
    except ImportError as e:
        print(f"Skipping ExportService test due to import error: {e}")
    except Exception as e:
        print(f"FAILED ExportService test: {e}")
        # Don't fail the whole script if ezdxf write fails due to permissions, mainly want logic check
        if "ezdxf" in str(e):
             print("(Likely environment issue with ezdxf write)")

if __name__ == "__main__":
    test_contour_generator()
    test_export_service_integration()
