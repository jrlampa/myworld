import pytest
import ezdxf
from shapely.geometry import Polygon, Point, LineString
import geopandas as gpd
import pandas as pd
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator

@pytest.fixture
def dxf_gen(tmp_path):
    output_file = tmp_path / "test.dxf"
    return DXFGenerator(str(output_file))

def test_layer_creation(dxf_gen):
    """Test if standard layers are created."""
    assert 'EDIFICACAO' in dxf_gen.doc.layers
    assert 'VIAS' in dxf_gen.doc.layers
    assert 'VEGETACAO' in dxf_gen.doc.layers

def test_block_creation(dxf_gen):
    """Test if blocks are created."""
    assert 'ARVORE' in dxf_gen.doc.blocks
    assert 'POSTE' in dxf_gen.doc.blocks

def test_building_extrusion(dxf_gen):
    """Test if building height is correctly calculated from tags."""
    # Mock data
    poly = Polygon([(0,0), (10,0), (10,10), (0,10)])
    
    # Case 1: Specific height
    tags1 = {'building': 'yes', 'height': '15'}
    thickness1 = dxf_gen._get_thickness(tags1, 'EDIFICACAO')
    assert thickness1 == 15.0

    # Case 2: Levels
    tags2 = {'building': 'yes', 'building:levels': '4'}
    thickness2 = dxf_gen._get_thickness(tags2, 'EDIFICACAO')
    assert thickness2 == 12.0 # 4 * 3.0

    # Case 3: Default
    tags3 = {'building': 'yes'}
    thickness3 = dxf_gen._get_thickness(tags3, 'EDIFICACAO')
    assert thickness3 == 3.5

def test_add_features(dxf_gen):
    """Test adding features to DXF."""
    # Create valid GeoDataFrame
    data = {
        'geometry': [Point(0,0), LineString([(0,0), (10,10)])],
        'building': [None, None],
        'highway': [None, 'residential'],
        'natural': ['tree', None]
    }
    gdf = gpd.GeoDataFrame(data)
    
    dxf_gen.add_features(gdf)
    
    # Check if entities exist in modelspace
    # Note: ezdxf entities need to be queried
    msp = dxf_gen.msp
    assert len(msp) > 0

def test_legend_and_title_block(dxf_gen):
    """Test if Legend and Title Block are generated during save."""
    # Add some features to populate layers
    data = {'geometry': [Point(0,0)], 'building': [True]}
    gdf = gpd.GeoDataFrame(data)
    dxf_gen.add_features(gdf)
    
    dxf_gen.project_info = {'client': 'TEST CLIENT', 'project': 'TEST PROJECT'}
    dxf_gen.save()
    
    # Check ModelSpace for Legend entities (TEXT or MTEXT)
    msp_text = [e.dxf.text for e in dxf_gen.msp if e.dxftype() in ('TEXT', 'MTEXT')]
    assert any("LEGENDA" in t for t in msp_text)
    
    # Check PaperSpace (Layout1) for Title Block components
    layout = dxf_gen.doc.layout("Layout1")
    # Should have a viewport
    viewports = [e for e in layout if e.dxftype() == 'VIEWPORT']
    assert len(viewports) >= 1
    
    # Should have Title Block lines/text
    layout_text = [e.dxf.text for e in layout if e.dxftype() in ('TEXT', 'MTEXT')]
    assert any("TEST CLIENT" in t for t in layout_text)
    assert any("TEST PROJECT" in t for t in layout_text)
