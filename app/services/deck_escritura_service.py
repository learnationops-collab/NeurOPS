"""El write del mazo del closer, sacado de la ruta para que dos superficies lo compartan.

Todo lo que confirma una agenda o reporta una llamada pasaba por el cuerpo de
`POST /api/closer/deck/<appt_id>`, que exige rol `closer`. La ficha unificada la abren tambien la
direccion comercial, el setter y triage (`/api/ficha`), y no podian escribir sin duplicar esta
logica — que no es un `setattr` por campo: adentro viven dos reglas que se escribieron a mano por
dos bugs reales de produccion y que tienen que valer igual en las dos puertas.

  · `closer_processed` (ver `_resolver_procesada`): volver a "Pendiente" DESprocesa, el
    autoguardado del wizard de confirmacion no toca el campo, y cualquier otro guardado procesa.
  · los logs `show_up_reported` / `confirmed` solo se escriben cuando el campo cambio de verdad en
    ESTE guardado, para que "Cerrar el dia" pueda distinguir el trabajo de hoy del de antes.

La funcion NO comitea: quien la llama decide cuando cerrar la transaccion, porque las rutas de la
ficha encadenan varios pasos en un mismo guardado.
"""
from datetime import datetime

from app import db

# Claves del autoguardado del wizard de confirmacion. Si un guardado trae `confirm_status` y NADA
# fuera de este conjunto, el lead sigue vivo dentro del pipeline de confirmaciones y la cita no se
# marca como procesada: tocar una etapa mientras el lead sigue "conversando" la sacaria del mazo
# antes de llegar a Testimonio.
CLAVES_SOLO_CONFIRMACION = frozenset({
    'confirm_status', 'closer_notes', 'pre_call_reminder_at',
    'confirmation_stage', 'confirmation_contact_status', 'confirmation_pain_points',
})


def _a_booleano_tri_estado(valor):
    """None cuando la pregunta no se hizo; el resto se lee tolerando el texto que manda el form."""
    if valor is None or valor == '':
        return None
    return valor is True or valor in ('true', 'True', '1', 1)


def _resolver_procesada(appt, data):
    """Si este guardado saca la cita del mazo, la devuelve a el, o no la toca.

    Bug real (08/sep/2026, Joaquin): reagendar una llamada devolviendola explicitamente a
    "Pendiente" (un seguimiento con "contesto y agendo", una 2a llamada o un reagendado manual
    mandan `result: 'Pendiente'` junto con otras claves) caia en el caso general y marcaba como
    "ya reportada" la MISMA fila cuyo `start_time` se acababa de mover a una fecha futura.
    """
    if 'result' in data and (data['result'] or '').strip().lower() == 'pendiente':
        appt.closer_processed = False
    elif 'confirm_status' in data and set(data.keys()).issubset(CLAVES_SOLO_CONFIRMACION):
        pass
    else:
        appt.closer_processed = True


