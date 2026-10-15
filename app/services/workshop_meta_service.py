"""La inversión, el CPM, el CPC y los clics de cada workshop, sacados de Meta Ads (15/10/2026).

**Qué campañas.** Las marcadas a mano como de workshop en Marketing › Meta Ads (`MetaCampanaWorkshop`):
las que llevan a las landings del taller (WS, WB, launch…). Kerwin eligió marcarlas a mano en vez de
adivinar por el nombre.

**Qué días.** Del día siguiente al taller anterior al día del taller, incluido: lo que se gastó para
llenar esa clase. Es el criterio con el que el equipo cargaba la inversión a mano (coincide en 13 de
los 15 talleres de julio a octubre de 2026, ~3% menos porque se cargaba antes de que cerrara el día).
El primer taller registrado no tiene anterior: se le cuentan los 7 días que terminan en él. OJO: las
agendas y ventas usan otra ventana, la que EMPIEZA en el taller (`workshop_metrics_service`).

**Qué números** (comparados con lo cargado a mano el 15/10): inversión = gasto; clics = todos los
clics (`clicks`); CPC = gasto / clics en el ENLACE; CPM = gasto / impresiones × 1000.

Los resultados se guardan en `WorkshopEvent.meta_*` y reemplazan a los cargados a mano mientras haya
datos de Meta para esos días; si se desmarcan todas las campañas vuelven los cargados a mano.
`recalcular()` corre después de cada sincronización con Meta, al marcar o desmarcar una campaña y al
registrar o borrar un taller (la ventana del siguiente cambia). No hace commit.
"""
from datetime import datetime, timedelta

from app import db
from app.models import MetaAnuncio, MetaCampanaWorkshop, MetaGastoDiario, WorkshopEvent

DIAS_SIN_ANTERIOR = 7


def ventanas(eventos=None):
    """{evento.id: (desde, hasta)} con los días de gasto de cada taller."""
    eventos = eventos if eventos is not None else WorkshopEvent.query.order_by(WorkshopEvent.date).all()
    eventos = sorted(eventos, key=lambda e: e.date)
    resultado = {}
    for i, evento in enumerate(eventos):
        desde = eventos[i - 1].date + timedelta(days=1) if i else evento.date - timedelta(days=DIAS_SIN_ANTERIOR - 1)
        resultado[evento.id] = (desde, evento.date)
    return resultado


def ventana_de(evento):
    return ventanas().get(evento.id)


def _de_workshop():
    """La consulta base: los días de gasto de los anuncios de las campañas marcadas."""
    marcadas = db.session.query(MetaCampanaWorkshop.campana_id)
    return (db.session.query(MetaGastoDiario)
            .join(MetaAnuncio, MetaAnuncio.meta_ad_id == MetaGastoDiario.meta_ad_id)
            .filter(MetaAnuncio.campana_id.in_(marcadas.scalar_subquery())))


def recalcular():
    """Recalcula `meta_*` de todos los talleres. No hace commit."""
    eventos = WorkshopEvent.query.order_by(WorkshopEvent.date).all()
    hay_marcadas = db.session.query(MetaCampanaWorkshop.id).first() is not None
    # Desde cuándo hay datos de Meta: antes de eso, cero gasto no es «no gastó», es «no se sabe».
    primer_dia = db.session.query(db.func.min(MetaGastoDiario.fecha)).scalar()
    dias = ventanas(eventos)
    for evento in eventos:
        desde, hasta = dias[evento.id]
        if not hay_marcadas or primer_dia is None or desde < primer_dia:
            _sin_meta(evento)
            continue
        gasto, impresiones, clics, enlace, sin_conteos = _de_workshop().filter(
            MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta,
        ).with_entities(
            db.func.coalesce(db.func.sum(MetaGastoDiario.gasto), 0.0),
            db.func.coalesce(db.func.sum(MetaGastoDiario.impresiones), 0),
            db.func.coalesce(db.func.sum(MetaGastoDiario.clics), 0),
            db.func.coalesce(db.func.sum(MetaGastoDiario.clics_enlace), 0),
            db.func.count(db.case((MetaGastoDiario.impresiones.is_(None), 1))),
        ).one()
        evento.meta_inversion = round(float(gasto), 2)
        # Días sincronizados antes de que se trajeran impresiones y clics: esos tres siguen a mano.
        conteos = (None, None, None) if sin_conteos else (int(impresiones), int(clics), int(enlace))
        evento.meta_impresiones, evento.meta_clics, evento.meta_clics_enlace = conteos
        evento.meta_actualizado_at = datetime.utcnow()


def _sin_meta(evento):
    evento.meta_inversion = evento.meta_impresiones = evento.meta_clics = evento.meta_clics_enlace = None
    evento.meta_actualizado_at = None
