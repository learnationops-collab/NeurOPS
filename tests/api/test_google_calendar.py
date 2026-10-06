"""Conectar Google Calendar y qué pasa cuando Google deja de aceptar el token.

Lo que importa: la URL de vuelta sale del dominio del request (no de variables que apuntan a otro
entorno ni del Referer), cancelar o fallar vuelve a la app con el motivo, y un token que Google
rechaza deja de contar como conectado (también para Agendas 2.0) y avisa una sola vez.
"""

import json
from urllib.parse import parse_qs, urlparse

import pytest
from google.auth.exceptions import RefreshError

from app.models import GoogleCalendarToken, Notification
from app.services import google_service
from app.services.google_service import GoogleService

TOKEN_VENCIDO = json.dumps({
    'token': 'viejo', 'refresh_token': 'r', 'client_id': 'x', 'client_secret': 'y',
    'expiry': '2020-01-01T00:00:00Z',
})


@pytest.fixture(autouse=True)
def cliente_google(monkeypatch):
    monkeypatch.setenv('GOOGLE_CLIENT_ID', 'id-de-prueba.apps.googleusercontent.com')
    monkeypatch.setenv('GOOGLE_CLIENT_SECRET', 'secreto')


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer')


def _login(client, headers, **kw):
    r = client.get('/api/google/login', headers={**headers, **kw})
    assert r.status_code == 200
    return parse_qs(urlparse(r.get_json()['auth_url']).query)


def test_la_url_de_vuelta_es_la_del_dominio_del_request(client, closer, auth_headers):
    q = _login(client, auth_headers(closer), Referer='https://otro-sitio.com/x')
    assert q['redirect_uri'] == ['http://localhost/google/callback']
    assert q['client_id'] == ['id-de-prueba.apps.googleusercontent.com'] and q['access_type'] == ['offline']


def test_las_variables_viejas_no_mandan_a_otro_entorno(client, closer, auth_headers, monkeypatch):
    monkeypatch.setenv('REDIRECT_URI_PROD', 'https://work.thelearnation.com/google/callback')
    assert _login(client, auth_headers(closer))['redirect_uri'] == ['http://localhost/google/callback']


def test_google_redirect_uri_la_fija(client, closer, auth_headers, monkeypatch):
    monkeypatch.setenv('GOOGLE_REDIRECT_URI', 'https://develop.ejemplo.com/google/callback')
    assert _login(client, auth_headers(closer))['redirect_uri'] == ['https://develop.ejemplo.com/google/callback']


def test_los_nombres_viejos_del_cliente_siguen_andando(client, closer, auth_headers, monkeypatch):
    monkeypatch.delenv('GOOGLE_CLIENT_ID')
    monkeypatch.setenv('CLIENT_ID', 'viejo.apps.googleusercontent.com')
    assert _login(client, auth_headers(closer))['client_id'] == ['viejo.apps.googleusercontent.com']


def test_cancelar_en_google_vuelve_a_configuracion(client, closer, auth_headers):
    h = auth_headers(closer)
    state = _login(client, h)['state'][0]
    r = client.get(f'/google/callback?error=access_denied&state={state}', headers=h)
    assert r.status_code == 302
    assert r.location == '/closer/deck?vista=configuracion&google_connected=cancelado'
    assert GoogleCalendarToken.query.count() == 0


def test_un_state_que_no_coincide_no_conecta(client, closer, auth_headers):
    h = auth_headers(closer)
    _login(client, h)
    r = client.get('/google/callback?code=abc&state=otro', headers=h)
    assert r.location.endswith('google_connected=error') and GoogleCalendarToken.query.count() == 0


class FlowFalso:
    def __init__(self, falla=None):
        self.falla = falla
        self.credentials = type('C', (), {'to_json': lambda self: '{"token": "nuevo"}'})()

    def fetch_token(self, authorization_response):
        if self.falla:
            raise self.falla


