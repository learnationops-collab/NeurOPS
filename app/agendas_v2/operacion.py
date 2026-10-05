"""Agendas 2.0 escribe en la operacion: una reserva tomada desde el link publico es una agenda como
cualquier otra de NeurOPS. Mismo camino que la «Nueva agenda» manual del closer (app/api/closer.py):

  1. Cliente: se busca (email, telefono, instagram) o se crea, con BookingService.find_or_create_client.
     Guarda el ultimo formulario en `clients.formulario_payload`, tambien si no califico.
  2. Appointment: BookingService.create_appointment (notifica al closer y a admin, sincroniza el Lead),
     con la agenda completa en `appointments.agenda_payload`.
  3. FinancialAgenda: el espejo de siempre, BookingService.sync_appointment_to_financial_agenda (que
     ademas reconcilia duplicados), con el payload en `raw_data['agendas_v2']`.
  4. Evento en el Google Calendar del closer con Meet, invitando al lead. Va DESPUES de guardar: si
     Google falla, la agenda ya existe y se avisa a admin y al closer.

Si el lead ya tiene una agenda futura abierta, no se crea otra: se REPROGRAMA esa (como hace la
ingesta de n8n), aunque cambie el closer.
"""

from datetime import datetime, timedelta

from flask import current_app
from sqlalchemy import func, or_
from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.models import Appointment, Client, Notification, User
from app.models.financial import FinancialAgenda

# Resultados de una Appointment que ya no ocupan el horario del closer. Incluye las dos grafias que
# hay en la base: las que pone el closer (Cancelada/Reprogramada) y las del sync de n8n (Cancelado/Reagendado).
RESULTADOS_NO_VIGENTES = ('Cancelada', 'Cancelado', 'Reprogramada', 'Reagendada', 'Reagendado')
# Una agenda que empezo hace menos de esto todavia cuenta como "futura abierta" para reprogramar.
MARGEN_REPROGRAMAR = timedelta(hours=2)


def filtro_vigente():
    """Appointment que sigue ocupando su horario: sin procesar y no cancelada ni reprogramada."""
    return (
        Appointment.closer_processed.is_(False),
        or_(Appointment.result.is_(None), Appointment.result.notin_(RESULTADOS_NO_VIGENTES)),
    )


def _o_none(x):
    x = (x or '').strip()
    return x or None


def _cliente(payload):
    from app.services.booking_service import BookingService

    lead = payload['lead']
    cliente = BookingService.find_or_create_client(
        nombre=_o_none(lead.get('nombre')) or 'Desconocido',
        email=_o_none(lead.get('email')),
        instagram=_o_none(lead.get('instagram')),
        phone=_o_none(lead.get('telefono')),
    )
    cliente.formulario_payload = payload
    flag_modified(cliente, 'formulario_payload')
    return cliente


def registrar_descalificado(payload):
    """Un lead que no califico: queda como cliente, con su formulario, sin agenda."""
    cliente = _cliente(payload)
    db.session.commit()
    return cliente


def agenda_de(cliente_id, inicio):
    """La agenda de Agendas 2.0 vigente de ese cliente a esa hora (el mismo lead que confirma dos veces)."""
    return Appointment.query.filter(
        Appointment.client_id == cliente_id,
        Appointment.start_time == inicio,
        Appointment.agenda_payload.isnot(None),
        *filtro_vigente(),
    ).first()


def cliente_por_email(email):
    email = (email or '').strip().lower()
    if not email:
        return None
    return Client.query.filter(func.lower(Client.email) == email).first()


def _fuente(payload, setter):
    """Lo que va en Appointment.origin / FinancialAgenda.nombre («Fuente»): el setter si lo hay; si no,
    el origen del link (?o=) o el funnel."""
    if setter:
        return setter.username
    return payload.get('origen') or payload.get('funnel_slug') or 'agendas 2.0'


def _espejo_de(appt, inicio_anterior):
    """La FinancialAgenda de esa cita ANTES de moverla (mismo cruce que el espejo, +/-36 h)."""
    from app.services.booking_service import BookingService

    filtros = BookingService.filtros_de_agenda_del_cliente(appt.client)
    if not filtros or not inicio_anterior:
        return None
    return FinancialAgenda.query.filter(
        FinancialAgenda.duplicada_de_id.is_(None),
        or_(*filtros),
        FinancialAgenda.date >= inicio_anterior - timedelta(hours=36),
        FinancialAgenda.date <= inicio_anterior + timedelta(hours=36),
    ).first()


def _payload_en_espejo(fa, payload):
    if not fa:
        return
    fa.raw_data = {**(fa.raw_data or {}), 'agendas_v2': payload}
    flag_modified(fa, 'raw_data')


