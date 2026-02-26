import pytest
import numpy as np
import sys
import os
from shapely.geometry import LineString
from geopandas import GeoDataFrame

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator

class TestSmartLabels:
    @pytest.fixture
    def dxf_gen(self):
        return DXFGenerator("test_labels.dxf")

    def test_rotation_horizontal(self, dxf_gen):
        # Horizontal line (0 degrees) - must be >= 30m to get a label
        line = LineString([(0,0), (50,0)])
        gdf = GeoDataFrame({'geometry': [line], 'name': ['Rua Horizontal'], 'highway': ['residential']})
        
        dxf_gen.add_features(gdf)
        
        # Find the name label text
        name_texts = [e for e in dxf_gen.msp if e.dxftype() == 'TEXT' and e.dxf.text == 'Rua Horizontal']
        assert len(name_texts) == 1, f"Expected 1 name label, found {len(name_texts)}"
        text = name_texts[0]
        
        # Rotation should be 0
        assert abs(text.dxf.rotation - 0) < 1, f"Horizontal line should have 0 deg rotation, got {text.dxf.rotation}"

    def test_rotation_vertical(self, dxf_gen):
        # Vertical line (90 degrees) - must be >= 30m to get a label
        line = LineString([(0,0), (0,50)])
        gdf = GeoDataFrame({'geometry': [line], 'name': ['Rua Vertical'], 'highway': ['residential']})
        dxf_gen.add_features(gdf)
        
        name_texts = [e for e in dxf_gen.msp if e.dxftype() == 'TEXT' and e.dxf.text == 'Rua Vertical']
        assert len(name_texts) == 1, f"Expected 1 name label, found {len(name_texts)}"
        text = name_texts[0]
        
        # Should be 90
        assert abs(text.dxf.rotation - 90) < 1, f"Vertical line should have 90 deg rotation, got {text.dxf.rotation}"

    def test_rotation_readability(self, dxf_gen):
        # Line going left (180 degrees) -> Text should be flipped to 0 for readability - must be >= 30m
        line = LineString([(50,0), (0,0)])
        gdf = GeoDataFrame({'geometry': [line], 'name': ['Rua Invertida'], 'highway': ['residential']})
        dxf_gen.add_features(gdf)
        
        name_texts = [e for e in dxf_gen.msp if e.dxftype() == 'TEXT' and e.dxf.text == 'Rua Invertida']
        assert len(name_texts) == 1
        text = name_texts[0]
        
        rot = text.dxf.rotation % 360
        assert abs(rot - 0) < 1, f"Inverted line should be flipped to 0 deg for readability, got {rot}"

