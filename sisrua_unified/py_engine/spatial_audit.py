import geopandas as gpd
from shapely.geometry import Point, LineString

def run_spatial_audit(gdf):
    """
    Performs GIS audit on the GeoDataFrame.
    Returns: (summary_dict, analysis_gdf)
    """
    if gdf.empty:
        return {}, gpd.GeoDataFrame()

    # Identify categories safely
    def has_col_val(col, val):
        if col not in gdf.columns: return gpd.pd.Series([False] * len(gdf))
        return gdf[col] == val

    power_lines = gdf[((gdf.get('power') == 'line') | (has_col_val('feature_type', 'power_line'))) & 
                     gdf.geometry.type.isin(['LineString', 'MultiLineString'])]
    
    buildings = gdf[((gdf.get('building') == True) | (has_col_val('feature_type', 'building')))]
    
    lamps = gdf[((gdf.get('highway') == 'street_lamp') | (has_col_val('feature_type', 'lamp')))]
    
    roads = gdf[(has_col_val('feature_type', 'highway'))]

    analysis_features = []
    violations_count = 0
    violations_list = []
    
    # 1. Proximity Audit (Buffers)
    if not power_lines.empty and not buildings.empty:
        # Create 5m buffers around power lines
        buffers_gdf = power_lines.copy()
        buffers_gdf['geometry'] = power_lines.geometry.buffer(5)
        buffers_gdf['analysis_type'] = 'buffer'
        
        # We need a WGS84 transformer to get lat/lon for violations
        # gdf handles projection, so we assume it has a CRS.
        # Let's get the CRS to convert back to lat/lon
        source_crs = gdf.crs
        
        # Check intersections
        for idx, b in buildings.iterrows():
            if buffers_gdf.geometry.intersects(b.geometry).any():
                violations_count += 1
                
                # Get centroid in WGS84 for the AI/Frontend
                b_wgs84 = gpd.GeoSeries([b.geometry], crs=source_crs).to_crs(epsg=4326).iloc[0]
                centroid = b_wgs84.centroid
                
                violations_list.append({
                    "type": "proximity",
                    "description": f"Building {idx} is within 5m of a Power Line.",
                    "lat": float(centroid.y),
                    "lon": float(centroid.x)
                })
        
        analysis_features.append(buffers_gdf)

    # 2. Lighting Audit (Coverage)
    # ... existing logic ...
    if not lamps.empty:
        coverage_gdf = lamps.copy()
        coverage_gdf['geometry'] = lamps.geometry.buffer(15)
        coverage_gdf['analysis_type'] = 'coverage'
        analysis_features.append(coverage_gdf)

    # Combine analysis features with index protection to prevent join errors
    if analysis_features:
        try:
            # Use ignore_index=True to prevent "cannot join with no overlapping index names"
            combined_df = gpd.pd.concat(analysis_features, ignore_index=True)
            final_analysis_gdf = gpd.GeoDataFrame(combined_df, crs=gdf.crs)
        except Exception as e:
            from utils.logger import Logger
            Logger.info(f"Audit concat fallback triggered: {e}")
            final_analysis_gdf = analysis_features[0] if analysis_features else gpd.GeoDataFrame(columns=['geometry'], crs=gdf.crs)
    else:
        final_analysis_gdf = gpd.GeoDataFrame(columns=['geometry'], crs=gdf.crs)

    # 3. Calculate Scores
    total_road_length = roads.geometry.length.sum() if not roads.empty else 0
    coverage_score = 0
    if total_road_length > 0:
        ideal_lamps = total_road_length / 30
        coverage_score = min(100, int((len(lamps) / ideal_lamps) * 100)) if ideal_lamps > 0 else 0

    summary = {
        "violations": violations_count,
        "violations_list": violations_list,
        "coverageScore": coverage_score
    }

    return summary, final_analysis_gdf
