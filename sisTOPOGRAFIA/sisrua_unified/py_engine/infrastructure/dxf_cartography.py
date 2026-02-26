"""
dxf_cartography.py
Responsabilidade: elementos cartográficos do DXF.
"""
import math
import numpy as np
from ezdxf.enums import TextEntityAlignment

try:
    from .dxf_abnt import ABNTTitleBlock, compute_abnt_scale, format_abnt_scale, select_paper_size, ABNT_PAPER_SIZES
    from .utils.logger import Logger
    from constants import *
except (ImportError, ValueError):
    from infrastructure.dxf_abnt import ABNTTitleBlock, compute_abnt_scale, format_abnt_scale, select_paper_size, ABNT_PAPER_SIZES
    from utils.logger import Logger
    from constants import *

class DXFCartographyMixin:
    def add_cartographic_elements(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        try:
            margin = 5.0
            na_x = max_x - diff_x - margin
            na_y = max_y - diff_y - margin
            self.msp.add_blockref('NORTE', (na_x, na_y))
            sb_x = max_x - diff_x - 30.0
            sb_y = min_y - diff_y + margin
            self.msp.add_blockref('ESCALA', (sb_x, sb_y))
        except Exception as e:
            Logger.info(f"Cartographic elements failed: {e}")

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        frame_pts = [
            (min_x - diff_x - 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, max_y - diff_y + 5),
            (min_x - diff_x - 5, max_y - diff_y + 5)
        ]
        self.msp.add_lwpolyline(frame_pts, close=True, dxfattribs={'layer': 'sisTOPO_QUADRO', 'color': 7})
        step = 50.0
        x_range = np.arange(np.floor(min_x / step) * step, max_x + 1, step)
        for x in x_range[:50]:
            dx = x - diff_x
            if min_x - 5 <= x <= max_x + 5:
                self.msp.add_text(f"E: {x:.0f}", dxfattribs={'height': 2, 'layer': 'sisTOPO_QUADRO'}).set_placement((dx, min_y - diff_y - 8), align=TextEntityAlignment.MIDDLE_CENTER)

        y_range = np.arange(np.floor(min_y / step) * step, max_y + 1, step)
        for y in y_range[:50]:
            dy = y - diff_y
            if min_y - 5 <= y <= max_y + 5:
                self.msp.add_text(f"N: {y:.0f}", dxfattribs={'height': 2, 'layer': 'sisTOPO_QUADRO', 'rotation': 90.0}).set_placement((min_x - diff_x - 8, dy), align=TextEntityAlignment.MIDDLE_CENTER)

    def add_legend(self):
        min_x, min_y, max_x, max_y = self.bounds
        start_x = max_x - self.diff_x + 20
        start_y = max_y - self.diff_y
        self.msp.add_text("LEGENDA TÉCNICA", dxfattribs={'height': 4, 'style': 'PRO_STYLE', 'layer': 'sisTOPO_QUADRO'}).set_placement((start_x, start_y))
        items = [
            ("EDIFICAÇÕES", LAYER_EDIFICACAO, 7),
            ("VIAS / RUAS", LAYER_VIAS, 8),
            ("MEIO-FIO", LAYER_VIAS_MEIO_FIO, 251),
            ("VEGETAÇÃO", LAYER_VEGETACAO, 3),
            ("PRODIST (HV)", LAYER_PRODIST_FAIXA_HV, 1),
            ("CURVAS DE NÍVEL", LAYER_TOPOGRAFIA_CURVAS, 252)
        ]
        y_offset = -10
        for label, layer, color in items:
            self.msp.add_line((start_x, start_y + y_offset), (start_x + 10, start_y + y_offset), dxfattribs={'layer': layer, 'color': color})
            self.msp.add_text(label, dxfattribs={'height': 2.5, 'layer': 'sisTOPO_QUADRO'}).set_placement((start_x + 12, start_y + y_offset - 1))
            y_offset -= 8

    def add_title_block(self, client="N/A", project="Projeto Urbanístico", designer="sisRUA AI", numero_desenho="SR-0001"):
        layout = self.doc.layout('Layout1')
        model_extent = max(abs(self.bounds[2] - self.bounds[0]), abs(self.bounds[3] - self.bounds[1]))
        paper_code = select_paper_size(model_extent)
        width, height = ABNT_PAPER_SIZES[paper_code]
        
        lm = ABNTTitleBlock.LEFT_MARGIN
        dm = ABNTTitleBlock.DEFAULT_MARGIN
        p1 = (lm, dm)
        p2 = (width - dm, dm)
        p3 = (width - dm, height - dm)
        p4 = (lm, height - dm)
        layout.add_lwpolyline([p1, p2, p3, p4], close=True, dxfattribs={'layer': 'sisTOPO_QUADRO', 'lineweight': 50})
        
        cx, cy = (self.bounds[0] + self.bounds[2]) / 2, (self.bounds[1] + self.bounds[3]) / 2
        view_x, view_y = cx - self.diff_x, cy - self.diff_y
        tb_h = ABNTTitleBlock.BLOCK_HEIGHT
        tb_w = ABNTTitleBlock.BLOCK_WIDTH
        
        draw_w = width - lm - dm
        draw_h = height - dm * 2
        
        viewport_w = draw_w
        viewport_h = draw_h - tb_h
        vp_cx = lm + viewport_w / 2
        vp_cy = dm + tb_h + viewport_h / 2
        
        scale_denom = compute_abnt_scale(model_extent, min(viewport_w, viewport_h))
        view_h = (viewport_h / 1000.0) * scale_denom
        try:
            vp = layout.add_viewport(center=(vp_cx, vp_cy), size=(viewport_w, viewport_h), view_center_point=(view_x, view_y), view_height=max(view_h, 50.0))
            vp.dxf.status = 1
        except: pass
        
        tb_ox = width - dm - tb_w
        tb_oy = dm
        title_block = ABNTTitleBlock(empresa=client, projeto=project, numero_desenho=numero_desenho, escala=f"1:{scale_denom}", elaborado_por=designer)
        title_block.draw_on_layout(layout, tb_ox, tb_oy)
