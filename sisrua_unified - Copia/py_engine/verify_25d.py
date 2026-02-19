
import sys
import os
import ezdxf
import traceback
from unittest.mock import MagicMock, patch

# Add parent dir to path to import main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import main

def test_dxf_25d_attributes():
    print("Starting verification...")
    # Mock return values
    with patch('main.sample_elevation_with_fallback') as mock_sample:
        mock_sample.return_value = main.ElevationSample(
            lat=-22.0, lng=-42.0, elevation_m=50.0, provider="mock", quality="measured"
        )
        
        with patch('main.fetch_osm_features') as mock_osm:
            print("Mocking OSM features...")
            mock_osm.return_value = MagicMock()
            mock_osm.return_value.buildings = [[(-22.0001, -42.0001), (-22.0002, -42.0002), (-22.0001, -42.0002)]]
            mock_osm.return_value.roads = [[(-22.0, -42.0), (-22.001, -42.001)]]
            mock_osm.return_value.trees = [(-22.0005, -42.0005)]
            # Empty others
            for attr in ['parks','water','waterways','power_lines','amenities','footways','bus_stops','leisure_areas','roads_with_names']:
                setattr(mock_osm.return_value, attr, [])

        
        # Mock _get_elevation_at_point to bypass grid generation and ensure 50.0 is returned
        with patch('main._get_elevation_at_point', return_value=50.0) as mock_get_elev:
            output_file = "test_25d.dxf"
            if os.path.exists(output_file):
                os.remove(output_file)
            
            print("Generating DXF...")
            try:
                result = main.generate_dxf_from_coordinates(
                    lat=-22.0, lng=-42.0, radius=100, 
                    output_filename=output_file,
                    include_buildings=True,
                    include_trees=True,
                    quality_mode="balanced"
                )
                print(f"Generation result: {result}")
            except Exception as e:
                print(f"Generation FAILED exception: {e}")
                traceback.print_exc()
                raise e

            assert result['success'] is True, f"Generation failed: {result.get('error')}"
            assert os.path.exists(output_file), "Output file not created"
            
            print("Generating DXF...")
            # We must enable buildings/trees explicitly
            try:
                result = main.generate_dxf_from_coordinates(
                    lat=-22.0, lng=-42.0, radius=100, 
                    output_filename=output_file,
                    include_buildings=True,
                    include_trees=True,
                    quality_mode="balanced"
                )
                print(f"Generation result: {result}")
            except Exception as e:
                print(f"Generation FAILED exception: {e}")
                traceback.print_exc()
                raise e

            assert result['success'] is True, f"Generation failed: {result.get('error')}"
            assert os.path.exists(output_file), "Output file not created"
            
            print("Reading DXF...")
            doc = ezdxf.readfile(output_file)
            msp = doc.modelspace()
            
            print("Cheking Buildings...")
            buildings = msp.query('LWPOLYLINE[layer=="BUILDINGS"]')
            print(f"Found {len(buildings)} buildings")
            if len(buildings) == 0:
                 # Debug: print all layers
                 print("Layers present:", [e.dxf.layer for e in msp])
            
            assert len(buildings) > 0, "No buildings found in DXF"
            for b in buildings:
                print(f"Building Elevation: {b.dxf.elevation}, Thickness: {b.dxf.thickness}")
                assert abs(b.dxf.elevation - 50.0) < 0.1, f"Bad elevation: {b.dxf.elevation}"
                assert abs(b.dxf.thickness - 6.0) < 0.1, f"Bad thickness: {b.dxf.thickness}"
                
            print("Checking Roads...")
            roads = msp.query('LWPOLYLINE[layer=="ROADS"]')
            print(f"Found {len(roads)} roads")
            assert len(roads) > 0, "No roads found"
            for r in roads:
                print(f"Road Elevation: {r.dxf.elevation}")
                assert abs(r.dxf.elevation - 50.0) < 0.1

            print("SUCCESS: DXF contains proper 2.5D attributes!")
            
            doc = None
            if os.path.exists(output_file):
                os.remove(output_file)

if __name__ == "__main__":
    try:
        test_dxf_25d_attributes()
    except Exception as e:
        print(f"FAILED: {e}")
        traceback.print_exc()
        sys.exit(1)
