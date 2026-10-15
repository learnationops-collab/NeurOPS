"""La inversión, el CPM, el CPC y los clics de cada workshop, sacados de Meta Ads (15/10/2026).

**Qué anuncios.** Los de embudo 'workshop' (`MetaAnuncio.embudo`): los que llevan a la clase en vivo
(«CLASE GRATIS: cómo estudiar…»). El embudo lo pone solo la sincronización
(`meta_ads_service.detectar_embudo`) y se corrige a mano en Marketing › Meta Ads. Kerwin (15/10/2026)
eligió esto en vez de marcar campañas enteras: dentro de campañas «WS» hay anuncios de DM («Comenta
DIAGNÓSTICO», las guías LPF) que no llenan la clase.

**Qué días.** Del día siguiente al taller anterior al día del taller, incluido: lo que se gastó para
llenar esa clase. Es el criterio con el que el equipo cargaba la inversión a mano (coincide en 13 de
los 15 talleres de julio a octubre de 2026, ~3% menos porque se cargaba antes de que cerrara el día).
El primer taller registrado no tiene anterior: se le cuentan los 7 días que terminan en él. OJO: las
agendas y ventas usan otra ventana, la que EMPIEZA en el taller (`workshop_metrics_service`).

**Qué números** (comparados con lo cargado a mano el 15/10): inversión = gasto; clics = todos los
clics (`clicks`); CPC = gasto / clics en el ENLACE; CPM = gasto / impresiones × 1000.

Los resultados se guardan en `WorkshopEvent.meta_*` y reemplazan a los cargados a mano mientras haya
datos de Meta para esos días; si no queda ningún anuncio de workshop vuelven los cargados a mano.
`recalcular()` corre después de cada sincronización con Meta, al cambiar el embudo de un anuncio y al
registrar o borrar un taller (la ventana del siguiente cambia). No hace commit.
"""
from collections import defaultdict
from datetime import datetime, timedelta

import pytz

from app import db
from app.models import LandingTracking, MetaAnuncio, MetaGastoDiario, WorkshopEvent

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
    """La consulta base: los días de gasto de los anuncios de workshop."""
    return (db.session.query(MetaGastoDiario)
            .join(MetaAnuncio, MetaAnuncio.meta_ad_id == MetaGastoDiario.meta_ad_id)
            .filter(MetaAnuncio.embudo == 'workshop'))


def _anuncios_de_workshop():
    return db.session.query(MetaAnuncio.id).filter(MetaAnuncio.embudo == 'workshop').count()


def recalcular():
    """Recalcula `meta_*` de todos los talleres. No hace commit."""
    eventos = WorkshopEvent.query.order_by(WorkshopEvent.date).all()
    hay_de_workshop = _anuncios_de_workshop() > 0
    # Desde cuándo hay datos de Meta: antes de eso, cero gasto no es «no gastó», es «no se sabe».
    primer_dia = db.session.query(db.func.min(MetaGastoDiario.fecha)).scalar()
    dias = ventanas(eventos)
    for evento in eventos:
        desde, hasta = dias[evento.id]
        if not hay_de_workshop or primer_dia is None or desde < primer_dia:
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


def _metricas(gasto, impresiones, clics, enlace):
    return {
        'gasto': round(gasto, 2), 'impresiones': impresiones, 'clics': clics, 'clics_enlace': enlace,
        'cpm': round(gasto / impresiones * 1000, 2) if impresiones else None,
        'cpc': round(gasto / enlace, 2) if enlace else None,
        'ctr': round(clics / impresiones * 100, 2) if impresiones else None,
    }


def _limites_utc(desde, hasta, zona):
    """[00:00 local de `desde`, 00:00 local del día siguiente a `hasta`) en UTC naive."""
    inicio = zona.localize(datetime.combine(desde, datetime.min.time()))
    fin = zona.localize(datetime.combine(hasta + timedelta(days=1), datetime.min.time()))
    return (inicio.astimezone(pytz.utc).replace(tzinfo=None), fin.astimezone(pytz.utc).replace(tzinfo=None))


