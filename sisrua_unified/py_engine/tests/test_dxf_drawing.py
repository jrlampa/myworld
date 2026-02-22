"""
test_dxf_drawing.py
Testes unitários para DXFDrawingMixin (dxf_drawing.py) e DXFGenerator:
determine_layer, _merge_contiguous_lines, add_terrain_from_grid, add_contour_lines.

Fixtures compartilhadas (gen, gen_canonical) definidas em conftest.py.
Testes de geometria em test_dxf_drawing_geometry.py.

Coordenadas canônicas de teste (Muriaé/MG):
  UTM 23K: E=788547, N=7634925 → raio 100m
"""
import os
import sys
import pytest
import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString, Polygon

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator
from constants import TEST_UTM_E, TEST_UTM_N


# ─── determine_layer ─────────────────────────────────────────────────────────

class TestDetermineLayer:
    """Testa o mapeamento de tags OSM para camadas DXF."""

    def _tags(self, d: dict) -> pd.Series:
        return pd.Series(d)

    def test_power_line_hv(self, gen):
        assert gen.determine_layer(self._tags({'power': 'line'}), self._tags({})) == 'INFRA_POWER_HV'

    def test_power_tower_hv(self, gen):
        assert gen.determine_layer(self._tags({'power': 'tower'}), self._tags({})) == 'INFRA_POWER_HV'

    def test_power_substation_hv(self, gen):
        assert gen.determine_layer(self._tags({'power': 'substation'}), self._tags({})) == 'INFRA_POWER_HV'

    def test_power_distribution_lv(self, gen):
        assert gen.determine_layer(self._tags({'power': 'distribution'}), self._tags({})) == 'INFRA_POWER_LV'

    def test_telecom(self, gen):
        assert gen.determine_layer(self._tags({'telecom': 'cable'}), self._tags({})) == 'INFRA_TELECOM'

    def test_bench_mobiliario(self, gen):
        assert gen.determine_layer(self._tags({'amenity': 'bench'}), self._tags({})) == 'MOBILIARIO_URBANO'

    def test_waste_basket_mobiliario(self, gen):
        assert gen.determine_layer(self._tags({'amenity': 'waste_basket'}), self._tags({})) == 'MOBILIARIO_URBANO'

    def test_street_lamp_mobiliario(self, gen):
        assert gen.determine_layer(self._tags({'highway': 'street_lamp'}), self._tags({})) == 'MOBILIARIO_URBANO'

    def test_building_edificacao(self, gen):
        assert gen.determine_layer(self._tags({'building': 'yes'}), self._tags({})) == 'EDIFICACAO'

    def test_highway_vias(self, gen):
        assert gen.determine_layer(self._tags({'highway': 'residential'}), self._tags({})) == 'VIAS'

    def test_natural_tree_vegetacao(self, gen):
        assert gen.determine_layer(self._tags({'natural': 'tree'}), self._tags({})) == 'VEGETACAO'

    def test_natural_wood_vegetacao(self, gen):
        assert gen.determine_layer(self._tags({'natural': 'wood'}), self._tags({})) == 'VEGETACAO'

    def test_natural_scrub_vegetacao(self, gen):
        assert gen.determine_layer(self._tags({'natural': 'scrub'}), self._tags({})) == 'VEGETACAO'

    def test_amenity_school_equipamentos(self, gen):
        assert gen.determine_layer(self._tags({'amenity': 'school'}), self._tags({})) == 'EQUIPAMENTOS'

    def test_leisure_vegetacao(self, gen):
        assert gen.determine_layer(self._tags({'leisure': 'park'}), self._tags({})) == 'VEGETACAO'

    def test_waterway_hidrografia(self, gen):
        assert gen.determine_layer(self._tags({'waterway': 'river'}), self._tags({})) == 'HIDROGRAFIA'

    def test_natural_water_hidrografia(self, gen):
        assert gen.determine_layer(self._tags({'natural': 'water'}), self._tags({})) == 'HIDROGRAFIA'

    def test_empty_tags_fallback(self, gen):
        assert gen.determine_layer(self._tags({}), self._tags({})) == '0'


# ─── _merge_contiguous_lines ─────────────────────────────────────────────────

