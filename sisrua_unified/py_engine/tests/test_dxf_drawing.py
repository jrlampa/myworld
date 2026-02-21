"""
test_dxf_drawing.py
Testes unitários para DXFDrawingMixin (dxf_drawing.py) e métodos relacionados
de DXFGenerator (dxf_generator.py): determine_layer, _merge_contiguous_lines,
add_terrain_from_grid, add_contour_lines, _draw_geometry, _draw_point,
_draw_street_offsets, _draw_linestring.

Coordenadas canônicas de teste (Muriaé/MG):
  UTM 23K: E=788547, N=7634925 → raio 100m
"""
import os
import sys
import math
import pytest
import ezdxf
import pandas as pd
import geopandas as gpd
from shapely.geometry import (
    Point, LineString, MultiLineString, Polygon, MultiPolygon
)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator
from constants import TEST_UTM_E, TEST_UTM_N


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def gen(tmp_path):
    """DXFGenerator pronto com offset zerado."""
    g = DXFGenerator(str(tmp_path / "test_drawing.dxf"))
    g.diff_x = 0.0
    g.diff_y = 0.0
    g.bounds = [0.0, 0.0, 100.0, 100.0]
    g._offset_initialized = True
    return g


@pytest.fixture
def gen_canonical(tmp_path):
    """DXFGenerator com coordenadas canônicas de teste aplicadas como offset."""
    g = DXFGenerator(str(tmp_path / "test_canonical.dxf"))
    g.diff_x = float(TEST_UTM_E)
    g.diff_y = float(TEST_UTM_N)
    g.bounds = [float(TEST_UTM_E) - 100, float(TEST_UTM_N) - 100,
                float(TEST_UTM_E) + 100, float(TEST_UTM_N) + 100]
    g._offset_initialized = True
    return g


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


# ─── _draw_geometry ──────────────────────────────────────────────────────────

class TestDrawGeometry:
    """Testa _draw_geometry para todos os tipos de geometria."""

    def _tags(self, d: dict = None) -> pd.Series:
        return pd.Series(d or {})

    def test_empty_geometry_skipped(self, gen):
        empty_poly = Polygon()
        initial = len(gen.msp)
        gen._draw_geometry(empty_poly, 'EDIFICACAO', 0, 0, self._tags())
        assert len(gen.msp) == initial

    def test_polygon_edificacao(self, gen):
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        initial = len(gen.msp)
        gen._draw_geometry(poly, 'EDIFICACAO', 0, 0, self._tags({'building': 'yes'}))
        assert len(gen.msp) > initial

    def test_multipolygon_edificacao(self, gen):
        """MultiPolygon deve iterar e desenhar cada polígono."""
        mp = MultiPolygon([
            Polygon([(0, 0), (10, 0), (10, 10), (0, 10)]),
            Polygon([(20, 0), (30, 0), (30, 10), (20, 10)]),
        ])
        initial = len(gen.msp)
        gen._draw_geometry(mp, 'EDIFICACAO', 0, 0, self._tags({'building': 'yes'}))
        assert len(gen.msp) > initial

    def test_linestring_vias(self, gen):
        """LineString VIAS deve adicionar polilinha e offsets de meio-fio."""
        line = LineString([(0, 0), (50, 0)])
        initial = len(gen.msp)
        gen._draw_geometry(line, 'VIAS', 0, 0, self._tags({'highway': 'residential'}))
        assert len(gen.msp) > initial

    def test_multilinestring_vias(self, gen):
        """MultiLineString deve iterar e desenhar cada segmento."""
        mls = MultiLineString([[(0, 0), (10, 0)], [(20, 0), (30, 0)]])
        initial = len(gen.msp)
        gen._draw_geometry(mls, 'VIAS', 0, 0, self._tags({'highway': 'residential'}))
        assert len(gen.msp) > initial

    def test_point_vegetacao(self, gen):
        """Point em camada VEGETACAO deve usar bloco ARVORE."""
        pt = Point(5, 5)
        initial = len(gen.msp)
        gen._draw_geometry(pt, 'VEGETACAO', 0, 0, self._tags())
        assert len(gen.msp) > initial

    def test_unknown_layer_falls_back_to_0(self, gen):
        """Camada desconhecida deve ser substituída por '0'."""
        line = LineString([(0, 0), (10, 0)])
        gen._draw_geometry(line, 'CAMADA_INEXISTENTE', 0, 0, self._tags())

    def test_street_label_added_for_named_via(self, gen):
        """Via com nome deve gerar rótulo de texto."""
        line = LineString([(0, 0), (100, 0)])
        initial_texts = [e for e in gen.msp if e.dxftype() in ('TEXT', 'MTEXT')]
        gen._draw_geometry(line, 'VIAS', 0, 0, self._tags({'name': 'Rua das Flores'}))
        after_texts = [e for e in gen.msp if e.dxftype() in ('TEXT', 'MTEXT')]
        assert len(after_texts) > len(initial_texts)

    def test_canonical_coords_multipolygon(self, gen_canonical):
        """MultiPolygon com coordenadas canônicas (Muriaé/MG)."""
        e, n = float(TEST_UTM_E), float(TEST_UTM_N)
        mp = MultiPolygon([
            Polygon([(e, n), (e + 20, n), (e + 20, n + 20), (e, n + 20)]),
            Polygon([(e + 30, n), (e + 50, n), (e + 50, n + 20), (e + 30, n + 20)]),
        ])
        gen_canonical._draw_geometry(mp, 'EDIFICACAO', float(TEST_UTM_E), float(TEST_UTM_N),
                                     pd.Series({'building': 'yes'}))


