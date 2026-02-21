"""
test_dxf_drawing_guards.py
Testes direcionados para os caminhos de erro e guardas defensivas de
DXFDrawingMixin (dxf_drawing.py) e DXFGenerator (dxf_generator.py)
que ainda não eram cobertos pelo test_dxf_drawing.py.

Linhas alvo:
  dxf_drawing.py: 29-31, 39-41, 46, 53, 58-60, 68, 76, 78-80, 90,
                  97-100, 118-119, 136-137, 162-163, 178-179, 183,
                  189-196, 209
  dxf_generator.py: 72, 114, 153, 212-213, 226-227, 252-254, 296-298
"""
import os
import sys
import math
import pytest
import ezdxf
import pandas as pd
import geopandas as gpd
from unittest.mock import patch, MagicMock
from shapely.geometry import (
    Point, LineString, MultiLineString, Polygon, MultiPolygon
)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator
from constants import TEST_UTM_E, TEST_UTM_N


# ─── Fixture ─────────────────────────────────────────────────────────────────

@pytest.fixture
def gen(tmp_path):
    g = DXFGenerator(str(tmp_path / "guards.dxf"))
    g.diff_x = 0.0
    g.diff_y = 0.0
    g.bounds = [0.0, 0.0, 100.0, 100.0]
    g._offset_initialized = True
    return g


# ─── _safe_v guard (lines 29-31) ─────────────────────────────────────────────

class TestSafeVGuard:
    """Cobre o except(ValueError, TypeError) de _safe_v."""

    def test_non_numeric_string_returns_zero(self, gen):
        """'abc' → float('abc') lança ValueError → retorna 0.0."""
        result = gen._safe_v("abc")
        assert result == 0.0

    def test_none_input_returns_zero(self, gen):
        """None → float(None) lança TypeError → retorna 0.0."""
        result = gen._safe_v(None)
        assert result == 0.0

    def test_non_numeric_with_fallback(self, gen):
        """Com fallback_val, o except retorna o fallback em vez de 0.0."""
        result = gen._safe_v("INVALIDO", fallback_val=3.5)
        assert result == 3.5

    def test_list_input_returns_zero(self, gen):
        """Lista não é float-convertível → TypeError → 0.0."""
        result = gen._safe_v([1, 2, 3])
        assert result == 0.0


# ─── _safe_p guard (lines 39-41) ─────────────────────────────────────────────

class TestSafePGuard:
    """Cobre o except(IndexError, TypeError) de _safe_p."""

    def test_none_point_returns_origin(self, gen):
        """None como ponto → TypeError ao indexar → (0.0, 0.0)."""
        result = gen._safe_p(None)
        assert result == (0.0, 0.0)

    def test_integer_point_returns_origin(self, gen):
        """Inteiro como ponto → TypeError ao indexar → (0.0, 0.0)."""
        result = gen._safe_p(42)
        assert result == (0.0, 0.0)

    def test_empty_tuple_returns_origin(self, gen):
        """Tupla vazia → IndexError ao acessar p[0] → (0.0, 0.0)."""
        result = gen._safe_p(())
        assert result == (0.0, 0.0)


# ─── _validate_points guard (lines 46, 53, 58-60) ───────────────────────────

