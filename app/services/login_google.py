"""Entrar con Google: el usuario elige su cuenta de Google y entra a la de NeurOPS que tiene ese mismo
email (verificado por Google). No crea usuarios: quien no tiene cuenta, o la tiene sin email cargado,
entra con usuario y clave (y ahí se le pide el email para la próxima).

Usa el mismo cliente OAuth y la misma URL de vuelta (/google/callback) que Google Calendar: el
callback distingue el login por `google_oauth_proposito` en la sesión. Solo pide nombre, email y
perfil, que para Google son permisos no sensibles.
"""

import sqlalchemy as sa
from flask import session
from google.auth.transport.requests import Request
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


def url_de_login():
    redirect_uri = GoogleService.redirect_uri()
    flow = GoogleService.get_flow(redirect_uri, scopes=SCOPES_LOGIN)
    url, state = flow.authorization_url(prompt='select_account')
    session['google_oauth_state'] = state
    session['google_redirect_uri'] = redirect_uri
    session['google_oauth_proposito'] = PROPOSITO
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
