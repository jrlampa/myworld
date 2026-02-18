#!/usr/bin/env python
"""Test DXF generation with UTM coordinates and validation"""
import sys
import os
sys.path.insert(0, 'py_engine')

from main import generate_dxf_from_coordinates

# UTM 24K: Zone 24, Easting 216330, Northing 7528658
# Convert to Lat/Lon (aproximado para Macaé, Brasil)
# Baseado na conversão: ~-22.3246, -41.7537

def test_utm_dxf_generation():
    print("=" * 60)
    print("Testing DXF Generation with UTM Coordinates")
    print("=" * 60)
    print()
    print("📍 Location: 24K 0216330 7528658 (Macaé, Brasil)")
    print("🎯 Radius: 100m")
    print()
    
    # Coordinates from UTM conversion
    lat = -22.324554
    lng = -41.753739
    radius = 100  # meters
    
    output_file = "test_utm_100m_validation.dxf"
    
    print(f"Converting to: {lat}, {lng}")
    print(f"Generating DXF: {output_file}")
    print()
    
    try:
        result = generate_dxf_from_coordinates(
            lat=lat,
            lng=lng,
            radius=radius,
            output_filename=output_file
        )
        
        print("✅ DXF Generation completed!")
        print()
        print(f"📄 File: {result['filename']}")
        print(f"📊 Stats:")
        print(f"   - Total Objects: {result['stats']['total_objects']}")
        print(f"   - Buildings: {result['stats']['buildings']}")
        print(f"   - Roads: {result['stats']['roads']}")
        print(f"   - Trees: {result['stats']['trees']}")
        print()
        
        # Validate file exists and has content
        if os.path.exists(output_file):
            size = os.path.getsize(output_file)
            print(f"✅ File exists: {size:,} bytes")
            
            # Quick validation: check for 'nan' in file
            with open(output_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                nan_count = content.count('nan')
                if nan_count > 0:
                    print(f"⚠️  WARNING: Found {nan_count} 'nan' strings in DXF!")
                else:
                    print("✅ No 'nan' strings found - file should be valid!")
        else:
            print("❌ File not created!")
            
        return result
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_utm_dxf_generation()
