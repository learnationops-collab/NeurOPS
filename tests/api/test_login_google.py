"""Entrar con Google y cargar el email para poder hacerlo.

Lo que importa: entra solo quien ya tiene cuenta con ese email verificado por Google (sin importar
mayúsculas), nunca se crea un usuario, una cuenta desactivada no entra, el token sale una sola vez y
solo para una sesión que vino de Google, y el email se carga una vez, válido y sin repetir.
"""

from urllib.parse import parse_qs, urlparse

import pytest

from app.models import User
from app.services import login_google


@pytest.fixture(autouse=True)
def cliente_google(monkeypatch):
    monkeypatch.setenv('GOOGLE_CLIENT_ID', 'id-de-prueba.apps.googleusercontent.com')
    monkeypatch.setenv('GOOGLE_CLIENT_SECRET', 'secreto')


@pytest.fixture()
def google_dice(monkeypatch):
    """google_dice('ana@x.com') hace que la vuelta de Google traiga ese email (None: sin verificar)."""
    def fijar(email):
        monkeypatch.setattr(login_google, 'email_de_la_vuelta', lambda uri, resp: email)
    return fijar


def _ida(client):
    r = client.get('/api/auth/google')
    assert r.status_code == 200
    q = parse_qs(urlparse(r.get_json()['auth_url']).query)
    assert 'openid' in q['scope'][0] and 'calendar' not in q['scope'][0]
    assert q['redirect_uri'] == ['http://localhost/google/callback']
    return q['state'][0]


def _vuelta(client, state, extra='code=abc'):
    return client.get(f'/google/callback?{extra}&state={state}')


def test_entra_con_su_email_y_canjea_el_token_una_vez(client, make_user, google_dice):
    ana = make_user(role='closer', email='Ana@Empresa.com')
    google_dice('ana@empresa.com')
    r = _vuelta(client, _ida(client))
    assert r.status_code == 302 and r.location == '/login?google=ok'

    s = client.post('/api/auth/google/sesion')
    assert s.status_code == 200
    datos = s.get_json()
    assert datos['token'] and datos['user']['id'] == ana.id and datos['user']['role'] == 'closer'
    assert client.post('/api/auth/google/sesion').status_code == 401  # una sola vez


@pytest.mark.parametrize('email, resultado', [(None, 'sin_verificar'), ('nadie@x.com', 'sin_cuenta')])
def test_sin_email_verificado_o_sin_cuenta_no_entra_ni_se_crea(client, make_user, google_dice, email, resultado):
    make_user(role='closer', email='ana@empresa.com')
    google_dice(email)
    assert _vuelta(client, _ida(client)).location == f'/login?google={resultado}'
    assert client.post('/api/auth/google/sesion').status_code == 401
    assert User.query.count() == 1


def test_una_cuenta_desactivada_no_entra(client, make_user, google_dice):
    make_user(role='closer', email='ana@empresa.com', is_active=False)
    google_dice('ana@empresa.com')
    assert _vuelta(client, _ida(client)).location == '/login?google=desactivada'


def test_cancelar_o_un_state_ajeno_vuelve_al_login(client, google_dice):
    google_dice('ana@empresa.com')
    assert _vuelta(client, _ida(client), extra='error=access_denied').location == '/login?google=cancelado'
    _ida(client)
    assert _vuelta(client, 'otro').location == '/login?google=error'


def test_una_sesion_con_clave_no_canjea_el_token_de_google(client, make_user):
    make_user(role='closer', username='ana')
    assert client.post('/api/auth/login', json={'username': 'ana', 'password': 'secret123'}).status_code == 200
    assert client.post('/api/auth/google/sesion').status_code == 401


def test_conectar_el_calendar_sigue_siendo_calendar(client, make_user, auth_headers, google_dice):
    """Si alguien arrancó el login con Google y después conecta su Calendar, la vuelta es la del Calendar."""
    closer = make_user(role='closer')
    h = auth_headers(closer)
    _ida(client)
    state = parse_qs(urlparse(client.get('/api/google/login', headers=h).get_json()['auth_url']).query)['state'][0]
    r = client.get(f'/google/callback?error=access_denied&state={state}', headers=h)
    assert r.location == '/closer/deck?vista=configuracion&google_connected=cancelado'


# --- Cargar el email ---------------------------------------------------------------------------

def test_cargar_el_email_una_vez(client, make_user, auth_headers):
    sin = make_user(role='closer', email=None)
    h = auth_headers(sin)
    r = client.put('/api/auth/me/email', json={'email': '  Beto@Gmail.com '}, headers=h)
    assert r.status_code == 200 and r.get_json()['user']['email'] == 'beto@gmail.com'
    r = client.put('/api/auth/me/email', json={'email': 'otro@gmail.com'}, headers=h)
    assert r.status_code == 409 and User.query.get(sin.id).email == 'beto@gmail.com'


@pytest.mark.parametrize('email, codigo', [('no-es-un-mail', 400), ('', 400), (123, 400), ('ANA@empresa.com', 409)])
def test_email_invalido_o_de_otro(client, make_user, auth_headers, email, codigo):
    make_user(role='closer', email='ana@empresa.com')
    sin = make_user(role='closer', email=None)
    assert client.put('/api/auth/me/email', json={'email': email}, headers=auth_headers(sin)).status_code == codigo
    assert User.query.get(sin.id).email is None


def test_cargar_el_email_pide_sesion(client):
    assert client.put('/api/auth/me/email', json={'email': 'a@b.com'}).status_code == 401
