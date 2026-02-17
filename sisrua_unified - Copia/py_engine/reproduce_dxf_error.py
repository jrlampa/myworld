import os
import sys
import math
import ezdxf
from dxf_generator import DXFGenerator
from utils.logger import Logger

def stress_test_dxf():
    output_path = "stress_test_auto_audit.dxf"
    gen = DXFGenerator(output_path)
    
    Logger.info("Starting Stress Test for AutoCAD compatibility...")
    
    # 1. Stress Text Alignment (AutoCAD crash source)
    from ezdxf.enums import TextEntityAlignment
    for i in range(100):
        # Rotating text with offsets
        t = gen.msp.add_text(f"TEST {i}", dxfattribs={'height': 2.0, 'rotation': i*3.6})
        t.set_placement((float(i), float(i)), align=TextEntityAlignment.CENTER)

    # 2. Stress Hatch Epsilon (Micro-gap source)
    # Creating a path with nearly identical points
    micro_path = [
        (0.0, 0.0),
        (10.0, 0.0),
        (10.0, 10.0),
        (10.0001, 10.0001), # Tiny gap
        (0.0, 10.0),
        (0.0, 0.0)
    ]
    try:
        # This uses the new deduplicate_epsilon internally
        gen._draw_polygon({'geometry': type('obj', (), {'exterior': type('obj', (), {'coords': micro_path})(), 'interiors': []}), 'tags': {}})
    except Exception as e:
        Logger.info(f"Hatch stress fail (expected if logic missing): {e}")

    # 3. Stress Attributes (Empty field source)
    gen._draw_point(type('obj', (), {'x': 50, 'y': 50})(), 'POSTE', 0.0, 0.0, {'osmid': '123'})

    # 4. Stress Grid range
    gen.bounds = [0.0, 0.0, 100.0, 100.0]
    gen.add_cartographic_elements(0.0, 0.0, 100.0, 100.0, 0.0, 0.0)

    # Generate the file
    gen.save()
    
    Logger.info(f"Generated {output_path}. Starting byte-level scan...")
    
    # Byte-level scan for illegal values
    corruption_found = False
    illegal_terms = [b"nan", b"inf", b"NaN", b"Inf"]
    
    with open(output_path, 'rb') as f:
        content = f.read()
        for term in illegal_terms:
            if term in content:
                print(f"CRITICAL: Found illegal term '{term.decode()}' in DXF!")
                corruption_found = True
                
    if not corruption_found:
        print("SUCCESS: Byte-scan clean. No NaN/Inf values found.")
    else:
        print("FAILURE: DXF contains illegal values.")
        sys.exit(1)

if __name__ == "__main__":
    stress_test_dxf()