def _aplicar_campos(appt, data, usuario):
    if 'keyword' in data:
        appt.keyword = data['keyword']
    if 'linked_call' in data:
        appt.linked_call = data['linked_call']
    if 'closer_notes' in data:
        notes_str = data['closer_notes'].strip()
        appt.closer_notes = notes_str
        # La nota de la agenda se espeja en el hilo del cliente: es donde el equipo lee el
        # historial del lead, que no vive por agenda sino por persona.
        if notes_str and appt.client_id:
            from app.models import Comment
            db.session.add(Comment(text=notes_str, comment_type='client',
                                   associated_id=appt.client_id, author_id=usuario.id))

    if 'result' in data:
        res_val = data['result']
        if res_val == 'Asistió':
            res_val = 'Show up'
        appt.closer_result = res_val

    if 'confirm_status' in data:
        appt.result = data['confirm_status']

    # Progreso granular del wizard de confirmacion (ver `Appointment.confirmation_*`): aditivo, no
    # reemplaza `result`, que sigue mandando para el Kanban de 3 columnas.
    if 'confirmation_stage' in data:
        appt.confirmation_stage = data['confirmation_stage'] or None
    if 'confirmation_contact_status' in data:
        appt.confirmation_contact_status = data['confirmation_contact_status'] or None
    if 'confirmation_pain_points' in data:
        pain_points = data['confirmation_pain_points']
        if isinstance(pain_points, list):
            pain_points = ','.join(p for p in pain_points if p)
        appt.confirmation_pain_points = pain_points or None

    if 'with_decision_maker' in data:
        appt.with_decision_maker = _a_booleano_tri_estado(data['with_decision_maker'])
    if 'offer_presented' in data:
        appt.offer_presented = _a_booleano_tri_estado(data['offer_presented'])

    if 'fecha_seguimiento' in data:
        appt.fecha_seguimiento = data['fecha_seguimiento']
        # Cerrar el seguimiento (fecha en null) tambien apaga su aviso: si no, quedaria armado con
        # una hora vieja esperando a que el lead se reabra.
        if not data['fecha_seguimiento']:
            appt.followup_reminder_enabled = False
            appt.followup_reminder_time = None
    if 'fecha_seguimiento_cobro' in data:
        appt.fecha_seguimiento_cobro = data['fecha_seguimiento_cobro']
    if 'seguimiento_realizado' in data:
        appt.seguimiento_realizado = bool(data['seguimiento_realizado'])
    if 'seguimiento_tipo' in data:
        appt.seguimiento_tipo = data['seguimiento_tipo']
    if 'seguimiento_sub' in data:
        appt.seguimiento_sub = data['seguimiento_sub']
    if 'seguimiento_intento' in data:
        appt.seguimiento_intento = data['seguimiento_intento']
    if 'pre_call_reminder_at' in data:
        val = data['pre_call_reminder_at']
        appt.pre_call_reminder_at = datetime.fromisoformat(val.replace('Z', '')) if val else None

    if 'followup_reminder_enabled' in data or 'followup_reminder_time' in data:
        from app.services.closer_followup_service import CloserFollowUpService
        CloserFollowUpService.apply_reminder_settings(
            appt,
            reminder_enabled=data.get('followup_reminder_enabled'),
            reminder_time=data.get('followup_reminder_time'))

    if data.get('contact_result'):
        appt.last_contact_outcome = data['contact_result']
        appt.last_contact_at = datetime.utcnow()


def _registrar_eventos(appt, data, usuario, anterior):
    from app.services.booking_service import BookingService

    description = f"Closer {usuario.username} completó seguimiento. Estado: {data.get('result', 'Pendiente')}."
    if data.get('closer_notes'):
        description += f" Notas: \"{data['closer_notes']}\""
    BookingService.log_lead_event(appt.id, usuario.id, 'closer_notes', description)

    # Eventos especificos, ADEMAS del genérico de arriba. Bug real (08/sep/2026, Nerina):
    # `get_daily_activity_summary` contaba una cita como "confirmada hoy" / "show up reportado hoy"
    # si se la tocaba por CUALQUIER motivo hoy y su estado actual ya era ese. Solo se escriben
    # cuando el campo relevante cambio de valor en este guardado.
    def _mismo(a, b):
        return (a or '').strip().lower() == (b or '').strip().lower()

    if 'result' in data and not _mismo(anterior['closer_result'], appt.closer_result) \
            and _mismo(appt.closer_result, 'show up'):
        BookingService.log_lead_event(appt.id, usuario.id, 'show_up_reported',
                                      f"{usuario.username} reportó Show Up.")
    if 'confirm_status' in data and not _mismo(anterior['result'], appt.result) \
            and _mismo(appt.result, 'confirmado'):
        BookingService.log_lead_event(appt.id, usuario.id, 'confirmed',
                                      f"{usuario.username} confirmó la cita.")


def aplicar_cambios(appt, data, usuario):
    """Aplica un guardado del mazo sobre `appt` y deja la sesion lista para comitear.

    `data` es el payload tal como lo manda el frontend (se ignora toda clave desconocida, que es
    lo que permite que el mismo endpoint sirva al wizard de confirmacion, al arbol de reporte y al
    flujo de seguimientos sin una ruta por caso).
    """
    from app.services.booking_service import BookingService

    anterior = {'closer_result': appt.closer_result, 'result': appt.result}

    _aplicar_campos(appt, data, usuario)
    _resolver_procesada(appt, data)
    _registrar_eventos(appt, data, usuario, anterior)

    # Espejo a FinancialAgenda (la tabla que mira triage). Nunca puede tumbar el guardado: el
    # cruce es por texto libre y falla en leads sin contacto.
    try:
        BookingService.sync_appointment_to_financial_agenda(appt)
    except Exception:
        pass

    return appt
