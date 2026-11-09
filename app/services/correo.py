"""El correo saliente de la plataforma por la API de Gmail (ADR-W123): reemplaza al Gmail de n8n.

Una cuenta de Google (team@) conectada solo con permiso de enviar (`gmail.send`): una autorización aparte de
las de Calendar y las notas de Meet, que no se tocan. Sin contraseñas ni verificación en dos pasos. El token
vive en `integrations` (clave 'correo', payload_config: {email, token_json, conectada_en, conectada_ts,
vencida_en?, ultimo_error?}).

Se conecta con un link firmado (vence en 24 h, sirve una vez) que abre quien tiene la cuenta; vuelve por
/google/callback (app/api/google_calendar.py → app/api/correo.py). La Academia manda sus mails por
POST /api/external/academy/correo con el mensaje MIME entero.
"""
import base64
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

CLAVE = 'correo'
SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/gmail.send']
SAL = 'correo-gmail'
VIGENCIA_LINK_S = 24 * 3600
MAXIMO_BYTES = 20 * 1024 * 1024  # Gmail acepta hasta 25 MB por mensaje


class SinCorreo(Exception):
    """No hay cuenta conectada (o Google la rechazó)."""


def _integracion(crear=False):
    i = Integration.query.filter_by(key=CLAVE).first()
    if not i and crear:
        i = Integration(key=CLAVE, name='Correo saliente (Gmail)', payload_config={})
        db.session.add(i)
    return i


def _config():
    i = _integracion()
    return dict(i.payload_config or {}) if i else {}


def _guardar(**cambios):
    c = _config()
    c.update(cambios)
    _integracion(crear=True).payload_config = c
    db.session.commit()


def estado():
    c = _config()
    return {'conectada': bool(c.get('token_json')) and not c.get('vencida_en'), 'email': c.get('email'),
            'conectada_en': c.get('conectada_en'), 'vencida_en': c.get('vencida_en'), 'ultimo_error': c.get('ultimo_error')}


# --- Link firmado ---------------------------------------------------------------------------------

def _firmador():
    from itsdangerous import URLSafeTimedSerializer

    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SAL)


def link_para_conectar(base=None):
    base = (base or request.host_url).rstrip('/')
    return base + '/google/correo/conectar/' + _firmador().dumps({'t': int(time.time())})


def leer_firma(firma):
    """Motivo para mostrar si la firma no sirve; None si sirve."""
    from itsdangerous import BadSignature

    try:
        datos = _firmador().loads(firma, max_age=VIGENCIA_LINK_S)
    except BadSignature:
        return 'El link para conectar el correo venció. Pedí uno nuevo.'
    if (_config().get('conectada_ts') or 0) >= datos.get('t', 0):
        return 'Este link ya se usó. Pedí uno nuevo.'
    return None


# --- Token ----------------------------------------------------------------------------------------

def guardar_credenciales(creds):
    email = None
    try:
        info = build('oauth2', 'v2', credentials=creds, cache_discovery=False).userinfo().get().execute()
        email = (info.get('email') or '').lower() or None
    except Exception as e:  # noqa: BLE001  (sin el email la conexión sirve igual)
        logger.warning(f'[CORREO] No se pudo leer el email de la cuenta conectada: {e}')
    _guardar(email=email, token_json=creds.to_json(), conectada_en=datetime.utcnow().isoformat() + 'Z',
             conectada_ts=int(time.time()), vencida_en=None, ultimo_error=None)
    return email


def _credenciales():
    c = _config()
    if not c.get('token_json') or c.get('vencida_en'):
        raise SinCorreo('No hay una cuenta de correo conectada.')
    creds = google.oauth2.credentials.Credentials.from_authorized_user_info(json.loads(c['token_json']), SCOPES)
    if creds.valid:
        return creds
    try:
        creds.refresh(Request())
    except RefreshError as e:
        if any(codigo in str(e) for codigo in ERRORES_DE_TOKEN):
            _vencer(str(e))
            raise SinCorreo('Google dejó de aceptar la cuenta de correo.') from e
        raise
    _guardar(token_json=creds.to_json())
    return creds


def _vencer(motivo):
    from app.services import avisos_service

    logger.warning(f'[CORREO] Google rechazó el token: {motivo}')
    _guardar(vencida_en=datetime.utcnow().isoformat() + 'Z', ultimo_error=motivo[:300])
    avisos_service.avisar('google_desconectado', *avisos_service.destino(['admin']), 'Correo desconectado',
                          'Google dejó de aceptar la cuenta que manda los mails de la plataforma. Hasta que se '
                          'vuelva a conectar, los mails de la Academia no salen.')
    db.session.commit()


# --- Envío ----------------------------------------------------------------------------------------

def enviar_mime(mime):
    """Manda el mensaje MIME (bytes) tal cual. Gmail pone como remitente la cuenta conectada si el From es
    otro. Devuelve el id del mensaje en Gmail. Levanta SinCorreo o el error de Google."""
    if not mime or len(mime) > MAXIMO_BYTES:
        raise ValueError('El mensaje está vacío o pesa más de 20 MB.')
    servicio = build('gmail', 'v1', credentials=_credenciales(), cache_discovery=False)
    raw = base64.urlsafe_b64encode(mime).decode('ascii')
    r = servicio.users().messages().send(userId='me', body={'raw': raw}).execute()
    return r.get('id')
