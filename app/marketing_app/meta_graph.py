"""Las llamadas a la Graph API de Meta del puente de Learnation Marketing (ADR-W278).

Token: `META_ADS_WRITE_TOKEN` (un usuario del sistema con `ads_management`, para crear y publicar) y, si no
está, `META_ADS_TOKEN` (el de solo lectura del gasto, que alcanza para leer). La versión, la de
`meta_ads_service`.
"""
import json
import logging
import os

import requests

from app.services import meta_ads_service

logger = logging.getLogger(__name__)

GRAPH = 'https://graph.facebook.com'
POR_PEDIDO = 50


class ErrorDeTool(Exception):
    """Lo que la página recibe como el error de una herramienta (`code` + `message`)."""

    def __init__(self, message, code='tool_error', retryable=False, extra=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.extra = extra or {}


def _token():
    t = (os.environ.get('META_ADS_WRITE_TOKEN') or os.environ.get('META_ADS_TOKEN') or '').strip()
    if not t:
        raise ErrorDeTool('Work no tiene el token de Meta (META_ADS_WRITE_TOKEN en Railway).')
    return t


def _base():
    return f'{GRAPH}/{meta_ads_service.configuracion()[2]}'


def _error(r):
    try:
        e = r.json().get('error') or {}
    except ValueError:
        e = {}
    partes = [e.get('error_user_title'), e.get('error_user_msg') or e.get('message')]
    texto = ' — '.join(p for p in partes if p) or f'Meta respondió {r.status_code}'
    sub = e.get('error_subcode')
    if sub:
        texto += f' (subcode {sub})'
    reintentable = r.status_code >= 500 or e.get('code') in (1, 2, 4, 17, 32, 613)
    return ErrorDeTool(texto[:900], code='upstream_error' if r.status_code >= 500 else 'tool_error',
                       retryable=reintentable, extra={'error_subcode': sub, 'error_code': e.get('code')})


def _params(params):
    out = {}
    for k, v in (params or {}).items():
        if v is None:
            continue
        if isinstance(v, bool):
            out[k] = 'true' if v else 'false'
        else:
            out[k] = json.dumps(v) if isinstance(v, (dict, list)) else v
    out['access_token'] = _token()
    return out


def get(ruta, params=None):
    try:
        r = requests.get(f'{_base()}/{ruta.lstrip("/")}', params=_params(params), timeout=60)
    except requests.RequestException as e:
        raise ErrorDeTool(f'Meta no respondió: {e}', code='server_unavailable', retryable=True) from e
    if r.status_code != 200:
        raise _error(r)
    return r.json()


def post(ruta, data=None):
    try:
        r = requests.post(f'{_base()}/{ruta.lstrip("/")}', data=_params(data), timeout=90)
    except requests.RequestException as e:
        raise ErrorDeTool(f'Meta no respondió: {e}', code='server_unavailable', retryable=True) from e
    if r.status_code != 200:
        raise _error(r)
    return r.json()


def por_ids(ids, campos):
    """{id: objeto} de varios ids, de a 50 (el máximo de `?ids=`). Los que no existen no vienen."""
    out = {}
    ids = [str(i) for i in ids if i]
    for i in range(0, len(ids), POR_PEDIDO):
        grupo = ids[i:i + POR_PEDIDO]
        try:
            out.update(get('', {'ids': ','.join(grupo), 'fields': campos}))
        except ErrorDeTool as e:
            if len(grupo) == 1:
                logger.info(f'[MARKETING_APP] {grupo[0]} no se pudo leer: {e.message}')
                continue
            for uno in grupo:  # un id borrado hace fallar el pedido entero: se piden de a uno
                out.update(por_ids([uno], campos))
    return out


def cuenta(ad_account_id):
    c = str(ad_account_id or '').strip().removeprefix('act_')
    if not c.isdigit():
        raise ErrorDeTool('Falta la cuenta publicitaria (ad_account_id).', code='invalid_argument')
    return f'act_{c}'
