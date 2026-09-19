"""Manejadores de error de create_app: nunca filtran detalles internos fuera de debug.

Un error inesperado devuelve JSON generico. Solo con app.debug se agregan `error` y `trace` (para
desarrollo local). Los errores HTTP normales (400, 404, 405...) pasan tal cual, sin convertirse
en 500.
"""
import pytest

from app.models import User


@pytest.fixture()
def login_que_falla(monkeypatch):
    """Hace que /api/auth/login (sin decorador de rol) levante una excepcion inesperada."""
    def _falla(self, password):
        raise RuntimeError('detalle-interno-secreto')

    monkeypatch.setattr(User, 'check_password', _falla)


def _login(client, make_user):
    make_user(username='ana')
    return client.post('/api/auth/login', json={'username': 'ana', 'password': 'x'})


def test_un_error_inesperado_devuelve_json_generico(client, make_user, login_que_falla):
    respuesta = _login(client, make_user)

    assert respuesta.status_code == 500
    assert respuesta.get_json() == {'message': 'Unhandled Exception'}


def test_un_error_inesperado_no_filtra_nada_interno(client, make_user, login_que_falla):
    cuerpo = _login(client, make_user).get_data(as_text=True)

    assert 'detalle-interno-secreto' not in cuerpo
    assert 'Traceback' not in cuerpo
    assert 'trace' not in cuerpo


def test_solo_en_debug_se_agrega_el_detalle(app, client, make_user, login_que_falla, monkeypatch):
    monkeypatch.setattr(app, 'debug', True)

    cuerpo = _login(client, make_user).get_json()

    assert cuerpo['message'] == 'Unhandled Exception'
    assert 'detalle-interno-secreto' in cuerpo['error']
    assert 'Traceback' in cuerpo['trace']


@pytest.mark.parametrize('metodo,ruta,codigo', [
    ('post', '/api/ruta-que-no-existe', 405),  # la unica ruta comodin acepta solo GET
    ('get', '/api/ruta-que-no-existe', 404),
    ('put', '/api/health', 405),
])
def test_los_errores_http_normales_conservan_su_codigo(client, metodo, ruta, codigo):
    assert getattr(client, metodo)(ruta).status_code == codigo


def test_un_json_invalido_es_400_y_no_500(client):
    respuesta = client.post('/api/auth/login', data='{roto', content_type='application/json')

    assert respuesta.status_code == 400
