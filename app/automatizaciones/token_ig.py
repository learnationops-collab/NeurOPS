"""El token de Instagram del Inbox (ADR-W286): de dónde sale, cómo se renueva y cómo se conecta la cuenta.

  · Vive en `integrations` (clave `instagram_token`, `payload_config`), sin migración. Si no hay, se usa
    `IG_ACCESS_TOKEN` (cargado a mano, lo de antes).
  · Un token largo de Instagram dura 60 días. El reloj del motor lo renueva cada 7 días (`renovar_si_toca`);
    antes nadie lo renovaba y al vencer se cortaba todo el Inbox.
  · «Conectar Instagram» (login con Instagram): lo pide Meta para la App Review de Human Agent y deja cambiar
    el token sin tocar Railway. `url_de_conexion` arma el permiso; `conectar` canjea el código por el token largo.
"""
import logging
import os
from datetime import datetime, timedelta
from urllib.parse import urlencode

import requests

from app import db

logger = logging.getLogger(__name__)

CLAVE = 'instagram_token'
GRAPH = 'https://graph.instagram.com'
API_VERSION = 'v24.0'
# La app «Learnation Inbox-IG» (docs/meta_app_review_human_agent.md). IG_APP_ID la pisa si cambia.
APP_ID = '1792503462024517'
PERMISOS = 'instagram_business_basic,instagram_business_manage_messages'
RENOVAR_CADA = timedelta(days=7)
REINTENTAR_CADA = timedelta(hours=6)
DURA = timedelta(days=60)


class ErrorDeConexion(Exception):
    pass


def _fila(crear=False):
    from app.models import Integration
    fila = Integration.query.filter_by(key=CLAVE).first()
    if fila is None and crear:
        fila = Integration(key=CLAVE, name='Token de Instagram del Inbox', payload_config={})
        db.session.add(fila)
    return fila


def _datos(fila):
    return dict(fila.payload_config or {}) if fila else {}


def token_actual():
    """El de la cuenta conectada; si no hay (o la base no responde), el de `IG_ACCESS_TOKEN`."""
    try:
        token = _datos(_fila()).get('token')
    except Exception:  # noqa: BLE001  (sin base, el Inbox sigue con el token de Railway)
        logger.exception('[IG TOKEN] No se pudo leer el token guardado')
        token = None
    return token or os.environ.get('IG_ACCESS_TOKEN')


def _iso(valor):
    return valor.isoformat() + 'Z' if valor else None


def _fecha(texto):
    try:
        return datetime.fromisoformat(texto) if texto else None
    except ValueError:
        return None


def estado():
    """Para la pantalla: de dónde sale el token, la cuenta y cuándo vence."""
    d = _datos(_fila())
    if d.get('token'):
        return {'origen': 'conexion', 'usuario': d.get('usuario'), 'renovado_en': _iso(_fecha(d.get('renovado_en'))),
                'vence_en': _iso(_fecha(d.get('vence_en'))), 'error': d.get('error')}
    return {'origen': 'railway' if os.environ.get('IG_ACCESS_TOKEN') else None, 'usuario': None,
            'renovado_en': None, 'vence_en': None, 'error': d.get('error')}


def _guardar(token, segundos, ahora, usuario=None):
    fila = _fila(crear=True)
    d = _datos(fila)
    d.update(token=token, renovado_en=ahora.isoformat(), error=None,
             vence_en=(ahora + (timedelta(seconds=int(segundos)) if segundos else DURA)).isoformat())
    if usuario:
        d['usuario'] = usuario
    fila.payload_config = d  # JSON entero de nuevo: SQLAlchemy no ve los cambios dentro del dict
    db.session.flush()


def _get(url, params):
    r = requests.get(url, params=params, timeout=20)
    datos = r.json() if r.content else {}
    if r.status_code >= 400 or 'error' in datos or 'error_message' in datos:
        error = datos.get('error')
        raise ErrorDeConexion((error.get('message') if isinstance(error, dict) else None)
                              or datos.get('error_message') or f'HTTP {r.status_code}')
    return datos


def renovar_si_toca(ahora):
    """Lo llama el reloj del motor. Renueva si pasaron 7 días desde la última vez (Meta pide que el token tenga
    más de 24 h). Si falla, queda el motivo a la vista y se reintenta en 6 h. True si renovó."""
    fila = _fila()
    d = _datos(fila)
    renovado = _fecha(d.get('renovado_en'))
    intento = _fecha(d.get('intento_en'))
    if renovado and ahora - renovado < RENOVAR_CADA:
        return False
    if intento and ahora - intento < REINTENTAR_CADA:
        return False
    token = d.get('token') or os.environ.get('IG_ACCESS_TOKEN')
    if not token:
        return False
    fila = fila or _fila(crear=True)
    try:
        nuevo = _get(f'{GRAPH}/refresh_access_token', {'grant_type': 'ig_refresh_token', 'access_token': token})
    except (ErrorDeConexion, requests.RequestException, ValueError) as error:
        logger.error(f'[IG TOKEN] No se pudo renovar: {error}')
        d.update(intento_en=ahora.isoformat(), error=f'No se pudo renovar: {error}'[:300])
        fila.payload_config = d
        db.session.commit()
        return False
    _guardar(nuevo['access_token'], nuevo.get('expires_in'), ahora)
    fila.payload_config = {**fila.payload_config, 'intento_en': ahora.isoformat()}
    db.session.commit()
    logger.info('[IG TOKEN] Token renovado')
    return True


def _app():
    app_id = (os.environ.get('IG_APP_ID') or APP_ID).strip()
    secreto = (os.environ.get('IG_APP_SECRET') or '').strip()
    if not secreto:
        raise ErrorDeConexion('Falta IG_APP_SECRET en Railway')
    return app_id, secreto


def url_de_conexion(redirect_uri, state):
    app_id, _ = _app()
    return 'https://www.instagram.com/oauth/authorize?' + urlencode({
        'enable_fb_login': 0, 'force_authentication': 1, 'client_id': app_id, 'redirect_uri': redirect_uri,
        'response_type': 'code', 'scope': PERMISOS, 'state': state,
    })


def conectar(codigo, redirect_uri, ahora):
    """Canjea el código del login por el token corto, después por el largo (60 días) y lo guarda."""
    app_id, secreto = _app()
    r = requests.post('https://api.instagram.com/oauth/access_token', timeout=20, data={
        'client_id': app_id, 'client_secret': secreto, 'grant_type': 'authorization_code',
        'redirect_uri': redirect_uri, 'code': codigo,
    })
    corto = r.json() if r.content else {}
    if isinstance(corto.get('data'), list) and corto['data']:
        corto = corto['data'][0]
    if r.status_code >= 400 or not corto.get('access_token'):
        raise ErrorDeConexion(corto.get('error_message') or (corto.get('error') or {}).get('message')
                              or f'HTTP {r.status_code}')
    largo = _get(f'{GRAPH}/access_token', {'grant_type': 'ig_exchange_token', 'client_secret': secreto,
                                           'access_token': corto['access_token']})
    try:
        yo = _get(f'{GRAPH}/{API_VERSION}/me', {'fields': 'user_id,username', 'access_token': largo['access_token']})
    except ErrorDeConexion:
        yo = {}
    _guardar(largo['access_token'], largo.get('expires_in'), ahora, usuario=yo.get('username'))
    db.session.commit()
    return estado()
