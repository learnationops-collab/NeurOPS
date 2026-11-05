"""Las cuentas de Google de cuyos Drives salen las notas: varias a la vez (santiago@, team@, mario@…). Los
tokens viven en `integrations` (clave 'notas_meet', en payload_config; forma en _config()).

Se conecta desde Operaciones › Integraciones con la cuenta del navegador, o con un link firmado (vence en
24 h, sirve una vez) que abre quien tenga la otra cuenta. Vuelve por /google/callback como el resto de los
permisos de Google (app/api/google_calendar.py). Conectar una cuenta que ya estaba la reemplaza.
"""
import json
import logging
import time
from datetime import datetime

import google.oauth2.credentials
from flask import current_app, request
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app import db
from app.models import Integration
from app.services.google_service import ERRORES_DE_TOKEN

logger = logging.getLogger(__name__)

CLAVE = 'notas_meet'
# drive.readonly y no drive.meet.readonly: las notas las escribe Gemini, no Meet, y con ese scope Google
# las lista pero no deja exportarlas (appNotAuthorizedToFile, probado el 05/11/2026). El email, para
# mostrar qué cuenta quedó.
SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/drive.readonly']
SAL = 'notas-meet'
VIGENCIA_LINK_S = 24 * 3600


def _integracion(crear=False):
    i = Integration.query.filter_by(key=CLAVE).first()
    if i is None and crear:
        i = Integration(key=CLAVE, name='Notas de Meet (Drive)', payload_config={})
        db.session.add(i)
    return i


_DE_LA_CUENTA = ('token_json', 'email', 'conectada_en', 'ultima_lectura', 'ultimo_error', 'vencida_en')


def _config():
    """payload_config: {cuentas: {email: {token_json, conectada_en, ultima_lectura, ultimo_error,
    vencida_en}}, conectada_ts, reglas: {serie: categoría}}. La forma vieja (una sola cuenta, todo suelto)
    se lee como una cuenta más."""
    i = _integracion()
    c = dict(i.payload_config or {}) if i else {}
    if c.get('token_json'):
        vieja = {k: c.pop(k, None) for k in _DE_LA_CUENTA}
        c['cuentas'] = {**(c.get('cuentas') or {}), (vieja.pop('email') or 'sin-email'): vieja}
    for k in _DE_LA_CUENTA:
        c.pop(k, None)
    return c


def _guardar_config(c):
    """JSON sin seguimiento de cambios: se reasigna el dict entero."""
    _integracion(crear=True).payload_config = c
    db.session.commit()


def cuentas():
    return _config().get('cuentas') or {}


def _guardar(email, **cambios):
    c = _config()
    todas = dict(c.get('cuentas') or {})
    todas[email] = {**todas.get(email, {}), **cambios}
    c['cuentas'] = todas
    _guardar_config(c)


def _conectada(cuenta):
    return bool(cuenta.get('token_json')) and not cuenta.get('vencida_en')


def estado():
    from sqlalchemy import func

    from app.models import MeetingNote

    por_cuenta = dict(db.session.query(MeetingNote.account_email, func.count()).group_by(MeetingNote.account_email))
    lista = [{
        'email': email,
        'conectada': _conectada(c),
        'vencida': bool(c.get('vencida_en')),
        'conectada_en': c.get('conectada_en'),
        'ultima_lectura': c.get('ultima_lectura'),
        'ultimo_error': c.get('ultimo_error'),
        'notas': por_cuenta.get(email, 0),
    } for email, c in sorted(cuentas().items())]
    return {
        'conectada': any(c['conectada'] for c in lista),
        'cuentas': lista,
        'notas': MeetingNote.query.count(),
        'vinculadas': MeetingNote.query.filter(MeetingNote.appointment_id.isnot(None)).count(),
    }


def reglas():
    """{serie: categoría} elegidas a mano (categorias.py)."""
    return _config().get('reglas') or {}


def guardar_regla(serie, categoria):
    """`categoria` None borra la regla."""
    c = _config()
    r = dict(c.get('reglas') or {})
    if categoria:
        r[serie] = categoria
    else:
        r.pop(serie, None)
    c['reglas'] = r
    _guardar_config(c)