def registrar_agenda(payload, closer, setter, inicio, ahora=None):
    """Crea (o reprograma) la agenda en la operacion. `inicio`: datetime UTC sin zona.
    Devuelve (appointment, evento_a_borrar): evento_a_borrar es (user_id, google_event_id) del evento
    viejo de una agenda reprogramada, o None. Hace commit."""
    from app.services.booking_service import BookingService

    ahora = ahora or datetime.utcnow()
    cliente = _cliente(payload)
    db.session.flush()

    previa = (
        Appointment.query.filter(
            Appointment.client_id == cliente.id,
            Appointment.start_time >= ahora - MARGEN_REPROGRAMAR,
            *filtro_vigente(),
        )
        .order_by(Appointment.start_time)
        .first()
    )

    if previa:
        anterior = previa.start_time
        espejo = _espejo_de(previa, anterior)
        evento_viejo = (previa.closer_id, previa.google_event_id) if previa.google_event_id else None
        previa.start_time = inicio
        previa.closer_id = closer.id
        previa.setter_id = setter.id if setter else previa.setter_id
        previa.is_rescheduled = True
        previa.google_event_id = None
        previa.agenda_payload = {**payload, 'reprogramada_desde': anterior.isoformat() + 'Z' if anterior else None}
        if espejo:
            espejo.date = inicio
            espejo.fecha_meet = inicio.isoformat()
            espejo.closer = closer.username
            _payload_en_espejo(espejo, previa.agenda_payload)
        db.session.add(
            Notification(
                subject='Agenda reprogramada',
                content=(
                    f'{cliente.full_name or "Un lead"} reprogramó su agenda desde el link de agendas: '
                    f'pasa al {inicio.strftime("%d/%m/%Y %H:%M")} UTC.'
                ),
                target_users=['role:admin', int(closer.id)],
                associated_id=previa.id,
                associated_type='appointment',
            )
        )
        db.session.commit()
        if not espejo:
            _payload_en_espejo(BookingService.sync_appointment_to_financial_agenda(previa), previa.agenda_payload)
            db.session.commit()
        current_app.logger.info(f'[AGENDAS 2.0] Agenda #{previa.id} reprogramada de {anterior} a {inicio}')
        return previa, evento_viejo

    appt = BookingService.create_appointment(
        client_id=cliente.id,
        closer_id=closer.id,
        start_time_utc=inicio,
        origin=_fuente(payload, setter),
        setter_id=setter.id if setter else None,
    )
    if not appt:
        # create_appointment solo falla si el closer ya tiene una cita a esa MISMA hora.
        db.session.rollback()
        return None, None
    appt.agenda_payload = payload
    db.session.commit()
    _payload_en_espejo(BookingService.sync_appointment_to_financial_agenda(appt), payload)
    db.session.commit()
    return appt, None


def _descripcion(payload):
    lead = payload.get('lead') or {}
    lineas = [f'Lead: {lead.get("nombre") or "-"}']
    for etiqueta, k in (('WhatsApp', 'telefono'), ('Email', 'email'), ('Instagram', 'instagram')):
        if lead.get(k):
            lineas.append(f'{etiqueta}: {lead[k]}')
    respuestas = [r for r in payload.get('respuestas') or [] if r.get('respuesta')]
    if respuestas:
        lineas += ['', 'Formulario:'] + [f'• {r["pregunta"]}: {r["respuesta"]}' for r in respuestas]
    if payload.get('nota') is not None:
        lineas += ['', f'Nota: {payload["nota"]}']
    if payload.get('origen'):
        lineas.append(f'Origen: {payload["origen"]}')
    return '\n'.join(lineas)


def crear_evento(appt, nombre_evento, evento_a_borrar=None):
    """Evento en el Calendar del closer con Meet e invitacion al lead. Nunca rompe la agenda: si
    Google falla, se avisa a admin y al closer para crearlo a mano."""
    from app.services.google_service import GoogleService

    if evento_a_borrar:
        try:
            GoogleService.delete_event(*evento_a_borrar)
        except Exception as e:  # noqa: BLE001  (el evento viejo no puede frenar la agenda nueva)
            current_app.logger.warning(f'[AGENDAS 2.0] No se pudo borrar el evento viejo {evento_a_borrar}: {e}')

    payload = dict(appt.agenda_payload or {})
    lead = payload.get('lead') or {}
    closer = db.session.get(User, appt.closer_id)
    fin = appt.start_time + timedelta(minutes=int(payload.get('duracion_min') or 60))
    titulo = f'{nombre_evento}: {lead.get("nombre") or "Lead"} y {closer.username if closer else "Learnation"}'
    email = _o_none(lead.get('email'))
    try:
        evento_id, meet = GoogleService.crear_evento_con_meet(
            appt.closer_id, appt.start_time, fin, titulo, _descripcion(payload), invitado_email=email
        )
    except Exception as e:  # noqa: BLE001  (Google puede fallar de mil formas; la agenda ya esta guardada)
        current_app.logger.error(f'[AGENDAS 2.0] Sin evento de Calendar para la agenda #{appt.id}: {e}')
        db.session.add(
            Notification(
                subject='Agenda sin evento de Google Calendar',
                content=(
                    f'La agenda de {lead.get("nombre") or "un lead"} '
                    f'del {appt.start_time.strftime("%d/%m/%Y %H:%M")} UTC '
                    f'se guardó, pero no se pudo crear el evento en el Calendar del closer ({e}). '
                    'Creálo a mano con link de Meet e invitá al lead.'
                ),
                target_users=['role:admin', int(appt.closer_id)],
                associated_id=appt.id,
                associated_type='appointment',
            )
        )
        db.session.commit()
        return False
    appt.google_event_id = evento_id
    appt.agenda_payload = {**payload, 'meet': meet}
    db.session.commit()
    return True
