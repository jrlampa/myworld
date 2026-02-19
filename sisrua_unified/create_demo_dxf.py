#!/usr/bin/env python3
"""
Simple DXF Generator - Creates a demo DXF file without requiring OSM data
This demonstrates the DXF generation capability of the system
"""

import sys
from pathlib import Path

try:
    import ezdxf
    from ezdxf import units
    from ezdxf.enums import TextEntityAlignment
except ImportError:
    print("Error: ezdxf not installed. Run: pip install ezdxf")
    sys.exit(1)


def create_demo_dxf(output_file):
    """Create a demonstration DXF file with various CAD elements"""
    
    print(f"Creating demo DXF file: {output_file}")
    
    # Create a new DXF document
    doc = ezdxf.new('R2018', setup=True)
    doc.units = units.M  # Meters
    
    # Set header variables
    doc.header['$ACADVER'] = 'AC1032'  # AutoCAD 2018
    doc.header['$INSUNITS'] = 6  # Meters
    
    # Get the modelspace
    msp = doc.modelspace()
    
    # Define layers with colors and line types
    layers = [
        ('BUILDINGS', 1),      # Red
        ('ROADS', 7),          # White
        ('TREES', 3),          # Green  
        ('TERRAIN', 8),        # Dark gray
        ('DIMENSIONS', 2),     # Yellow
        ('TEXT', 6),           # Magenta
        ('TITLE_BLOCK', 7),    # White
    ]
    
    for layer_name, color in layers:
        doc.layers.add(layer_name, color=color)
    
    # 1. Create sample buildings (rectangles)
    print("  Adding buildings...")
    buildings = [
        # (x, y, width, height)
        (10, 10, 30, 20),
        (50, 15, 25, 35),
        (85, 10, 40, 25),
        (15, 50, 35, 30),
        (60, 55, 30, 25),
    ]
    
    for x, y, w, h in buildings:
        points = [
            (x, y),
            (x + w, y),
            (x + w, y + h),
            (x, y + h),
            (x, y)
        ]
        msp.add_lwpolyline(
            points,
            dxfattribs={'layer': 'BUILDINGS', 'color': 1}
        )
    
    # 2. Create roads (polylines)
    print("  Adding roads...")
    roads = [
        # Horizontal road
        [(0, 5), (150, 5)],
        # Vertical road
        [(5, 0), (5, 100)],
        # Diagonal road
        [(0, 100), (150, 0)],
        # Curved road segment
        [(50, 0), (60, 20), (70, 40), (75, 60), (75, 100)],
    ]
    
    for road_points in roads:
        msp.add_lwpolyline(
            road_points,
            dxfattribs={'layer': 'ROADS', 'color': 7}
        )
    
    # 3. Add trees (circles)
    print("  Adding trees...")
    tree_positions = [
        (20, 25), (35, 28), (45, 30), (25, 70), (40, 75),
        (90, 50), (95, 55), (100, 60), (70, 20), (75, 25)
    ]
    
    for x, y in tree_positions:
        msp.add_circle(
            center=(x, y),
            radius=2,
            dxfattribs={'layer': 'TREES', 'color': 3}
        )
    
    # 4. Add contour lines (terrain)
    print("  Adding terrain contours...")
    contours = [
        [(10, 90), (40, 88), (70, 85), (100, 88), (130, 90)],
        [(10, 80), (40, 78), (70, 75), (100, 78), (130, 80)],
        [(10, 70), (40, 68), (70, 65), (100, 68), (130, 70)],
    ]
    
    for contour in contours:
        msp.add_lwpolyline(
            contour,
            dxfattribs={'layer': 'TERRAIN', 'color': 8}
        )
    
    # 5. Add dimensions
    print("  Adding dimensions...")
    dim = msp.add_linear_dim(
        base=(75, -5),
        p1=(0, 0),
        p2=(150, 0),
        dimstyle='EZ_CURVED',
        dxfattribs={'layer': 'DIMENSIONS'}
    )
    dim.render()
    
    # 6. Add text annotations
    print("  Adding text...")
    texts = [
        ("SAMPLE URBAN AREA", 60, 95, 3),
        ("Buildings", 20, 35, 1.5),
        ("Roads Network", 80, 8, 1.5),
        ("Green Areas", 95, 58, 1.5),
    ]
    
    for text, x, y, height in texts:
        msp.add_text(
            text,
            dxfattribs={
                'layer': 'TEXT',
                'height': height,
                'color': 6
            }
        ).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)
    
    # 7. Add title block
    print("  Adding title block...")
    # Title block frame
    title_block_points = [
        (160, 0), (210, 0), (210, 30), (160, 30), (160, 0)
    ]
    msp.add_lwpolyline(
        title_block_points,
        dxfattribs={'layer': 'TITLE_BLOCK', 'color': 7}
    )
    
    # Title block content
    msp.add_text(
        "SIS RUA UNIFIED",
        dxfattribs={'layer': 'TITLE_BLOCK', 'height': 2, 'color': 7}
    ).set_placement((185, 25), align=TextEntityAlignment.MIDDLE_CENTER)
    
    msp.add_text(
        "DEMO EXPORT",
        dxfattribs={'layer': 'TITLE_BLOCK', 'height': 1.5, 'color': 7}
    ).set_placement((185, 20), align=TextEntityAlignment.MIDDLE_CENTER)
    
    msp.add_text(
        "Project: Sample Urban Planning",
        dxfattribs={'layer': 'TITLE_BLOCK', 'height': 1, 'color': 7}
    ).set_placement((185, 15), align=TextEntityAlignment.MIDDLE_CENTER)
    
    msp.add_text(
        "Client: SIS RUA Demo",
        dxfattribs={'layer': 'TITLE_BLOCK', 'height': 1, 'color': 7}
    ).set_placement((185, 12), align=TextEntityAlignment.MIDDLE_CENTER)
    
    msp.add_text(
        "Date: 2026-02-17",
        dxfattribs={'layer': 'TITLE_BLOCK', 'height': 0.8, 'color': 7}
    ).set_placement((185, 9), align=TextEntityAlignment.MIDDLE_CENTER)
    
    msp.add_text(
        "Scale: 1:1000",
        dxfattribs={'layer': 'TITLE_BLOCK', 'height': 0.8, 'color': 7}
    ).set_placement((185, 6), align=TextEntityAlignment.MIDDLE_CENTER)
    
    msp.add_text(
        "System: SIS RUA Unified v1.0",
        dxfattribs={'layer': 'TITLE_BLOCK', 'height': 0.7, 'color': 8}
    ).set_placement((185, 3), align=TextEntityAlignment.MIDDLE_CENTER)
    
    # 8. Add coordinate grid
    print("  Adding coordinate grid...")
    for i in range(0, 151, 25):
        # Vertical lines
        msp.add_line(
            (i, 0), (i, 100),
            dxfattribs={'layer': 'TERRAIN', 'color': 8, 'linetype': 'DASHED'}
        )
        # Horizontal lines
        if i <= 100:
            msp.add_line(
                (0, i), (150, i),
                dxfattribs={'layer': 'TERRAIN', 'color': 8, 'linetype': 'DASHED'}
            )
    
    # Save the DXF file
    print(f"  Saving to {output_file}...")
    # Ensure output directory exists before saving
    output_path = Path(output_file)
    if output_path.parent != Path('.'):
        output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.saveas(output_file)
    
    # Audit the file
    print("  Running audit...")
    auditor = doc.audit()
    
    if auditor.has_errors:
        print(f"  ⚠️  Warning: DXF has {len(auditor.errors)} errors")
        for error in auditor.errors[:5]:  # Show first 5 errors
            print(f"    - {error}")
    else:
        print("  ✓ DXF file passed audit")
    
    # Print statistics
    entity_counts = {}
    for entity in msp:
        entity_type = entity.dxftype()
        entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1
    
    print(f"\n✓ DXF file created successfully!")
    print(f"  File: {output_file}")
    print(f"  Layers: {len(doc.layers)}")
    print(f"  Entities:")
    for entity_type, count in sorted(entity_counts.items()):
        print(f"    {entity_type}: {count}")
    
    return True


def main():
    """Main execution"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Create a demo DXF file')
    parser.add_argument(
        '--output', 
        type=str, 
        default='demo.dxf',
        help='Output DXF filename'
    )
    
    args = parser.parse_args()
    
    # Create output directory if needed
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        success = create_demo_dxf(args.output)
        return 0 if success else 1
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
