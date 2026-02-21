"""
dxf_cartography.py
Responsabilidade: elementos cartográficos do DXF (grade de coordenadas,
legenda, carimbo/title block, norte e escala).
"""
import math
import numpy as np
from ezdxf.enums import TextEntityAlignment
try:
    from .utils.logger import Logger
    from .dxf_abnt import ABNTTitleBlock, compute_abnt_scale, format_abnt_scale, select_paper_size, ABNT_PAPER_SIZES  # pragma: no cover
except (ImportError, ValueError):
    from utils.logger import Logger
    from dxf_abnt import ABNTTitleBlock, compute_abnt_scale, format_abnt_scale, select_paper_size, ABNT_PAPER_SIZES


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

    def add_title_block(
        self,
        client: str = "N/A",
        project: str = "Projeto Urbanístico",
        designer: str = "sisRUA AI",
        numero_desenho: str = "SR-0001",
        verificado_por: str = "",
        aprovado_por: str = "",
        revisao: str = "A",
        drawing_extent_m: float = 500.0,
    ):
        """Cria carimbo ABNT NBR 10582 no Paper Space com escala ABNT NBR 8196."""
        layout = self.doc.layout('Layout1')

        # Seleciona formato de papel conforme ABNT NBR 13142
        paper_code = select_paper_size(drawing_extent_m)
        width, height = ABNT_PAPER_SIZES[paper_code]

        # Borda externa da folha
        layout.add_lwpolyline(
            [(0, 0), (width, 0), (width, height), (0, height)],
            close=True,
            dxfattribs={'layer': 'QUADRO', 'lineweight': 50}
        )

        # Viewport — posiciona o modelo no papel
        cx = (self.bounds[0] + self.bounds[2]) / 2
        cy = (self.bounds[1] + self.bounds[3]) / 2
        view_x = cx - self.diff_x
        view_y = cy - self.diff_y

        tb_h = ABNTTitleBlock.BLOCK_HEIGHT
        viewport_h = height - tb_h - 20.0
        viewport_w = width - 20.0

        # Calcula escala ABNT NBR 8196
        model_extent = max(
            abs(self.bounds[2] - self.bounds[0]),
            abs(self.bounds[3] - self.bounds[1]),
        )
        if model_extent < 1.0:
            model_extent = drawing_extent_m * 2.0
        scale_denom = compute_abnt_scale(model_extent, min(viewport_w, viewport_h))
        scale_str = format_abnt_scale(scale_denom)

        # view_height é o tamanho real do modelo que deve caber no viewport
        view_h = (viewport_h / 1000.0) * scale_denom  # mm → m convertido para escala

        try:
            vp = layout.add_viewport(
                center=(width / 2, (height + tb_h) / 2),
                size=(viewport_w, viewport_h),
                view_center_point=(view_x, view_y),
                view_height=max(view_h, 50.0),
            )
            vp.dxf.status = 1
        except Exception as exc:
            Logger.error(f"Erro ao criar viewport ABNT: {exc}")

        # Posiciona o carimbo ABNT no canto inferior direito
        cb_x = width - ABNTTitleBlock.BLOCK_WIDTH
        cb_y = 0.0

        title_block = ABNTTitleBlock(
            empresa=client,
            projeto=str(project).upper(),
            numero_desenho=numero_desenho,
            escala=scale_str,
            elaborado_por=designer,
            verificado_por=verificado_por,
            aprovado_por=aprovado_por,
            revisao=revisao,
        )
        title_block.draw_on_layout(layout, cb_x, cb_y)
