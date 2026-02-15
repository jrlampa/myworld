import pytest
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from spatial_audit import run_spatial_audit

def test_spatial_audit_no_data():
    """Test audit with empty GDF."""
    gdf = gpd.GeoDataFrame()
    summary, analysis_gdf = run_spatial_audit(gdf)
    assert summary == {}
    assert analysis_gdf.empty

def test_violation_detection():
    """Test detection of building inside power line buffer."""
    # Power line (LineString)
    pl = LineString([(0,0), (10,0)])
    # Building inside (5m buffer)
    b_inside = Polygon([(5,1), (6,1), (6,2), (5,2)])
    # Building outside
    b_outside = Polygon([(5,10), (6,10), (6,11), (5,11)])
    
    data = {
        'geometry': [pl, b_inside, b_outside],
        'power': ['line', None, None],
        'building': [None, True, True]
    }
    gdf = gpd.GeoDataFrame(data, crs="EPSG:3857")
    
    summary, analysis_gdf = run_spatial_audit(gdf)
    
    assert summary['violations'] == 1
    assert 'violations_list' in summary
    violations = summary['violations_list']
    assert len(violations) == 1
    assert violations[0]['type'] == 'proximity'
    assert "Building 1 is within 5m of a Power Line." in violations[0]['description']
    # Check coordinate propagation (within building bounds approx)
    assert isinstance(violations[0]['lat'], float)
    assert isinstance(violations[0]['lon'], float)
    
    assert 'analysis_type' in analysis_gdf.columns
    assert len(analysis_gdf[analysis_gdf['analysis_type'] == 'buffer']) == 1

def test_lighting_coverage():
    """Test lighting coverage score calculation."""
    # Road of 100m
    road = LineString([(0,0), (100,0)])
    # 2 lamps (Ideal is 100/30 = 3.33)
    # Score should be (2 / 3.33) * 100 approx 60%
    lamp1 = Point(10, 0)
    lamp2 = Point(40, 0)
    
    data = {
        'geometry': [road, lamp1, lamp2],
        'feature_type': ['highway', 'lamp', 'lamp'],
        'highway': ['residential', 'street_lamp', 'street_lamp']
    }
    gdf = gpd.GeoDataFrame(data)
    
    summary, _ = run_spatial_audit(gdf)
    
    assert 50 < summary['coverageScore'] < 70
    assert summary['violations'] == 0

def test_analysis_layers_output():
    """Test if analysis features are correctly generated."""
    lamp = Point(0,0)
    data = {
        'geometry': [lamp],
        'highway': ['street_lamp']
    }
    gdf = gpd.GeoDataFrame(data)
    
    _, analysis_gdf = run_spatial_audit(gdf)
    
    assert not analysis_gdf.empty
    assert analysis_gdf.iloc[0]['analysis_type'] == 'coverage'
    # Check if buffer radius is correct (15m radius circle area approx 706)
    assert 700 < analysis_gdf.iloc[0].geometry.area < 710
