"""
dxf_abnt.py
Responsabilidade: conformidade com normas ABNT para geração DXF.

Normas implementadas:
  - ABNT NBR 8196:1999  — Escalas recomendadas para desenho técnico
  - ABNT NBR 10582:1988 — Apresentação da folha para desenho técnico
  - ABNT NBR 13142:1999 — Formatos e margens de folhas para desenho técnico
"""
import datetime
import math
from typing import Optional

try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

# ---------------------------------------------------------------------------
# ABNT NBR 13142 — Formatos de folha (mm)
# ---------------------------------------------------------------------------
ABNT_PAPER_SIZES: dict[str, tuple[float, float]] = {
    'A0': (1189.0, 841.0),
    'A1': (841.0, 594.0),
    'A2': (594.0, 420.0),
    'A3': (420.0, 297.0),
    'A4': (297.0, 210.0),
}

# Margens ABNT NBR 10582 (mm): esquerda, direita, superior, inferior
ABNT_MARGINS: dict[str, tuple[float, float, float, float]] = {
    'A0': (25.0, 10.0, 10.0, 10.0),
    'A1': (25.0, 10.0, 10.0, 10.0),
    'A2': (25.0, 7.0, 7.0, 7.0),
    'A3': (25.0, 7.0, 7.0, 7.0),
    'A4': (25.0, 7.0, 7.0, 7.0),
}

# ---------------------------------------------------------------------------
# ABNT NBR 8196 — Escalas recomendadas para desenho técnico (redução)
# ---------------------------------------------------------------------------
ABNT_STANDARD_SCALES: list[int] = [
    1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500,
    1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000,
]


def compute_abnt_scale(drawing_extent_m: float, viewport_mm: float) -> int:
    """
    Calcula a escala ABNT NBR 8196 mais adequada para o desenho.

    A escala é dada pelo fator N em '1:N', onde:
      N = extent_modelo (mm em escala real) / tamanho_viewport (mm)

    Como o modelo usa coordenadas em metros (UTM), convertemos para mm
    multiplicando por 1000 antes de dividir pelo tamanho do viewport.

    Args:
        drawing_extent_m: dimensão máxima do modelo em metros (ex.: 500.0 para raio 500m)
        viewport_mm: dimensão do viewport no papel em mm (ex.: 370.0 para A3 menos margens)

    Returns:
        Denominador da escala ABNT NBR 8196 mais próximo (ex.: 1000 para 1:1000)
    """
    if viewport_mm <= 0:
        return 1000  # fallback seguro

    raw_scale = (drawing_extent_m * 1000.0) / viewport_mm

    # Seleciona o menor denominador padrão >= raw_scale
    for candidate in ABNT_STANDARD_SCALES:
        if candidate >= raw_scale:
            return candidate

    return ABNT_STANDARD_SCALES[-1]


def format_abnt_scale(denominator: int) -> str:
    """Retorna string de escala no formato ABNT: '1:1000'."""
    return f"1:{denominator}"


def select_paper_size(drawing_extent_m: float) -> str:
    """
    Seleciona o formato de papel ABNT NBR 13142 mais adequado
    com base na extensão do desenho (raio em metros).

    Args:
        drawing_extent_m: maior dimensão do modelo em metros

    Returns:
        Código do formato de papel ('A0', 'A1', 'A2', 'A3', 'A4')
    """
    # Para cada formato, verifica se a escala mínima padrão cabe no papel
    # Heurística: preferir A3 para uso padrão; escalar para cima conforme necessário
    if drawing_extent_m <= 200:
        return 'A4'
    if drawing_extent_m <= 500:
        return 'A3'
    if drawing_extent_m <= 1500:
        return 'A2'
    if drawing_extent_m <= 3000:
        return 'A1'
    return 'A0'