class TestValidatePointsGuard:
    """Cobre os caminhos de None e exceção em _validate_points."""

    def test_none_input_returns_none(self, gen):
        """None como lista → retorna None imediatamente (linha 46)."""
        assert gen._validate_points(None) is None

    def test_empty_list_returns_none(self, gen):
        """Lista vazia → len < min_points → retorna None (linha 46)."""
        assert gen._validate_points([]) is None

    def test_single_point_below_min_returns_none(self, gen):
        """Uma única coordenada com min_points=2 → None (linha 46)."""
        assert gen._validate_points([(1.0, 2.0)], min_points=2) is None

    def test_all_nan_values_returns_none(self, gen):
        """Pontos NaN → _safe_v retorna 0.0 → todos iguais (0.0,0.0) → deduplication
        → apenas 1 ponto único < min_points=2 → retorna None (linhas 61-62)."""
        nan_pts = [(float('nan'), float('nan')), (float('nan'), float('nan'))]
        result = gen._validate_points(nan_pts, min_points=2)
        assert result is None

    def test_non_iterable_point_triggers_except_and_continue(self, gen):
        """Ponto inteiro (não-iterável) → TypeError ao iterar → Logger.error → continue
        (linhas 58-60). Apenas 1 ponto válido sobra → < min_points → None."""
        # 42 → TypeError ao tentar 'for v in 42' → except → continue (58-60)
        # (1.0, 2.0) → válido, mas sozinho não atinge min_points=2
        mixed = [42, (1.0, 2.0)]
        result = gen._validate_points(mixed, min_points=2)
        assert result is None

    def test_partial_nan_normalizes_to_zero(self, gen):
        """Ponto com NaN não é filtrado — NaN vira 0.0. Resultado inclui o ponto."""
        # NaN não gera None em _safe_v (retorna 0.0 com fallback_val=None)
        pts = [(float('nan'), 0.0), (1.0, 2.0), (3.0, 4.0)]
        result = gen._validate_points(pts, min_points=2)
        # O ponto NaN se torna (0.0, 0.0) e é incluído
        assert result is not None
        assert len(result) >= 2


# ─── _get_thickness guard (lines 68, 76, 78-80) ──────────────────────────────

class TestGetThicknessGuard:
    """Cobre os caminhos não testados de _get_thickness."""

    def _tags(self, d):
        return pd.Series(d)

    def test_non_edificacao_layer_returns_zero(self, gen):
        """Camada diferente de EDIFICACAO → retorna 0.0 (linha 68)."""
        result = gen._get_thickness(self._tags({'building': 'yes'}), 'VIAS')
        assert result == 0.0

    def test_levels_key_returns_correct_thickness(self, gen):
        """'levels' (sem 'building:' prefixo) → 2.5 * 3.0 = 7.5 (linha 76)."""
        result = gen._get_thickness(self._tags({'levels': '2.5'}), 'EDIFICACAO')
        assert result == pytest.approx(7.5, abs=0.01)

    def test_invalid_height_raises_exception_returns_default(self, gen):
        """height='alto' → float('alto') → ValueError → except → 3.5 (linhas 78-80)."""
        result = gen._get_thickness(self._tags({'height': 'alto'}), 'EDIFICACAO')
        assert result == 3.5

    def test_height_with_unit_string_parsed(self, gen):
        """height='6m' → split(' ')[0] → '6m' → float('6m') → ValueError → 3.5."""
        # '6m' não converte diretamente com float()
        result = gen._get_thickness(self._tags({'height': '6m'}), 'EDIFICACAO')
        assert result == 3.5


# ─── _draw_polygon guard (lines 90, 97-100) ──────────────────────────────────

class TestDrawPolygonGuard:
    """Cobre _draw_polygon com exterior degenerado e com buracos."""

    def test_degenerate_polygon_skipped(self, gen):
        """Polígono com todos os pontos iguais → _validate_points retorna None → return (linha 90)."""
        # Um ponto só não forma polígono válido, então todos os coords são iguais
        degenerate = Polygon([(5.0, 5.0), (5.0, 5.0), (5.0, 5.0)])
        count_before = sum(1 for _ in gen.msp)
        gen._draw_polygon(degenerate, 'EDIFICACAO', 0.0, 0.0, pd.Series({}))
        count_after = sum(1 for _ in gen.msp)
        # Nenhuma entidade deve ser adicionada
        assert count_after == count_before

    def test_polygon_with_interior_ring_draws_both(self, gen):
        """Polígono com buraco → exterior + interior desenhados (linhas 97-100)."""
        exterior = [(0.0, 0.0), (20.0, 0.0), (20.0, 20.0), (0.0, 20.0)]
        interior = [(5.0, 5.0), (15.0, 5.0), (15.0, 15.0), (5.0, 15.0)]
        poly = Polygon(exterior, [interior])

        count_before = sum(1 for _ in gen.msp)
        gen._draw_polygon(poly, 'VEGETACAO', 0.0, 0.0, pd.Series({}))
        count_after = sum(1 for _ in gen.msp)

        # Deve adicionar pelo menos 2 entidades (exterior + interior)
        assert count_after - count_before >= 2

    def test_edificacao_polygon_with_hole_draws_annotation(self, gen):
        """EDIFICACAO com buraco → exterior + interior + anotação."""
        exterior = [(0.0, 0.0), (30.0, 0.0), (30.0, 30.0), (0.0, 30.0)]
        interior = [(5.0, 5.0), (25.0, 5.0), (25.0, 25.0), (5.0, 25.0)]
        poly = Polygon(exterior, [interior])

        gen._draw_polygon(poly, 'EDIFICACAO', 0.0, 0.0, pd.Series({'building': 'yes'}))

        all_entities = list(gen.msp)
        assert len(all_entities) >= 2  # exterior + interior


