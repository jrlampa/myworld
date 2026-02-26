from fpdf import FPDF
from fpdf.enums import XPos, YPos
import os
import datetime

try:
    from utils.logger import Logger
except ImportError:
    from ..utils.logger import Logger

_BLUE_DARK   = (30, 58, 138)
_BLUE_LIGHT  = (240, 244, 255)
_GRAY_BG     = (245, 245, 245)
_GRAY_TEXT   = (100, 100, 100)
_BLACK       = (0, 0, 0)
_WHITE       = (255, 255, 255)

class PdfAdapter(FPDF):
    """Subclasse FPDF com header/footer institucionais sisTOPOGRAFIA."""

    def header(self):
        self.set_fill_color(*_BLUE_DARK)
        self.rect(0, 0, 210, 40, 'F')
        self.set_font('helvetica', 'B', 24)
        self.set_text_color(*_WHITE)
        self.cell(0, 15, 'sisTOPOGRAFIA',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        self.set_font('helvetica', '', 10)
        self.cell(0, 5, 'ENGENHARIA E ANALISE GEOESPACIAL',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(*_GRAY_TEXT)
        ts = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
        self.cell(
            0, 10,
            f'Pagina {self.page_no()}/{{nb}} - Gerado por sisTOPOGRAFIA AI em {ts}',
            align='C'
        )

    def generate(self, data: dict, output_path: str) -> str:
        self.add_page()
        self.set_auto_page_break(auto=True, margin=15)

        self._section_project_info(data)
        self._section_topographic_summary(data.get('stats', {}))
        self._section_technical_recommendations()
        self._section_earthwork(data.get('stats', {}))
        self._certification_block()

        self.output(output_path)
        Logger.info(f"Laudo PDF gerado: {os.path.basename(output_path)}")
        return output_path

    def _section_project_info(self, data: dict) -> None:
        self.set_font('helvetica', 'B', 16)
        self.set_text_color(*_BLUE_DARK)
        self.cell(0, 10, 'LAUDO TECNICO DE ANALISE TOPOGRAFICA',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        self.ln(5)

        self.set_fill_color(*_BLUE_LIGHT)
        info = [
            ('Projeto:',             data.get('project_names', 'N/A') if 'project_names' in data else data.get('project_name', 'N/A')),
            ('Cliente:',             data.get('client', 'CLIENTE PADRAO')),
            ('Localizacao:',         data.get('location_label', 'N/A')),
            ('Data do Levantamento:', datetime.date.today().strftime("%d/%m/%Y")),
            ('Referencia:',          'SIRGAS 2000 / Georeferenciado'),
        ]
        for label, value in info:
            self.set_font('helvetica', 'B', 10)
            self.set_text_color(*_BLACK)
            self.cell(50, 8, label, border=0, fill=True)
            self.set_font('helvetica', '', 10)
            self.cell(0, 8, str(value),
                      border=0, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(10)

    def _section_topographic_summary(self, stats: dict) -> None:
        self._section_header('1. SUMARIO TOPOGRAFICO E AMBIENTAL')
        self.set_font('helvetica', '', 10)
        self.set_text_color(*_BLACK)

        slope     = stats.get('avg_slope', 8.4)
        min_h     = stats.get('min_height', 0)
        max_h     = stats.get('max_height', 0)
        summary   = (
            f"A area analisada apresenta declividade media de {slope:.1f}%, "
            f"com altitude variando entre {min_h:.1f}m e {max_h:.1f}m. "
            "Os dados sugerem morfologia que requer atencao especial para "
            "drenagem e estabilidade de taludes."
        )
        self.multi_cell(0, 6, summary, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(5)

        self.set_fill_color(*_GRAY_BG)
        metrics = [
            ('Area Construida (estimada)',  f"{stats.get('total_building_area', 0):.1f} m2"),
            ('Extensao de Vias',            f"{stats.get('total_road_length', 0):.1f} m"),
            ('Densidade de Edificacoes',    'ALTA' if stats.get('total_buildings', 0) > 100 else 'MEDIA'),
            ('Pontos de Vegetacao',         str(stats.get('total_nature', 0))),
        ]
        for m_label, m_val in metrics:
            self.set_font('helvetica', 'B', 10)
            self.cell(70, 8, m_label, border='B', fill=True)
            self.set_font('helvetica', '', 10)
            self.cell(0, 8, m_val, border='B',
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='R')
        self.ln(10)

    def _section_technical_recommendations(self) -> None:
        self._section_header('2. RECOMENDACOES TECNICAS')
        self.set_font('helvetica', '', 10)
        self.set_text_color(*_BLACK)
        recs = [
            "- Proceder com levantamento planialtimetrico cadastral in-loco para validacao centimetrica.",
            "- Verificar restricoes ambientais junto aos orgaos competentes para areas de preservacao.",
            "- Implementar sistema de drenagem pluvial compativel com a declividade local.",
            "- Considerar o uso de contencoes caso a declividade em cortes ultrapasse 30%.",
        ]
        for rec in recs:
            self.multi_cell(0, 6, rec, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(5)

    def _section_earthwork(self, stats: dict) -> None:
        self._section_header('3. MOVIMENTACAO DE TERRA (ESTIMATIVA)')
        self.set_font('helvetica', '', 10)
        self.set_text_color(*_BLACK)
        self.set_fill_color(*_GRAY_BG)

        rows = [
            ('Volume de Corte (V+):',  f"{stats.get('cut_volume', 0):.1f} m3"),
            ('Volume de Aterro (V-):',  f"{stats.get('fill_volume', 0):.1f} m3"),
        ]
        for label, val in rows:
            self.set_font('helvetica', 'B', 10)
            self.cell(70, 8, label, border='B', fill=True)
            self.set_font('helvetica', '', 10)
            self.cell(0, 8, val, border='B',
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='R')
        self.ln(10)

    def _certification_block(self) -> None:
        self.set_y(-40)
        self.set_font('helvetica', 'I', 9)
        self.set_text_color(*_GRAY_TEXT)
        self.multi_cell(
            0, 5,
            "Certifico que os dados deste laudo sao provenientes de processamento "
            "algoritmico de bases abertas (OSM) e georeferenciamento de satelite. "
            "Possui carater tecnico-preliminar para estudos de viabilidade.",
            align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT
        )
        self.ln(10)
        self.set_font('helvetica', 'B', 10)
        self.set_text_color(*_BLACK)
        self.cell(0, 5, 'sisTOPOGRAFIA - ANALISTA AI',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

    def _section_header(self, title: str) -> None:
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(*_BLUE_DARK)
        self.cell(0, 10, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*_BLUE_DARK)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

def generate_report(data: dict, filename: str) -> str:
    generator = PdfAdapter()
    return generator.generate(data, filename)
