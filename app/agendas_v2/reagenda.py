"""Cuando el lead reprograma desde el link de Thalamus (operacion.registrar_agenda con 'reprogramar')."""

from flask import current_app

from app import db
from app.agendas_v2 import operacion
from app.models import Notification


def reagendar(previa, cliente, payload, closer, setter, setter_id, inicio, ignorar_ids=()):
    """El lead reprogramó desde el link: igual que «Reagendado» del mazo (CloserService.process_agenda),
    son dos filas. La vieja queda cerrada como 'Reagendado' y la nueva nace con `is_rescheduled`, con
    un comentario en el roadmap: de ahí salen el embudo del closer (agendas y reagendas), la cartera y
    la cola «reagendar». Antes se movía la misma fila y para todo eso la reagenda no existía.
    El registro de agendas sigue con UNA fila (la de la vieja, que pasa a la fecha nueva): así no
    suma otra agenda en el workshop ni en Confirmación.
    Devuelve (agenda nueva, evento_a_borrar) o (None, None) si el horario ya no está libre."""
    from app.models import ClientComment
    from app.services.booking_service import BookingService

    anterior = previa.start_time
    espejo = operacion._espejo_de(previa, anterior)
    evento_viejo = (previa.closer_id, previa.google_event_id) if previa.google_event_id else None
    previa.closer_result = 'Reagendado'
    previa.closer_processed = True
    nueva = BookingService.create_appointment(
        client_id=cliente.id,
        closer_id=closer.id,
        start_time_utc=inicio,
        origin=previa.origin,
        setter_id=setter.id if setter else (setter_id or previa.setter_id),
        ignorar_ids=[*ignorar_ids, previa.id],
    )
    if not nueva:
        db.session.rollback()
        return None, None
    nueva.is_rescheduled = True
    nueva.agenda_payload = {
        **payload,
        'reprogramada_desde': anterior.isoformat() + 'Z' if anterior else None,
        'reagenda_de': previa.id,
    }
    db.session.add(
        ClientComment(
            client_id=cliente.id,
            author_id=previa.closer_id or closer.id,
            text=(
                f'Reagendado por el lead desde el link de agendas. '
                f'Nueva cita el {inicio.strftime("%d/%m/%Y %H:%M")} UTC con {closer.username}.'
            ),
        )
    )
    db.session.flush()
    if espejo:
        espejo.date = inicio
        espejo.fecha_meet = inicio.isoformat()
        espejo.closer = closer.username
        operacion._payload_en_espejo(espejo, nueva.agenda_payload)
    db.session.add(
        Notification(
            subject='Agenda reprogramada',
            content=(
                f'{cliente.full_name or "Un lead"} reprogramó su agenda desde el link de agendas: '
                f'pasa al {inicio.strftime("%d/%m/%Y %H:%M")} UTC.'
            ),
            target_users=['role:admin', int(closer.id)],
            associated_id=nueva.id,
            associated_type='appointment',
        )
    )
    db.session.commit()
    if not espejo:
        operacion._payload_en_espejo(BookingService.sync_appointment_to_financial_agenda(nueva), nueva.agenda_payload)
        db.session.commit()
    current_app.logger.info(f'[AGENDAS 2.0] Agenda #{previa.id} reagendada por el lead: #{nueva.id} ({anterior} -> {inicio})')
    return nueva, evento_viejo