# ─── _draw_building_annotation exception (lines 118-119, 136-137) ────────────

class TestDrawBuildingAnnotationGuard:
    """Cobre os except blocks em _draw_building_annotation."""

    def test_annotation_exception_does_not_raise(self, gen):
        """Se add_text falhar → except captura e segue (linhas 118-119)."""
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        points = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]

        with patch.object(gen.msp, 'add_text', side_effect=RuntimeError("mock error")):
            # Não deve lançar exceção
            gen._draw_building_annotation(poly, 0.0, 0.0, points)

    def test_hatch_exception_does_not_raise(self, gen):
        """Se add_hatch falhar → except captura (linhas 136-137)."""
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        points = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]

        with patch.object(gen.msp, 'add_hatch', side_effect=RuntimeError("hatch error")):
            gen._draw_building_annotation(poly, 0.0, 0.0, points)


# ─── _draw_linestring VIAS annotation exception (lines 162-163) ──────────────

class TestDrawLinestringGuard:
    """Cobre o except do bloco de anotação de comprimento em _draw_linestring."""

    def test_annotation_exception_does_not_raise(self, gen):
        """Se a geração da anotação falhar → except Logger.info → sem raise (linhas 162-163)."""
        line = LineString([(0, 0), (50, 0)])

        with patch.object(gen.msp, 'add_text', side_effect=RuntimeError("text error")):
            gen._draw_linestring(line, 'VIAS', 0.0, 0.0)


# ─── _draw_street_offsets MultiLineString result (lines 178-179, 183) ────────

class TestDrawStreetOffsetsGuard:
    """Cobre o caminho MultiLineString no resultado de offset e o except."""

    def test_offset_multilinestring_result_processed(self, gen):
        """Quando o offset resulta em MultiLineString → processa cada sub-linha
        (linhas 181-195 including 178-179 for subline processing)."""
        from unittest.mock import MagicMock

        # Mock de linha que retorna MultiLineString no offset_curve
        ml = MultiLineString([[(0, 1), (10, 1)], [(0, -1), (10, -1)]])
        mock_line = MagicMock(spec=['offset_curve'])
        mock_line.offset_curve.return_value = ml

        tags = pd.Series({'highway': 'residential'})
        gen._draw_street_offsets(mock_line, tags, 0.0, 0.0)

        # Deve ter adicionado pelo menos 2 polilinhas de meio-fio (uma por sub-linha)
        meio_fio = [e for e in gen.msp if e.dxf.layer == 'VIAS_MEIO_FIO']
        assert len(meio_fio) >= 2

    def test_offset_exception_does_not_raise(self, gen):
        """Offset explode → except Logger.info → sem raise (linha 183)."""
        from unittest.mock import MagicMock

        mock_line = MagicMock(spec=['offset_curve'])
        mock_line.offset_curve.side_effect = RuntimeError("offset error")

        tags = pd.Series({'highway': 'residential'})
        # Não deve lançar exceção
        gen._draw_street_offsets(mock_line, tags, 0.0, 0.0)


# ─── _draw_point NaN guard (line 209) ────────────────────────────────────────