# --- Link firmado ---------------------------------------------------------------------------------

def _firmador():
    from itsdangerous import URLSafeTimedSerializer

    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SAL)


def link_para_conectar(academia=None):
    """`academia`: ruta de la Academia a la que se vuelve después de conectar (si no, una página de Work)."""
    datos = {'t': int(time.time())}
    if academia:
        datos['a'] = academia
    return request.host_url.rstrip('/') + '/google/notas/conectar/' + _firmador().dumps(datos)


def leer_firma(firma):
    """(motivo, datos): motivo None si la firma es válida y no se usó; si no, el texto para mostrar."""
    from itsdangerous import BadSignature

    try:
        datos = _firmador().loads(firma, max_age=VIGENCIA_LINK_S)
    except BadSignature:  # también la vencida
        return 'El link para conectar venció. Pedí uno nuevo.', {}
    if (_config().get('conectada_ts') or 0) >= datos.get('t', 0):  # una conexión invalida los links anteriores
        return 'Este link ya se usó. Pedí uno nuevo.', datos
    return None, datos


# --- Token ----------------------------------------------------------------------------------------

def guardar_credenciales(creds):
    """Suma la cuenta (o la reemplaza, si ya estaba). Devuelve su email."""
    email = None
    try:
        info = build('oauth2', 'v2', credentials=creds, cache_discovery=False).userinfo().get().execute()
        email = (info.get('email') or '').lower() or None
    except Exception as e:  # noqa: BLE001  (sin el email la conexión sirve igual)
        logger.warning(f'[NOTAS_MEET] No se pudo leer el email de la cuenta conectada: {e}')
    email = email or f'cuenta-{int(time.time())}'
    c = _config()
    todas = dict(c.get('cuentas') or {})
    # Sin ultima_lectura: la cuenta nueva se lee entera la primera vez.
    todas[email] = {'token_json': creds.to_json(), 'conectada_en': datetime.utcnow().isoformat() + 'Z'}
    c.update(cuentas=todas, conectada_ts=int(time.time()))
    _guardar_config(c)
    return email


def credenciales(email):
    """Credenciales vigentes de la cuenta (renovadas si hacía falta) o None. Si Google rechaza el token,
    queda vencida y se avisa a admin."""
    c = cuentas().get(email) or {}
    if not _conectada(c):
        return None
    creds = google.oauth2.credentials.Credentials.from_authorized_user_info(json.loads(c['token_json']), SCOPES)
    if creds.valid:
        return creds
    if not creds.refresh_token:
        _vencer(email, 'no tiene refresh token')
        return None
    try:
        creds.refresh(Request())
    except RefreshError as e:
        if any(codigo in str(e) for codigo in ERRORES_DE_TOKEN):
            _vencer(email, str(e))
            return None
        raise
    _guardar(email, token_json=creds.to_json())
    return creds


def _vencer(email, motivo):
    from app.services import avisos_service

    logger.warning(f'[NOTAS_MEET] Google rechazó el token de {email}: {motivo}')
    _guardar(email, vencida_en=datetime.utcnow().isoformat() + 'Z', ultimo_error=motivo[:300])
    avisos_service.avisar(
        'google_desconectado', *avisos_service.destino(['admin']),
        'Notas de Meet desconectadas',
        f'Google dejó de aceptar la conexión con el Drive de {email}. Hasta que se vuelva a conectar '
        '(Operaciones › Integraciones) no entran sus notas nuevas.',
    )
    db.session.commit()


def marcar_lectura(email, cuando):
    _guardar(email, ultima_lectura=cuando.isoformat() + 'Z', ultimo_error=None)


def anotar_error(email, motivo):
    _guardar(email, ultimo_error=motivo[:300])


def desconectar(email):
    """Saca la cuenta. Sus notas quedan."""
    c = _config()
    todas = dict(c.get('cuentas') or {})
    if todas.pop(email, None) is None:
        return False
    c['cuentas'] = todas
    _guardar_config(c)
    return True
