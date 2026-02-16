import sys
import os
import numpy as np
import geopandas as gpd
from shapely.geometry import Point

# Add py_engine to path
sys.path.append(os.path.join(os.getcwd(), 'py_engine'))

from dxf_generator import DXFGenerator

def test_nan_resilience():
    output_file = 'c:/myworld/sisrua_unified/public/dxf/test_fix.dxf'
    gen = DXFGenerator(output_file)
    
    # 1. Create a dummy GDF with some points
    gdf = gpd.GeoDataFrame({
        'geometry': [Point(0,0), Point(10,10)],
        'building': ['yes', 'yes']
    }, crs="EPSG:3857")
    
    gen.add_features(gdf)
    
    # 2. Add Terrain with intentionally malformed data (NaN and Inf)
    grid = [
        [(0,0,10), (10,0,float('nan')), (20,0,15)],
        [(0,10,12), (10,10,14), (20,10,float('inf'))],
        [(0,20,float('-inf')), (10,20,18), (20,20,20)]
    ]
    
    print("Testing add_terrain_from_grid with NaN/Inf...")
    gen.add_terrain_from_grid(grid)
    
    # 3. Save
    gen.save()
    print(f"Generated test file: {output_file}")
    
    # 4. Audit result
    import ezdxf
    try:
        doc = ezdxf.readfile(output_file)
        auditor = doc.audit()
        if auditor.has_errors:
            print("AUDIT FAILED: Errors found in resilient DXF!")
            for e in auditor.errors:
                print(f"  - {e.message}")
        else:
            print("AUDIT PASSED: DXF is valid even with input NaN/Inf.")
            
        # Verify no 'nan' strings in the file content
        with open(output_file, 'r') as f:
            content = f.read().lower()
            if 'nan' in content:
                 print("CRITICAL ERROR: 'nan' found in DXF file content!")
            else:
                 print("SUCCESS: No 'nan' strings in DXF output.")
                 
    except Exception as e:
        print(f"READ FAILED: {e}")

if __name__ == "__main__":
    test_nan_resilience()
