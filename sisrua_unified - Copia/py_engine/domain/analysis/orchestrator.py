"""
Advanced topographic analysis: slope, aspect, viewshed, solar exposure.
Converts elevation data into professional-grade terrain metrics.
"""

import math
import numpy as np
from typing import List, Tuple, Dict, Any, Optional, Union
from dataclasses import dataclass

# Modular Imports
from ..terrain.interpolators import idw_interpolation
from .geomorphometry import (
    calculate_slope_aspect, terrain_ruggedness_index, 
    calculate_tpi, classify_landforms_weiss, classify_terrain_slope
)
from ..hydrology.service import (
    calculate_flow_direction, calculate_flow_accumulation, 
    extract_watersheds, calculate_strahler_order, trace_streams,
    fill_sinks, calculate_watershed_metrics
)
from ..solar.service import solar_exposure_master
from .visibility import viewshed_analysis


@dataclass
class TerrainMetrics:
    """Comprehensive terrain analysis results."""
    elevation_range: Tuple[float, float]  # (min, max)
    mean_elevation: float
    slope_degrees: List[List[float]]  # slope in degrees per point
    aspect_degrees: List[List[float]]  # aspect (direction) per point
    terrain_ruggedness: Union[float, np.ndarray]  # TRI (Terrain Ruggedness Index) or Grid
    mean_slope: float
    max_slope: float
    surface_roughness: float
    # Analysis
    solar_exposure: Optional[List[List[float]]] = None
    # Hydrology
    flow_direction: Optional[List[List[int]]] = None
    flow_accumulation: Optional[List[List[int]]] = None
    hydrology_streams: Optional[List[List[Tuple[float, float]]]] = None  # Vector streams
    watersheds: Optional[List[List[int]]] = None # Grid of basin IDs
    stream_orders: Optional[List[int]] = None # Strahler order per stream segment
    tpi: Optional[np.ndarray] = None # Topographic Position Index
    landforms: Optional[np.ndarray] = None # Classification (ridge, valley, etc.)
    # Master Analysis (Phase 15)
    stability_index: Optional[np.ndarray] = None
    plan_curvature: Optional[np.ndarray] = None
    profile_curvature: Optional[np.ndarray] = None
    # Raw Grid (for TIN/Visualization)
    elevation_grid: Optional[np.ndarray] = None


class TopographicAnalyzer:
    """Analyze elevation data for professional-grade metrics (Orchestration Layer)."""
    
    @staticmethod
    def analyze_full(
        elevation_data: List[Tuple[float, float, float]],  # (x, y, elevation)
        grid_size: int = 50,
        cell_size: float = 30.0,
        latitude: float = 0.0
    ) -> TerrainMetrics:
        """Perform comprehensive terrain analysis by delegating to specialized modules."""
        if not elevation_data:
             return TerrainMetrics(
                elevation_range=(0.0, 0.0),
                mean_elevation=0.0,
                slope_degrees=[],
                aspect_degrees=[],
                terrain_ruggedness=0.0,
                mean_slope=0.0,
                max_slope=0.0,
                surface_roughness=0.0
            )
        
        # Extract components
        xs = np.array([p[0] for p in elevation_data])
        ys = np.array([p[1] for p in elevation_data])
        elevs = np.array([p[2] for p in elevation_data])
        
        min_elev, max_elev = float(np.min(elevs)), float(np.max(elevs))
        mean_elev = float(np.mean(elevs))
        
        # 1. Interpolation
        # Ensure we have a valid bounding box
        min_x, max_x = float(np.min(xs)), float(np.max(xs))
        min_y, max_y = float(np.min(ys)), float(np.max(ys))
        
        grid_xs = np.linspace(min_x, max_x, grid_size)
        grid_ys = np.linspace(min_y, max_y, grid_size)
        grid_points = [(x, y) for x in grid_xs for y in grid_ys]
        
        interpolated = idw_interpolation(elevation_data, grid_points)
        grid = np.array(interpolated).reshape(grid_size, grid_size)
        
        # 2. Master Hydrology: Sink Filling (CRITICAL for valid drainage)
        from ..hydrology.service import fill_sinks, calculate_watershed_metrics
        filled_grid = fill_sinks(grid)
        
        # 3. Geomorphometry (Uses filled grid for more accurate slopes in pits)
        from .geomorphometry import classify_landforms_weiss
        from ..solar.service import solar_exposure_master
        slope, aspect = calculate_slope_aspect(filled_grid, cell_size)
        tri = terrain_ruggedness_index(filled_grid)
        # 10-Class Weiss Classification
        landforms = classify_landforms_weiss(filled_grid, slope)
        
        # 4. Solar & Shadows (Master Engine)
        solar = solar_exposure_master(filled_grid, cell_size, latitude, aspect, slope)

        # 4.1 Master Geomorphometry & Stability (Phase 15)
        from .slope_stability import SlopeStabilityAnalyzer
        from .geomorphometry import GeomorphometryEngine
        stability = SlopeStabilityAnalyzer.calculate_stability(filled_grid, cell_size)
        plan_curv, prof_curv = GeomorphometryEngine.calculate_curvatures(filled_grid, cell_size)

        # 5. Hydrology Analysis (on filled grid)
        flow_dir = calculate_flow_direction(filled_grid)
        flow_acc = calculate_flow_accumulation(flow_dir)
        
        # Dynamic threshold (1% of cells or 100m2 equivalent)
        threshold = max(5, int((grid_size * grid_size) * 0.01))
        
        streams = trace_streams(
            flow_acc, flow_dir,
            (min_x, min_y, max_x, max_y),
            grid_size,
            threshold
        )
        
        basins = extract_watersheds(flow_dir)
        orders = calculate_strahler_order(
            flow_acc, streams, (min_x, min_y, max_x, max_y), (grid_size, grid_size)
        )
        
        # Watershed Metrics
        metrics = calculate_watershed_metrics(basins, cell_size, flow_acc)
        
        return TerrainMetrics(
            elevation_range=(min_elev, max_elev),
            mean_elevation=mean_elev,
            slope_degrees=slope.tolist(),
            aspect_degrees=aspect.tolist(),
            terrain_ruggedness=tri, 
            mean_slope=float(np.mean(slope)),
            max_slope=float(np.max(slope)),
            surface_roughness=float(np.std(slope)),
            solar_exposure=solar.tolist(),
            flow_direction=flow_dir.tolist(),
            flow_accumulation=flow_acc.tolist(),
            hydrology_streams=streams,
            watersheds=basins.tolist(),
            stream_orders=orders,
            tpi=calculate_tpi(filled_grid, radius_cells=3), 
            landforms=landforms,
            stability_index=stability,
            plan_curvature=plan_curv,
            profile_curvature=prof_curv,
            elevation_grid=filled_grid
        )
