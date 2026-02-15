import sys
import os
import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dxf_generator import DXFGenerator

def test_manual():
    print("Starting manual test...")
    dxf_gen = DXFGenerator("debug.dxf")
    
    line = LineString([(0,0), (10,0)])
    data = {'geometry': [line], 'name': ['Rua Test'], 'highway': ['residential']}
    gdf = gpd.GeoDataFrame(data)
    
    print("Adding features...")
    dxf_gen.add_features(gdf)
    
    # Check entities
    print("Checking entities...")
    texts = [e for e in dxf_gen.msp if e.dxftype() == 'TEXT']
    print(f"Found {len(texts)} TEXT entities")
    
    if texts:
        print(f"Rotation: {texts[0].dxf.rotation}")

if __name__ == "__main__":
    try:
        test_manual()
    except Exception as e:
        print(f"CRASH: {e}")