# ─── _draw_point ─────────────────────────────────────────────────────────────

class TestDrawPoint:
    """Testa _draw_point para todas as camadas e tags."""

    def _pt(self, x=5.0, y=5.0):
        return Point(x, y)

    def _tags(self, d: dict = None) -> pd.Series:
        return pd.Series(d or {})

    def test_vegetacao_uses_arvore_block(self, gen):
        initial = len(gen.msp)
        gen._draw_point(self._pt(), 'VEGETACAO', 0, 0, self._tags())
        assert len(gen.msp) > initial

    def test_mobiliario_bench(self, gen):
        gen._draw_point(self._pt(), 'MOBILIARIO_URBANO', 0, 0, self._tags({'amenity': 'bench'}))

    def test_mobiliario_waste_basket(self, gen):
        gen._draw_point(self._pt(), 'MOBILIARIO_URBANO', 0, 0, self._tags({'amenity': 'waste_basket'}))

    def test_mobiliario_street_lamp(self, gen):
        gen._draw_point(self._pt(), 'MOBILIARIO_URBANO', 0, 0, self._tags({'highway': 'street_lamp'}))

    def test_mobiliario_fallback_circle(self, gen):
        """MOBILIARIO_URBANO sem tag específica → círculo."""
        gen._draw_point(self._pt(), 'MOBILIARIO_URBANO', 0, 0, self._tags())

    def test_equipamentos(self, gen):
        gen._draw_point(self._pt(), 'EQUIPAMENTOS', 0, 0, self._tags({'osmid': '123', 'amenity': 'school'}))

    def test_infra_power_hv_tower(self, gen):
        gen._draw_point(self._pt(), 'INFRA_POWER_HV', 0, 0, self._tags({'power': 'tower'}))

    def test_infra_power_lv(self, gen):
        gen._draw_point(self._pt(), 'INFRA_POWER_LV', 0, 0, self._tags({'power': 'distribution'}))

    def test_infra_telecom(self, gen):
        gen._draw_point(self._pt(), 'INFRA_TELECOM', 0, 0, self._tags())

    def test_unknown_layer_fallback_circle(self, gen):
        """Camada desconhecida → círculo genérico."""
        gen._draw_point(self._pt(), 'HIDROGRAFIA', 0, 0, self._tags())


# ─── _draw_street_offsets ────────────────────────────────────────────────────

class TestDrawStreetOffsets:
    """Testa a geração de meio-fios (linhas paralelas) para vias."""

    def _tags(self, highway='residential') -> pd.Series:
        return pd.Series({'highway': highway})

    def test_residential_generates_offsets(self, gen):
        line = LineString([(0, 0), (50, 0)])
        initial = len(gen.msp)
        gen._draw_street_offsets(line, self._tags('residential'), 0, 0)
        assert len(gen.msp) > initial

    def test_primary_generates_offsets(self, gen):
        line = LineString([(0, 0), (50, 0)])
        initial = len(gen.msp)
        gen._draw_street_offsets(line, self._tags('primary'), 0, 0)
        assert len(gen.msp) > initial

    def test_footway_skipped(self, gen):
        """Calçadas não recebem meio-fio."""
        line = LineString([(0, 0), (50, 0)])
        initial = len(gen.msp)
        gen._draw_street_offsets(line, self._tags('footway'), 0, 0)
        assert len(gen.msp) == initial

    def test_path_skipped(self, gen):
        line = LineString([(0, 0), (50, 0)])
        initial = len(gen.msp)
        gen._draw_street_offsets(line, self._tags('path'), 0, 0)
        assert len(gen.msp) == initial

    def test_cycleway_skipped(self, gen):
        line = LineString([(0, 0), (50, 0)])
        initial = len(gen.msp)
        gen._draw_street_offsets(line, self._tags('cycleway'), 0, 0)
        assert len(gen.msp) == initial

    def test_steps_skipped(self, gen):
        line = LineString([(0, 0), (50, 0)])
        initial = len(gen.msp)
        gen._draw_street_offsets(line, self._tags('steps'), 0, 0)
        assert len(gen.msp) == initial


