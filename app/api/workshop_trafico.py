"""Trafico de las landings de institute-site (pestaña «Tráfico landings»).

Las landings de institute-site cuentan cada carga de pagina con
POST /api/v1/metrics/track-visit (tabla `landing_trackings`). Las de la clase en
vivo (live-class*, live, acceso, crear-evento) tienen ademas un boton que lleva al
grupo de WhatsApp del evento: ese clic viaja por el mismo endpoint con
`evento='clic_whatsapp'` (desde el 03/10/2026; antes solo iba al Pixel de Meta).

La grabacion (/replay/) no usa track-visit sino el latido de `landing_sessions`
(una fila por visita): se suma desde ahi para que la pestaña tenga todas las
landings, y las filas viejas de track-visit de /replay/ se descartan para no
contarla dos veces. Su embudo completo vive en la pestaña «Landing grabación».

Solo agregados, sin datos personales: mismo permiso que el resto del panel.
"""
from collections import defaultdict
from datetime import timedelta
from urllib.parse import urlsplit

import pytz
from flask import jsonify
from flask_login import login_required, current_user

from app import db
from app.models import LandingTracking, LandingSession
from app.decorators import workshop_required
from app.api.metrics import EVENTO_CLIC_WHATSAPP
from app.api.workshop import bp
from app.api.workshop_landing import _rango, _pct

PATH_REPLAY = '/replay/'

# Landings cuyo boton principal lleva al grupo de WhatsApp del evento (ver
# assets/js/workshops.js de institute-site). Sirve para marcarlas aunque en el
# rango todavia no haya clics medidos.
LANDINGS_CON_WHATSAPP = {'/live/', '/acceso/', '/crear-evento/'}
PREFIJO_LIVE_CLASS = '/live-class'

FUENTES = {
    'ig': 'Instagram', 'instagram': 'Instagram',
    'fb': 'Facebook', 'facebook': 'Facebook',
    'th': 'Threads', 'threads': 'Threads',
    'google': 'Google',
}
SIN_UTM = 'Directo / sin UTM'


def normalizar_path(raw):
    """'/live-class', '/live-class/?utm=..' y 'https://x/live-class/' -> '/live-class/'."""
    if not raw:
        return '/'
    path = urlsplit(raw).path if '://' in raw else raw.split('?', 1)[0].split('#', 1)[0]
    path = '/' + path.strip().strip('/').lower()
    return path if path == '/' else path + '/'


def normalizar_fuente(utm_source):
    s = (utm_source or '').strip()
    if not s or s == '--sanitized--':
        return SIN_UTM
    return FUENTES.get(s.lower(), s)


def lleva_a_whatsapp(path):
    return path in LANDINGS_CON_WHATSAPP or path.startswith(PREFIJO_LIVE_CLASS)


def _zona():
    try:
        return pytz.timezone(getattr(current_user, 'timezone', None) or 'America/La_Paz')
    except pytz.UnknownTimeZoneError:
        return pytz.timezone('America/La_Paz')


def _tasa(clics, visitas_medidas):
    """Sin visitas medidas todavia (ni una despues del primer clic) no hay tasa: None, no 0%."""
    return _pct(clics, visitas_medidas) if visitas_medidas else None


def _nuevo():
    return {'visitas': 0, 'clics_whatsapp': 0, 'visitas_medidas': 0}


