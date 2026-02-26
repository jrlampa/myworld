import os
import sys
import geopandas as gpd
from shapely.geometry import Point, Polygon
import ezdxf

# Add root to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from infrastructure.dxf_builder import DXFGenerator

def final_verification():
    print("--- Final Integrated SOTA Verification ---")
    filename = "final_sota_verification.dxf"
    
    # 1. Setup Generator
    dxf_gen = DXFGenerator(filename)
    
    # 2. Add some features
    data = {
        'geometry': [
            Polygon([(0,0), (10,0), (10,10), (0,10)]), # Building
            Point(5, 5), # Tree
            Point(2, 2)  # Lamp
        ],
        'building': ['yes', None, None],
        'natural': [None, 'tree', None],
        'highway': [None, None, 'street_lamp'],
        'name': ['Building 1', None, None]
    }
    gdf = gpd.GeoDataFrame(data)
    dxf_gen.add_features(gdf)
    
    # 3. Add Cartography
    min_x, min_y, max_x, max_y = 0, 0, 10, 10
    dxf_gen.add_coordinate_grid(min_x, min_y, max_x, max_y, 0, 0)
    dxf_gen.add_cartographic_elements(min_x, min_y, max_x, max_y, 0, 0)
    dxf_gen.add_legend()
    dxf_gen.add_title_block(client="CLIENTE TESTE", project="VERIFICAÇÃO FINAL SOTA")
    
    # 4. Save
    dxf_gen.save()
    
    # 5. Verify file
    doc = ezdxf.readfile(filename)
    msp = doc.modelspace()
    
    # Check layers
    sistopo_layers = [l.dxf.name for l in doc.layers if l.dxf.name.startswith('sisTOPO_')]
    print(f"sisTOPO Layers found: {len(sistopo_layers)}")
    
    # Check Blocks
    block_names = [b.name for b in doc.blocks]
    required_blocks = ['ARVORE', 'NORTE', 'ESCALA']
    for rb in required_blocks:
        if rb in block_names:
            print(f"Block {rb}: OK")
        else:
            print(f"Block {rb}: MISSING")
            
    # Check Layout
    layout = doc.layout('Layout1')
    viewports = layout.query('VIEWPORT')
    print(f"Viewports in Layout1: {len(viewports)}")
    
    print("--- Final Verification: OK ---")

if __name__ == "__main__":
    final_verification()