def test_conectar_guarda_el_token_y_reconectar_lo_revive(client, closer, auth_headers, db, monkeypatch):
    db.session.add(GoogleCalendarToken(user_id=closer.id, token_json='{}', vencido_en=db.func.now()))
    db.session.commit()
    h = auth_headers(closer)
    state = _login(client, h)['state'][0]
    monkeypatch.setattr(GoogleService, 'get_flow', staticmethod(lambda uri: FlowFalso()))
    r = client.get(f'/google/callback?code=abc&state={state}', headers=h)
    assert r.location.endswith('google_connected=success')
    token = GoogleCalendarToken.query.one()
    assert token.token_json == '{"token": "nuevo"}' and token.vencido_en is None


def test_si_google_no_da_el_token_vuelve_con_error(client, closer, auth_headers, monkeypatch):
    h = auth_headers(closer)
    state = _login(client, h)['state'][0]
    monkeypatch.setattr(GoogleService, 'get_flow', staticmethod(lambda uri: FlowFalso(falla=ValueError('invalid_grant'))))
    r = client.get(f'/google/callback?code=abc&state={state}', headers=h)
    assert r.location.endswith('google_connected=error') and GoogleCalendarToken.query.count() == 0


def test_frontend_url_solo_cambia_el_dominio_de_vuelta(client, make_user, auth_headers, monkeypatch):
    monkeypatch.setenv('FRONTEND_URL', 'http://localhost:5173/')
    admin = make_user(role='admin')
    h = auth_headers(admin)
    state = _login(client, h)['state'][0]
    r = client.get(f'/google/callback?error=access_denied&state={state}', headers=h)
    assert r.location == 'http://localhost:5173/admin/settings?google_connected=cancelado'


@pytest.fixture()
def token_rechazado(db, closer, monkeypatch):
    db.session.add(GoogleCalendarToken(user_id=closer.id, token_json=TOKEN_VENCIDO))
    db.session.commit()

    def refrescar(self, request):
        raise RefreshError('invalid_grant: Token has been expired or revoked.')

    monkeypatch.setattr(google_service.google.oauth2.credentials.Credentials, 'refresh', refrescar)
    return closer


def test_un_token_rechazado_queda_vencido_y_avisa_una_vez(token_rechazado):
    assert GoogleService.get_credentials(token_rechazado.id) is None
    assert GoogleService.get_credentials(token_rechazado.id) is None
    assert GoogleCalendarToken.query.one().vencido_en is not None
    (aviso,) = Notification.query.filter_by(subject='Google Calendar desconectado').all()
    assert token_rechazado.id in aviso.target_users and 'role:admin' in aviso.target_users


def test_otros_errores_de_google_no_marcan_el_token(db, closer, monkeypatch):
    db.session.add(GoogleCalendarToken(user_id=closer.id, token_json=TOKEN_VENCIDO))
    db.session.commit()

    def refrescar(self, request):
        raise RefreshError('invalid_client: The OAuth client was not found.')

    monkeypatch.setattr(google_service.google.oauth2.credentials.Credentials, 'refresh', refrescar)
    with pytest.raises(RefreshError):
        GoogleService.get_credentials(closer.id)
    assert GoogleCalendarToken.query.one().vencido_en is None


def test_la_pantalla_muestra_vencido(client, token_rechazado, auth_headers):
    h = auth_headers(token_rechazado)
    assert client.get('/api/google/calendars?solo_estado=1', headers=h).get_json() == {'connected': True, 'vencido': False}
    assert client.get('/api/google/calendars', headers=h).get_json() == {'connected': False, 'vencido': True}
    assert client.get('/api/google/calendars?solo_estado=1', headers=h).get_json() == {'connected': False, 'vencido': True}


def test_agendas_v2_no_cuenta_un_token_vencido(db, token_rechazado):
    from app.agendas_v2 import servicio

    assert servicio._con_calendar({token_rechazado.id}) == {token_rechazado.id}
    GoogleService.get_credentials(token_rechazado.id)
    assert servicio._con_calendar({token_rechazado.id}) == set()
