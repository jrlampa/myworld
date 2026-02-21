"""
dxf_cartography.py
Responsabilidade: elementos cartográficos do DXF (grade de coordenadas,
legenda, carimbo/title block, norte e escala).
"""
import math
import datetime
import numpy as np
from ezdxf.enums import TextEntityAlignment
try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger


class DXFCartographyMixin:
    """Mixin com métodos cartográficos para o gerador DXF do sisRUA."""

    def add_cartographic_elements(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Adiciona Rosa dos Ventos e Escala gráfica ao desenho."""
        try:
            margin = 10.0
            na_x = self._safe_v(max_x - diff_x - margin)
            na_y = self._safe_v(max_y - diff_y - margin)
            self.msp.add_blockref('NORTE', (na_x, na_y))

            sb_x = self._safe_v(max_x - diff_x - 30.0)
            sb_y = self._safe_v(min_y - diff_y + margin)
            self.msp.add_blockref('ESCALA', (sb_x, sb_y))
        except Exception as e:
            Logger.info(f"Elementos cartográficos falharam: {e}")

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Desenha quadro de delimitação com rótulos de coordenadas."""
        min_x, max_x = self._safe_v(min_x), self._safe_v(max_x)
        min_y, max_y = self._safe_v(min_y), self._safe_v(max_y)
        diff_x, diff_y = self._safe_v(diff_x), self._safe_v(diff_y)

        frame_pts = [
            (min_x - diff_x - 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, max_y - diff_y + 5),
            (min_x - diff_x - 5, max_y - diff_y + 5)
        ]
        self.msp.add_lwpolyline(frame_pts, close=True, dxfattribs={'layer': 'QUADRO', 'color': 7})

        step = 50.0
        x_range = np.arange(np.floor(min_x / step) * step, max_x + 1, step)
        for x in x_range[:50]:
            dx = self._safe_v(x - diff_x)
            if min_x - 5 <= x <= max_x + 5:
                try:
                    self.msp.add_text(
                        f"E: {x:.0f}",
                        dxfattribs={'height': 2, 'layer': 'QUADRO'}
                    ).set_placement((dx, min_y - diff_y - 8), align=TextEntityAlignment.CENTER)
                except Exception as e:
                    Logger.error(f"Erro ao adicionar rótulo do eixo X em {x}: {e}")

        y_range = np.arange(np.floor(min_y / step) * step, max_y + 1, step)
        for y in y_range[:50]:
            dy = self._safe_v(y - diff_y)
            if min_y - 5 <= y <= max_y + 5:
                try:
                    self.msp.add_text(
                        f"N: {y:.0f}",
                        dxfattribs={'height': 2, 'layer': 'QUADRO', 'rotation': 90.0}
                    ).set_placement((min_x - diff_x - 8, dy), align=TextEntityAlignment.CENTER)
                except Exception as e:
                    Logger.error(f"Erro ao adicionar rótulo do eixo Y em {y}: {e}")

    def add_legend(self):
        """Adiciona legenda técnica ao Model Space."""
        min_x, min_y, max_x, max_y = self.bounds
        start_x = self._safe_v(max_x - self.diff_x + 20)
        start_y = self._safe_v(max_y - self.diff_y)

        self.msp.add_text(
            "LEGENDA TÉCNICA",
            dxfattribs={'height': 4, 'style': 'PRO_STYLE', 'layer': 'QUADRO'}
        ).set_placement((start_x, start_y))

        items = [
            ("EDIFICAÇÕES", "EDIFICACAO", 5),
            ("VIAS / RUAS", "VIAS", 1),
            ("MEIO-FIO", "VIAS_MEIO_FIO", 9),
            ("VEGETAÇÃO", "VEGETACAO", 3),
            ("ILUMINAÇÃO PÚBLICA", "MOBILIARIO_URBANO", 2),
            ("REDE ELÉTRICA (AT)", "INFRA_POWER_HV", 1),
            ("REDE ELÉTRICA (BT)", "INFRA_POWER_LV", 30),
            ("TELECOMUNICAÇÕES", "INFRA_TELECOM", 90),
            ("CURVAS DE NÍVEL", "TOPOGRAFIA_CURVAS", 8)
        ]

        y_offset = -10
        for label, layer, color in items:
            self.msp.add_line(
                (start_x, start_y + y_offset),
                (start_x + 10, start_y + y_offset),
                dxfattribs={'layer': layer, 'color': color}
            )
            self.msp.add_text(
                label,
                dxfattribs={'height': 2.5, 'layer': 'QUADRO'}
            ).set_placement((start_x + 12, start_y + y_offset - 1))
            y_offset -= 8

    def add_title_block(self, client="N/A", project="Projeto Urbanístico", designer="sisRUA AI"):
        """Cria carimbo profissional A3 no Paper Space."""
        layout = self.doc.layout('Layout1')
        width, height = 420, 297

        layout.add_lwpolyline(
            [(0, 0), (width, 0), (width, height), (0, height)],
            close=True,
            dxfattribs={'layer': 'QUADRO', 'lineweight': 50}
        )

        cx = (self.bounds[0] + self.bounds[2]) / 2
        cy = (self.bounds[1] + self.bounds[3]) / 2
        view_x = cx - self.diff_x
        view_y = cy - self.diff_y

        v_height = max(abs(self.bounds[2] - self.bounds[0]), abs(self.bounds[3] - self.bounds[1])) * 1.2
        if v_height < 50:
            v_height = 200

        vp = layout.add_viewport(
            center=(width / 2, height / 2 + 20),
            size=(width - 40, height - 80),
            view_center_point=(view_x, view_y),
            view_height=200
        )
        vp.dxf.status = 1

        cb_x, cb_y = width - 185, 0
        cb_w, cb_h = 185, 50

        layout.add_lwpolyline(
            [(cb_x, cb_y), (cb_x + cb_w, cb_y), (cb_x + cb_w, cb_y + cb_h), (cb_x, cb_y + cb_h)],
            close=True,
            dxfattribs={'layer': 'QUADRO'}
        )
        layout.add_line((cb_x, cb_y + 25), (cb_x + cb_w, cb_y + 25), dxfattribs={'layer': 'QUADRO'})
        layout.add_line((cb_x + 100, cb_y), (cb_x + 100, cb_y + 25), dxfattribs={'layer': 'QUADRO'})

        date_str = datetime.date.today().strftime("%d/%m/%Y")
        p_name = str(project).upper()
        c_name = str(client)
        d_name = str(designer)

        def add_layout_text(text, pos, height, style='PRO_STYLE'):
            t = layout.add_text(text, dxfattribs={'height': height, 'style': style})
            t.dxf.halign = 0
            t.dxf.valign = 0
            t.dxf.insert = pos
            t.dxf.align_point = pos
            return t

        add_layout_text(f"PROJETO: {p_name[:50]}", (cb_x + 5, cb_y + 35), 4)
        add_layout_text(f"CLIENTE: {c_name[:50]}", (cb_x + 5, cb_y + 15), 3)
        add_layout_text(f"DATA: {date_str}", (cb_x + 105, cb_y + 15), 2.5)
        add_layout_text("ENGINE: sisRUA Unified v1.5", (cb_x + 105, cb_y + 5), 2)
        add_layout_text(f"RESPONSÁVEL: {d_name[:50]}", (cb_x + 5, cb_y + 5), 2.5)

        try:
            layout.add_blockref('LOGO', (cb_x + cb_w - 20, cb_y + cb_h - 10))
        except Exception as e:
            Logger.error(f"Erro ao adicionar referência de bloco LOGO: {e}")
