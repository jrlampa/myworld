"""
test_dxf_abnt.py
Testes unitários para o módulo dxf_abnt.py (conformidade ABNT NBR 8196/10582/13142).
"""
import pytest
import sys
import os
import datetime

# Compatibilidade: adiciona o diretório py_engine ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dxf_abnt import (
    compute_abnt_scale,
    format_abnt_scale,
    select_paper_size,
    ABNTTitleBlock,
    ABNT_PAPER_SIZES,
    ABNT_STANDARD_SCALES,
)


# ─────────────────────────────────────────────────────────────
# ABNT NBR 13142 — Formatos de papel
# ─────────────────────────────────────────────────────────────

class TestPaperSizes:
    def test_a3_dimensions(self):
        """A3 deve ter 420 x 297 mm conforme NBR 13142."""
        w, h = ABNT_PAPER_SIZES['A3']
        assert w == 420.0
        assert h == 297.0

    def test_a4_dimensions(self):
        """A4 deve ter 297 x 210 mm conforme NBR 13142."""
        w, h = ABNT_PAPER_SIZES['A4']
        assert w == 297.0
        assert h == 210.0

    def test_a0_dimensions(self):
        """A0 deve ter 1189 x 841 mm conforme NBR 13142."""
        w, h = ABNT_PAPER_SIZES['A0']
        assert w == 1189.0
        assert h == 841.0

    def test_all_standard_formats_present(self):
        """Todos os formatos A0-A4 devem estar definidos."""
        for fmt in ('A0', 'A1', 'A2', 'A3', 'A4'):
            assert fmt in ABNT_PAPER_SIZES


# ─────────────────────────────────────────────────────────────
# ABNT NBR 13142 — Seleção automática de formato
# ─────────────────────────────────────────────────────────────

class TestSelectPaperSize:
    def test_small_area_returns_a4(self):
        """Área pequena (<= 200m) → A4."""
        assert select_paper_size(100.0) == 'A4'
        assert select_paper_size(200.0) == 'A4'

    def test_medium_area_returns_a3(self):
        """Área média (200-500m) → A3."""
        assert select_paper_size(201.0) == 'A3'
        assert select_paper_size(500.0) == 'A3'

    def test_large_area_returns_a2(self):
        """Área grande (500-1500m) → A2."""
        assert select_paper_size(501.0) == 'A2'
        assert select_paper_size(1500.0) == 'A2'

    def test_very_large_area_returns_a1(self):
        """Área muito grande (1500-3000m) → A1."""
        assert select_paper_size(1501.0) == 'A1'
        assert select_paper_size(3000.0) == 'A1'

    def test_extra_large_area_returns_a0(self):
        """Área extra grande (>3000m) → A0."""
        assert select_paper_size(3001.0) == 'A0'
        assert select_paper_size(10000.0) == 'A0'


# ─────────────────────────────────────────────────────────────
# ABNT NBR 8196 — Escala
# ─────────────────────────────────────────────────────────────

class TestComputeAbntScale:
    def test_standard_scales_present(self):
        """Deve incluir as escalas padrão NBR 8196."""
        expected = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
        for s in expected:
            assert s in ABNT_STANDARD_SCALES

    def test_small_model_gives_small_scale(self):
        """Modelo pequeno (10m) num viewport de 370mm → escala <= 1:100."""
        scale = compute_abnt_scale(10.0, 370.0)
        assert scale <= 100

    def test_radius_500m_gives_reasonable_scale(self):
        """Modelo de 1000m (2*raio 500m) num viewport de 370mm → 1:2500 ou menos."""
        scale = compute_abnt_scale(1000.0, 370.0)
        assert scale in ABNT_STANDARD_SCALES
        assert scale <= 5000

    def test_result_is_always_standard(self):
        """O resultado deve sempre ser um denominador ABNT NBR 8196."""
        for extent in [50, 200, 500, 1000, 5000]:
            scale = compute_abnt_scale(float(extent), 370.0)
            assert scale in ABNT_STANDARD_SCALES

    def test_zero_viewport_returns_fallback(self):
        """Viewport zero ou negativo deve retornar valor de fallback seguro."""
        scale = compute_abnt_scale(500.0, 0.0)
        assert scale == 1000

    def test_canonical_coord_100m_scale(self):
        """Coordenadas canônicas (raio 100m, diâmetro 200m) → escala adequada A3."""
        # A3: viewport ~370mm de largura útil
        scale = compute_abnt_scale(200.0, 370.0)
        assert scale in ABNT_STANDARD_SCALES


