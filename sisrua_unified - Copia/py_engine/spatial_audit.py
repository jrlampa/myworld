import geopandas as gpd
from shapely.geometry import Point, LineString

try:
    from utils.logger import Logger
    from constants import POWER_LINE_BUFFER_METERS, STREET_LAMP_COVERAGE_METERS, IDEAL_LAMP_SPACING_METERS
except (ImportError, ValueError):
    from .utils.logger import Logger
    from .constants import POWER_LINE_BUFFER_METERS, STREET_LAMP_COVERAGE_METERS, IDEAL_LAMP_SPACING_METERS

def run_spatial_audit(gdf):
    """
    Performs GIS audit on the GeoDataFrame.
    
    Args:
        gdf: GeoDataFrame with projected geometries
        
    Returns:
        tuple: (summary_dict, analysis_gdf)
    """
    if gdf.empty:
        Logger.info("Empty GeoDataFrame provided to spatial audit")
        return {}, gpd.GeoDataFrame()

    # Identify categories safely
    def has_col_val(col, val):
        if col not in gdf.columns:
            return gpd.pd.Series([False] * len(gdf))
        return gdf[col] == val

    # Filter features by type
    power_lines = gdf[
        ((gdf.get('power') == 'line') | (has_col_val('feature_type', 'power_line'))) & 
        gdf.geometry.type.isin(['LineString', 'MultiLineString'])
    ]
    
    buildings = gdf[
        ((gdf.get('building') == True) | (has_col_val('feature_type', 'building')))
    ]
    
    lamps = gdf[
        ((gdf.get('highway') == 'street_lamp') | (has_col_val('feature_type', 'lamp')))
    ]
    
    roads = gdf[has_col_val('feature_type', 'highway')]

    analysis_features = []
    violations_count = 0
    violations_list = []
    
    # 1. Proximity Audit (Power Line Buffers)
    if not power_lines.empty and not buildings.empty:
        violations_count, violations_list, buffers_gdf = _audit_power_line_proximity(
            power_lines, buildings, gdf.crs
        )
        if buffers_gdf is not None:
            analysis_features.append(buffers_gdf)

    # 2. Lighting Coverage Audit
    if not lamps.empty:
        coverage_gdf = lamps.copy()
        coverage_gdf['geometry'] = lamps.geometry.buffer(STREET_LAMP_COVERAGE_METERS)
        coverage_gdf['analysis_type'] = 'coverage'
        analysis_features.append(coverage_gdf)

    # Combine analysis features with index protection
    final_analysis_gdf = _combine_analysis_features(analysis_features, gdf.crs)

    # 3. Calculate Coverage Scores
    coverage_score = _calculate_lighting_score(roads, lamps)

    summary = {
        "violations": violations_count,
        "violations_list": violations_list,
        "coverageScore": coverage_score
    }

    Logger.info(f"Spatial audit complete: {violations_count} violations, {coverage_score}% coverage")
    return summary, final_analysis_gdf


def _audit_power_line_proximity(power_lines, buildings, crs):
    """Check for buildings too close to power lines"""
    violations_count = 0
    violations_list = []
    
    try:
        # Create buffer zones around power lines
        buffers_gdf = power_lines.copy()
        buffers_gdf['geometry'] = power_lines.geometry.buffer(POWER_LINE_BUFFER_METERS)
        buffers_gdf['analysis_type'] = 'buffer'
        
        # Check intersections with buildings
        for idx, building in buildings.iterrows():
            if buffers_gdf.geometry.intersects(building.geometry).any():
                violations_count += 1
                
                # Get centroid in WGS84 for reporting
                building_wgs84 = gpd.GeoSeries([building.geometry], crs=crs).to_crs(epsg=4326).iloc[0]
                centroid = building_wgs84.centroid
                
                violations_list.append({
                    "type": "proximity",
                    "description": f"Building {idx} within {POWER_LINE_BUFFER_METERS}m of power line",
                    "lat": float(centroid.y),
                    "lon": float(centroid.x)
                })
        
        return violations_count, violations_list, buffers_gdf
    except Exception as e:
        Logger.error(f"Power line proximity audit failed: {e}")
        return 0, [], None


def _combine_analysis_features(analysis_features, crs):
    """Combine analysis feature GeoDataFrames safely"""
    if not analysis_features:
        return gpd.GeoDataFrame(columns=['geometry'], crs=crs)
    
    try:
        # Use ignore_index=True to prevent index overlap errors
        combined_df = gpd.pd.concat(analysis_features, ignore_index=True)
        return gpd.GeoDataFrame(combined_df, crs=crs)
    except Exception as e:
        Logger.warn(f"Audit concat fallback triggered: {e}")
        return analysis_features[0] if analysis_features else gpd.GeoDataFrame(columns=['geometry'], crs=crs)


def _calculate_lighting_score(roads, lamps):
    """Calculate street lighting coverage score"""
    if roads.empty:
        return 0
    
    total_road_length = roads.geometry.length.sum()
    if total_road_length <= 0:
        return 0
    
    ideal_lamp_count = total_road_length / IDEAL_LAMP_SPACING_METERS
    if ideal_lamp_count <= 0:
        return 0
    
    actual_lamp_count = len(lamps)
    score = min(100, int((actual_lamp_count / ideal_lamp_count) * 100))
    
    return score
