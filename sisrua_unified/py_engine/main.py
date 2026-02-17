import sys
import argparse
import json
import traceback
from controller import OSMController
from utils.logger import Logger

def main():
    # Force UTF-8 encoding for stdout (Windows fix)
    sys.stdout.reconfigure(encoding='utf-8')
    
    parser = argparse.ArgumentParser(description='Download OSM data and convert to DXF')
    parser.add_argument('--lat', type=float, required=True, help='Latitude')
    parser.add_argument('--lon', type=float, required=True, help='Longitude')
    parser.add_argument('--radius', type=float, required=True, help='Radius in meters')
    parser.add_argument('--output', type=str, required=True, help='Output DXF filename')
    parser.add_argument('--layers', type=str, required=False, default='{}', help='JSON string of layers to fetch')
    parser.add_argument('--crs', type=str, required=False, default='auto', help='EPSG code or "auto"')
    parser.add_argument('--projection', type=str, required=False, default='local', help='Projection type: local or utm')
    parser.add_argument('--format', type=str, required=False, default='dxf', help='Output format (dxf, kml, geojson)')
    parser.add_argument('--selection_mode', type=str, required=False, default='circle', help='Selection mode (circle, polygon)')
    parser.add_argument('--polygon', type=str, required=False, default='[]', help='JSON string of polygon points [[lat, lon], ...]')
    parser.add_argument('--client_name', type=str, required=False, default='CLIENTE PADRÃO', help='Client name for title block')
    parser.add_argument('--project_id', type=str, required=False, default='PROJETO URBANISTICO', help='Project ID for title block')
    parser.add_argument('--no-preview', action='store_true', help='Skip GeoJSON preview logs (prevents OOM in CLI)')
    
    args = parser.parse_args()
    
    try:
        layers_config = json.loads(args.layers)
        # Default to all true if empty
        if not layers_config:
             layers_config = {'buildings': True, 'roads': True, 'trees': True, 'amenities': True}

        if args.no_preview:
            Logger.SKIP_GEOJSON = True

        controller = OSMController(
            lat=args.lat,
            lon=args.lon,
            radius=args.radius,
            output_file=args.output,
            layers_config=layers_config,
            crs=args.crs,
            export_format=args.format,
            selection_mode=args.selection_mode,
            polygon=json.loads(args.polygon)
        )
        controller.project_metadata = {
            'client': args.client_name,
            'project': args.project_id
        }
        controller.run()
        
    except Exception as e:
        sys.stderr.write(traceback.format_exc())
        Logger.error(str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