class TestDrawPointNaNGuard:
    """Cobre o guard NaN em _draw_point (linha 209)."""

    def test_nan_point_skipped(self, gen):
        """Ponto com NaN nas coordenadas → retorna imediatamente (linha 209)."""
        nan_point = Point(float('nan'), float('nan'))
        count_before = sum(1 for _ in gen.msp)
        gen._draw_point(nan_point, 'VEGETACAO', 0.0, 0.0, pd.Series({}))
        count_after = sum(1 for _ in gen.msp)
        assert count_after == count_before

    def test_nan_x_only_skipped(self, gen):
        """Ponto com NaN apenas em x → retorna imediatamente."""
        nan_point = Point(float('nan'), 5.0)
        count_before = sum(1 for _ in gen.msp)
        gen._draw_point(nan_point, 'VEGETACAO', 0.0, 0.0, pd.Series({}))
        assert sum(1 for _ in gen.msp) == count_before


# ─── _draw_point MOBILIARIO_URBANO sub-cases (lines 189-196) ─────────────────

class TestDrawPointMobiliarioUrbanoBranches:
    """Cobre bench, waste_basket, street_lamp (linhas 223-228) e fallback (230)."""

    def test_mobiliario_bench_uses_banco_block(self, gen):
        pt = Point(5.0, 5.0)
        gen._draw_point(pt, 'MOBILIARIO_URBANO', 0.0, 0.0,
                        pd.Series({'amenity': 'bench'}))
        inserts = [e for e in gen.msp if e.dxftype() == 'INSERT' and e.dxf.name == 'BANCO']
        assert len(inserts) == 1

    def test_mobiliario_waste_basket_uses_lixeira_block(self, gen):
        pt = Point(5.0, 5.0)
        gen._draw_point(pt, 'MOBILIARIO_URBANO', 0.0, 0.0,
                        pd.Series({'amenity': 'waste_basket'}))
        inserts = [e for e in gen.msp if e.dxftype() == 'INSERT' and e.dxf.name == 'LIXEIRA']
        assert len(inserts) == 1

    def test_mobiliario_street_lamp_uses_poste_luz_block(self, gen):
        pt = Point(5.0, 5.0)
        gen._draw_point(pt, 'MOBILIARIO_URBANO', 0.0, 0.0,
                        pd.Series({'highway': 'street_lamp'}))
        inserts = [e for e in gen.msp if e.dxftype() == 'INSERT' and e.dxf.name == 'POSTE_LUZ']
        assert len(inserts) == 1

    def test_mobiliario_fallback_uses_circle(self, gen):
        """Amenity não mapeada e sem highway → circle fallback (linha 230)."""
        pt = Point(5.0, 5.0)
        gen._draw_point(pt, 'MOBILIARIO_URBANO', 0.0, 0.0,
                        pd.Series({'amenity': 'phone'}))
        circles = [e for e in gen.msp if e.dxftype() == 'CIRCLE']
        assert len(circles) >= 1


# ─── dxf_generator.py: NaN bounds (line 72) ──────────────────────────────────

class TestAddFeaturesNaNBounds:
    """Cobre o guard de bounds NaN/Inf em add_features (linha 72)."""

    def test_nan_bounds_uses_fallback(self, tmp_path):
        """GDF com geometria que produz NaN em total_bounds → bounds = [0,0,100,100]."""
        gen = DXFGenerator(str(tmp_path / "nan_bounds.dxf"))

        # Patch total_bounds para retornar NaN
        data = {'geometry': [Point(10.0, 10.0)], 'natural': ['tree']}
        gdf = gpd.GeoDataFrame(data)

        with patch.object(type(gdf), 'total_bounds',
                          new_callable=lambda: property(
                              lambda self: [float('nan'), float('nan'),
                                           float('nan'), float('nan')])):
            gen.add_features(gdf)

        # bounds devem ter sido substituídos pelo fallback
        assert gen.bounds == [0.0, 0.0, 100.0, 100.0]


# ─── dxf_generator.py: _simplify_line (line 114) ─────────────────────────────

