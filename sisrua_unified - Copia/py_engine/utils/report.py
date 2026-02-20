from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import io

def generate_area_report(stats: dict) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(30, height - 40, "Relatório Técnico - Área Analisada")
    c.setFont("Helvetica", 12)
    y = height - 80
    for key, value in stats.items():
        c.drawString(30, y, f"{key}: {value}")
        y -= 20
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()

# Exemplo de uso:
# stats = {
#     "Declividade média": "5.2%",
#     "Área total": "10.000 m²",
#     "Extensão de vias": "1.200 m",
#     "Densidade urbana": "0.8",
# }
# pdf_bytes = generate_area_report(stats)
# with open("relatorio.pdf", "wb") as f:
#     f.write(pdf_bytes)
