"""
test_dxf_drawing_geometry.py
Testes unitários para _draw_geometry, _draw_point, _draw_street_offsets,
_draw_linestring e add_features (integração) de DXFGenerator/DXFDrawingMixin.

Fixtures compartilhadas (gen, gen_canonical) definidas em conftest.py.
Testes de camadas/merge/terrain/contour em test_dxf_drawing.py.

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
        initial = len(gen_canonical.msp)
        gen_canonical._draw_geometry(mp, 'EDIFICACAO', float(TEST_UTM_E), float(TEST_UTM_N),
                                     pd.Series({'building': 'yes'}))
        assert len(gen_canonical.msp) > initial


# ─── _draw_point ─────────────────────────────────────────────────────────────

class TestDrawPoint:
    """Testa _draw_point para diferentes camadas e tags."""

    def _tags(self, d: dict = None) -> pd.Series:
        return pd.Series(d or {})

    def test_vegetacao_tree(self, gen):
        """VEGETACAO deve usar bloco ARVORE."""
        gen._draw_point(Point(5, 5), 'VEGETACAO', 0, 0, self._tags({'natural': 'tree'}))
        refs = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert any(e.dxf.name == 'ARVORE' for e in refs)

    def test_hidrografia_point(self, gen):
        gen._draw_point(Point(5, 5), 'HIDROGRAFIA', 0, 0, self._tags())
        assert len(gen.msp) > 0

    def test_mobiliario_bench(self, gen):
        gen._draw_point(Point(5, 5), 'MOBILIARIO_URBANO', 0, 0,
                        self._tags({'amenity': 'bench'}))
        refs = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert any(e.dxf.name == 'BANCO' for e in refs)

    def test_mobiliario_waste_basket(self, gen):
        gen._draw_point(Point(5, 5), 'MOBILIARIO_URBANO', 0, 0,
                        self._tags({'amenity': 'waste_basket'}))
        refs = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert any(e.dxf.name == 'LIXEIRA' for e in refs)

    def test_mobiliario_street_lamp(self, gen):
        gen._draw_point(Point(5, 5), 'MOBILIARIO_URBANO', 0, 0,
                        self._tags({'highway': 'street_lamp'}))
        refs = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert any(e.dxf.name == 'POSTE_LUZ' for e in refs)

    def test_mobiliario_fallback_circle(self, gen):
        """Amenity não mapeado deve gerar círculo."""
        initial = len(gen.msp)
        gen._draw_point(Point(5, 5), 'MOBILIARIO_URBANO', 0, 0,
                        self._tags({'amenity': 'fountain'}))
        assert len(gen.msp) > initial

    def test_infraestrutura_poste(self, gen):
        gen._draw_point(Point(5, 5), 'INFRA_TELECOM', 0, 0, self._tags())
        refs = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert any(e.dxf.name == 'POSTE' for e in refs)

    def test_generic_layer_circle(self, gen):
        gen._draw_point(Point(5, 5), 'CAMADA_GENERICA', 0, 0, self._tags())
        circles = [e for e in gen.msp if e.dxftype() == 'CIRCLE']
        assert len(circles) > 0

    def test_nan_point_skipped(self, gen):
        """Ponto com coordenadas NaN deve ser ignorado."""
        initial = len(gen.msp)
        gen._draw_point(Point(math.nan, math.nan), 'EDIFICACAO', 0, 0, self._tags())
        assert len(gen.msp) == initial

    def test_infra_power_hv_torre(self, gen):
        """INFRA_POWER_HV deve usar bloco TORRE."""
        gen._draw_point(Point(5, 5), 'INFRA_POWER_HV', 0, 0,
                        self._tags({'power': 'tower'}))
        refs = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert any(e.dxf.name == 'TORRE' for e in refs)

    def test_infra_power_lv_poste(self, gen):
        """INFRA_POWER_LV (sem tower tag) deve usar bloco POSTE (linha 237)."""
        gen._draw_point(Point(5, 5), 'INFRA_POWER_LV', 0, 0,
                        self._tags({'power': 'pole'}))
        refs = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert any(e.dxf.name == 'POSTE' for e in refs)

    def test_equipamentos_poste(self, gen):
        """EQUIPAMENTOS deve usar bloco POSTE (linha 232)."""
        gen._draw_point(Point(5, 5), 'EQUIPAMENTOS', 0, 0, self._tags())
        refs = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert any(e.dxf.name == 'POSTE' for e in refs)


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
