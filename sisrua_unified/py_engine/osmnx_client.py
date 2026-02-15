import osmnx as ox
import pandas as pd
import geopandas as gpd

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
    """
    try:
        if polygon and len(polygon) >= 3:
            from shapely.geometry import Polygon as ShapelyPolygon
            # OSMnx expects (lon, lat) for Shapely or it uses latlng for from_polygon
            # features_from_polygon expects a shapely Polygon
            boundary = ShapelyPolygon([(p[1], p[0]) for p in polygon]) # (lon, lat) order for shapely common practice? 
            # Actually ox.features_from_polygon expects polygon in (lat, lon) ? 
            # Check docs: features_from_polygon(polygon, tags)
            # "polygon: the shape to fetch features within"
            # It usually uses the coords as provided.
            
            # Repent: OSMnx uses (lat, lon) in points but shapely uses (x, y) which is (lon, lat)
            # However, features_from_polygon is sensitive to the CRS.
            
            print(f"Fetching OSM data from Polygon ({len(polygon)} points) with CRS={crs}...")
            gdf = ox.features.features_from_polygon(ShapelyPolygon([(p[1], p[0]) for p in polygon]), tags)
        else:
            # Check if the radius is too large to prevent timeout/memory issues
            if radius > 5000:
                raise ValueError("Radius too large. Max 5000m.")
                
            print(f"Fetching OSM data from ({lat}, {lon}) radius={radius}m with CRS={crs}...")
            gdf = ox.features.features_from_point((lat, lon), tags, dist=radius)
        
        if gdf.empty:
            print("No features found.")
            return gpd.GeoDataFrame()
            
        # Ensure coordinate reference system is projected for accurate distance/drawing
        if crs and crs != 'auto':
             try:
                gdf_proj = gdf.to_crs(crs)
                print(f"Projected to custom CRS: {crs}")
             except Exception as e:
                print(f"Failed to project to {crs}: {e}. Falling back to auto.")
                gdf_proj = ox.projection.project_gdf(gdf)
        else:
             # Project to UTM suitable for the latitude
             gdf_proj = ox.projection.project_gdf(gdf)
        
        return gdf_proj
        
    except Exception as e:
        print(f"Error fetching OSM data: {e}")
        raise