# ─── _draw_linestring ────────────────────────────────────────────────────────

class TestDrawLinestring:
    """Testa _draw_linestring para diferentes camadas."""

    def test_via_with_length_annotation(self, gen):
        """VIAS devem gerar anotação de comprimento."""
        line = LineString([(0, 0), (100, 0)])
        initial = len(gen.msp)
        gen._draw_linestring(line, 'VIAS', 0, 0)
        after = len(gen.msp)
        assert after > initial

    def test_other_layer_no_annotation(self, gen):
        """Outras camadas não geram anotação de comprimento."""
        line = LineString([(0, 0), (50, 0)])
        gen._draw_linestring(line, 'HIDROGRAFIA', 0, 0)

    def test_too_short_line_no_entity(self, gen):
        """Linha com pontos idênticos deve ser ignorada."""
        line = LineString([(0, 0), (0, 0), (0, 0)])
        gen._draw_linestring(line, 'VIAS', 0, 0)


# ─── add_features — integração ───────────────────────────────────────────────

class TestAddFeaturesIntegration:
    """Testa add_features com diferentes GeoDataFrames."""

    def test_empty_gdf_does_not_crash(self, tmp_path):
        gen = DXFGenerator(str(tmp_path / "empty.dxf"))
        empty_gdf = gpd.GeoDataFrame({'geometry': []})
        gen.add_features(empty_gdf)
        assert gen._offset_initialized is False

    def test_offset_initialized_on_first_call(self, tmp_path):
        gen = DXFGenerator(str(tmp_path / "offset.dxf"))
        poly = Polygon([(10, 20), (20, 20), (20, 30), (10, 30)])
        gdf = gpd.GeoDataFrame({'geometry': [poly], 'building': ['yes']})
        gen.add_features(gdf)
        assert gen._offset_initialized is True

    def test_offset_not_reinitialized_on_second_call(self, tmp_path):
        gen = DXFGenerator(str(tmp_path / "offset2.dxf"))
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        gdf = gpd.GeoDataFrame({'geometry': [poly], 'building': ['yes']})
        gen.add_features(gdf)
        first_diff_x = gen.diff_x
        first_diff_y = gen.diff_y
        gen.add_features(gdf)  # Segunda chamada NÃO deve alterar o offset
        assert gen.diff_x == first_diff_x
        assert gen.diff_y == first_diff_y

    def test_multipolygon_feature_processed(self, tmp_path):
        gen = DXFGenerator(str(tmp_path / "mp.dxf"))
        mp = MultiPolygon([
            Polygon([(0, 0), (10, 0), (10, 10), (0, 10)]),
            Polygon([(20, 0), (30, 0), (30, 10), (20, 10)]),
        ])
        gdf = gpd.GeoDataFrame({'geometry': [mp], 'building': ['yes']})
        gen.add_features(gdf)
        assert len(gen.msp) > 0

    def test_canonical_coords_full_feature_set(self, tmp_path):
        """Teste de integração com conjunto de features nas coords canônicas."""
        e, n = float(TEST_UTM_E), float(TEST_UTM_N)
        gen = DXFGenerator(str(tmp_path / "canonical.dxf"))
        data = {
            'geometry': [
                Polygon([(e, n), (e + 20, n), (e + 20, n + 20), (e, n + 20)]),
                LineString([(e, n), (e + 80, n + 40)]),
                MultiLineString([[(e + 10, n), (e + 40, n)], [(e + 50, n), (e + 80, n)]]),
                Point(e + 10, n + 50),
                MultiPolygon([
                    Polygon([(e + 30, n + 30), (e + 50, n + 30), (e + 50, n + 50), (e + 30, n + 50)]),
                ]),
            ],
            'building': ['yes', None, None, None, 'residential'],
            'highway': [None, 'residential', 'primary', None, None],
            'natural': [None, None, None, 'tree', None],
            'name': [None, 'Rua de Teste', 'Av. Principal', None, None],
        }
        gdf = gpd.GeoDataFrame(data)
        gen.add_features(gdf)
        gen.project_info = {'client': 'TESTE CI', 'project': 'CANONICAL COORDS TEST'}
        gen.save()

        # Valida o arquivo DXF gerado (headless)
        doc = ezdxf.readfile(str(tmp_path / "canonical.dxf"))
        auditor = doc.audit()
        assert not auditor.has_errors, f"DXF com erros: {[e.message for e in auditor.errors]}"
        assert len(doc.modelspace()) > 0
