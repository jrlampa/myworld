import argparse
import json
import numpy as np
from pathlib import Path
from typing import Dict, Optional, List

try:
    from .application.topography_app_service import TopographyAppService
    from .domain.cad.exporter import CADExporter
except (ModuleNotFoundError, ImportError):
    from application.topography_app_service import TopographyAppService
    from domain.cad.exporter import CADExporter

def generate_dxf_from_coordinates(
    lat: float,
    lng: float,
    radius: float,
    output_filename: str,
    quality_mode: str = "high",
    strict_mode: bool = False,
    settings: Optional[Dict] = None,
    bounds: Optional[List[List[float]]] = None,
    preset: str = "1:1000",
    target_elevation: Optional[float] = None
) -> Dict:
    """
    Thin orchestration layer following the Master Level requirements.
    Delegates analysis to TopographyService and export to ExportService.
    """
    output_path = Path(output_filename)
    
    # 1. Initialize Services
    topo_service = TopographyAppService()
    export_service = CADExporter()
    
    # 2. Get Analysis Data
    analysis_data = topo_service.get_analysis(
        lat, lng, radius, quality_mode, 
        bounds=bounds, 
        target_elevation=target_elevation
    )
    
    # 3. Generate Artifacts (DXF and STL)
    osm_stats = export_service.generate_dxf(analysis_data, str(output_path))
    
    stl_path = output_path.with_suffix(".stl")
    export_service.export_stl(analysis_data, str(stl_path))
    
    # 4. Final Result Assembly
    analysis_dict = analysis_data["analysis"]
    result = {
        "success": True,
        "filename": str(output_path),
        "stl_filename": str(stl_path),
        "earthworks": analysis_data.get("earthworks"),
        "stats": {
            "buildings": osm_stats.get("buildings", 0),
            "roads": osm_stats.get("roads", 0),
            "trees": osm_stats.get("trees", 0),
            "elevation_samples": len(analysis_data["samples"])
        },
        "analysis": {
            "elevation_grid": analysis_dict.get("elevation_grid"),
            "grid_size": analysis_data["grid_size"],
            "metadata": analysis_data["metadata"],
            "elevation_range": analysis_dict.get("elevation_range"),
            "slope_degrees": analysis_dict.get("slope_degrees"),
            "aspect_degrees": analysis_dict.get("aspect_degrees"),
            "mean_slope": analysis_dict.get("mean_slope", 0),
            "solar_exposure": analysis_dict.get("solar_exposure"),
            "tpi": analysis_dict.get("tpi"),
            "landforms": analysis_dict.get("landforms"),
            "watersheds": analysis_dict.get("watersheds"),
            "hydrology": {
                "streams": analysis_dict.get("hydrology_streams", []),
                "stream_orders": analysis_dict.get("stream_orders", []),
                "flow_direction": analysis_dict.get("flow_direction"),
                "flow_accum": analysis_dict.get("flow_accumulation")
            },
            "features": {
                "forests": getattr(analysis_data.get("feature_collection"), "forests", []) if hasattr(analysis_data.get("feature_collection"), "forests") else []
            }
        }
    }

    # Save Sidecar
    try:
        sidecar = output_path.with_suffix(".json")
        with open(sidecar, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
    except:
        pass

    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Master Level Topography Engine")
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lng", type=float, required=True)
    parser.add_argument("--radius", type=float, default=500.0)
    parser.add_argument("--out", type=str, default="output.dxf")
    parser.add_argument("--quality", type=str, default="high")
    parser.add_argument("--bounds", type=str, default=None, help="GeoJSON Polygon coordinates JSON string")
    parser.add_argument("--target_z", type=float, default=None, help="Target elevation for Earthworks")
    
    args = parser.parse_args()
    
    bounds_data = None
    if args.bounds:
        try:
            bounds_data = json.loads(args.bounds)
        except:
            pass

    try:
        res = generate_dxf_from_coordinates(
            args.lat, args.lng, args.radius, args.out, 
            args.quality, bounds=bounds_data, 
            target_elevation=args.target_z
        )
        print(json.dumps(res, indent=2))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        exit(1)