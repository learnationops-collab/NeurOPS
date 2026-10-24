"""Entrar con Google: el usuario elige su cuenta de Google y entra a la de NeurOPS que tiene ese mismo
email (verificado por Google). No crea usuarios: quien no tiene cuenta, o la tiene sin email cargado,
entra con usuario y clave (y ahí se le pide el email para la próxima).

Usa el mismo cliente OAuth y la misma URL de vuelta (/google/callback) que Google Calendar: el
callback distingue el login por `google_oauth_proposito` en la sesión. Solo pide nombre, email y
perfil, que para Google son permisos no sensibles.
"""

import base64
import hashlib
import hmac
import re

import sqlalchemy as sa
from flask import current_app, session
from google.auth.transport.requests import Request
from itsdangerous import BadData, URLSafeTimedSerializer
from google.oauth2 import id_token

from app import db
from app.models import User
from app.services.google_service import GoogleService, _cliente

SCOPES_LOGIN = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
]
PROPOSITO = 'login'


def url_de_login(reto_movil=None):
    redirect_uri = GoogleService.redirect_uri()
    flow = GoogleService.get_flow(redirect_uri, scopes=SCOPES_LOGIN)
    url, state = flow.authorization_url(prompt='select_account')
    session['google_oauth_state'] = state
    session['google_redirect_uri'] = redirect_uri
    session['google_oauth_proposito'] = PROPOSITO
    if reto_movil:
        session['google_movil_reto'] = reto_movil
    else:
        session.pop('google_movil_reto', None)
    return url


def email_de_la_vuelta(redirect_uri, authorization_response):
    """Canjea el código de Google y devuelve el email verificado, o None si Google no lo verificó."""
    flow = GoogleService.get_flow(redirect_uri, scopes=SCOPES_LOGIN)
    flow.fetch_token(authorization_response=authorization_response)
    datos = id_token.verify_oauth2_token(flow.credentials.id_token, Request(), _cliente()[0])
    if not datos.get('email_verified') or not datos.get('email'):
        return None
    return datos['email']


def usuario_por_email(email):
    return db.session.scalar(sa.select(User).where(sa.func.lower(User.email) == email.strip().lower()))


# ---- App móvil ----
# El login se hace en el navegador del teléfono (su cookie no es la de la app), así que la vuelta no puede
# dejar una sesión que la app canjee. En su lugar entrega un código firmado de 2 minutos que la app canjea
# con POST /api/auth/google/movil/canje. Va atado a un reto (SHA-256 del verificador que solo conoce la
# app, estilo PKCE): un código interceptado no sirve sin el verificador.
ESQUEMA_MOVIL = 'learnation'
CODIGO_MOVIL_SEGUNDOS = 120
_RETO = re.compile(r'^[A-Za-z0-9_-]{43}$')  # SHA-256 en base64url, sin relleno


def reto_valido(reto):
    return bool(reto) and bool(_RETO.match(reto))


def _firmador():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='login-google-movil')


def generar_codigo_movil(usuario_id, reto):
    return _firmador().dumps({'u': usuario_id, 'c': reto})


def usuario_de_codigo_movil(codigo, verificador):
    """El usuario del código, o None si venció, está alterado o el verificador no corresponde al reto."""
    try:
        datos = _firmador().loads(codigo, max_age=CODIGO_MOVIL_SEGUNDOS)
    except BadData:
        return None
    esperado = base64.urlsafe_b64encode(hashlib.sha256(verificador.encode()).digest()).rstrip(b'=').decode()
    if not hmac.compare_digest(esperado, str(datos.get('c', ''))):
        return None
    return db.session.get(User, datos.get('u'))
