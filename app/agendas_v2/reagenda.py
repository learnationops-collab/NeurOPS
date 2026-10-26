"""Reagendas que llegan solas: el lead reprograma desde el link de Thalamus (operacion.registrar_agenda con
'reprogramar') o el closer mueve el evento en su Google Calendar (movidas.py)."""

from flask import current_app

from app import db
from app.agendas_v2 import operacion
from app.services import avisos_service


def _mover(previa, cliente, closer, setter_id, inicio, payload, comentario, aviso, ignorar_ids=()):
    """Igual que «Reagendado» del mazo (CloserService.process_agenda), son dos filas. La vieja queda
    cerrada como 'Reagendado' y la nueva nace con `is_rescheduled`, con una nota en el log de la persona: de
    ahí salen el embudo del closer (agendas y reagendas), la cartera y la cola «reagendar». Antes se
    movía la misma fila y para todo eso la reagenda no existía.
    El registro de agendas sigue con UNA fila (la de la vieja, que pasa a la fecha nueva): así no
    suma otra agenda en el workshop ni en Confirmación.
    payload None: la nueva queda sin agenda_payload (una de n8n sigue siendo de n8n).
    Devuelve la agenda nueva, o None si el horario ya no está libre (sin cambios)."""
    from app.services import lead_log_service
    from app.services.booking_service import BookingService

    anterior = previa.start_time
    espejo = operacion._espejo_de(previa, anterior)
    previa.closer_result = 'Reagendado'
    previa.closer_processed = True
    nueva = BookingService.create_appointment(
        client_id=cliente.id,
        closer_id=closer.id,
        start_time_utc=inicio,
        origin=previa.origin,
        setter_id=setter_id or previa.setter_id,
        ignorar_ids=[*ignorar_ids, previa.id],
    )
    if not nueva:
        db.session.rollback()
        return None
    nueva.is_rescheduled = True
    if payload is not None:
        nueva.agenda_payload = {
            **payload,
            'reprogramada_desde': anterior.isoformat() + 'Z' if anterior else None,
            'reagenda_de': previa.id,
        }
    db.session.flush()
    lead_log_service.nota(comentario, previa.closer_id or closer.id, appt=nueva)
    if espejo:
        espejo.date = inicio
        espejo.fecha_meet = inicio.isoformat()
        espejo.closer = closer.username
        if nueva.agenda_payload:
            operacion._payload_en_espejo(espejo, nueva.agenda_payload)
    avisos_service.avisar(
        'agenda_reprogramada', *avisos_service.destino(['admin'], [closer.id]), 'Agenda reprogramada', aviso,
        'appointment', nueva.id, person_uuid=nueva.person_uuid,
    )
    db.session.commit()
    if not espejo:
        fa = BookingService.sync_appointment_to_financial_agenda(nueva)
        if nueva.agenda_payload:
            operacion._payload_en_espejo(fa, nueva.agenda_payload)
        db.session.commit()
    return nueva


def reagendar(previa, cliente, payload, closer, setter, setter_id, inicio, ignorar_ids=()):
    """El lead reprogramó desde el link. Devuelve (agenda nueva, evento_a_borrar) o (None, None) si el
    horario ya no está libre."""
    anterior = previa.start_time
    evento_viejo = (previa.closer_id, previa.google_event_id) if previa.google_event_id else None
    cuando = inicio.strftime('%d/%m/%Y %H:%M')
    nueva = _mover(
        previa, cliente, closer, setter.id if setter else setter_id, inicio, payload,
        comentario=f'Reagendado por el lead desde el link de agendas. Nueva cita el {cuando} UTC con {closer.username}.',
        aviso=f'{cliente.full_name or "Un lead"} reprogramó su agenda desde el link de agendas: pasa al {cuando} UTC.',
        ignorar_ids=ignorar_ids,
    )
    if not nueva:
        return None, None
    current_app.logger.info(f'[AGENDAS 2.0] Agenda #{previa.id} reagendada por el lead: #{nueva.id} ({anterior} -> {inicio})')
    return nueva, evento_viejo


def seguir_movida(previa, inicio):
    """El closer movió el evento de la agenda en su Google Calendar: Work pasa la agenda a esa hora, como
    reagenda. El evento sigue siendo el mismo (no se borra ni se crea otro): la nueva queda vinculada a él
    y la vieja lo suelta. Devuelve la agenda nueva o None si a esa hora ya hay otra agenda vigente."""
    from app.models import User
    from app.services import segmento_service

    cliente, closer = previa.client, db.session.get(User, previa.closer_id)
    if not cliente or not closer:
        return None
    anterior = previa.start_time
    evento = (previa.google_event_id, previa.calendar_evento_id, previa.calendar_id, previa.calendar_vinculo)
    payload = {**previa.agenda_payload, 'inicio': inicio.isoformat() + 'Z', 'movida_en_google': True} \
        if previa.agenda_payload else None
    previa.google_event_id = None
    cuando = inicio.strftime('%d/%m/%Y %H:%M')
    nueva = _mover(
        previa, cliente, closer, None, inicio, payload,
        comentario=f'{closer.username} movió la cita en su Google Calendar. Nueva cita el {cuando} UTC.',
        aviso=f'La agenda de {cliente.full_name or "un lead"} se movió en Google Calendar: pasa al {cuando} UTC.',
    )
    if not nueva:
        return None
    nueva.google_event_id, nueva.calendar_evento_id, nueva.calendar_id, nueva.calendar_vinculo = evento
    segmento_service.copiar(nueva, previa)
    db.session.commit()
    current_app.logger.info(f'[AGENDAS 2.0] Agenda #{previa.id} movida en Google: #{nueva.id} ({anterior} -> {inicio})')
    return nueva
