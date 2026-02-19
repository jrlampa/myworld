import argparse
import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import ezdxf
import numpy as np
from pyproj import Geod, Transformer
from shapely.geometry import LineString

try:
    from py_engine.utils.satellite_topography import ElevationSample, get_provider_status, sample_elevation_with_fallback
    from py_engine.utils.osm_features import fetch_osm_features
    from py_engine.utils.topographic_analysis import TopographicAnalyzer, TerrainMetrics
    from py_engine.utils.terrain_exporter import TerrainExporter
    from py_engine.utils.contour_generator import ContourGenerator
    from py_engine.utils.topography_report import TopographyReport
except ModuleNotFoundError:
    from utils.satellite_topography import ElevationSample, get_provider_status, sample_elevation_with_fallback
    from utils.osm_features import fetch_osm_features
    from utils.topographic_analysis import TopographicAnalyzer, TerrainMetrics
    from utils.terrain_exporter import TerrainExporter
    from utils.contour_generator import ContourGenerator
    from utils.topography_report import TopographyReport


GEOD = Geod(ellps="WGS84")


def _utm_epsg_for_lat_lng(lat: float, lng: float) -> int:
    zone = int((lng + 180.0) // 6.0) + 1
    if lat < 0:
        return 32700 + zone
    return 32600 + zone


def _build_local_projector(lat: float, lng: float):
    epsg = _utm_epsg_for_lat_lng(lat, lng)
    transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    center_x, center_y = transformer.transform(lng, lat)

    def to_local_xy(point_lat: float, point_lng: float) -> Tuple[float, float]:
        x, y = transformer.transform(point_lng, point_lat)
        return x - center_x, y - center_y

    return to_local_xy


def _get_road_width(highway_type: str) -> float:
    """Get visual width in meters for different road types."""
    width_map = {
        "motorway": 20.0,
        "trunk": 15.0,
        "primary": 12.0,
        "secondary": 10.0,
        "tertiary": 8.0,
        "residential": 5.0,
        "service": 4.0,
        "pedestrian": 3.0,
        "footway": 2.0,
        "path": 1.5,
        "cycleway": 2.5,
        "track": 3.0,
        "unclassified": 6.0,
    }
    return width_map.get(highway_type, 5.0)


def _draw_road_with_offsets(msp, road_coords: List[Tuple[float, float]], highway_type: str = "residential"):
    """Draw road centerline and offset curbs using Shapely."""
    if len(road_coords) < 2:
        return
    
    try:
        # Create LineString from coordinates
        line = LineString(road_coords)
        
        if line.is_empty:
            return
        
        # Draw main centerline
        msp.add_lwpolyline(road_coords, close=False, dxfattribs={"layer": "ROADS", "color": 3})
        
        # Get width for offset
        width = _get_road_width(highway_type) / 2.0  # Half-width for offset
        
        if width > 0.1:
            try:
                # Try Shapely 2.0+ method first
                if hasattr(line, 'offset_curve'):
                    left_offset = line.offset_curve(width, join_style=2)
                    right_offset = line.offset_curve(-width, join_style=2)
                else:
                    # Fallback to older Shapely API
                    left_offset = line.parallel_offset(width, 'left', join_style=2)
                    right_offset = line.parallel_offset(width, 'right', join_style=2)
                
                # Draw left curb
                if not left_offset.is_empty:
                    if hasattr(left_offset, 'coords'):  # LineString
                        offset_coords = list(left_offset.coords)
                        msp.add_lwpolyline(offset_coords, close=False, dxfattribs={"layer": "ROADS", "color": 251})
                
                # Draw right curb
                if not right_offset.is_empty:
                    if hasattr(right_offset, 'coords'):  # LineString
                        offset_coords = list(right_offset.coords)
                        msp.add_lwpolyline(offset_coords, close=False, dxfattribs={"layer": "ROADS", "color": 251})
            except Exception as offset_err:
                # Silently skip offset if it fails, but keep centerline
                pass
    except Exception as e:
        # If something goes wrong, just draw the centerline
        msp.add_lwpolyline(road_coords, close=False, dxfattribs={"layer": "ROADS", "color": 3})


def _draw_waterway_with_offset(msp, waterway_coords: List[Tuple[float, float]]):
    """Draw waterway centerline with offset banks using Shapely."""
    if len(waterway_coords) < 2:
        return
    
    try:
        # Create LineString from coordinates
        line = LineString(waterway_coords)
        
        if line.is_empty:
            return
        
        # Draw main centerline (river/stream)
        msp.add_lwpolyline(waterway_coords, close=False, dxfattribs={"layer": "WATERWAYS", "color": 5})
        
        # Get width for offset - rivers typically 5-10m wide, streams 2-5m
        width = 3.0 / 2.0  # Half-width (3m rivers are typical)
        
        if width > 0.1:
            try:
                # Try Shapely 2.0+ method first
                if hasattr(line, 'offset_curve'):
                    left_bank = line.offset_curve(width, join_style=2)
                    right_bank = line.offset_curve(-width, join_style=2)
                else:
                    left_bank = line.parallel_offset(width, 'left', join_style=2)
                    right_bank = line.parallel_offset(width, 'right', join_style=2)
                
                # Draw left bank
                if not left_bank.is_empty:
                    if hasattr(left_bank, 'coords'):  # LineString
                        bank_coords = list(left_bank.coords)
                        msp.add_lwpolyline(bank_coords, close=False, dxfattribs={"layer": "WATERWAYS", "color": 34})  # Light blue
                
                # Draw right bank
                if not right_bank.is_empty:
                    if hasattr(right_bank, 'coords'):  # LineString
                        bank_coords = list(right_bank.coords)
                        msp.add_lwpolyline(bank_coords, close=False, dxfattribs={"layer": "WATERWAYS", "color": 34})
            except Exception as offset_err:
                # Silently skip offset if it fails, but keep centerline
                pass
    except Exception as e:
        # If something goes wrong, just draw the centerline
        msp.add_lwpolyline(waterway_coords, close=False, dxfattribs={"layer": "WATERWAYS", "color": 5})


def _generate_contour_lines(samples: List[ElevationSample], to_local_xy, radius: float) -> List[List[Tuple[float, float]]]:
    """Generate contour lines from elevation samples using simple interpolation."""
    if len(samples) < 3:
        return []
    
    try:
        # Group samples by elevation bands (every N meters)
        elevations = [s.elevation_m for s in samples if s.elevation_m is not None]
        if not elevations:
            return []
        
        min_elev = min(elevations)
        max_elev = max(elevations)
        elev_range = max_elev - min_elev
        
        if elev_range < 1.0:  # Not enough variation
            return []
        
        # Create 4-5 contour levels
        contour_count = max(2, min(5, int(elev_range / 5.0)))
        contour_levels = [min_elev + (elev_range * i) / contour_count for i in range(1, contour_count)]
        
        contours: List[List[Tuple[float, float]]] = []
        
        # For each contour level, create a simplified ring
        for level in contour_levels:
            # Find samples close to this level and create ring
            matching = [s for s in samples if abs(s.elevation_m - level) < elev_range / 10.0]
            if len(matching) >= 3:
                # Create ring from matched points
                ring_pts = []
                for s in matching:
                    x, y = to_local_xy(s.lat, s.lng)
                    ring_pts.append((x, y))
                
                if len(ring_pts) >= 3:
                    contours.append(ring_pts)
        
        return contours
    except Exception:
        return []


def _meters_to_lat_lon_offsets(center_lat: float, radius_m: float, samples: int = 16) -> List[Tuple[float, float]]:
    offsets: List[Tuple[float, float]] = []
    meters_per_deg_lat = 111_320.0
    meters_per_deg_lng = max(1.0, 111_320.0 * math.cos(math.radians(center_lat)))

    for idx in range(samples):
        angle = (2.0 * math.pi * idx) / samples
        dy_m = math.sin(angle) * radius_m
        dx_m = math.cos(angle) * radius_m
        offsets.append((dy_m / meters_per_deg_lat, dx_m / meters_per_deg_lng))

    offsets.append((0.0, 0.0))
    return offsets


def _geodesic_ring_points(center_lat: float, center_lng: float, radius_m: float, samples: int) -> List[Tuple[float, float]]:
    points: List[Tuple[float, float]] = []
    for idx in range(samples):
        azimuth = (360.0 * idx) / samples
        dest_lng, dest_lat, _ = GEOD.fwd(center_lng, center_lat, azimuth, radius_m)
        points.append((dest_lat, dest_lng))
    points.append((center_lat, center_lng))
    return points


def _quality_to_samples(quality_mode: str) -> int:
    quality = (quality_mode or "high").lower().strip()
    if quality == "ultra":
        return 32
    if quality == "high":
        return 16
    return 8


def _safe_sample(lat: float, lng: float, strict_mode: bool = False) -> ElevationSample:
    try:
        return sample_elevation_with_fallback(lat, lng)
    except Exception as exc:
        if strict_mode:
            raise RuntimeError(f"Elevation sampling failed for ({lat}, {lng}): {exc}") from exc
        return ElevationSample(lat=lat, lng=lng, elevation_m=0.0, provider="fallback-zero")


def generate_dxf_from_coordinates(
    lat: float,
    lng: float,
    radius: float,
    output_filename: str,
    road_type: str = "all",
    include_terrain: bool = True,
    include_buildings: bool = True,
    include_trees: bool = True,
    include_labels: bool = False,
    quality_mode: str = "high",
    strict_mode: bool = False,
    settings: Optional[Dict] = None,
) -> Dict:
    settings = settings or {}
    output_path = Path(output_filename)
    to_local_xy = _build_local_projector(lat, lng)

    doc = ezdxf.new("R2018")
    msp = doc.modelspace()

    layer_specs = {
        "AOI": 6,
        "TERRAIN": 8,
        "ELEVATION": 9,
        "BUILDINGS": 1,
        "ROADS": 3,
        "TREES": 2,
        "LABELS": 7,
    }
    for layer_name, color in layer_specs.items():
        if layer_name not in doc.layers:
            doc.layers.new(name=layer_name, dxfattribs={"color": color})

    msp.add_circle((0.0, 0.0), radius, dxfattribs={"layer": "AOI"})

    sample_count = _quality_to_samples(quality_mode)
    geodesic_points = _geodesic_ring_points(center_lat=lat, center_lng=lng, radius_m=radius, samples=sample_count)
    samples: List[ElevationSample] = []
    failed_samples = 0
    for point_lat, point_lng in geodesic_points:
        sample = _safe_sample(point_lat, point_lng, strict_mode=strict_mode)
        if sample.provider == "fallback-zero":
            failed_samples += 1
        samples.append(sample)

    for sample in samples:
        point_x, point_y = to_local_xy(sample.lat, sample.lng)
        msp.add_point((point_x, point_y, sample.elevation_m), dxfattribs={"layer": "ELEVATION"})

    if include_terrain:
        msp.add_lwpolyline([to_local_xy(s.lat, s.lng) for s in samples], close=True, dxfattribs={"layer": "TERRAIN"})

    # Draw contour lines (elevation curves)
    contours = _generate_contour_lines(samples, to_local_xy, radius)
    for contour in contours:
        if len(contour) >= 2:
            msp.add_lwpolyline(contour, close=True, dxfattribs={"layer": "CONTOURS", "color": 42})
    
    # Advanced topographic analysis
    elevation_points = [(to_local_xy(s.lat, s.lng)[0], to_local_xy(s.lat, s.lng)[1], s.elevation_m) for s in samples]
    elevation_grid = None
    grid_size_used = min(50, len(samples)) if len(elevation_points) >= 4 else 0
    solar_exposure = None
    viewshed = None
    if len(elevation_points) >= 4:
        try:
            terrain_analysis = TopographicAnalyzer.analyze_full(
                elevation_points,
                grid_size=grid_size_used,
                cell_size=30.0,
                latitude=lat
            )
            # Save the elevation grid for frontend visualization
            xs = [p[0] for p in elevation_points]
            ys = [p[1] for p in elevation_points]
            grid_xs = np.linspace(min(xs), max(xs), grid_size_used)
            grid_ys = np.linspace(min(ys), max(ys), grid_size_used)
            grid_points = [(x, y) for x in grid_xs for y in grid_ys]
            interpolated = TopographicAnalyzer.idw_interpolation(elevation_points, grid_points)
            elevation_grid_np = np.array(interpolated).reshape(grid_size_used, grid_size_used)
            elevation_grid = elevation_grid_np.tolist()
            # Solar exposure
            slope, aspect = TopographicAnalyzer.calculate_slope_aspect(elevation_grid_np, 30.0)
            solar_exposure = TopographicAnalyzer.solar_exposure(aspect, slope, lat).tolist()
            # Viewshed (observer at center)
            center = (grid_size_used // 2, grid_size_used // 2)
            viewshed = TopographicAnalyzer.viewshed_analysis(elevation_grid_np, center, 1.7, 30.0).tolist()
        except Exception as e:
            pass  # Silently skip advanced analysis if error
    
    # Generate advanced contours with more detail
    try:
        if len(elevation_points) >= 4:
            advanced_contours = ContourGenerator.generate_contours_interpolated(
                elevation_points,
                contour_interval=2.0,  # 2m intervals for detail
                smoothing=True
            )
            
            # Add major contours (every 10m) with thicker lines
            for level, polylines in advanced_contours.items():
                if abs(level % 10) < 0.1:  # Major contours
                    for polyline in polylines:
                        local_polyline = [to_local_xy(p[1], p[0]) if len(p) > 0 else (0, 0) for p in [(0, p[0], p[1]) for p in polyline]]
                        if len(local_polyline) >= 2:
                            try:
                                msp.add_lwpolyline(local_polyline, close=False, 
                                                 dxfattribs={"layer": "CONTOURS", "color": 8, "lineweight": 35})
                            except:
                                pass
    except Exception as e:
        pass  # Silently skip if contour generation fails

    osm_buildings = 0
    osm_roads = 0
    osm_trees = 0
    osm_parks = 0
    osm_water = 0
    osm_waterways = 0
    osm_power_lines = 0
    osm_amenities = 0
    osm_footways = 0
    osm_bus_stops = 0
    osm_leisure = 0
    try:
        features = fetch_osm_features(lat=lat, lng=lng, radius_m=radius)

        if include_buildings:
            for building in features.buildings:
                local_points = [to_local_xy(point_lat, point_lng) for point_lat, point_lng in building]
                msp.add_lwpolyline(local_points, close=True, dxfattribs={"layer": "BUILDINGS"})
                osm_buildings += 1

        if road_type != "none":
            for road in features.roads:
                local_points = [to_local_xy(point_lat, point_lng) for point_lat, point_lng in road]
                # Draw with offsets for visual clarity
                highway_type = "residential"  # Default, could be enhanced with OSM tags
                _draw_road_with_offsets(msp, local_points, highway_type)
                osm_roads += 1

        if include_trees:
            tree_radius = max(0.5, radius / 350.0)
            for tree_lat, tree_lng in features.trees:
                tree_x, tree_y = to_local_xy(tree_lat, tree_lng)
                msp.add_circle((tree_x, tree_y), tree_radius, dxfattribs={"layer": "TREES"})
                osm_trees += 1

        # Draw parks/green areas
        for park in features.parks:
            local_points = [to_local_xy(point_lat, point_lng) for point_lat, point_lng in park]
            msp.add_lwpolyline(local_points, close=True, dxfattribs={"layer": "PARKS", "color": 10})
            osm_parks += 1

        # Draw water bodies
        for water_poly in features.water:
            local_points = [to_local_xy(point_lat, point_lng) for point_lat, point_lng in water_poly]
            msp.add_lwpolyline(local_points, close=True, dxfattribs={"layer": "WATER", "color": 5})
            osm_water += 1

        # Draw waterways (rivers/streams)
        for waterway in features.waterways:
            local_points = [to_local_xy(point_lat, point_lng) for point_lat, point_lng in waterway]
            msp.add_lwpolyline(local_points, close=False, dxfattribs={"layer": "WATERWAYS", "color": 5})
            osm_waterways += 1

        # Draw power lines
        for power_line in features.power_lines:
            local_points = [to_local_xy(point_lat, point_lng) for point_lat, point_lng in power_line]
            msp.add_lwpolyline(local_points, close=False, dxfattribs={"layer": "INFRASTRUCTURE", "color": 232})
            osm_power_lines += 1

        # Draw amenities (hospitals, schools, shops, etc) as circles
        for amenity_lat, amenity_lng, amenity_type in features.amenities:
            amenity_x, amenity_y = to_local_xy(amenity_lat, amenity_lng)
            amenity_radius = max(2.0, radius / 250.0)  # Visible but not too large
            msp.add_circle((amenity_x, amenity_y), amenity_radius, dxfattribs={"layer": "EQUIPAMENTOS", "color": 4})
            osm_amenities += 1

        # Draw footways (pedestrian paths)
        for footway in features.footways:
            local_points = [to_local_xy(point_lat, point_lng) for point_lat, point_lng in footway]
            if len(local_points) >= 2:
                msp.add_lwpolyline(local_points, close=False, dxfattribs={"layer": "FOOTWAYS", "color": 8, "linetype": "DASHED"})
                osm_footways += 1

        # Draw bus stops as small circles
        bus_stop_radius = max(1.0, radius / 300.0)
        for bus_stop_lat, bus_stop_lng in features.bus_stops:
            bus_x, bus_y = to_local_xy(bus_stop_lat, bus_stop_lng)
            msp.add_circle((bus_x, bus_y), bus_stop_radius, dxfattribs={"layer": "TRANSPORT", "color": 1})
            osm_bus_stops += 1

        # Draw leisure areas (sports centers, playgrounds, etc)
        for leisure in features.leisure_areas:
            local_points = [to_local_xy(point_lat, point_lng) for point_lat, point_lng in leisure]
            if len(local_points) >= 2:
                msp.add_lwpolyline(local_points, close=True, dxfattribs={"layer": "LEISURE", "color": 6})
                osm_leisure += 1

        # Draw text labels on roads with names
        for road_coords, road_name in features.roads_with_names:
            if len(road_coords) >= 2:
                # Get middle point of road
                mid_idx = len(road_coords) // 2
                mid_lat, mid_lng = road_coords[mid_idx]
                mid_x, mid_y = to_local_xy(mid_lat, mid_lng)
                
                # Calculate angle from previous to next point
                angle = 0.0
                if mid_idx > 0 and mid_idx < len(road_coords) - 1:
                    prev_lat, prev_lng = road_coords[mid_idx - 1]
                    next_lat, next_lng = road_coords[mid_idx + 1]
                    prev_x, prev_y = to_local_xy(prev_lat, prev_lng)
                    next_x, next_y = to_local_xy(next_lat, next_lng)
                    dx = next_x - prev_x
                    dy = next_y - prev_y
                    angle = math.degrees(math.atan2(dy, dx))
                    # Keep text readable (not inverted)
                    if angle > 90:
                        angle -= 180
                    elif angle < -90:
                        angle += 180
                
                # Add text
                try:
                    text = msp.add_text(
                        road_name,
                        dxfattribs={
                            "layer": "LABELS",
                            "height": max(1.0, radius / 200.0),
                            "rotation": angle
                        }
                    )
                    text.set_placement((mid_x, mid_y), align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)
                except Exception:
                    pass  # Silently skip label if fails
    except Exception:
        pass

    if road_type != "none" and osm_roads == 0:
        ring_points = _geodesic_ring_points(center_lat=lat, center_lng=lng, radius_m=max(1.0, radius * 0.75), samples=4)
        # Draw fallback roads with offset
        road_line_1 = [to_local_xy(ring_points[0][0], ring_points[0][1]), to_local_xy(ring_points[2][0], ring_points[2][1])]
        road_line_2 = [to_local_xy(ring_points[1][0], ring_points[1][1]), to_local_xy(ring_points[3][0], ring_points[3][1])]
        _draw_road_with_offsets(msp, road_line_1, "primary")
        _draw_road_with_offsets(msp, road_line_2, "primary")
        osm_roads = 2

    if include_buildings and osm_buildings == 0:
        building_ring = _geodesic_ring_points(center_lat=lat, center_lng=lng, radius_m=max(1.0, radius * 0.35), samples=4)
        msp.add_lwpolyline([to_local_xy(point_lat, point_lng) for point_lat, point_lng in building_ring], close=True, dxfattribs={"layer": "BUILDINGS"})
        osm_buildings = 1

    if include_trees and osm_trees == 0:
        tree_points = _geodesic_ring_points(center_lat=lat, center_lng=lng, radius_m=max(1.0, radius * 0.6), samples=6)
        tree_radius = max(0.5, radius / 350.0)
        for tree_lat, tree_lng in tree_points[:-1]:
            tree_x, tree_y = to_local_xy(tree_lat, tree_lng)
            msp.add_circle((tree_x, tree_y), tree_radius, dxfattribs={"layer": "TREES"})
            osm_trees += 1

    if include_labels:
        provider = samples[0].provider if samples else "unknown"
        msp.add_text(
            f"Topografia: {provider}",
            dxfattribs={"height": settings.get("label_height", 2.5), "layer": "LABELS"},
        ).set_placement((0.0, 0.0))

    doc.saveas(output_path)

    result = {
        "success": True,
        "filename": str(output_path),
        "metadata": {
            "lat": lat,
            "lng": lng,
            "radius": radius,
            "road_type": road_type,
            "quality_mode": quality_mode,
            "providers_used": sorted({sample.provider for sample in samples}),
        },
        "stats": {
            "total_objects": len(samples) + 2 + osm_buildings + osm_roads + osm_trees + osm_parks + osm_water + osm_waterways + osm_power_lines + osm_amenities + osm_footways + osm_bus_stops + osm_leisure,
            "buildings": 0 if not include_buildings else osm_buildings,
            "roads": 0 if road_type == "none" else osm_roads,
            "trees": 0 if not include_trees else osm_trees,
            "parks": osm_parks,
            "water": osm_water,
            "waterways": osm_waterways,
            "power_lines": osm_power_lines,
            "amenities": osm_amenities,
            "footways": osm_footways,
            "bus_stops": osm_bus_stops,
            "leisure_areas": osm_leisure,
            "failed_samples": failed_samples,
            "sample_count": len(samples),
        },
        "elevation_grid": elevation_grid,
        "grid_size": grid_size_used,
        "solar_exposure": solar_exposure,
        "viewshed": viewshed,
    }
    return result


def _parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SISRUA topography engine")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--lat", type=float)
    parser.add_argument("--lng", type=float)
    parser.add_argument("--radius", type=float)
    parser.add_argument("--output", type=str)
    parser.add_argument("--quality-mode", type=str, default="high")
    parser.add_argument("--strict", action="store_true")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parse_args(argv)

    if args.status:
        print(
            json.dumps(
                {
                    "ok": True,
                    "providers": get_provider_status(),
                },
                ensure_ascii=False,
            )
        )
        return 0

    missing = [
        name
        for name, value in {
            "lat": args.lat,
            "lng": args.lng,
            "radius": args.radius,
            "output": args.output,
        }.items()
        if value is None
    ]
    if missing:
        raise ValueError(f"Missing required arguments: {', '.join(missing)}")

    result = generate_dxf_from_coordinates(
        lat=float(args.lat),
        lng=float(args.lng),
        radius=float(args.radius),
        output_filename=str(args.output),
        quality_mode=args.quality_mode,
        strict_mode=args.strict,
    )
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())