class TestMergeContiguousLines:
    """Testa a fusão de segmentos de via contíguos."""

    def _tags(self, name='Rua A', highway='residential'):
        return {'name': name, 'highway': highway}

    def test_empty_list_returns_empty(self, gen):
        result = gen._merge_contiguous_lines([])
        assert result == []

    def test_single_line_unchanged(self, gen):
        line = LineString([(0, 0), (10, 0)])
        result = gen._merge_contiguous_lines([(line, self._tags())])
        assert len(result) == 1
        assert result[0][0].length == pytest.approx(10.0, abs=0.01)

    def test_two_contiguous_lines_merged(self, gen):
        """l2 começa onde l1 termina — devem ser fundidas em uma só."""
        l1 = LineString([(0, 0), (10, 0)])
        l2 = LineString([(10, 0), (20, 0)])
        tags = self._tags()
        result = gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 1
        assert result[0][0].length == pytest.approx(20.0, abs=0.01)

    def test_reverse_connected_lines_merged(self, gen):
        """l1 começa onde l2 termina — fusão reversa."""
        l1 = LineString([(10, 0), (20, 0)])
        l2 = LineString([(0, 0), (10, 0)])
        tags = self._tags()
        result = gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 1

    def test_end_to_end_merged(self, gen):
        """Fim de l1 == fim de l2 (um é reverso do outro)."""
        l1 = LineString([(0, 0), (10, 0)])
        l2 = LineString([(20, 0), (10, 0)])
        tags = self._tags()
        result = gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 1

    def test_different_name_not_merged(self, gen):
        """Linhas com nomes diferentes não são fundidas."""
        l1 = LineString([(0, 0), (10, 0)])
        l2 = LineString([(10, 0), (20, 0)])
        result = gen._merge_contiguous_lines([
            (l1, self._tags(name='Rua A')),
            (l2, self._tags(name='Rua B')),
        ])
        assert len(result) == 2

    def test_different_highway_not_merged(self, gen):
        """Linhas com tipos de via diferentes não são fundidas."""
        l1 = LineString([(0, 0), (10, 0)])
        l2 = LineString([(10, 0), (20, 0)])
        result = gen._merge_contiguous_lines([
            (l1, self._tags(highway='primary')),
            (l2, self._tags(highway='residential')),
        ])
        assert len(result) == 2

    def test_disconnected_lines_not_merged(self, gen):
        """Linhas sem pontos em comum permanecem separadas."""
        l1 = LineString([(0, 0), (10, 0)])
        l2 = LineString([(50, 0), (60, 0)])
        tags = self._tags()
        result = gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 2


# ─── add_terrain_from_grid ───────────────────────────────────────────────────

class TestAddTerrainFromGrid:
    """Testa a geração da malha de terreno 2.5D."""

    def test_empty_grid_does_not_raise(self, gen):
        gen.add_terrain_from_grid([])

    def test_empty_first_row_does_not_raise(self, gen):
        gen.add_terrain_from_grid([[]])

    def test_single_row_skipped(self, gen):
        gen.add_terrain_from_grid([[(0, 0, 5), (10, 0, 6)]])

    def test_single_column_skipped(self, gen):
        gen.add_terrain_from_grid([[(0, 0, 5)], [(0, 10, 7)]])

    def test_valid_grid_adds_polymesh(self, gen):
        grid = [
            [(0, 0, 10), (10, 0, 15)],
            [(0, 10, 11), (10, 10, 16)],
        ]
        initial_count = len(gen.msp)
        gen.add_terrain_from_grid(grid)
        assert len(gen.msp) > initial_count

    def test_canonical_coordinates_grid(self, gen_canonical):
        """Testa malha nas coordenadas canônicas de teste (Muriaé/MG)."""
        e, n = TEST_UTM_E, TEST_UTM_N
        grid = [
            [(e, n, 850), (e + 50, n, 855)],
            [(e, n + 50, 852), (e + 50, n + 50, 857)],
        ]
        gen_canonical.add_terrain_from_grid(grid)


# ─── add_contour_lines ───────────────────────────────────────────────────────

class TestAddContourLines:
    """Testa a geração de curvas de nível."""

    def test_empty_contours_does_not_raise(self, gen):
        gen.add_contour_lines([])

    def test_short_contour_skipped(self, gen):
        """Linha com menos de 2 pontos é ignorada."""
        gen.add_contour_lines([[(0, 0, 10)]])

    def test_valid_contour_line_added(self, gen):
        contours = [[(0, 0, 100), (10, 0, 100), (10, 10, 100)]]
        initial = len(gen.msp)
        gen.add_contour_lines(contours)
        assert len(gen.msp) > initial

    def test_mixed_valid_invalid_contours(self, gen):
        """Mistura de contornos válidos e inválidos — apenas válidos são adicionados."""
        contours = [
            [(0, 0, 100), (10, 0, 100)],    # válido
            [(5, 5, 200)],                    # inválido (1 ponto)
            [(20, 0, 50), (30, 0, 50)],      # válido
        ]
        initial = len(gen.msp)
        gen.add_contour_lines(contours)
        assert len(gen.msp) >= initial + 2


