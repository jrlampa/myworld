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


# ─── Testes com coordenadas canônicas de teste ───────────────────────────────

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from constants import TEST_LAT, TEST_LON, TEST_RADII
except ImportError:
    TEST_LAT, TEST_LON, TEST_RADII = -22.15018, -42.92185, [100, 500, 1000]


@pytest.fixture
def dxf_gen_test_coords(tmp_path):
    """DXFGenerator com coordenadas canônicas de teste (Muriaé/MG)."""
    output_file = tmp_path / "test_coords.dxf"
    gen = DXFGenerator(str(output_file))
    gen.project_info = {
        'client': 'TESTE AUTOMATIZADO',
        'project': f'EXTRACAO OSM - LAT={TEST_LAT} LON={TEST_LON}'
    }
    return gen


def test_dxf_with_test_coordinates_generates_valid_file(dxf_gen_test_coords, tmp_path):
    """Gera DXF com coordenadas canônicas de teste e verifica integridade."""
    from shapely.geometry import Point, LineString
    import geopandas as gpd

    # Simula geometrias reais próximas às coordenadas de teste (proj. UTM)
    # TEST_UTM_E=788547, TEST_UTM_N=7634925
    base_e, base_n = 788547.0, 7634925.0

    data = {
        'geometry': [
            Point(base_e, base_n),
            LineString([(base_e, base_n), (base_e + 50, base_n + 30)]),
            LineString([(base_e - 20, base_n + 10), (base_e + 80, base_n + 10)])
        ],
        'highway': [None, 'residential', 'primary'],
        'building': [None, None, None],
        'name': [None, 'Rua de Teste', 'Av. Principal'],
        'natural': ['tree', None, None]
    }
    gdf = gpd.GeoDataFrame(data)
    dxf_gen_test_coords.add_features(gdf)
    dxf_gen_test_coords.save()

    output_path = str(tmp_path / "test_coords.dxf")
    assert os.path.exists(output_path), "Arquivo DXF deve ser criado"
    assert os.path.getsize(output_path) > 0, "Arquivo DXF não deve estar vazio"

    # Verifica que o DXF pode ser lido sem erros (headless)
    doc_check = ezdxf.readfile(output_path)
    assert doc_check is not None
    msp = doc_check.modelspace()
    assert len(msp) > 0, "Model Space deve conter entidades"


def test_dxf_coordinate_offset_applied(dxf_gen_test_coords):
    """Verifica que o offset de coordenadas é aplicado corretamente."""
    from shapely.geometry import Point
    import geopandas as gpd

    base_e, base_n = 788547.0, 7634925.0
    data = {'geometry': [Point(base_e, base_n)], 'natural': ['tree'], 'highway': [None], 'building': [None]}
    gdf = gpd.GeoDataFrame(data)
    dxf_gen_test_coords.add_features(gdf)

    # O offset deve ser inicializado com os valores do centróide
    assert dxf_gen_test_coords._offset_initialized is True
    assert abs(dxf_gen_test_coords.diff_x - base_e) < 1.0
    assert abs(dxf_gen_test_coords.diff_y - base_n) < 1.0


def test_dxf_modular_drawing_mixin(dxf_gen_test_coords):
    """Verifica que os mixins DXFDrawingMixin e DXFCartographyMixin estão disponíveis."""
    from dxf_drawing import DXFDrawingMixin
    from dxf_cartography import DXFCartographyMixin
    from dxf_generator import DXFGenerator

    assert issubclass(DXFGenerator, DXFDrawingMixin)
    assert issubclass(DXFGenerator, DXFCartographyMixin)
    # Verifica métodos herdados
    assert hasattr(dxf_gen_test_coords, '_draw_polygon')
    assert hasattr(dxf_gen_test_coords, '_draw_linestring')
    assert hasattr(dxf_gen_test_coords, '_draw_point')
    assert hasattr(dxf_gen_test_coords, 'add_legend')
    assert hasattr(dxf_gen_test_coords, 'add_title_block')
    assert hasattr(dxf_gen_test_coords, 'add_coordinate_grid')
