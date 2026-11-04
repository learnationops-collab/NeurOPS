"""Cambiar a mano el segmento A/B/C/D de un lead desde su ficha (Kerwin, 04/11/2026).

El segmento lo calcula Thalamus al agendar (`segmento_service`); esto es la corrección de quien ve que el lead
no es del que salió. Se cambia en toda la persona —su cliente y todas sus agendas— para que Analizar, Revisar y
Marketing muestren el mismo (ver `segmentos_lectura`). Los puntos y la confianza del cálculo se borran: ya no
describen al segmento, y la versión queda en `manual`.
"""
from sqlalchemy import or_

from app import db
from app.agendas_v2.nucleo.segmento import SEGMENTOS
from app.models import Appointment, Client
from app.services.ficha_acciones_service import ErrorDeAccion

MANUAL = 'manual'


def _del_lead(appt):
    """(clientes, agendas) de la persona de esta agenda: la propia y las que comparten persona o cliente."""
    cliente = appt.client or (db.session.get(Client, appt.client_id) if appt.client_id else None)
    puuid = appt.person_uuid or (cliente.person_uuid if cliente else None)
    c_filtros = [Client.id == appt.client_id] if appt.client_id else []
    a_filtros = [Appointment.id == appt.id]
    if puuid:
        c_filtros.append(Client.person_uuid == puuid)
        a_filtros.append(Appointment.person_uuid == puuid)
    if appt.client_id:
        a_filtros.append(Appointment.client_id == appt.client_id)
    clientes = Client.query.filter(or_(*c_filtros)).all() if c_filtros else []
    return clientes, Appointment.query.filter(or_(*a_filtros)).all()


def cambiar_segmento(appt, datos, usuario):
    """`{'segmento': 'A'|'B'|'C'|'D'|None}`: lo pone en el cliente y en todas las agendas de la persona."""
    if 'segmento' not in datos:
        raise ErrorDeAccion('Falta el segmento.', 'segmento')
    nuevo = datos['segmento'] or None
    if nuevo is not None:
        nuevo = str(nuevo).strip().upper()
        if nuevo not in SEGMENTOS:
            raise ErrorDeAccion('El segmento tiene que ser A, B, C o D.', 'segmento')
    antes = appt.segmento or (appt.client.segmento if appt.client else None)
    if (antes or None) == nuevo:
        return {'id': appt.id, 'segmento': nuevo, 'cambio': False}

    clientes, agendas = _del_lead(appt)
    for fila in [*clientes, *agendas]:
        fila.segmento = nuevo
        fila.segmento_puntos = None
        fila.segmento_preguntas = None
        fila.segmento_confianza = None
        fila.segmento_version = MANUAL
    db.session.commit()

    from app.services.booking_service import BookingService
    BookingService.log_lead_event(
        appt.id, usuario.id, 'segmento_cambiado',
        f'{usuario.username} cambió el segmento del lead: {antes or "sin segmento"} → {nuevo or "sin segmento"}.')
    return {'id': appt.id, 'segmento': nuevo, 'cambio': True, 'manual': True}
