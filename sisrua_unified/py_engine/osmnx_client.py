import osmnx as ox
import pandas as pd
import geopandas as gpd
try:
    from utils.logger import Logger
    from constants import MAX_FETCH_RADIUS_METERS
except (ImportError, ValueError):
    from .utils.logger import Logger
    from .constants import MAX_FETCH_RADIUS_METERS

OSMNX_TIMEOUT_SECONDS = 180

# Radius threshold above which chunked fetching is used to avoid Overpass timeouts
LARGE_RADIUS_THRESHOLD_METERS = 1000

# Tag groups that are cheaper to fetch separately for large areas
# (avoids a single expensive Overpass query that may time out)
_CHUNK_TAG_GROUPS = [
    {'building': True},
    {'highway': True},
    {'natural': True, 'landuse': True, 'leisure': True},
    {'power': True, 'man_made': True, 'amenity': True, 'barrier': True},
]

# Configure osmnx timeout to handle large areas and slow network conditions
ox.settings.timeout = OSMNX_TIMEOUT_SECONDS


def _project_gdf(gdf: gpd.GeoDataFrame, crs: str) -> gpd.GeoDataFrame:
    """Projects a GeoDataFrame to the requested CRS or auto-UTM."""
    if crs and crs != 'auto':
        try:
            projected = gdf.to_crs(crs)
            Logger.info(f"Projected to custom CRS: {crs}")
            return projected
        except Exception as e:
            Logger.info(f"Failed to project to {crs}: {e}. Falling back to auto projection.")
    return ox.projection.project_gdf(gdf)


def _intersect_tags(requested: dict, group: dict) -> dict:
    """Returns the subset of *requested* tags present in *group*."""
    return {k: v for k, v in requested.items() if k in group}


def _fetch_chunked(lat: float, lon: float, radius: float, tags: dict) -> gpd.GeoDataFrame:
    """
    Fetches OSM data in tag-grouped chunks for large areas (>LARGE_RADIUS_THRESHOLD_METERS).

    Splits the requested tag dictionary into smaller predefined groups and
    issues one Overpass query per group, then concatenates the results.
    This prevents single large queries from timing out on the Overpass API.

    Args:
        lat: Latitude of the centre point.
        lon: Longitude of the centre point.
        radius: Fetch radius in metres.
        tags: Full OSM tag dictionary requested by the caller.

    Returns:
        Merged GeoDataFrame (WGS84) with deduplicated features.
    """
    frames = []
    fetched_groups = 0

    for group in _CHUNK_TAG_GROUPS:
        chunk_tags = _intersect_tags(tags, group)
        if not chunk_tags:
            continue

        try:
            Logger.info(
                f"Chunked fetch ({fetched_groups + 1}/{len(_CHUNK_TAG_GROUPS)}): "
                f"tags={list(chunk_tags.keys())} radius={radius}m"
            )
            chunk_gdf = ox.features.features_from_point((lat, lon), chunk_tags, dist=radius)
            if not chunk_gdf.empty:
                frames.append(chunk_gdf)
        except Exception as e:
            Logger.error(f"Chunk fetch failed for tags {list(chunk_tags.keys())}: {e}")

        fetched_groups += 1

    # Handle any remaining tags not covered by predefined groups
    covered_keys = {k for g in _CHUNK_TAG_GROUPS for k in g}
    remaining_tags = {k: v for k, v in tags.items() if k not in covered_keys}
    if remaining_tags:
        try:
            Logger.info(f"Chunked fetch (extra): tags={list(remaining_tags.keys())}")
            extra_gdf = ox.features.features_from_point((lat, lon), remaining_tags, dist=radius)
            if not extra_gdf.empty:
                frames.append(extra_gdf)
        except Exception as e:
            Logger.error(f"Extra chunk fetch failed for tags {list(remaining_tags.keys())}: {e}")

    if not frames:
        return gpd.GeoDataFrame()

    merged = pd.concat(frames)
    # Drop duplicate OSM elements that may appear in multiple tag-group chunks
    merged = merged[~merged.index.duplicated(keep='first')]
    Logger.info(f"Chunked fetch complete: {len(merged)} total features (merged from {len(frames)} chunks)")
    return merged


def fetch_osm_data(lat, lon, radius, tags, crs='auto', polygon=None):
    """
    Fetches features from OpenStreetMap within a radius or a custom polygon.

    For large radii (>1 km), automatically uses chunked tag-group queries to
    avoid Overpass API timeouts while ensuring all requested feature types are
    retrieved.

    Args:
        lat (float): Latitude (centre if polygon is None).
        lon (float): Longitude (centre if polygon is None).
        radius (float): Radius in metres (ignored if polygon is provided).
        tags (dict): Dictionary of OSM tags to fetch.
        crs (str): 'auto' or EPSG code for the projected output.
        polygon (list): List of [lat, lon] points for a custom boundary.

    Returns:
        GeoDataFrame: Projected GeoDataFrame with fetched features.
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

            if radius > LARGE_RADIUS_THRESHOLD_METERS:
                Logger.info(
                    f"Large radius detected ({radius}m > {LARGE_RADIUS_THRESHOLD_METERS}m): "
                    "using chunked OSM fetch strategy"
                )
                gdf = _fetch_chunked(lat, lon, radius, tags)
            else:
                Logger.info(f"Fetching OSM data from ({lat}, {lon}) radius={radius}m (CRS={crs})")
                gdf = ox.features.features_from_point((lat, lon), tags, dist=radius)

        if gdf.empty:
            Logger.info("No features found in the specified area")
            return gpd.GeoDataFrame()

        gdf_proj = _project_gdf(gdf, crs)
        Logger.info(f"Successfully fetched {len(gdf_proj)} features")
        return gdf_proj

    except Exception as e:
        Logger.error(f"Error fetching OSM data: {e}")
        raise
