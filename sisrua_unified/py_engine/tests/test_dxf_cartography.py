"""
test_dxf_cartography.py
Testes unitários para DXFCartographyMixin (dxf_cartography.py).

Cobre: add_cartographic_elements, add_coordinate_grid, add_legend, add_title_block.
Coordenadas canônicas de teste (Muriaé/MG): E=788547, N=7634925.
"""
import os
import sys
import pytest
import ezdxf

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator
from constants import TEST_UTM_E, TEST_UTM_N, TEST_RADII


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def gen(tmp_path):
    """DXFGenerator com offset zerado para testes básicos de cartografia."""
    g = DXFGenerator(str(tmp_path / "carto_test.dxf"))
    g.diff_x = 0.0
    g.diff_y = 0.0
    g.bounds = [0.0, 0.0, 200.0, 200.0]
    g._offset_initialized = True
    return g


@pytest.fixture
def gen_canonical(tmp_path):
    """DXFGenerator com coordenadas canônicas de teste (Muriaé/MG, UTM 23K)."""
    e, n = float(TEST_UTM_E), float(TEST_UTM_N)
    g = DXFGenerator(str(tmp_path / "carto_canonical.dxf"))
    g.diff_x = e
    g.diff_y = n
    g.bounds = [e - 100.0, n - 100.0, e + 100.0, n + 100.0]
    g._offset_initialized = True
    return g


# ─── add_cartographic_elements ───────────────────────────────────────────────

class TestAddCartographicElements:
    """Testa a adição de Rosa dos Ventos e Escala gráfica ao modelo."""

    def test_adds_two_block_references(self, gen):
        """Deve adicionar 2 referências de bloco (NORTE + ESCALA) ao modelspace."""
        initial = len(gen.msp)
        gen.add_cartographic_elements(0.0, 0.0, 200.0, 200.0, 0.0, 0.0)
        assert len(gen.msp) == initial + 2

    def test_does_not_raise_on_exception(self, gen):
        """Deve capturar exceções sem relançar."""
        # Chamar com valores que podem causar problemas numéricos
        gen.add_cartographic_elements(
            float('nan'), float('nan'), float('nan'), float('nan'), 0.0, 0.0
        )

    def test_canonical_coordinates(self, gen_canonical):
        """Testa com coordenadas canônicas UTM 23K (Muriaé/MG)."""
        e, n = float(TEST_UTM_E), float(TEST_UTM_N)
        initial = len(gen_canonical.msp)
        gen_canonical.add_cartographic_elements(
            e - 100.0, n - 100.0, e + 100.0, n + 100.0, e, n
        )
        assert len(gen_canonical.msp) > initial


# ─── add_coordinate_grid ─────────────────────────────────────────────────────

