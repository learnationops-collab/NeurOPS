"""Las llamadas de venta de los closers elegidos salen con grabación, transcripción y notas de Gemini automáticas,
para el call review de Marlon (Sales Team 14/11/2026, Leadership 1394).

Cada MINUTOS mira las agendas que vienen de esos closers y prende los artefactos de su Meet con la cuenta del
closer, que organiza el evento (meet_config.activar_artefactos + GoogleService.credenciales_meet). No crea ni
mueve nada: sirve para las ya agendadas y para cualquier camino por el que entre una nueva. La nota queda en el
Drive del closer; Work la trae si ese Drive está conectado en Integraciones › Notas de Meet, y la ficha la muestra
con la transcripción. La Momentum no entra: la organiza team@ y ya sale con todo (ADR-W128).
"""
import logging
import os
from datetime import datetime, timedelta

from sqlalchemy import func

from app import db
from app.models import Appointment, User

logger = logging.getLogger(__name__)

MINUTOS = 15
DIAS = 14
EMAILS = [e.strip().lower() for e in os.environ.get('GRABAR_LLAMADAS_EMAILS', 'jeancarlo@thelearnation.com').split(',') if e.strip()]
MARCA = 'grabacion_auto'


def pendientes(user, ahora):
    """Las agendas que vienen de `user` con Meet y todavía sin los artefactos prendidos."""
    from app.agendas_v2.manual import ORIGEN_MOMENTUM

    q = Appointment.query.filter(Appointment.closer_id == user.id, Appointment.start_time >= ahora - timedelta(minutes=10),
                                 Appointment.start_time <= ahora + timedelta(days=DIAS))
    return [a for a in q if a.origin != ORIGEN_MOMENTUM and isinstance(a.agenda_payload, dict)
            and a.agenda_payload.get('meet') and not a.agenda_payload.get(MARCA)]


def correr(ahora=None):
    """{email: prendidas | 'sin_permiso'}. Nunca lanza por una agenda: la que falla se reintenta en la próxima."""
    from app.services.google_service import GoogleService
    from app.services.meet_config import activar_artefactos

    ahora = ahora or datetime.utcnow()
    salida = {}
    for u in User.query.filter(func.lower(User.email).in_(EMAILS), User.is_active.is_(True)).all():
        agendas = pendientes(u, ahora)
        if not agendas:
            continue
        creds = GoogleService.credenciales_meet(u.id)
        if not creds:
            logger.warning(f'[GRABAR LLAMADAS] {u.email} no dio el permiso de Meet: tiene que reconectar Google Calendar.')
            salida[u.email] = 'sin_permiso'
            continue
        n = 0
        for a in agendas:
            if activar_artefactos(a.agenda_payload['meet'], creds):
                a.agenda_payload = {**a.agenda_payload, MARCA: True}
                n += 1
        db.session.commit()
        salida[u.email] = n
    return salida
