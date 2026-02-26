#!/usr/bin/env python3
"""
DXF Generation Script for SIS RUA Unified
Generates DXF files from OpenStreetMap data with various options
"""

import sys
import os
import argparse
import json
from pathlib import Path

# Add py_engine to path
script_dir = Path(__file__).parent
py_engine_dir = script_dir / "py_engine"
sys.path.insert(0, str(py_engine_dir))

from controller import OSMController
from utils.logger import Logger


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Generate DXF files from OpenStreetMap data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage - generate DXF for a location
  %(prog)s --lat -23.55052 --lon -46.63331 --radius 500 --output saopaulo.dxf
  
  # With custom layers
  %(prog)s --lat -23.55052 --lon -46.63331 --radius 1000 \\
           --output saopaulo_full.dxf \\
           --layers '{"buildings": true, "roads": true, "trees": true}'
  
  # UTM projection (absolute coordinates)
  %(prog)s --lat -23.55052 --lon -46.63331 --radius 500 \\
           --output saopaulo_utm.dxf \\
           --projection utm
  
  # With project metadata
  %(prog)s --lat -23.55052 --lon -46.63331 --radius 500 \\
           --output project.dxf \\
           --client "ACME Corp" \\
           --project "Urban Development Project 2026"
        """
    )
    
    # Required arguments
    parser.add_argument(
        '--lat', 
        type=float, 
        required=True, 
        help='Latitude (decimal degrees, e.g., -23.55052)'
    )
    parser.add_argument(
        '--lon', 
        type=float, 
        required=True, 
        help='Longitude (decimal degrees, e.g., -46.63331)'
    )
    parser.add_argument(
        '--radius', 
        type=float, 
        required=True, 
        help='Radius in meters (e.g., 500)'
    )
    parser.add_argument(
        '--output', 
        type=str, 
        required=True, 
        help='Output DXF filename (e.g., output.dxf)'
    )
    
    # Optional layer configuration
    parser.add_argument(
        '--layers', 
        type=str, 
        default='{}', 
        help='JSON string of layers to include (default: all layers)'
    )
    
    # Projection options
    parser.add_argument(
        '--projection', 
        type=str, 
        choices=['local', 'utm'], 
        default='local',
        help='Coordinate projection: "local" (relative to center) or "utm" (absolute)'
    )
    parser.add_argument(
        '--crs', 
        type=str, 
        default='auto', 
        help='EPSG code or "auto" for automatic CRS detection'
    )
    
    # Selection mode
    parser.add_argument(
        '--selection-mode', 
        type=str, 
        choices=['circle', 'polygon'], 
        default='circle',
        help='Selection mode (default: circle)'
    )
    parser.add_argument(
        '--polygon', 
        type=str, 
        default='[]', 
        help='JSON array of polygon points [[lat, lon], ...] when using polygon mode'
    )
    
    # Output format
    parser.add_argument(
        '--format', 
        type=str, 
        choices=['dxf', 'kml', 'geojson'], 
        default='dxf',
        help='Output format (default: dxf)'
    )
    
    # Project metadata
    parser.add_argument(
        '--client', 
        type=str, 
        default='CLIENTE PADRÃO', 
        help='Client name for title block'
    )
    parser.add_argument(
        '--project', 
        type=str, 
        default='PROJETO URBANISTICO', 
        help='Project ID/name for title block'
    )
    
    # Performance options
    parser.add_argument(
        '--no-preview', 
        action='store_true', 
        help='Skip GeoJSON preview logs to prevent memory issues'
    )
    
    # Verbose output
    parser.add_argument(
        '-v', '--verbose', 
        action='store_true', 
        help='Enable verbose output'
    )
    
    return parser.parse_args()


def validate_coordinates(lat, lon):
    """Validate latitude and longitude"""
    if not -90 <= lat <= 90:
        raise ValueError(f"Invalid latitude: {lat}. Must be between -90 and 90")
    if not -180 <= lon <= 180:
        raise ValueError(f"Invalid longitude: {lon}. Must be between -180 and 180")


def main():
    """Main execution"""
    try:
        # Force UTF-8 encoding for stdout
        sys.stdout.reconfigure(encoding='utf-8')
        
        # Parse arguments
        args = parse_arguments()
        
        # Validate coordinates
        validate_coordinates(args.lat, args.lon)
        
        # Parse layers configuration
        try:
            layers_config = json.loads(args.layers)
            # Default to all layers if empty
            if not layers_config:
                layers_config = {
                    'buildings': True, 
                    'roads': True, 
                    'trees': True, 
                    'amenities': True
                }
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in --layers: {e}", file=sys.stderr)
            return 1
        
        # Parse polygon if provided
        try:
            polygon = json.loads(args.polygon)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in --polygon: {e}", file=sys.stderr)
            return 1
        
        # Configure logger
        if args.no_preview:
            Logger.SKIP_GEOJSON = True
        
        if args.verbose:
            print(f"Generating DXF file:")
            print(f"  Location: {args.lat}, {args.lon}")
            print(f"  Radius: {args.radius}m")
            print(f"  Projection: {args.projection}")
            print(f"  Layers: {layers_config}")
            print(f"  Output: {args.output}")
        
        # Create output directory if needed
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Set projection mode in layers config
        layers_config['georef'] = (args.projection == 'utm')
        
        # Initialize controller
        controller = OSMController(
            lat=args.lat,
            lon=args.lon,
            radius=args.radius,
            output_file=args.output,
            layers_config=layers_config,
            crs=args.crs,
            export_format=args.format,
            selection_mode=args.selection_mode,
            polygon=polygon
        )
        
        # Set project metadata
        controller.project_metadata = {
            'client': args.client,
            'project_id': args.project,
        }
        
        # Run the generation
        print(f"Starting DXF generation...")
        result = controller.run()
        
        if result['success']:
            print(f"\n✓ Success! DXF file generated: {result['file']}")
            if 'stats' in result:
                stats = result['stats']
                print(f"\nStatistics:")
                print(f"  Buildings: {stats.get('buildings', 0)}")
                print(f"  Roads: {stats.get('roads', 0)}")
                print(f"  Trees: {stats.get('trees', 0)}")
                print(f"  Amenities: {stats.get('amenities', 0)}")
            return 0
        else:
            print(f"\n✗ Error: {result.get('error', 'Unknown error')}", file=sys.stderr)
            return 1
            
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"\n✗ Error: {str(e)}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