class TestSimplifyLine:
    """Cobre _simplify_line (linha 114)."""

    def test_simplify_reduces_points(self, gen):
        """Uma linha com muitos pontos colineares é simplificada."""
        pts = [(float(i), 0.0) for i in range(100)]
        line = LineString(pts)
        simplified = gen._simplify_line(line, tolerance=0.1)
        assert simplified is not None
        assert len(list(simplified.coords)) < 100

    def test_simplify_preserves_endpoints(self, gen):
        """Os endpoints devem ser mantidos após simplificação."""
        pts = [(0.0, 0.0)] + [(float(i), float(i) * 0.01) for i in range(50)] + [(10.0, 0.5)]
        line = LineString(pts)
        simplified = gen._simplify_line(line, tolerance=0.01)
        coords = list(simplified.coords)
        assert coords[0] == pytest.approx((0.0, 0.0), abs=0.001)
        assert coords[-1] == pytest.approx((10.0, 0.5), abs=0.001)


# ─── dxf_generator.py: start-start merge (line 153) ─────────────────────────

class TestMergeStartStart:
    """Cobre o ramo start-start de _merge_contiguous_lines (linha 153)."""

    def _tags(self):
        return {'name': 'Rua X', 'highway': 'residential'}

    def test_start_start_merge(self, gen):
        """l2 começa no mesmo ponto que l1 → reversed(l2) + l1 (linha 153)."""
        l1 = LineString([(10, 0), (20, 0)])
        l2 = LineString([(10, 0), (0, 0)])  # Início == Início de l1
        tags = self._tags()
        result = gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 1
        assert result[0][0].length == pytest.approx(20.0, abs=0.01)


# ─── dxf_generator.py: _draw_street_label exception (lines 212-213) ──────────

class TestDrawStreetLabelException:
    """Cobre o except da interpolação de ângulo em _draw_street_label (212-213)."""

    def test_label_exception_does_not_raise(self, gen):
        """Se arctan2 falhar dentro do try → except: pass (linhas 212-213)."""
        import dxf_generator as dxf_gen_module

        line = LineString([(0, 0), (10, 0)])
        # Patch np.arctan2 no módulo dxf_generator para lançar exceção
        with patch.object(dxf_gen_module.np, 'arctan2',
                          side_effect=RuntimeError("arctan2 error")):
            # Não deve lançar exceção — o except captura
            gen._draw_street_label(line, "Rua Teste", 0.0, 0.0)


# ─── dxf_generator.py: bad terrain vertex (lines 252-254) ────────────────────

class TestAddTerrainBadVertex:
    """Cobre o except de vértice inválido em add_terrain_from_grid (252-254)."""

    def test_invalid_vertex_uses_zero_fallback(self, gen):
        """Vertex com string → ValueError → except → (0.0, 0.0, 0.0) (252-254)."""
        bad_grid = [
            [("bad", "bad", "bad"), (1.0, 2.0, 3.0)],
            [(4.0, 5.0, 6.0), (7.0, 8.0, 9.0)],
        ]
        # Não deve lançar exceção
        gen.add_terrain_from_grid(bad_grid)
        # ezdxf representa polymesh como POLYLINE com flags especiais
        polylines = [e for e in gen.msp if e.dxftype() == 'POLYLINE']
        assert len(polylines) == 1

    def test_none_vertex_uses_zero_fallback(self, gen):
        """Vertex com None → TypeError → except → (0.0, 0.0, 0.0)."""
        bad_grid = [
            [(None, None, None), (1.0, 2.0, 3.0)],
            [(4.0, 5.0, 6.0), (7.0, 8.0, 9.0)],
        ]
        gen.add_terrain_from_grid(bad_grid)
        polylines = [e for e in gen.msp if e.dxftype() == 'POLYLINE']
        assert len(polylines) == 1


# ─── dxf_generator.py: save exception (lines 296-298) ────────────────────────

class TestSaveException:
    """Cobre o except de save() que propaga a exceção (linhas 296-298)."""

    def test_save_exception_propagates(self, gen):
        """Se doc.saveas() falhar → except → Logger.error → raise (296-298)."""
        with patch.object(gen.doc, 'saveas', side_effect=OSError("disco cheio")):
            with pytest.raises(OSError, match="disco cheio"):
                gen.save()
