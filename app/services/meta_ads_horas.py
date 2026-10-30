"""El gasto de las campañas de workshop por hora (29/10/2026).

El link del grupo de WhatsApp cambia cuando termina cada taller, así que lo que llega entre el fin de
uno y el fin del siguiente es de este último. Con insights por día no se puede cortar a esa hora:
acá se trae el desglose `hourly_stats_aggregated_by_advertiser_time_zone` y se guarda en
`MetaGastoHorario` (inicio de cada hora en UTC). Solo las campañas que tienen anuncios de embudo
'workshop': el resto de la cuenta no necesita este detalle. No hace commit.
"""
import json
import logging
from datetime import date, datetime, timedelta

import pytz

from app import db
from app.models import MetaAnuncio, MetaGastoDiario, MetaGastoHorario
from app.services.meta_ads_service import CAMPOS_DE_INSIGHTS, ErrorDeMeta, _entero, _paginas, _pedir, leads_de

logger = logging.getLogger(__name__)

DESGLOSE = 'hourly_stats_aggregated_by_advertiser_time_zone'
ZONA_POR_DEFECTO = 'America/La_Paz'
CAMPANAS_POR_PEDIDO = 40  # los ids van en la URL


def zona_de_la_cuenta(base, cuenta, token):
    """La zona horaria de la cuenta publicitaria (las horas del desglose son de esa zona)."""
    nombre = _pedir(f'{base}/act_{cuenta}', {'fields': 'timezone_name', 'access_token': token}).get('timezone_name')
    try:
        return pytz.timezone(nombre)
    except (pytz.UnknownTimeZoneError, AttributeError):
        logger.error(f'Zona horaria de la cuenta {cuenta} desconocida ({nombre!r}); se usa {ZONA_POR_DEFECTO}')
        return pytz.timezone(ZONA_POR_DEFECTO)


def _campanas_de_workshop(cuenta):
    return sorted(c for (c,) in db.session.query(MetaAnuncio.campana_id).filter(
        MetaAnuncio.cuenta_id == cuenta, MetaAnuncio.embudo == 'workshop',
        MetaAnuncio.campana_id.isnot(None)).distinct())


def _insights_por_hora(base, cuenta, campanas, desde, hasta, token):
    for i in range(0, len(campanas), CAMPANAS_POR_PEDIDO):
        grupo = campanas[i:i + CAMPANAS_POR_PEDIDO]
        yield from _paginas(f'{base}/act_{cuenta}/insights', {
            'level': 'ad',
            'time_increment': 1,
            'breakdowns': DESGLOSE,
            'time_range': json.dumps({'since': desde.isoformat(), 'until': hasta.isoformat()}),
            'fields': CAMPOS_DE_INSIGHTS,
            'filtering': json.dumps([{'field': 'campaign.id', 'operator': 'IN', 'value': grupo}]),
            'limit': 500,
            'access_token': token,
        })


def _inicio_utc(fila, zona):
    """El inicio de la hora de la fila en UTC naive, o None si Meta no la trae. «13:00:00 - 13:59:59»."""
    try:
        dia = date.fromisoformat(fila['date_start'])
        hora = int(fila[DESGLOSE][:2])
    except (KeyError, TypeError, ValueError):
        return None, None
    local = zona.localize(datetime(dia.year, dia.month, dia.day, hora), is_dst=False)
    return dia, local.astimezone(pytz.utc).replace(tzinfo=None)


def sincronizar_horas(base, cuenta, token, desde, hasta):
    """Reemplaza el gasto por hora de [desde, hasta] de las campañas de workshop de la cuenta.
    Devuelve las filas guardadas. Lanza ErrorDeMeta si Meta falla."""
    campanas = _campanas_de_workshop(cuenta)
    if not campanas:
        return 0
    zona = zona_de_la_cuenta(base, cuenta, token)
    filas = list(_insights_por_hora(base, cuenta, campanas, desde, hasta, token))

    de_las_campanas = db.session.query(MetaAnuncio.meta_ad_id).filter(
        MetaAnuncio.cuenta_id == cuenta, MetaAnuncio.campana_id.in_(campanas))
    MetaGastoHorario.query.filter(
        MetaGastoHorario.fecha >= desde, MetaGastoHorario.fecha <= hasta,
        MetaGastoHorario.meta_ad_id.in_(de_las_campanas.scalar_subquery()),
    ).delete(synchronize_session=False)
    guardadas = {}
    for fila in filas:
        meta_ad_id = str(fila.get('ad_id') or '')
        dia, inicio = _inicio_utc(fila, zona)
        if not meta_ad_id or inicio is None:
            continue
        registro = guardadas.get((meta_ad_id, inicio))
        if not registro:
            registro = guardadas[(meta_ad_id, inicio)] = MetaGastoHorario(
                meta_ad_id=meta_ad_id, fecha=dia, desde_utc=inicio)
            db.session.add(registro)
        registro.gasto = float(fila.get('spend') or 0)
        registro.impresiones = _entero(fila.get('impressions'))
        registro.clics = _entero(fila.get('clicks'))
        registro.clics_enlace = _entero(fila.get('inline_link_clicks'))
        registro.leads = leads_de(fila)
    return len(guardadas)


def sincronizar_horas_de_cuentas(base, cuentas, token, desde, hasta):
    """Lo que corre después de cada sincronización diaria. Un fallo no la tumba: sin horas, los talleres
    siguen con la ventana por día. Devuelve las filas guardadas."""
    total = 0
    for cuenta in cuentas:
        try:
            total += sincronizar_horas(base, cuenta, token, desde, hasta)
        except ErrorDeMeta as error:
            logger.error(f'Gasto por hora de la cuenta {cuenta}: {error}')
    return total


def cubre(inicio, fin):
    """¿Hay desglose por hora de todo lo que gastaron los anuncios de workshop entre `inicio` y `fin`
    (UTC naive)? Cada (anuncio, día) con gasto diario necesita sus horas. Los días se toman con un día
    de margen a cada lado: la zona de la cuenta puede correr la fecha."""
    desde, hasta = inicio.date() - timedelta(days=1), fin.date() + timedelta(days=1)
    con_horas = db.session.query(MetaGastoHorario.id).filter(
        MetaGastoHorario.meta_ad_id == MetaGastoDiario.meta_ad_id, MetaGastoHorario.fecha == MetaGastoDiario.fecha)
    faltan = (db.session.query(MetaGastoDiario.id)
              .join(MetaAnuncio, MetaAnuncio.meta_ad_id == MetaGastoDiario.meta_ad_id)
              .filter(MetaAnuncio.embudo == 'workshop', MetaGastoDiario.gasto > 0,
                      MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta, ~con_horas.exists())
              .first())
    return faltan is None
