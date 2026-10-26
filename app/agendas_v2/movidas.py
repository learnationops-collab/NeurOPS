"""Agendas que el closer movió en su Google Calendar: Work las pasa a la hora nueva (reagenda.seguir_movida).

Sin esto, una agenda movida en Google dejaba de bloquear su horario viejo (Google manda, ver
servicio.sigue_en_google) pero seguía figurando a esa hora: el panel mostraba dos agendas a la misma hora
y la de verdad, en otra. Corre en el scheduler (reminder_scheduler) cada MINUTOS.
"""

import logging
from datetime import datetime, timedelta

from app import db

logger = logging.getLogger(__name__)

MINUTOS = 15
# Qué agendas se revisan: las vigentes que empiezan entre ATRAS antes y ADELANTE después de ahora.
ATRAS = timedelta(hours=2)
ADELANTE = timedelta(days=30)


def sincronizar_movidas(ahora=None):
    """Revisa las agendas vigentes vinculadas a un evento de Google y pasa a la hora nueva las que se
    movieron. Devuelve cuántas movió."""
    from app.agendas_v2 import operacion, trazabilidad
    from app.agendas_v2.reagenda import seguir_movida
    from app.agendas_v2.trazabilidad import _dt, _ms
    from app.agendas_v2.servicio import _con_calendar
    from app.models import Appointment

    ahora = ahora or datetime.utcnow()
    desde, hasta = ahora - ATRAS, ahora + ADELANTE
    filas = Appointment.query.filter(
        Appointment.calendar_evento_id.isnot(None),
        Appointment.start_time >= desde,
        Appointment.start_time < hasta,
        *operacion.filtro_vigente(),
    ).all()
    por_closer = {}
    for a in filas:
        por_closer.setdefault(a.closer_id, []).append(a)
    movidas = 0
    for user_id in _con_calendar(set(por_closer)):
        citas = por_closer[user_id]
        try:
            trazas = trazabilidad.trazas(user_id, citas, _ms(desde), _ms(hasta))
        except Exception as e:  # noqa: BLE001  (un closer con Google caído no frena a los demás)
            db.session.rollback()
            logger.error(f'[MOVIDAS] No se pudo leer el Calendar del usuario #{user_id}: {e}')
            continue
        for a in citas:
            traza = (trazas or {}).get(str(a.id)) or {}
            if traza.get('estado') != 'movido' or traza.get('inicio_nuevo') is None:
                continue
            inicio = _dt(traza['inicio_nuevo'])
            try:
                if seguir_movida(a, inicio):
                    movidas += 1
                else:
                    logger.warning(f'[MOVIDAS] Agenda #{a.id} movida en Google a {inicio}, pero a esa hora ya hay otra agenda')
            except Exception as e:  # noqa: BLE001
                db.session.rollback()
                logger.error(f'[MOVIDAS] No se pudo pasar la agenda #{a.id} a {inicio}: {e}')
    return movidas
