"""Lo que el closer hace con la agenda en su Google Calendar pasa a Work. Corre en el scheduler
(reminder_scheduler) cada MINUTOS.

- Movida: Work la pasa a la hora nueva (reagenda.seguir_movida). Antes dejaba de bloquear su horario viejo
  (Google manda, ver servicio.sigue_en_google) pero seguía figurando a esa hora: el panel mostraba dos
  agendas a la misma hora y la de verdad, en otra.
- Cancelada o borrada, si todavía no pasó: Work la cancela como el botón «Canceló» de la ficha. Los closers
  cancelan en Google y casi nunca lo reportan (3 de 241 en los 30 días al 26/10/2026). Una que ya pasó no se
  toca: borrar el evento después de la llamada no dice qué pasó, eso lo reporta el closer.
"""

import logging
from datetime import datetime, timedelta

from app import db

logger = logging.getLogger(__name__)

MINUTOS = 15
# Qué agendas se revisan: las vigentes que empiezan entre ATRAS antes y ADELANTE después de ahora.
ATRAS = timedelta(hours=2)
ADELANTE = timedelta(days=30)
CANCELADAS = ('cancelado', 'borrado')


def _cancelar(appt, estado):
    """Cancela la agenda en Work (CloserService.process_agenda con 'Cancelado': libera el horario, deja el
    comentario y actualiza el registro de agendas). El evento ya no está: no se intenta borrar de nuevo."""
    from app.services.closer_service import CloserService

    appt.google_event_id = None
    como = 'canceló' if estado == 'cancelado' else 'borró'
    CloserService.process_agenda(appt.closer_id, appt.id, {
        'status': 'Cancelado', 'role': 'closer',
        'note': f'el closer {como} el evento en su Google Calendar (lo detectó Work)',
    }, is_admin=True)


def sincronizar_movidas(ahora=None):
    """Revisa las agendas vigentes vinculadas a un evento de Google: pasa a la hora nueva las que se
    movieron y cancela las futuras cuyo evento se canceló o se borró. Devuelve cuántas cambió."""
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
    cambiadas = 0
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
            estado = traza.get('estado')
            try:
                if estado == 'movido' and traza.get('inicio_nuevo') is not None:
                    inicio = _dt(traza['inicio_nuevo'])
                    if seguir_movida(a, inicio):
                        cambiadas += 1
                    else:
                        logger.warning(f'[MOVIDAS] Agenda #{a.id} movida en Google a {inicio}, pero a esa hora ya hay otra agenda')
                elif estado in CANCELADAS and a.start_time > ahora:
                    _cancelar(a, estado)
                    cambiadas += 1
                    logger.info(f'[MOVIDAS] Agenda #{a.id} cancelada en Work: su evento en Google está {estado}')
            except Exception as e:  # noqa: BLE001
                db.session.rollback()
                logger.error(f'[MOVIDAS] No se pudo seguir la agenda #{a.id} ({estado}): {e}')
    return cambiadas
