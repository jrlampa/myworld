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
        # Horizontal line (0 degrees)
        line = LineString([(0,0), (10,0)])
        tags = {'name': 'Rua Horizontal', 'highway': 'residential'}
        
        # Mocking add_features internal logic or extracting rotation logic
        # Since logic is inside add_features -> _draw_geometry, verification is hard without observing side effects 
        # (like checking the created TEXT entity)
        
        # Let's perform a full add_features and check the doc
        import geopandas as gpd
        gdf = gpd.GeoDataFrame({'geometry': [line], 'name': ['Rua Horizontal'], 'highway': ['residential']})
        
        dxf_gen.add_features(gdf)
        
        # Find the TEXT entity
        msp = dxf_gen.msp
        texts = [e for e in msp if e.dxftype() == 'TEXT']
        assert len(texts) == 1
        text = texts[0]
        
        # Rotation should be 0
        assert abs(text.dxf.rotation - 0) < 1

    def test_rotation_vertical(self, dxf_gen):
        # Vertical line (90 degrees)
        line = LineString([(0,0), (0,10)])
        gdf = GeoDataFrame({'geometry': [line], 'name': ['Rua Vertical'], 'highway': ['residential']})
        dxf_gen.add_features(gdf)
        
        text = [e for e in dxf_gen.msp if e.dxftype() == 'TEXT'][-1]
        
        # Should be 90
        assert abs(text.dxf.rotation - 90) < 1

    def test_rotation_readability(self, dxf_gen):
        # Line going left (180 degrees) -> Text should be flipped to 0 for readability?
        # Or if line is (-10, 0) to (0, 0)?
        line = LineString([(10,0), (0,0)])
        gdf = GeoDataFrame({'geometry': [line], 'name': ['Rua Invertida'], 'highway': ['residential']})
        dxf_gen.add_features(gdf)
        
        text = [e for e in dxf_gen.msp if e.dxftype() == 'TEXT'][-1]
        
        # Angle of vector is 180.
        # Logic says: if -90 <= angle <= 90: rot = angle. Else rot = angle + 180.
        # 180 + 180 = 360 -> 0.
        # So text should be 0 (readable from bottom).
        
        # Note: floating point math might give 180 or -180.
        # np.degrees(arctan2(0, -10)) -> 180.
        # 180 is not <= 90.
        # 180 + 180 = 360 = 0.
        
        rot = text.dxf.rotation % 360
        assert abs(rot - 0) < 1

