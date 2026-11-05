"""La conexión con el Drive de team@: el token vive en `integrations` (clave 'notas_meet', en payload_config).

La conecta alguien que tiene la cuenta de team@ y no necesariamente usuario de Work: un admin genera un
link firmado (vence en 24 h, sirve una vez), esa persona lo abre, elige team@ en Google y acepta. Vuelve por
/google/callback como el resto de los permisos de Google (app/api/google_calendar.py).
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
# Solo lo que creó Meet (notas, transcripciones, grabaciones); el email, para mostrar qué cuenta quedó.
SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/drive.meet.readonly']
SAL = 'notas-meet'
VIGENCIA_LINK_S = 24 * 3600


def _integracion(crear=False):
    i = Integration.query.filter_by(key=CLAVE).first()
    if i is None and crear:
        i = Integration(key=CLAVE, name='Notas de Meet (Drive de team@)', payload_config={})
        db.session.add(i)
    return i


def _config():
    i = _integracion()
    return dict(i.payload_config or {}) if i else {}


def _guardar(**cambios):
    """JSON sin seguimiento de cambios: se reasigna el dict entero."""
    i = _integracion(crear=True)
    i.payload_config = {**(i.payload_config or {}), **cambios}
    db.session.commit()


def estado():
    from app.models import MeetingNote

    c = _config()
    return {
        'conectada': bool(c.get('token_json')) and not c.get('vencida_en'),
        'vencida': bool(c.get('vencida_en')),
        'email': c.get('email'),
        'conectada_en': c.get('conectada_en'),
        'ultima_lectura': c.get('ultima_lectura'),
        'ultimo_error': c.get('ultimo_error'),
        'notas': MeetingNote.query.count(),
        'vinculadas': MeetingNote.query.filter(MeetingNote.appointment_id.isnot(None)).count(),
    }


# --- Link firmado ---------------------------------------------------------------------------------

def _firmador():
    from itsdangerous import URLSafeTimedSerializer

    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SAL)


def link_para_conectar():
    firma = _firmador().dumps({'t': int(time.time())})
    return request.host_url.rstrip('/') + '/google/notas/conectar/' + firma


def leer_firma(firma):
    """None si la firma es válida y no se usó; si no, el motivo para mostrar."""
    from itsdangerous import BadSignature

    try:
        datos = _firmador().loads(firma, max_age=VIGENCIA_LINK_S)
    except BadSignature:  # también la vencida
        return 'El link para conectar venció. Pedí uno nuevo.'
    if (_config().get('conectada_ts') or 0) >= datos.get('t', 0):
        return 'Este link ya se usó. Pedí uno nuevo.'
    return None


# --- Token ----------------------------------------------------------------------------------------

def guardar_credenciales(creds):
    email = None
    try:
        info = build('oauth2', 'v2', credentials=creds, cache_discovery=False).userinfo().get().execute()
        email = info.get('email')
    except Exception as e:  # noqa: BLE001  (sin el email la conexión sirve igual)
        logger.warning(f'[NOTAS_MEET] No se pudo leer el email de la cuenta conectada: {e}')
    _guardar(token_json=creds.to_json(), email=email, vencida_en=None, ultimo_error=None,
             conectada_en=datetime.utcnow().isoformat() + 'Z', conectada_ts=int(time.time()))
    return email


def credenciales():
    """Credenciales vigentes (renovadas si hacía falta) o None. Si Google rechaza el token, queda vencida
    y se avisa a admin."""
    c = _config()
    if not c.get('token_json') or c.get('vencida_en'):
        return None
    creds = google.oauth2.credentials.Credentials.from_authorized_user_info(json.loads(c['token_json']), SCOPES)
    if creds.valid:
        return creds
    if not creds.refresh_token:
        _vencer('no tiene refresh token')
        return None
    try:
        creds.refresh(Request())
    except RefreshError as e:
        if any(codigo in str(e) for codigo in ERRORES_DE_TOKEN):
            _vencer(str(e))
            return None
        raise
    _guardar(token_json=creds.to_json())
    return creds


def _vencer(motivo):
    from app.services import avisos_service

    logger.warning(f'[NOTAS_MEET] Google rechazó el token de team@: {motivo}')
    _guardar(vencida_en=datetime.utcnow().isoformat() + 'Z', ultimo_error=motivo[:300])
    avisos_service.avisar(
        'google_desconectado', *avisos_service.destino(['admin']),
        'Notas de Meet desconectadas',
        'Google dejó de aceptar la conexión con el Drive de team@. Hasta que se vuelva a conectar '
        '(Operaciones › Integraciones) no entran notas nuevas.',
    )
    db.session.commit()


def marcar_lectura(cuando):
    _guardar(ultima_lectura=cuando.isoformat() + 'Z', ultimo_error=None)


def anotar_error(motivo):
    _guardar(ultimo_error=motivo[:300])


def desconectar():
    i = _integracion()
    if i:
        i.payload_config = {}
        db.session.commit()