# ---------------------------------------------------------------------------
# ABNT NBR 10582 — Carimbo (Legenda) padrão
# ---------------------------------------------------------------------------
class ABNTTitleBlock:
    """
    Gera o carimbo (legenda) de acordo com ABNT NBR 10582:1988.

    Campos obrigatórios:
      - empresa: nome da empresa/organização
      - projeto: título do projeto/desenho
      - numero_desenho: código alfanumérico do desenho
      - escala: string no formato ABNT (ex.: '1:1000')
      - data: data de emissão
      - elaborado_por: responsável pelo desenho
      - folha_atual / folha_total: numeração de folhas

    Campos opcionais:
      - verificado_por: responsável pela verificação
      - aprovado_por: responsável pela aprovação
      - revisao: letra de revisão ('A', 'B', ...)
      - norma_ref: norma de referência (ex.: 'ABNT NBR 10582')
    """

    # Dimensões padrão do carimbo em mm (ABNT NBR 10582 Figura 2 — carimbo tipo A)
    BLOCK_WIDTH = 185.0
    BLOCK_HEIGHT = 56.0
    LINE_H = 7.0        # altura de cada linha interna
    COL_LEFT = 85.0     # largura da coluna esquerda (campos principais)
    COL_MID = 50.0      # largura da coluna central
    # Coluna direita = BLOCK_WIDTH - COL_LEFT - COL_MID

    def __init__(
        self,
        empresa: str = 'sisRUA UNIFIED',
        projeto: str = 'EXTRAÇÃO ESPACIAL OSM',
        numero_desenho: str = 'SR-0001',
        escala: str = '1:1000',
        elaborado_por: str = 'sisRUA AI',
        verificado_por: str = '',
        aprovado_por: str = '',
        revisao: str = 'A',
        folha_atual: int = 1,
        folha_total: int = 1,
        norma_ref: str = 'ABNT NBR 10582',
        data: Optional[str] = None,
    ) -> None:
        self.empresa = str(empresa)[:60]
        self.projeto = str(projeto)[:80]
        self.numero_desenho = str(numero_desenho)[:20]
        self.escala = str(escala)[:15]
        self.elaborado_por = str(elaborado_por)[:40]
        self.verificado_por = str(verificado_por)[:40]
        self.aprovado_por = str(aprovado_por)[:40]
        self.revisao = str(revisao)[:3].upper()
        self.folha_atual = max(1, int(folha_atual))
        self.folha_total = max(1, int(folha_total))
        self.norma_ref = str(norma_ref)[:30]
        self.data = data or datetime.date.today().strftime('%d/%m/%Y')

    @property
    def folha_str(self) -> str:
        """Retorna string 'X/Y' conforme ABNT NBR 10582."""
        return f"{self.folha_atual}/{self.folha_total}"

    def draw_on_layout(self, layout, origin_x: float, origin_y: float) -> None:
        """
        Desenha o carimbo completo no layout (paper space) do ezdxf.

        Args:
            layout: layout do ezdxf onde o carimbo será inserido
            origin_x: coordenada X do canto inferior esquerdo do carimbo (mm)
            origin_y: coordenada Y do canto inferior esquerdo do carimbo (mm)
        """
        try:
            self._draw_border(layout, origin_x, origin_y)
            self._draw_fields(layout, origin_x, origin_y)
        except Exception as exc:
            Logger.error(f"Erro ao desenhar carimbo ABNT: {exc}")

    # ------------------------------------------------------------------
    # helpers privados
    # ------------------------------------------------------------------

    def _add_line(self, layout, x1, y1, x2, y2):
        layout.add_line(
            (x1, y1), (x2, y2),
            dxfattribs={'layer': 'QUADRO', 'lineweight': 25}
        )

    def _add_text(self, layout, text: str, x: float, y: float, height: float = 2.0, bold: bool = False):
        style = 'PRO_STYLE'
        t = layout.add_text(text, dxfattribs={'height': height, 'style': style, 'layer': 'QUADRO'})
        t.dxf.halign = 0   # LEFT
        t.dxf.valign = 1   # MIDDLE
        t.dxf.insert = (x, y)
        t.dxf.align_point = (x, y)
        return t

    def _add_label(self, layout, label: str, value: str, x: float, y: float, lh: float = LINE_H):
        """Adiciona par rótulo+valor dentro de uma célula."""
        # Rótulo pequeno no topo da célula
        self._add_text(layout, label, x + 1.0, y + lh - 1.5, height=1.5)
        # Valor maior abaixo do rótulo
        self._add_text(layout, value, x + 1.0, y + lh / 2.0 - 0.5, height=2.5)

    def _draw_border(self, layout, ox: float, oy: float):
        """Desenha o retângulo externo e as linhas internas do carimbo."""
        bw = self.BLOCK_WIDTH
        bh = self.BLOCK_HEIGHT
        lh = self.LINE_H
        cl = self.COL_LEFT
        cm = self.COL_MID

        # Retângulo externo (linha grossa per NBR)
        layout.add_lwpolyline(
            [(ox, oy), (ox + bw, oy), (ox + bw, oy + bh), (ox, oy + bh)],
            close=True,
            dxfattribs={'layer': 'QUADRO', 'lineweight': 50}
        )

        # Linha horizontal: separação do campo empresa (linha topo)
        self._add_line(layout, ox, oy + bh - lh, ox + bw, oy + bh - lh)

        # Linhas horizontais internas (3 linhas → 4 faixas)
        self._add_line(layout, ox, oy + lh * 3, ox + bw, oy + lh * 3)
        self._add_line(layout, ox, oy + lh * 2, ox + cl, oy + lh * 2)
        self._add_line(layout, ox, oy + lh,     ox + bw, oy + lh)

        # Linhas verticais
        self._add_line(layout, ox + cl, oy, ox + cl, oy + bh - lh)
        self._add_line(layout, ox + cl + cm, oy + lh, ox + cl + cm, oy + lh * 3)

    def _draw_fields(self, layout, ox: float, oy: float):
        """Preenche os campos do carimbo com os dados do projeto."""
        bw = self.BLOCK_WIDTH
        bh = self.BLOCK_HEIGHT
        lh = self.LINE_H
        cl = self.COL_LEFT
        cm = self.COL_MID

        # Faixa superior — Nome da empresa (toda a largura)
        self._add_text(layout, self.empresa, ox + 2.0, oy + bh - lh / 2.0, height=3.5)

        # Coluna esquerda — Título do projeto (ocupa faixas 2+3+4 juntas)
        proj_y = oy + lh + (bh - lh - lh - lh) / 2.0  # centro das 3 faixas
        self._add_label(layout, 'PROJETO/TÍTULO', self.projeto, ox, oy + lh * 3, lh=lh * 3)

        # Coluna central/direita — campos detalhados por faixa

        # Faixa 4 (topo após empresa): Número do desenho | Revisão
        self._add_label(layout, 'NÚMERO DO DESENHO', self.numero_desenho, ox + cl, oy + lh * 3, lh=lh)
        self._add_label(layout, 'REV.', self.revisao, ox + cl + cm, oy + lh * 3, lh=lh)

        # Faixa 3: Escala | Folha
        self._add_label(layout, 'ESCALA', self.escala, ox + cl, oy + lh * 2, lh=lh)
        self._add_label(layout, 'FOLHA', self.folha_str, ox + cl + cm, oy + lh * 2, lh=lh)

        # Faixa 2: Elaborado por | Data
        self._add_label(layout, 'ELABORADO POR', self.elaborado_por, ox + cl, oy + lh, lh=lh)
        self._add_label(layout, 'DATA', self.data, ox + cl + cm, oy + lh, lh=lh)

        # Faixa 1 (inferior): Verificado / Aprovado / Norma
        col_w3 = (bw - cl) / 3.0
        self._add_label(layout, 'VERIFICADO', self.verificado_por or '—', ox + cl, oy, lh=lh)
        self._add_label(layout, 'APROVADO', self.aprovado_por or '—', ox + cl + col_w3, oy, lh=lh)
        self._add_label(layout, 'NORMA', self.norma_ref, ox + cl + col_w3 * 2.0, oy, lh=lh)
