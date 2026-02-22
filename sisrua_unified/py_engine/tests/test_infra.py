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



class TestDxfStylesLineweight:
    """Cobre a linha de _map_cad_lineweight: return 53 para lineweight > 0.50."""

    def test_lineweight_above_50_returns_53(self):
        """Quando w=0.60mm, _map_cad_lineweight retorna 53 (val=60 > 50)."""
        from dxf_styles import _map_cad_lineweight
        assert _map_cad_lineweight(0.60) == 53

    def test_lineweight_exactly_50_returns_50(self):
        """Quando w=0.50mm (val=50), retorna 50 (não 53)."""
        from dxf_styles import _map_cad_lineweight
        assert _map_cad_lineweight(0.50) == 50

    def test_lineweight_very_large_returns_53(self):
        """Qualquer lineweight acima de 0.50mm retorna 53."""
        from dxf_styles import _map_cad_lineweight
        assert _map_cad_lineweight(1.0) == 53


class TestOsmnxClientExtraChunkException:
    """Cobre linhas 93-94 de osmnx_client.py: except no extra chunk fetch."""

    def test_extra_chunk_exception_is_caught(self):
        """Se o fetch de tags extras lança, o except captura e continua (93-94)."""
        import geopandas as gpd
        from osmnx_client import _fetch_chunked
        from unittest.mock import patch, MagicMock
        from shapely.geometry import Point

        # Tag que não está nos _CHUNK_TAG_GROUPS (custom_key)
        tags = {'custom_extra_tag': True}

        def raise_for_extra(center, tags_arg, dist):
            # Parameters match ox.features.features_from_point(center, tags, dist=radius)
            # Named differently to avoid shadowing the outer 'tags' variable
            raise RuntimeError("Overpass timeout para extra chunk")

        with patch('osmnx_client.ox.features.features_from_point', side_effect=raise_for_extra):
            result = _fetch_chunked(-22.15018, -42.92185, 1500, tags)

        # Deve retornar GeoDataFrame vazio (não propagar exceção)
        assert isinstance(result, gpd.GeoDataFrame)
        assert result.empty


class TestUtilsGeo:
    """Testes para py_engine/utils/geo.py — utm_zone e sirgas2000_utm_epsg."""

    def test_utm_zone_canonical(self):
        """Longitude -42.922 deve retornar zona 23."""
        from utils.geo import utm_zone
        assert utm_zone(-42.922) == 23

    def test_utm_zone_clamped_min(self):
        """Longitude -180 retorna zona 1 (clamped)."""
        from utils.geo import utm_zone
        assert utm_zone(-180.0) == 1

    def test_utm_zone_clamped_max(self):
        """Longitude +180 retorna zona 60 (clamped)."""
        from utils.geo import utm_zone
        assert utm_zone(180.0) == 60

    def test_sirgas2000_southern_canonical(self):
        """Lat=-22.15 (Sul) retorna EPSG:31983 (SIRGAS 2000 / UTM 23S)."""
        from utils.geo import sirgas2000_utm_epsg
        epsg = sirgas2000_utm_epsg(-22.15018, -42.92185)
        assert epsg == 31983  # 31960 + 23

    def test_sirgas2000_northern(self):
        """Lat=5.0 (Norte) retorna EPSG no range Norte (31954 + zone)."""
        from utils.geo import sirgas2000_utm_epsg
        epsg = sirgas2000_utm_epsg(5.0, -60.0)
        # lon=-60 → zone=int((-60+180)/6)+1 = int(20)+1 = 21
        assert epsg == 31954 + 21
