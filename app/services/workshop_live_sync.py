"""Mantiene los WorkshopEvent ya cargados sincronizados en vivo.

Antes, si caia una agenda nueva o se cerraba una venta el mismo dia (o dentro
de la ventana de la grabacion) de un workshop ya registrado, el snapshot de
metricas de ese WorkshopEvent quedaba desactualizado hasta que alguien abria
el panel y apretaba "Resync sistema" a mano.

Este modulo engancha un listener `before_commit` sobre la sesion global de
SQLAlchemy: si el commit que esta por pasar crea o modifica una
FinancialAgenda o una FinancialSale, recalcula (via `calcular_prefill`, el
mismo calculo que ya usaba el boton de resync manual) solo los WorkshopEvent
cuya ventana vivo+landing pudo verse afectada -- nunca TODOS los eventos
cargados, que es justo el recalculo caro que el resync manual ya evitaba -- y
dejar los cambios en el snapshot como parte del MISMO commit (antes de que se
flushee, para que `calcular_prefill` ya vea la agenda/venta nueva via
autoflush). No hace falta un segundo commit ni tocar los ~7 sitios del codigo
que crean estos dos modelos: el hook vive a nivel de sesion.

Se usa `before_commit` y no `after_commit` a proposito: en `after_commit` la
sesion ya no admite mas SQL ("session is in 'committed' state"), y ademas
correr todo dentro del antes-de-commitear deja el ajuste del snapshot atomico
con el cambio que lo disparo (si algo falla, se revierte junto).
"""
from datetime import datetime, timedelta
import logging

from sqlalchemy import event

from app import db
from app.models import FinancialAgenda, FinancialSale, WorkshopEvent

logger = logging.getLogger(__name__)

_TRACKED_MODELS = (FinancialAgenda, FinancialSale)


def _changed_dates(session):
    """Fechas (date) de los registros de agenda/venta creados o modificados en este commit."""
    dates = set()
    for obj in list(session.new) + list(session.dirty):
        if isinstance(obj, _TRACKED_MODELS):
            ts = getattr(obj, 'created_at', None)
            if ts:
                dates.add(ts.date())
    return dates


def _affected_events(changed_dates):
    """WorkshopEvent ya registrados cuya ventana (vivo + grabacion) cae sobre alguna de estas fechas."""
    if not changed_dates:
        return []
    from app.services.workshop_metrics_service import DIAS_VENTANA_LANDING, _ventana_landing

    min_d = min(changed_dates) - timedelta(days=DIAS_VENTANA_LANDING)
    max_d = max(changed_dates)
    candidatos = WorkshopEvent.query.filter(
        WorkshopEvent.date >= min_d, WorkshopEvent.date <= max_d
    ).all()

    afectados = []
    for ev in candidatos:
        _, fin_landing, _ = _ventana_landing(ev.date)
        if any(ev.date <= d <= fin_landing for d in changed_dates):
            afectados.append(ev)
    return afectados


def register_workshop_live_sync(app):
    @event.listens_for(db.session, 'before_commit')
    def _sync_before_commit(session):
        dates = _changed_dates(session)
        eventos = _affected_events(dates)
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
