import osmnx as ox
import pandas as pd
import geopandas as gpd
try:
    from utils.logger import Logger
    from constants import MAX_FETCH_RADIUS_METERS
except (ImportError, ValueError):
    from .utils.logger import Logger
    from .constants import MAX_FETCH_RADIUS_METERS

def fetch_osm_data(lat, lon, radius, tags, crs='auto', polygon=None):
    """
    Fetches features from OpenStreetMap within a radius or a custom polygon.
    
    Args:
        lat (float): Latitude (center if polygon is None)
        lon (float): Longitude (center if polygon is None)
        radius (float): Radius in meters (ignored if polygon is provided)
        tags (dict): Dictionary of OSM tags to fetch
        crs (str): 'auto' or EPSG code
        polygon (list): List of [lat, lon] points for the boundary
        
    Returns:
        GeoDataFrame: Projected GeoDataFrame with fetched features
    """
    try:
        if polygon and len(polygon) >= 3:
            from shapely.geometry import Polygon as ShapelyPolygon
            
            # Shapely uses (x, y) which is (lon, lat) for geographic coordinates
            boundary = ShapelyPolygon([(p[1], p[0]) for p in polygon])
            
            Logger.info(f"Fetching OSM data from polygon with {len(polygon)} points (CRS={crs})")
            gdf = ox.features.features_from_polygon(boundary, tags)
        else:
            # Validate radius
            if radius > MAX_FETCH_RADIUS_METERS:
                raise ValueError(f"Radius too large. Max {MAX_FETCH_RADIUS_METERS}m.")
                
            Logger.info(f"Fetching OSM data from ({lat}, {lon}) radius={radius}m (CRS={crs})")
            gdf = ox.features.features_from_point((lat, lon), tags, dist=radius)
        
        if gdf.empty:
            Logger.info("No features found in the specified area")
            return gpd.GeoDataFrame()
            
        # Project to appropriate CRS for accurate distance calculations
        if crs and crs != 'auto':
            try:
                gdf_proj = gdf.to_crs(crs)
                Logger.info(f"Projected to custom CRS: {crs}")
            except Exception as e:
                Logger.info(f"Failed to project to {crs}: {e}. Falling back to auto projection.")
                gdf_proj = ox.projection.project_gdf(gdf)
        else:
            # Auto-project to UTM suitable for the latitude
            gdf_proj = ox.projection.project_gdf(gdf)
        
        Logger.info(f"Successfully fetched {len(gdf_proj)} features")
        return gdf_proj
        
    except Exception as e:
        Logger.error(f"Error fetching OSM data: {e}")
        raise
