"""El aviso de alumno nuevo a #onboardings (ADR-W195): lo que fulfillment necesita para la primera sesión, sin la
plata. Lo pidió Mario en Edu: Sesiones 1 a 1 (17/11/2026): «el pago son cosas de venta»; acá va el examen, cuándo
ingresó, los dolores y lo que anotaron el closer y el setter. El teléfono va también en la tarjeta, grande: Dari no
lo encontraba en el texto de arriba.

Sale del mismo pago que el aviso de #wins (venta.py), que sigue con la plata.
"""
from app import db
from app.services.discord_avisos.tarjeta import Aviso, corto

TONOS = {'Pendiente': 'amarillo', 'Cancelada': 'rojo'}
TIPOS = {'completo': 'Pago completo', 'parcial': 'Primer pago', 'seña': 'Seña'}


def _agenda(pago):
    """La agenda donde se cerró la venta; si la venta no la tiene, la última del cliente con notas."""
    from app.models import Appointment, Sale

    venta = db.session.get(Sale, pago.sale_id) if pago.sale_id else None
    if venta and venta.appointment_id:
        appt = db.session.get(Appointment, venta.appointment_id)
        if appt:
            return appt
    if not pago.client_id:
        return None
    return (Appointment.query.filter(Appointment.client_id == pago.client_id,
                                     db.or_(Appointment.closer_notes.isnot(None), Appointment.setter_notes.isnot(None)))
            .order_by(Appointment.start_time.desc().nullslast(), Appointment.id.desc()).first())


def _respuesta(appt, *claves):
    """Lo que respondió al agendar a la primera pregunta que contiene alguna de las claves (en minúscula)."""
    for r in ((appt.agenda_payload or {}).get('respuestas') or []) if appt else []:
        pregunta = str(r.get('pregunta') or '').lower()
        if any(c in pregunta for c in claves) and str(r.get('respuesta') or '').strip():
            return str(r['respuesta']).strip()
    return ''


def armar(pago):
    """El Aviso de alumno nuevo de un FinancialSale ya guardado."""
    from app.models import Client, User
    from app.services.closer_service import PROGRAM_LABELS
    from app.services.sheets_service import SheetsService

    programa, tipo = SheetsService.parse_tipo_pago(pago.tipo_pago)
    contacto = pago.contacto()
    telefono = contacto.get('telefono') or ''
    closer = User.query.filter(db.func.lower(User.email) == (pago.email_vendedor or '').lower()).first() \
        if pago.email_vendedor else None
    appt = _agenda(pago)
    cliente = db.session.get(Client, pago.client_id) if pago.client_id else None
    ingreso = pago.date or pago.created_at

    chips = []
    if programa:
        chips.append({'marca': programa, 'texto': PROGRAM_LABELS.get(programa, programa)})
    if ingreso:
        chips.append({'icono': 'cal', 'texto': f"Ingresó el {ingreso.strftime('%d/%m/%Y')}"})
    etapa = _respuesta(appt, 'etapa de tu formación')
    if etapa:
        chips.append({'icono': 'maletin', 'texto': corto(etapa, 40)})
    if tipo == 'seña':
        chips.append({'icono': 'reloj', 'texto': 'Con seña: falta completar el pago'})

    cajas = [{'titulo': 'Teléfono', 'valor': telefono or 'Sin número', 'color': 'verde' if telefono else 'rojo',
              'icono': 'telefono'},
             {'titulo': 'Closer', 'valor': closer.username if closer else (pago.email_vendedor or '-'),
              'color': 'azul', 'icono': 'personas'}]
    if pago.setter:
        cajas.append({'titulo': 'Origen', 'valor': pago.setter, 'color': 'verde', 'icono': 'bandeja'})

    tiles = []
    examen = pago.examen or (appt.examen if appt else None) or _respuesta(appt, 'examen')
    tiles.append({'icono': 'meta', 'titulo': 'Examen', 'sub': corto(examen, 140) if examen else 'Sin cargar'})
    problema = _respuesta(appt, 'problema')
    if problema:
        tiles.append({'icono': 'flecha', 'titulo': 'Lo que quiere resolver', 'sub': corto(problema, 200)})
    if cliente and (cliente.dolores or '').strip():
        tiles.append({'icono': 'x', 'titulo': 'Dolores', 'sub': corto(cliente.dolores, 200)})
    nota_closer = (appt.closer_notes or '').strip() if appt else ''
    tiles.append({'icono': 'nota', 'titulo': 'Nota del closer', 'sub': corto(nota_closer, 220) if nota_closer else 'Sin notas'})
    nota_setter = (appt.setter_notes or '').strip() if appt else ''
    if nota_setter:
        tiles.append({'icono': 'nota', 'titulo': 'Nota del setter', 'sub': corto(nota_setter, 160)})

    # La nota completa va en el texto si no entra en la tarjeta.
    extra = f'**Nota del closer:** {nota_closer}' if len(nota_closer) > 220 else ''
    return Aviso(emoji='🙌', titulo='Alumno nuevo', nombre=contacto.get('nombre_cliente') or 'Alumno',
                 telefono=telefono, evento='Alumno nuevo', estado=TIPOS.get(tipo, ''),
                 tono=TONOS.get(pago.estado, 'verde'), chips=chips, cajas=cajas, tiles=tiles,
                 pie=f'Onboarding · pago #{pago.id}' + (f' · agenda #{appt.id}' if appt else ''),
                 menciones=[closer.discord_id] if closer and closer.discord_id else [], texto_extra=extra)
