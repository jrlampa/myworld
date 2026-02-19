import pytest
import pandas as pd
import sys
import os
from geopandas import GeoDataFrame
from shapely.geometry import Point, LineString

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator

class TestInfra:
    @pytest.fixture
    def dxf_gen(self):
        return DXFGenerator("test_infra.dxf")

    def test_determine_layer_power_hv(self, dxf_gen):
        tags = {'power': 'line'}
        layer = dxf_gen.determine_layer(tags, None)
        assert layer == 'INFRA_POWER_HV'

    def test_determine_layer_power_lv(self, dxf_gen):
        tags = {'power': 'pole'}
        layer = dxf_gen.determine_layer(tags, None)
        assert layer == 'INFRA_POWER_LV'

    def test_determine_layer_telecom(self, dxf_gen):
        tags = {'telecom': 'line'}
        layer = dxf_gen.determine_layer(tags, None)
        assert layer == 'INFRA_TELECOM'
        
    def test_determine_layer_priority(self, dxf_gen):
        # Power should take precedence over implicit building if both present (unlikely but good to test)
        tags = {'power': 'substation', 'building': 'yes'}
        # In current logic, power is checked before building?
        # Let's check implementation order in dxf_generator.py
        # Logic: 
        # if power -> INFRA
        # if telecom -> INFRA
        # if building -> EDIFICACAO
        # So power should win
        layer = dxf_gen.determine_layer(tags, None)
        assert layer == 'INFRA_POWER_HV'

