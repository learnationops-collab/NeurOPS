"""Lo que Work sabe de cada anuncio publicado, para la tabla de Testeo de Learnation Marketing (25/11/2026).

La página pide a Meta (con el conector de Meta Ads) gasto, impresiones, clics y vistas de la landing, y a Work
(con el conector MCP de `app/api/mcp_publicacion.py`) lo que pasa después del clic:

- **Por anuncio de Meta** (`anuncios`): visitas a la landing y clics al grupo de WhatsApp. Los anuncios web
  mandan `utm_content={{ad.id}}` y `utm_campaign={{campaign.id}}`; las etiquetas escritas a mano se traducen
  con `utm_etiquetas` (lo mismo que Tráfico landings).
- **Por campaña de Meta, embudo de DM** (`campanas_dm`, por nombre): entrantes, calificados, agendas, ventas y
  cobrado de las palabras clave de esa campaña (`anuncios_service.tablero`, el tablero de Marketing).
- **Embudo de workshop** (`workshop`): agendas, ventas y cobrado del período. El que entra al grupo es anónimo
  hasta que agenda, así que esto no se puede partir por anuncio ni por campaña: va entero al embudo.

Todo el dinero es neto (`commission_service.cash_neto`).
"""
from collections import defaultdict
from datetime import datetime

import pytz

from app import db
from app.models import LandingTracking

ZONA_POR_DEFECTO = 'America/La_Paz'


def _landings_por_anuncio(desde, hasta, zona):
    from app.api.metrics import EVENTO_CLIC_WHATSAPP, EVENTO_VISITA
    from app.services.utm_etiquetas import codigos_de_workshop, resolver
    from app.services.workshop_meta_service import _limites_utc

    inicio, fin = _limites_utc(desde, hasta, zona)
    filas = db.session.query(
        LandingTracking.utm_campaign, LandingTracking.utm_content,
        db.func.count(db.case((db.or_(LandingTracking.evento.is_(None),
                                      LandingTracking.evento == EVENTO_VISITA), 1))),
        db.func.count(db.case((LandingTracking.evento == EVENTO_CLIC_WHATSAPP, 1))),
    ).filter(
        LandingTracking.created_at >= inicio, LandingTracking.created_at < fin,
        db.or_(LandingTracking.utm_campaign.isnot(None), LandingTracking.utm_content.isnot(None)),
        ~LandingTracking.page_path.like('%/replay%'),
    ).group_by(LandingTracking.utm_campaign, LandingTracking.utm_content).all()

    codigos = codigos_de_workshop()
    anuncios = defaultdict(lambda: {'visitas': 0, 'clics_whatsapp': 0})
    campanas = defaultdict(lambda: {'visitas': 0, 'clics_whatsapp': 0})
    for campana, contenido, visitas, clics in filas:
        campana, anuncio = resolver(campana, contenido, codigos)
        if anuncio and anuncio.isdigit():
            anuncios[anuncio]['visitas'] += visitas
            anuncios[anuncio]['clics_whatsapp'] += clics
        if campana and campana.isdigit():
            campanas[campana]['visitas'] += visitas
            campanas[campana]['clics_whatsapp'] += clics
    return dict(anuncios), dict(campanas)


def _dm_por_campana(desde, hasta):
    from app.services import anuncios_service

    suma = defaultdict(lambda: {'entrantes': 0, 'calificados': 0, 'agendas': 0, 'ventas': 0, 'cobrado': 0.0})
    for fila in anuncios_service.tablero(desde, hasta)['filas']:
        if not fila.get('campana'):
            continue
        c = suma[fila['campana']]
        for k in ('entrantes', 'calificados', 'agendas', 'ventas'):
            c[k] += fila.get(k) or 0
        c['cobrado'] = round(c['cobrado'] + (fila.get('cobrado') or 0.0), 2)
    return dict(suma)


def metricas(desde, hasta, zona_nombre=None):
    """Lo de arriba para los días locales [desde, hasta] (fechas, ambos incluidos)."""
    from app.services.workshop_metrics_service import resumen_periodo

    zona_nombre = zona_nombre or ZONA_POR_DEFECTO
    try:
        zona = pytz.timezone(zona_nombre)
    except pytz.UnknownTimeZoneError:
        raise ValueError(f'Zona horaria desconocida: {zona_nombre}') from None
    anuncios, campanas = _landings_por_anuncio(desde, hasta, zona)
    return {
        'desde': desde.isoformat(),
        'hasta': hasta.isoformat(),
        'zona': zona_nombre,
        'moneda': 'USD',
        'anuncios': anuncios,
        'campanas_landing': campanas,
        'campanas_dm': _dm_por_campana(desde, hasta),
        'workshop': resumen_periodo(desde, hasta, zona_nombre),
        'generado': datetime.utcnow().isoformat() + 'Z',
    }
