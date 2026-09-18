"""Genera la guía breve de operación para el primer club piloto."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "guia_piloto_recepcion.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#0B1420")
INK = colors.HexColor("#172331")
LIME = colors.HexColor("#B8EB63")
MUTED = colors.HexColor("#526170")
PAPER = colors.HexColor("#F5F7EF")
LINE = colors.HexColor("#DCE4D8")

styles = {
    "kicker": ParagraphStyle("kicker", fontName="Helvetica-Bold", fontSize=8, leading=12, textColor=MUTED, spaceAfter=7),
    "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=25, leading=28, textColor=INK, spaceAfter=10),
    "intro": ParagraphStyle("intro", fontName="Helvetica", fontSize=10.5, leading=16, textColor=MUTED, spaceAfter=16),
    "heading": ParagraphStyle("heading", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=INK, spaceBefore=15, spaceAfter=7),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=14.5, textColor=INK, spaceAfter=7),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.5, leading=12.5, textColor=MUTED, spaceAfter=5),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=9, leading=13, textColor=INK, alignment=TA_LEFT),
    "cell_head": ParagraphStyle("cell_head", fontName="Helvetica-Bold", fontSize=8, leading=11, textColor=INK),
}


def p(text, style="body"):
    return Paragraph(text, styles[style])


def step(number, title, detail):
    number_cell = p(f"{number:02d}", "cell_head")
    content = p(f"<b>{title}</b><br/>{detail}", "cell")
    table = Table([[number_cell, content]], colWidths=[36, 459], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), LIME),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("RIGHTPADDING", (0, 0), (0, 0), 8),
        ("LEFTPADDING", (1, 0), (1, 0), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
    ]))
    return table


def page_footer(canvas, doc):
    canvas.saveState()
    width, height = doc.pagesize
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 14 * mm, width, 14 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(LIME)
    canvas.drawString(18 * mm, height - 8.6 * mm, "padelbook / GUÍA DE PILOTO")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 16 * mm, width - 18 * mm, 16 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 11 * mm, "Operación de un club · versión para capacitación")
    canvas.drawRightString(width - 18 * mm, 11 * mm, f"{doc.page} / 2")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT), pagesize=(210 * mm, 297 * mm),
    leftMargin=18 * mm, rightMargin=18 * mm,
    topMargin=24 * mm, bottomMargin=23 * mm,
    title="PadelBook - Guía breve para recepción",
    author="PadelBook",
)

story = [
    p("PARA QUIEN ATIENDE EL CLUB", "kicker"),
    p("Recepción en control.", "title"),
    p("Una guía rápida para operar turnos reales. Cada empleado usa su propia cuenta; el administrador crea o desactiva los accesos desde <b>Equipo</b>.", "intro"),
    p("Tu recorrido diario", "heading"),
    step(1, "Ingresá", "Abrí la web del club, elegí <b>Ingresar</b> y usá tu email y contraseña de recepción. Tu panel abre directamente en <b>Reservas</b>."),
    Spacer(1, 6),
    step(2, "Cargá un turno de mostrador o WhatsApp", "En <b>Reservas &gt; Cargar un turno</b>, elegí fecha, cancha, inicio y duración. Completá nombre y teléfono del jugador. El sistema calcula el precio y deja el cobro pendiente."),
    Spacer(1, 6),
    step(3, "Consultá y bloqueá la agenda", "En <b>Agenda</b> revisá las canchas y bloqueá mantenimiento, clases fijas o cierres. Una reserva o bloqueo impide crear turnos que se superpongan."),
    Spacer(1, 6),
    step(4, "Confirmá, cobrá o cancelá", "En <b>Reservas</b> buscá al jugador. Registrá el importe recibido y el medio de pago; una seña deja saldo. Si cancelás una reserva con dinero registrado, coordiná el reintegro con el dueño."),
    p("Regla de oro", "heading"),
    p("<b>El turno no está cobrado porque el jugador eligió «seña».</b> El cobro existe únicamente cuando se registra en PadelBook. La integración de pago online se habilitará después de configurar la cuenta del club y probar sus notificaciones."),
    PageBreak(),
    p("PARA EL ENCARGADO Y EL DUEÑO", "kicker"),
    p("Control del piloto.", "title"),
    p("Usá esta lista durante las primeras semanas. Registrá problemas con fecha, horario, cancha y una captura, sin compartir contraseñas ni datos de pago.", "intro"),
    p("Si algo falla", "heading"),
    p("<b>No se guarda una reserva:</b> actualizá la agenda y comprobá que el horario siga libre. Si la API está caída, PadelBook mostrará indisponibilidad: anotá el pedido por separado y cargalo cuando vuelva el servicio."),
    p("<b>Pago dudoso:</b> no repitas el registro a ciegas. Abrí el historial de cobros de la reserva y comprobá si el movimiento ya figura. Escalá cualquier devolución al dueño."),
    p("<b>Cuenta comprometida o empleado que deja el club:</b> el administrador desactiva su acceso en <b>Equipo</b> y cambia la contraseña si corresponde."),
    p("Cuatro métricas semanales", "heading"),
]

metrics = [
    ("Autogestión", "Turnos creados online / total de turnos creados en la semana."),
    ("Intervención de recepción", "Turnos cargados por mostrador o WhatsApp; anotá el motivo en una planilla."),
    ("Errores de agenda", "Conflictos, dobles reservas y bloqueos inesperados. Meta: cero dobles reservas."),
    ("Cobros pendientes", "Cantidad y monto al cierre; tiempo hasta confirmar cada seña."),
]
for index, (name, detail) in enumerate(metrics, 1):
    story.append(step(index, name, detail))
    story.append(Spacer(1, 5))

story.extend([
    p("Cierre de cada jornada", "heading"),
    p("Revisá reservas pendientes, cobros registrados y horarios bloqueados del día siguiente. El dueño compara el cierre de caja con los medios de pago reales y anota diferencias."),
    p("Antes de invitar jugadores", "heading"),
    p("Probá dos cuentas en dispositivos distintos, las cuatro duraciones (1 h, 1:30 h, 2 h y 2:30 h), una cancelación, un bloqueo y una seña con saldo. Confirmá con el dueño la política de devolución y el contacto de soporte del club."),
])

doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
print(OUTPUT)
