import ezdxf
import sys
import numpy as np
from pathlib import Path

def test_dxf_compliance(dxf_path: str):
    """
    Headless auditor for DXF BIM compliance.
    Verifies layers, 2.5D geometry, and XData integrity.
    """
    print(f"🔍 Auditing DXF: {dxf_path}")
    if not Path(dxf_path).exists():
        print(f"❌ Error: File not found")
        sys.exit(1)
        
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        
        # 1. Layer Check
        required_layers = ["TOPO_TIN_SURF", "TOPO_CONT_MAJR", "TOPO_AOI"]
        doc_layers = [L.dxf.name for L in doc.layers]
        for rl in required_layers:
            if rl not in doc_layers:
                print(f"❌ Missing required layer: {rl}")
            else:
                print(f"✅ Layer found: {rl}")
                
        # 2. XData Check (BIM)
        tin_faces = msp.query('3DFACE[layer=="TOPO_TIN_SURF"]')
        if not tin_faces:
             print("❌ No TIN faces found in TOPO_TIN_SURF")
        else:
            face = tin_faces[0]
            xdata = face.get_xdata("SISRUA_BIM")
            if not xdata:
                print("❌ No SISRUA_BIM XData found on TIN faces")
            else:
                print(f"✅ BIM XData found on TIN faces (Sample count: {len(tin_faces)})")
                # Check for specific keys in first face
                xdata_str = str(xdata)
                for key in ["Slope_deg", "Aspect_deg", "Stability_FoS"]:
                    if key in xdata_str:
                        print(f"  ✅ BIM Key found: {key}")
                    else:
                        print(f"  ❌ Missing BIM Key: {key}")

        # 3. 2.5D Compliance Check
        contours = msp.query('LWPOLYLINE[layer=="TOPO_CONT_MAJR"]')
        if contours:
            is_25d = all(c.dxf.hasattr('elevation') for c in contours)
            if is_25d:
                print("✅ 2.5D Compliance: Major contours have elevation metadata")
            else:
                print("❌ 2.5D Regression: Some contours lack elevation attribute")

        print("\n🏆 DXF Compliance Audit: PASSED" if "❌" not in sys.stdout.getvalue() else "\n⚠️ DXF Compliance Audit: FAILED")
        
    except Exception as e:
        print(f"❌ Audit failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_dxf_compliance(sys.argv[1])
    else:
        print("Usage: python dxf_compliance_test.py <path_to_dxf>")