def _landings_por_campana(desde, hasta, zona):
    """{campana_id: (visitas, clics_whatsapp)} de las landings del taller en esos días. Los anuncios
    de Meta mandan el id de la campaña en `utm_campaign` (visto el 15/10/2026); la grabación
    (/replay/) es otro embudo y queda afuera."""
    from app.api.metrics import EVENTO_CLIC_WHATSAPP

    inicio, fin = _limites_utc(desde, hasta, zona)
    filas = db.session.query(
        LandingTracking.utm_campaign,
        db.func.count(db.case((db.or_(LandingTracking.evento.is_(None),
                                      LandingTracking.evento != EVENTO_CLIC_WHATSAPP), 1))),
        db.func.count(db.case((LandingTracking.evento == EVENTO_CLIC_WHATSAPP, 1))),
    ).filter(
        LandingTracking.created_at >= inicio, LandingTracking.created_at < fin,
        LandingTracking.utm_campaign.isnot(None), ~LandingTracking.page_path.like('%/replay%'),
    ).group_by(LandingTracking.utm_campaign).all()
    resultado = defaultdict(lambda: [0, 0])
    for campana, visitas, clics in filas:
        resultado[campana.strip()][0] += visitas
        resultado[campana.strip()][1] += clics
    return resultado


def desglose(evento, zona=None):
    """Los anuncios de workshop en los días del taller (del siguiente al anterior hasta el suyo)."""
    return desglose_periodo(*ventana_de(evento), zona)


def desglose_periodo(desde, hasta, zona=None):
    """Los anuncios de workshop en [desde, hasta], por campaña › conjunto › anuncio, con gasto,
    impresiones, clics, CPM, CPC y CTR, y por campaña las visitas a las landings y los clics al grupo
    de WhatsApp que trajo. Lo usan el embudo de cada taller y Rendimiento › Workshop."""
    zona = zona or pytz.timezone('America/La_Paz')
    filas = _de_workshop().filter(
        MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta,
    ).with_entities(
        MetaAnuncio.campana_id, MetaAnuncio.campana, MetaAnuncio.conjunto_id, MetaAnuncio.conjunto,
        MetaAnuncio.meta_ad_id, MetaAnuncio.nombre, MetaAnuncio.estado,
        db.func.sum(MetaGastoDiario.gasto), db.func.coalesce(db.func.sum(MetaGastoDiario.impresiones), 0),
        db.func.coalesce(db.func.sum(MetaGastoDiario.clics), 0),
        db.func.coalesce(db.func.sum(MetaGastoDiario.clics_enlace), 0),
    ).group_by(MetaAnuncio.campana_id, MetaAnuncio.campana, MetaAnuncio.conjunto_id, MetaAnuncio.conjunto,
               MetaAnuncio.meta_ad_id, MetaAnuncio.nombre, MetaAnuncio.estado).all()
    landings = _landings_por_campana(desde, hasta, zona)

    campanas = {}
    for cid, campana, sid, conjunto, ad_id, nombre, estado, gasto, imp, clics, enlace in filas:
        c = campanas.setdefault(cid, {'campana_id': cid, 'nombre': campana, 'suma': [0.0, 0, 0, 0], 'conjuntos': {}})
        s = c['conjuntos'].setdefault(sid or conjunto, {'nombre': conjunto, 'suma': [0.0, 0, 0, 0], 'anuncios': []})
        valores = (float(gasto or 0), int(imp), int(clics), int(enlace))
        for grupo in (c, s):
            grupo['suma'] = [a + b for a, b in zip(grupo['suma'], valores)]
        s['anuncios'].append({'meta_ad_id': ad_id, 'nombre': nombre, 'estado': estado, **_metricas(*valores)})

    resultado, total = [], [0.0, 0, 0, 0]
    total_visitas = total_whatsapp = 0
    for c in sorted(campanas.values(), key=lambda x: -x['suma'][0]):
        visitas, whatsapp = landings.get(c['campana_id'], (0, 0))
        total = [a + b for a, b in zip(total, c['suma'])]
        total_visitas += visitas
        total_whatsapp += whatsapp
        resultado.append({
            'campana_id': c['campana_id'], 'nombre': c['nombre'], **_metricas(*c['suma']),
            'visitas': visitas, 'clics_whatsapp': whatsapp,
            'costo_whatsapp': round(c['suma'][0] / whatsapp, 2) if whatsapp else None,
            'conjuntos': [
                {'nombre': s['nombre'], **_metricas(*s['suma']),
                 'anuncios': sorted(s['anuncios'], key=lambda a: -a['gasto'])}
                for s in sorted(c['conjuntos'].values(), key=lambda x: -x['suma'][0])
            ],
        })
    return {
        'desde': desde.isoformat(), 'hasta': hasta.isoformat(),
        'anuncios_workshop': _anuncios_de_workshop(),
        'totales': {**_metricas(*total), 'visitas': total_visitas, 'clics_whatsapp': total_whatsapp,
                    'costo_whatsapp': round(total[0] / total_whatsapp, 2) if total_whatsapp else None},
        'campanas': resultado,
    }


def _sin_meta(evento):
    evento.meta_inversion = evento.meta_impresiones = evento.meta_clics = evento.meta_clics_enlace = None
    evento.meta_actualizado_at = None
