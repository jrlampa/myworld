import pytest
from shapely.geometry import LineString, MultiLineString
from dxf_generator import DXFGenerator
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestOffsets:
    @pytest.fixture
    def dxf_gen(self):
        return DXFGenerator("test_offsets.dxf")

    def test_offset_residential(self, dxf_gen):
        # Residential should offset by 4.0m (current width from DXFStyleManager)
        line = LineString([(0,0), (10,0)])
        tags = {'highway': 'residential'}
        dxf_gen._draw_street_offsets(line, tags, 0, 0)
        
        # Check entities
        polylines = [e for e in dxf_gen.msp if e.dxftype() == 'LWPOLYLINE' and e.dxf.layer == 'VIAS_MEIO_FIO']
        assert len(polylines) == 2
        
        # Check Y coords of offsets
        ys = []
        for poly in polylines:
            points = poly.get_points() # format: (x, y, start_width, end_width, bulge)
            ys.append(points[0][1])
            
        # One should be ~4.0, one ~-4.0 (residential width from DXFStyleManager)
        assert any(abs(y - 4.0) < 0.1 for y in ys), f"Expected offset ~4.0m, got {ys}"
        assert any(abs(y + 4.0) < 0.1 for y in ys), f"Expected offset ~-4.0m, got {ys}"

    def test_offset_primary(self, dxf_gen):
        # Primary should offset by 7.0m (current width from DXFStyleManager)
        line = LineString([(0,0), (10,0)])
        tags = {'highway': 'primary'}
        dxf_gen._draw_street_offsets(line, tags, 0, 0)
        
        polylines = [e for e in dxf_gen.msp if e.dxftype() == 'LWPOLYLINE' and e.dxf.layer == 'VIAS_MEIO_FIO']
        assert len(polylines) == 2
        
        ys = [p.get_points()[0][1] for p in polylines]
        assert any(abs(y - 7.0) < 0.1 for y in ys), f"Expected offset ~7.0m, got {ys}"
        assert any(abs(y + 7.0) < 0.1 for y in ys), f"Expected offset ~-7.0m, got {ys}"

    def test_offset_footway(self, dxf_gen):
        # Footway should NOT have offsets
        line = LineString([(0,0), (10,0)])
        tags = {'highway': 'footway'}
        dxf_gen._draw_street_offsets(line, tags, 0, 0)
        
        polylines = [e for e in dxf_gen.msp if e.dxftype() == 'LWPOLYLINE' and e.dxf.layer == 'VIAS_MEIO_FIO']
        assert len(polylines) == 0
