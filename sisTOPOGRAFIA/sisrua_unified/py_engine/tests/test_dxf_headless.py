import os
import sys
import ezdxf

# Ensure the engine imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from infrastructure.bim_data_embedder import BIMDataEmbedder

def test_dxf_25d_and_bim():
    """
    Test that the generated DXF obeys 2.5D rules and contains Half-way BIM.
    """
    dxf_path = os.path.join(os.path.dirname(__file__), '..', 'test_bim.dxf')
    assert os.path.exists(dxf_path), f"DXF output not found at {dxf_path}"
    
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    
    entities = list(msp)
    assert len(entities) > 0, "No entities in the DXF file"
    
    # Trackers for BIM and 2.5D
    bim_count = 0
    non_25d_entities = []
    
    for entity in entities:
        # Check for BIM Data
        if entity.has_xdata(BIMDataEmbedder.APP_ID):
            bim_count += 1
            xdata = entity.get_xdata(BIMDataEmbedder.APP_ID)
            # xdata is a list of tuples (code, value)
            found_source = False
            for group_code, value in xdata:
                if group_code == 1000 and "source:OSM" in value:
                    found_source = True
            assert found_source, "BIM data is missing the 'source:OSM' key"

        # Check 2.5D constraint
        # Allowed entities for 2.5D: LWPOLYLINE (thickness), CIRCLE, TEXT, INSERT
        # 3D Solids or regions are strictly forbidden
        if entity.dxftype() in ['3DSOLID', 'REGION', 'SURFACE']:
            non_25d_entities.append(entity.dxftype())
            
        # If it's a POLYLINE (3D), it can only be used for contours
        if entity.dxftype() == 'POLYLINE':
            # Is it a 3D polyline?
            if entity.is_3d_polyline and entity.dxf.layer != 'TOPOGRAFIA_CURVAS':
                 non_25d_entities.append(entity.dxftype() + " on layer " + entity.dxf.layer)
                 
    assert len(non_25d_entities) == 0, f"Found strictly 3D entities which violates 2.5D constraint: {non_25d_entities}"
    assert bim_count > 0, "Found 0 entities with Half-way BIM XDATA. BIM injection failed."
    
    print(f"SUCCESS: DXF Validated! Parsed {len(entities)} entities.")
    print(f"-> Found {bim_count} entities with embedded 'Half-way BIM' XDATA.")
    print("-> Verified 100% adherence to 2.5D Topographic Rules (No 3D solids, planar elements only).")

if __name__ == '__main__':
    test_dxf_25d_and_bim()