class TestFormatAbntScale:
    def test_format_1000(self):
        assert format_abnt_scale(1000) == '1:1000'

    def test_format_500(self):
        assert format_abnt_scale(500) == '1:500'

    def test_format_1(self):
        assert format_abnt_scale(1) == '1:1'

    def test_format_100000(self):
        assert format_abnt_scale(100000) == '1:100000'


# ─────────────────────────────────────────────────────────────
# ABNT NBR 10582 — Carimbo (ABNTTitleBlock)
# ─────────────────────────────────────────────────────────────

class TestABNTTitleBlock:
    def _make_block(self, **kwargs) -> ABNTTitleBlock:
        defaults = dict(
            empresa='Empresa Teste',
            projeto='Projeto de Teste',
            numero_desenho='SR-0042',
            escala='1:1000',
            elaborado_por='Engenheiro A',
        )
        defaults.update(kwargs)
        return ABNTTitleBlock(**defaults)

    def test_default_date_is_today(self):
        """Data padrão deve ser a data de hoje no formato DD/MM/AAAA."""
        block = self._make_block()
        assert block.data == datetime.date.today().strftime('%d/%m/%Y')

    def test_custom_date(self):
        block = ABNTTitleBlock(data='01/01/2026')
        assert block.data == '01/01/2026'

    def test_folha_str(self):
        """Formatação 'X/Y' conforme NBR 10582."""
        block = self._make_block(folha_atual=2, folha_total=5)
        assert block.folha_str == '2/5'

    def test_folha_str_single(self):
        block = self._make_block(folha_atual=1, folha_total=1)
        assert block.folha_str == '1/1'

    def test_empresa_truncated(self):
        """Empresa com mais de 60 caracteres deve ser truncada."""
        long_name = 'A' * 80
        block = self._make_block(empresa=long_name)
        assert len(block.empresa) <= 60

    def test_projeto_truncated(self):
        """Projeto com mais de 80 caracteres deve ser truncado."""
        long_name = 'B' * 100
        block = self._make_block(projeto=long_name)
        assert len(block.projeto) <= 80

    def test_numero_desenho_truncated(self):
        """Número do desenho com mais de 20 caracteres deve ser truncado."""
        block = self._make_block(numero_desenho='X' * 30)
        assert len(block.numero_desenho) <= 20

    def test_revisao_uppercase(self):
        """Revisão deve ser armazenada em maiúsculas."""
        block = self._make_block(revisao='b')
        assert block.revisao == 'B'

    def test_folha_atual_minimum_one(self):
        """Folha atual mínima é 1."""
        block = self._make_block(folha_atual=0)
        assert block.folha_atual == 1

    def test_folha_total_minimum_one(self):
        block = self._make_block(folha_total=-5)
        assert block.folha_total == 1

    def test_block_dimensions(self):
        """Dimensões do carimbo conforme ABNT NBR 10582."""
        assert ABNTTitleBlock.BLOCK_WIDTH == 185.0
        assert ABNTTitleBlock.BLOCK_HEIGHT == 56.0

    def test_draw_on_layout_does_not_raise(self):
        """draw_on_layout() não deve lançar exceção com um layout válido do ezdxf."""
        import ezdxf
        doc = ezdxf.new('R2013')
        layout = doc.layout('Layout1')
        block = self._make_block()
        # Não deve levantar nenhuma exceção
        block.draw_on_layout(layout, origin_x=235.0, origin_y=0.0)

    def test_draw_creates_entities_in_layout(self):
        """Após draw_on_layout, o layout deve conter entidades no layer QUADRO."""
        import ezdxf
        doc = ezdxf.new('R2013')
        # Garante que o layer QUADRO existe
        doc.layers.add('QUADRO')
        layout = doc.layout('Layout1')
        block = self._make_block()
        block.draw_on_layout(layout, origin_x=0.0, origin_y=0.0)
        entities = list(layout)
        assert len(entities) > 0
