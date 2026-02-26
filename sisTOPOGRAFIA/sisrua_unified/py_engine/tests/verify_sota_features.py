import ezdxf
import os
import sys

# Add root to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from infrastructure.dxf_builder import DXFGenerator
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
import pandas as pd

def run_verification():
    filename = "verification_test.dxf"
    print(f"--- Verifying SOTA Features in {filename} ---")
    
    gen = DXFGenerator(filename)
    
    # Create Mock Data
    data = {
        'geometry': [
            Point(0, 0), # Tree
            Point(10, 10), # Pole
            LineString([(0,0), (50,0)]), # Road
            Polygon([(20,20), (40,20), (40,40), (20,40), (20,20)]) # Building
        ],
        'natural': ['tree', None, None, None],
        'power': [None, 'pole', None, None],
        'highway': [None, None, 'residential', None],
        'building': [None, None, None, 'yes'],
        'name': [None, None, 'Rua Teste', None],
        'height': [None, None, None, '10m'],
        'osmid': ['1', '2', '3', '4']
    }
    gdf = gpd.GeoDataFrame(data, crs="EPSG:31983") # SIRGAS 2000 UTM 23S
    
    # 1. Add Features
    gen.add_features(gdf)
    
    # 2. Add Drainage Mock
    gen.add_drainage_lines([[(0,0), (10,10)]])
    
    # 3. Save
    gen.save()
    
    # 4. Verify
    doc = ezdxf.readfile(filename)
    
    print("\n[Layer Verification]")
    required_layers = [
        'sisTOPO_EDIFICACAO', 
        'sisTOPO_VIAS', 
        'sisTOPO_VEGETACAO', 
        'sisTOPO_HIDROGRAFIA_DRENAGEM'
    ]
    for layer in required_layers:
        exists = layer in doc.layers
        print(f"Layer {layer}: {'OK' if exists else 'MISSING'}")
        if not exists:
            # Check what layers exist
            print(f"  Available layers: {[l.dxf.name for l in doc.layers]}")

    print("\n[BIM Metadata Verification]")
    msp = doc.modelspace()
    polylines = msp.query('LWPOLYLINE')
    bim_found = False
    for pl in polylines:
        if pl.dxf.layer == 'sisTOPO_EDIFICACAO':
            xdata = pl.get_xdata('SISRUA_BIM')
            if xdata:
                bim_found = True
                print(f"XDATA found on Building: {xdata[:5]}...")
    print(f"BIM XData: {'OK' if bim_found else 'MISSING'}")

    print("\n[2.5D Block Verification]")
    blocks = msp.query('INSERT')
    tree_found = False
    pole_found = False
    for b in blocks:
        if b.dxf.name == 'ARVORE': tree_found = True
        if b.dxf.name == 'POSTE': pole_found = True
    print(f"Block ARVORE: {'OK' if tree_found else 'MISSING'}")
    print(f"Block POSTE: {'OK' if pole_found else 'MISSING'}")

    # Cleanup
    if os.path.exists(filename):
        os.remove(filename)

if __name__ == "__main__":
    run_verification()
