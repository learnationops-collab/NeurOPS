"""Mantiene los WorkshopEvent ya cargados sincronizados en vivo.

Antes, si caia una agenda nueva o se cerraba una venta dentro de la ventana de
un workshop ya registrado, el snapshot de metricas de ese WorkshopEvent quedaba
desactualizado hasta que alguien abria el panel y apretaba "Resync sistema".

Como funciona:

  1. `before_flush` anota en `session.info` la fecha de cada FinancialAgenda /
     FinancialSale creada o modificada, y la de cada WorkshopEvent creado o
     borrado. Se anota en el flush y no recien en el commit porque el webhook
     de n8n guarda las agendas de a lotes y la consulta anti-duplicados del
     item siguiente ya flushea el anterior: al llegar al commit `session.new`
     esta vacio y un hook que mire solo ahi pierde esas agendas.
  2. `before_commit` resuelve que WorkshopEvent es dueño de cada fecha (el
     ultimo taller registrado hasta ese dia, porque su ventana llega hasta el
     taller siguiente) y lo recalcula via `calcular_prefill`, el MISMO calculo
     del boton de resync manual. Nunca recalcula TODOS los eventos, solo los
     tocados. Registrar o borrar un taller recalcula ademas el anterior, cuya
     ventana se acorta o se alarga.

Se usa `before_commit` y no `after_commit` a proposito: en `after_commit` la
sesion ya no admite mas SQL ("session is in 'committed' state"), y correr todo
antes de commitear deja el ajuste del snapshot atomico con el cambio que lo
disparo (si algo falla, se revierte junto).
"""
from datetime import datetime, timedelta
import logging

from sqlalchemy import event

from app import db
from app.models import FinancialAgenda, FinancialSale, WorkshopEvent

logger = logging.getLogger(__name__)

_TRACKED_MODELS = (FinancialAgenda, FinancialSale)
_KEY_FECHAS = 'workshop_sync_fechas'        # dias (UTC) de agendas/ventas tocadas
_KEY_TALLERES = 'workshop_sync_talleres'    # dias de WorkshopEvent creados/borrados


def _anotar_cambios(session):
    """Registra en `session.info` que dias toca el flush que esta por pasar."""
    for obj in list(session.new) + list(session.dirty):
        if isinstance(obj, _TRACKED_MODELS):
            # Un objeto nuevo todavia no tiene `created_at`: el default se aplica
            # recien al insertar y va a ser "ahora" en UTC.
            ts = getattr(obj, 'created_at', None) or datetime.utcnow()
            session.info.setdefault(_KEY_FECHAS, set()).add(ts.date())
    for obj in list(session.new) + list(session.deleted):
        if isinstance(obj, WorkshopEvent) and obj.date:
            session.info.setdefault(_KEY_TALLERES, set()).add(obj.date)


def _evento_vigente(dia):
    """WorkshopEvent dueño de `dia`: el ultimo registrado hasta ese dia inclusive."""
    return WorkshopEvent.query.filter(WorkshopEvent.date <= dia).order_by(WorkshopEvent.date.desc()).first()


def _affected_events(fechas, talleres):
    """WorkshopEvent cuya ventana (del taller al siguiente) cae sobre alguno de estos dias."""
    afectados = {}
    for d in fechas:
        # `created_at` es UTC: el dia local puede ser el anterior, se cubren los dos.
        for candidato in (d, d - timedelta(days=1)):
            ev = _evento_vigente(candidato)
            if ev:
                afectados[ev.id] = ev
    for d in talleres:
        # El taller anterior al creado/borrado: su ventana termina donde empieza este.
        ev = _evento_vigente(d - timedelta(days=1))
        if ev:
            afectados[ev.id] = ev
    return list(afectados.values())


def register_workshop_live_sync(app):
    @event.listens_for(db.session, 'before_flush')
    def _anotar_before_flush(session, flush_context, instances):
        _anotar_cambios(session)

    @event.listens_for(db.session, 'after_rollback')
    def _olvidar_after_rollback(session):
        session.info.pop(_KEY_FECHAS, None)
        session.info.pop(_KEY_TALLERES, None)

    @event.listens_for(db.session, 'before_commit')
    def _sync_before_commit(session):
        # Lo que quedo pendiente se flushea ahora (y se anota, via before_flush)
        # para que `calcular_prefill` ya vea la agenda/venta/taller nuevo.
        session.flush()
        fechas = session.info.pop(_KEY_FECHAS, set())
        talleres = session.info.pop(_KEY_TALLERES, set())
        if not fechas and not talleres:
            return

        eventos = _affected_events(fechas, talleres)
        if not eventos:
            return

        from app.services.workshop_metrics_service import calcular_prefill

        for ev in eventos:
            try:
                data = calcular_prefill(ev.date)
            except Exception:
                # No se aborta el commit original por esto: el usuario que
                # esta creando la agenda/venta no tiene por que verse
                # bloqueado porque el recalculo del dashboard falle.
                logger.exception('No se pudo recalcular el prefill en vivo para el workshop del %s', ev.date)
                continue
            ev.aplicaciones_form = data['aplicaciones_form']
            ev.agendas_exitosas = data['agendas_exitosas']
            ev.show_up_sales_call = data['show_up_sales_call']
            ev.sales = data['sales']
            ev.cash_collected = data['cash_collected']
            ev.synced_at = datetime.utcnow()
