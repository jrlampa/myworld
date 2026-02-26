"""
dxf_abnt.py
Responsabilidade: conformidade com normas ABNT para geração DXF.
"""
import datetime
import math
from typing import Optional

try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

ABNT_PAPER_SIZES: dict[str, tuple[float, float]] = {
    'A0': (1189.0, 841.0),
    'A1': (841.0, 594.0),
    'A2': (594.0, 420.0),
    'A3': (420.0, 297.0),
    'A4': (297.0, 210.0),
}

ABNT_STANDARD_SCALES: list[int] = [
    1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500,
    1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000,
]

def compute_abnt_scale(drawing_extent_m: float, viewport_mm: float) -> int:
    if viewport_mm <= 0: return 1000
    raw_scale = (drawing_extent_m * 1000.0) / viewport_mm
    for candidate in ABNT_STANDARD_SCALES:
        if candidate >= raw_scale: return candidate
    return ABNT_STANDARD_SCALES[-1]

def format_abnt_scale(denominator: int) -> str:
    return f"1:{denominator}"

def select_paper_size(drawing_extent_m: float) -> str:
    if drawing_extent_m <= 200: return 'A4'
    if drawing_extent_m <= 500: return 'A3'
    if drawing_extent_m <= 1500: return 'A2'
    if drawing_extent_m <= 3000: return 'A1'
    return 'A0'

class ABNTTitleBlock:
    BLOCK_WIDTH = 170.0
    BLOCK_HEIGHT = 56.0
    LINE_H = 7.0
    COL_LEFT = 75.0
    COL_MID = 45.0
    
    LEFT_MARGIN = 20.0
    DEFAULT_MARGIN = 10.0

    def __init__(self, empresa: str = 'SISTOPO', projeto: str = 'LEVANTAMENTO TOPOGRÁFICO', 
                 numero_desenho: str = 'SR-0001', escala: str = '1:1000', elaborado_por: str = 'sisRUA AI',
                 verificado_por: str = '', aprovado_por: str = '', revisao: str = 'A',
                 folha_atual: int = 1, folha_total: int = 1, norma_ref: str = 'ABNT NBR 10582', data: Optional[str] = None):
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

    def draw_on_layout(self, layout, origin_x: float, origin_y: float) -> None:
        self._draw_border(layout, origin_x, origin_y)
        self._draw_fields(layout, origin_x, origin_y)

    def _add_line(self, layout, x1, y1, x2, y2):
        layout.add_line((x1, y1), (x2, y2), dxfattribs={'layer': 'sisTOPO_QUADRO', 'lineweight': 25})

    def _add_text(self, layout, text: str, x: float, y: float, height: float = 2.0):
        t = layout.add_text(text, dxfattribs={'height': height, 'style': 'PRO_STYLE', 'layer': 'sisTOPO_QUADRO'})
        t.dxf.halign = 0 # LEFT
        t.dxf.valign = 1 # MIDDLE
        t.dxf.insert = (x, y)
        t.dxf.align_point = (x, y)
        return t

    def _add_label(self, layout, label: str, value: str, x: float, y: float, lh: float = 7.0):
        self._add_text(layout, label, x + 1.0, y + lh - 1.5, height=1.5)
        self._add_text(layout, value, x + 1.0, y + lh / 2.0 - 0.5, height=2.5)

    def _draw_border(self, layout, ox: float, oy: float):
        bw, bh, lh, cl, cm = self.BLOCK_WIDTH, self.BLOCK_HEIGHT, self.LINE_H, self.COL_LEFT, self.COL_MID
        layout.add_lwpolyline([(ox, oy), (ox + bw, oy), (ox + bw, oy + bh), (ox, oy + bh)], close=True, dxfattribs={'layer': 'sisTOPO_QUADRO', 'lineweight': 50})
        self._add_line(layout, ox, oy + bh - lh, ox + bw, oy + bh - lh)
        self._add_line(layout, ox, oy + lh * 3, ox + bw, oy + lh * 3)
        self._add_line(layout, ox, oy + lh * 2, ox + cl, oy + lh * 2)
        self._add_line(layout, ox, oy + lh, ox + bw, oy + lh)
        self._add_line(layout, ox + cl, oy, ox + cl, oy + bh - lh)
        self._add_line(layout, ox + cl + cm, oy + lh, ox + cl + cm, oy + lh * 3)

    def _draw_fields(self, layout, ox: float, oy: float):
        bw, bh, lh, cl, cm = self.BLOCK_WIDTH, self.BLOCK_HEIGHT, self.LINE_H, self.COL_LEFT, self.COL_MID
        self._add_text(layout, self.empresa, ox + 2.0, oy + bh - lh / 2.0, height=3.5)
        self._add_label(layout, 'PROJETO/TÍTULO', self.projeto, ox, oy + lh * 3, lh=lh * 3)
        self._add_label(layout, 'NÚMERO DO DESENHO', self.numero_desenho, ox + cl, oy + lh * 3, lh=lh)
        self._add_label(layout, 'REV.', self.revisao, ox + cl + cm, oy + lh * 3, lh=lh)
        self._add_label(layout, 'ESCALA', self.escala, ox + cl, oy + lh * 2, lh=lh)
        self._add_label(layout, 'FOLHA', f"{self.folha_atual}/{self.folha_total}", ox + cl + cm, oy + lh * 2, lh=lh)
        self._add_label(layout, 'ELABORADO POR', self.elaborado_por, ox + cl, oy + lh, lh=lh)
        self._add_label(layout, 'DATA', self.data, ox + cl + cm, oy + lh, lh=lh)
        col_w3 = (bw - cl) / 3.0
        self._add_label(layout, 'VERIFICADO', self.verificado_por or '—', ox + cl, oy, lh=lh)
        self._add_label(layout, 'APROVADO', self.aprovado_por or '—', ox + cl + col_w3, oy, lh=lh)
        self._add_label(layout, 'NORMA', self.norma_ref, ox + cl + col_w3 * 2.0, oy, lh=lh)