class TestAddCoordinateGrid:
    """Testa o quadro de delimitação com rótulos de coordenadas."""

    def test_adds_frame_and_labels(self, gen):
        """Deve adicionar polilinha de enquadramento e rótulos dos eixos."""
        initial = len(gen.msp)
        gen.add_coordinate_grid(0.0, 0.0, 200.0, 200.0, 0.0, 0.0)
        assert len(gen.msp) > initial

    def test_frame_is_lwpolyline(self, gen):
        """A moldura externa deve ser uma LWPOLYLINE fechada."""
        gen.add_coordinate_grid(0.0, 0.0, 100.0, 100.0, 0.0, 0.0)
        polylines = [e for e in gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(polylines) >= 1

    def test_text_labels_added(self, gen):
        """Rótulos de coordenadas E: e N: devem ser adicionados."""
        gen.add_coordinate_grid(0.0, 0.0, 100.0, 100.0, 0.0, 0.0)
        texts = [e for e in gen.msp if e.dxftype() in ('TEXT', 'MTEXT')]
        labels = [t.dxf.text for t in texts]
        assert any('E:' in lbl for lbl in labels)
        assert any('N:' in lbl for lbl in labels)

    def test_canonical_coordinates(self, gen_canonical):
        """Testa grade de coordenadas nas coords canônicas (Muriaé/MG)."""
        e, n = float(TEST_UTM_E), float(TEST_UTM_N)
        initial = len(gen_canonical.msp)
        gen_canonical.add_coordinate_grid(
            e - 100.0, n - 100.0, e + 100.0, n + 100.0, e, n
        )
        texts = [ent for ent in gen_canonical.msp if ent.dxftype() in ('TEXT', 'MTEXT')]
        # Devem existir rótulos de coordenadas reais (ex: "E: 788550")
        assert len(texts) > 0

    def test_does_not_raise_with_small_area(self, gen):
        """Deve funcionar sem exceção com áreas muito pequenas."""
        gen.add_coordinate_grid(0.0, 0.0, 1.0, 1.0, 0.0, 0.0)


# ─── add_legend ──────────────────────────────────────────────────────────────

class TestAddLegend:
    """Testa a legenda técnica."""

    def test_adds_entities_to_msp(self, gen):
        """add_legend deve adicionar entidades ao modelspace."""
        initial = len(gen.msp)
        gen.add_legend()
        assert len(gen.msp) > initial

    def test_contains_legenda_title(self, gen):
        """A legenda deve conter o título 'LEGENDA TÉCNICA'."""
        gen.add_legend()
        texts = [e.dxf.text for e in gen.msp if e.dxftype() in ('TEXT', 'MTEXT')]
        assert any('LEGENDA' in t for t in texts)

    def test_contains_layer_lines(self, gen):
        """A legenda deve conter linhas representando os layers."""
        gen.add_legend()
        lines = [e for e in gen.msp if e.dxftype() == 'LINE']
        assert len(lines) > 0

    def test_canonical_legend_items(self, gen_canonical):
        """Legenda com coords canônicas deve conter itens padrão."""
        gen_canonical.add_legend()
        texts = [e.dxf.text for e in gen_canonical.msp if e.dxftype() in ('TEXT', 'MTEXT')]
        expected_items = ['EDIFICAÇÕES', 'VIAS / RUAS', 'VEGETAÇÃO']
        for item in expected_items:
            assert any(item in t for t in texts), f"'{item}' não encontrado na legenda"


# ─── add_title_block ─────────────────────────────────────────────────────────

class TestAddTitleBlock:
    """Testa o carimbo ABNT NBR 10582 no Paper Space."""

    def test_creates_viewport_in_layout(self, gen):
        """Deve criar viewport no layout Layout1."""
        gen.add_title_block(client="CLIENTE TESTE", project="PROJETO TESTE")
        layout = gen.doc.layout('Layout1')
        viewports = [e for e in layout if e.dxftype() == 'VIEWPORT']
        assert len(viewports) >= 1

    def test_creates_frame_in_layout(self, gen):
        """Deve criar moldura de papel (LWPOLYLINE) no Layout1."""
        gen.add_title_block(client="EMPRESA", project="OBRA")
        layout = gen.doc.layout('Layout1')
        polylines = [e for e in layout if e.dxftype() == 'LWPOLYLINE']
        assert len(polylines) >= 1

    def test_carimbo_contains_client_name(self, gen):
        """Carimbo deve conter o nome da empresa."""
        gen.add_title_block(client="PREFEITURA MUNICIPAL", project="URBANISMO")
        layout = gen.doc.layout('Layout1')
        all_texts = [e.dxf.text for e in layout if e.dxftype() in ('TEXT', 'MTEXT')]
        assert any('PREFEITURA MUNICIPAL' in t for t in all_texts)

    def test_carimbo_contains_project_name(self, gen):
        """Carimbo deve conter o nome do projeto."""
        gen.add_title_block(client="EMPRESA", project="plano diretor urbano")
        layout = gen.doc.layout('Layout1')
        all_texts = [e.dxf.text for e in layout if e.dxftype() in ('TEXT', 'MTEXT')]
        # project é convertido para uppercase no código
        assert any('PLANO DIRETOR URBANO' in t for t in all_texts)

    def test_zero_bounds_uses_drawing_extent(self, gen):
        """Bounds zero deve usar drawing_extent_m para cálculo de escala."""
        gen.bounds = [0.0, 0.0, 0.0, 0.0]  # model_extent = 0 < 1 → usa drawing_extent_m * 2
        gen.add_title_block(
            client="TESTE",
            project="EXTRAÇÃO OSM",
            drawing_extent_m=500.0
        )
        layout = gen.doc.layout('Layout1')
        viewports = [e for e in layout if e.dxftype() == 'VIEWPORT']
        assert len(viewports) >= 1

    def test_abnt_fields_propagated(self, gen):
        """Todos os campos ABNT devem ser propagados ao carimbo."""
        gen.add_title_block(
            client="EMPRESA",
            project="PROJETO",
            designer="Eng. Silva",
            numero_desenho="MD-0042",
            verificado_por="Arq. Costa",
            aprovado_por="Dir. Lima",
            revisao="B",
            drawing_extent_m=200.0,
        )
        layout = gen.doc.layout('Layout1')
        all_texts = [e.dxf.text for e in layout if e.dxftype() in ('TEXT', 'MTEXT')]
        # Verifica campos-chave
        assert any('MD-0042' in t for t in all_texts), "numero_desenho não encontrado"
        assert any('Eng. Silva' in t for t in all_texts), "designer não encontrado"

    def test_canonical_coordinates_full_titleblock(self, gen_canonical, tmp_path):
        """Carimbo completo com coordenadas canônicas + audit headless."""
        gen_canonical.add_title_block(
            client="PREFEITURA DE MURIAÉ",
            project="PLANO DIRETOR URBANO",
            designer="sisRUA AI",
            numero_desenho="SR-2026-001",
            drawing_extent_m=200.0,
        )
        # Salvar e auditar DXF
        out = str(tmp_path / "canonical_carto.dxf")
        gen_canonical.doc.saveas(out)
        doc = ezdxf.readfile(out)
        auditor = doc.audit()
        assert not auditor.has_errors, (
            f"DXF com erros após add_title_block: {[e.message for e in auditor.errors]}"
        )

    def test_all_radii_title_blocks(self, tmp_path):
        """Testa carimbo para os 3 raios canônicos de teste (100m, 500m, 1km)."""
        e, n = float(TEST_UTM_E), float(TEST_UTM_N)
        for radius in TEST_RADII:
            g = DXFGenerator(str(tmp_path / f"carto_{radius}m.dxf"))
            g.diff_x = e
            g.diff_y = n
            g.bounds = [e - radius, n - radius, e + radius, n + radius]
            g._offset_initialized = True
            g.add_title_block(
                client="TESTE",
                project=f"RAIO {radius}M",
                drawing_extent_m=float(radius * 2),
            )
            layout = g.doc.layout('Layout1')
            assert len(list(layout)) > 0, f"Layout vazio para raio {radius}m"


# ─── Integração: fluxo completo de cartografia ───────────────────────────────

class TestCartographyIntegration:
    """Testa o fluxo completo de cartografia: grade + legenda + carimbo + audit."""

    def test_full_cartography_flow_headless(self, gen_canonical, tmp_path):
        """Fluxo completo de cartografia com audit headless do DXF gerado."""
        e, n = float(TEST_UTM_E), float(TEST_UTM_N)
        min_x, min_y = e - 100.0, n - 100.0
        max_x, max_y = e + 100.0, n + 100.0

        gen_canonical.add_coordinate_grid(min_x, min_y, max_x, max_y, e, n)
        gen_canonical.add_cartographic_elements(min_x, min_y, max_x, max_y, e, n)
        gen_canonical.add_legend()
        gen_canonical.add_title_block(
            client="PREFEITURA DE MURIAÉ",
            project="PLANO DIRETOR URBANO",
            designer="sisRUA AI",
            numero_desenho="SR-2026-001",
            drawing_extent_m=200.0,
        )

        out = str(tmp_path / "full_carto.dxf")
        gen_canonical.doc.saveas(out)

        doc = ezdxf.readfile(out)
        auditor = doc.audit()
        assert not auditor.has_errors, (
            f"DXF com erros estruturais: {[e.message for e in auditor.errors]}"
        )

        # Verifica que o Model Space tem entidades (legenda + grade)
        assert len(doc.modelspace()) > 0

        # Verifica que o Layout1 tem viewport (carimbo)
        layout = doc.layout('Layout1')
        viewports = [ent for ent in layout if ent.dxftype() == 'VIEWPORT']
        assert len(viewports) >= 1