@bp.route('/landing/trafico', methods=['GET'])
@login_required
@workshop_required
def trafico_landings():
    # El rango se pide en dias locales (los del selector): 00:00 de La Paz, no de UTC.
    zona = _zona()
    desde_local, hasta_local = _rango()
    desde_local = desde_local.replace(hour=0, minute=0, second=0, microsecond=0)
    hasta_local = hasta_local.replace(hour=0, minute=0, second=0, microsecond=0)
    desde, hasta = (zona.localize(x).astimezone(pytz.utc).replace(tzinfo=None) for x in (desde_local, hasta_local))

    def dia_local(dt):
        return pytz.utc.localize(dt).astimezone(zona).strftime('%Y-%m-%d')

    # Los clics al grupo se miden desde que institute-site empezo a mandarlos. La
    # tasa visita -> WhatsApp se calcula solo con las visitas posteriores: con las
    # de antes (que nunca pudieron sumar un clic) daria casi 0 sin significar nada.
    primer_clic = db.session.query(db.func.min(LandingTracking.created_at)).filter(
        LandingTracking.evento == EVENTO_CLIC_WHATSAPP
    ).scalar()

    filas = db.session.query(
        LandingTracking.page_path, LandingTracking.utm_source,
        LandingTracking.utm_campaign, LandingTracking.evento, LandingTracking.created_at,
    ).filter(
        LandingTracking.created_at >= desde, LandingTracking.created_at < hasta,
    ).all()

    sesiones_replay = db.session.query(
        LandingSession.utm_source, LandingSession.utm_campaign, LandingSession.created_at,
    ).filter(
        LandingSession.created_at >= desde, LandingSession.created_at < hasta,
    ).all()

    por_landing = defaultdict(lambda: {**_nuevo(), 'fuentes': defaultdict(int), 'ultima': None})
    por_fuente = defaultdict(_nuevo)
    por_campana = defaultdict(_nuevo)
    por_dia = defaultdict(_nuevo)

    def sumar(path, utm_source, utm_campaign, es_clic, creado):
        clave = 'clics_whatsapp' if es_clic else 'visitas'
        fuente = normalizar_fuente(utm_source)
        landing = por_landing[path]
        landing[clave] += 1
        # Base de la tasa: visitas a landings con boton al grupo, posteriores al
        # primer clic medido (la de la fuente y la campaña tampoco cuentan /replay/).
        medida = (not es_clic and primer_clic is not None and creado >= primer_clic
                  and lleva_a_whatsapp(path))
        if medida:
            landing['visitas_medidas'] += 1
            por_fuente[fuente]['visitas_medidas'] += 1
            if utm_campaign:
                por_campana[utm_campaign.strip()]['visitas_medidas'] += 1
        if not es_clic:
            landing['fuentes'][fuente] += 1
            if landing['ultima'] is None or creado > landing['ultima']:
                landing['ultima'] = creado
        por_fuente[fuente][clave] += 1
        if utm_campaign:
            por_campana[utm_campaign.strip()][clave] += 1
        por_dia[dia_local(creado)][clave] += 1

    for page_path, utm_source, utm_campaign, evento, creado in filas:
        path = normalizar_path(page_path)
        if path == PATH_REPLAY:
            continue
        sumar(path, utm_source, utm_campaign, evento == EVENTO_CLIC_WHATSAPP, creado)

    for utm_source, utm_campaign, creado in sesiones_replay:
        sumar(PATH_REPLAY, utm_source, utm_campaign, False, creado)

    landings = []
    for path, d in por_landing.items():
        fuente_top = max(d['fuentes'].items(), key=lambda kv: kv[1])[0] if d['fuentes'] else None
        con_wa = lleva_a_whatsapp(path) or d['clics_whatsapp'] > 0
        landings.append({
            'path': path,
            'visitas': d['visitas'],
            'clics_whatsapp': d['clics_whatsapp'],
            'tasa_whatsapp': _tasa(d['clics_whatsapp'], d['visitas_medidas']) if con_wa else None,
            'lleva_whatsapp': con_wa,
            'fuente_principal': fuente_top,
            'ultima_visita': d['ultima'].isoformat() + 'Z' if d['ultima'] else None,
            'origen_datos': 'sesiones' if path == PATH_REPLAY else 'track-visit',
        })
    landings.sort(key=lambda x: (-x['visitas'], x['path']))

    def lista(agrupado, nombre, tope=None):
        items = [{nombre: k, **v} for k, v in agrupado.items()]
        for x in items:
            medidas = x.pop('visitas_medidas')
            x['tasa_whatsapp'] = _tasa(x['clics_whatsapp'], medidas)
        items.sort(key=lambda x: (-x['visitas'], -x['clics_whatsapp']))
        return items[:tope] if tope else items

    # Serie diaria completa (dias sin trafico en 0) para que el grafico no salte dias.
    claves = set(por_dia)
    cursor = desde_local.date()
    while cursor < hasta_local.date():
        claves.add(cursor.strftime('%Y-%m-%d'))
        cursor += timedelta(days=1)
    dias = []
    for clave in sorted(claves):
        d = por_dia.get(clave, _nuevo())
        dias.append({'dia': clave, 'visitas': d['visitas'], 'clics_whatsapp': d['clics_whatsapp']})

    visitas = sum(x['visitas'] for x in landings)
    visitas_wa = sum(x['visitas'] for x in landings if x['lleva_whatsapp'])
    visitas_wa_medidas = sum(por_landing[x['path']]['visitas_medidas'] for x in landings if x['lleva_whatsapp'])
    clics = sum(x['clics_whatsapp'] for x in landings)

    return jsonify({
        'rango': {'desde': desde_local.strftime('%Y-%m-%d'), 'hasta': (hasta_local - timedelta(days=1)).strftime('%Y-%m-%d')},
        'totales': {
            'visitas': visitas,
            'landings': len(landings),
            'visitas_landings_whatsapp': visitas_wa,
            'clics_whatsapp': clics,
            'tasa_whatsapp': _tasa(clics, visitas_wa_medidas),
        },
        'por_landing': landings,
        'por_fuente': lista(por_fuente, 'fuente'),
        'por_campana': lista(por_campana, 'campana', tope=12),
        'por_dia': dias,
        'whatsapp_medido_desde': primer_clic.isoformat() + 'Z' if primer_clic else None,
    }), 200
