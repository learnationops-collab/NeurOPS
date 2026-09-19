"""Autenticacion por token de las integraciones (Academia y plataforma de desarrollo).

Son cuentas de servicio sin usuario detras: 'Authorization: Bearer <token>' contra una variable de
entorno. Si la variable no esta configurada, la integracion queda CERRADA (500), nunca abierta.
"""
import re

import pytest
from flask import Flask, jsonify

from app import decorators
from app.decorators import require_academy_token, require_dev_platform_token

INTEGRACIONES = {
    'academia': ('ACADEMY_INBOUND_API_TOKEN', require_academy_token),
    'dev_platform': ('DEV_PLATFORM_INBOUND_API_TOKEN', require_dev_platform_token),
}
TOKEN = 'token-de-prueba-123'


@pytest.fixture(params=sorted(INTEGRACIONES))
def integracion(request, monkeypatch):
    """(variable de entorno, cliente Flask con una ruta protegida por ese decorador)."""
    variable, decorador = INTEGRACIONES[request.param]
    app = Flask(__name__)
    app.config['TESTING'] = True

    @app.route('/protegida')
    @decorador
    def protegida():
        return jsonify(ok=True)

    def configurar(valor=TOKEN):
        monkeypatch.setenv(variable, valor)

    return variable, app.test_client(), configurar


def _pedir(cliente, autorizacion=None):
    cabeceras = {'Authorization': autorizacion} if autorizacion is not None else {}
    return cliente.get('/protegida', headers=cabeceras)


# --- Sin configurar: cerrada ------------------------------------------------------------------

def test_sin_configurar_la_integracion_queda_cerrada(integracion):
    variable, cliente, _ = integracion

    respuesta = _pedir(cliente, f'Bearer {TOKEN}')

    assert respuesta.status_code == 500
    assert variable in respuesta.get_json()['error']


def test_sin_configurar_un_token_vacio_tampoco_abre_la_puerta(integracion):
    variable, cliente, configurar = integracion
    configurar('')  # una variable definida pero vacia cuenta como no configurada

    assert _pedir(cliente, 'Bearer ').status_code == 500


# --- Configurada: quien pasa ------------------------------------------------------------------

def test_con_el_token_correcto_pasa(integracion):
    _, cliente, configurar = integracion
    configurar()

    respuesta = _pedir(cliente, f'Bearer {TOKEN}')

    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'ok': True}


def test_tolera_espacios_alrededor_del_token(integracion):
    _, cliente, configurar = integracion
    configurar()

    assert _pedir(cliente, f'Bearer   {TOKEN}  ').status_code == 200


@pytest.mark.parametrize('autorizacion', [
    None,  # sin cabecera
    '',
    'Bearer',
    'Bearer ',  # token vacio
    'Basic dXNlcjpwYXNz',  # otro esquema
    f'Token {TOKEN}',
    TOKEN,  # el token a secas, sin 'Bearer '
    'Bearer token-equivocado',
    f'Bearer {TOKEN[:-1]}',  # prefijo del real
    f'Bearer {TOKEN}x',  # el real mas un caracter
    f'Bearer {TOKEN.upper()}',  # distinto en mayusculas
])
def test_todo_lo_demas_es_401(integracion, autorizacion):
    _, cliente, configurar = integracion
    configurar()

    respuesta = _pedir(cliente, autorizacion)

    assert respuesta.status_code == 401
    assert 'error' in respuesta.get_json()


def test_un_error_nunca_devuelve_el_token_esperado(integracion):
    _, cliente, configurar = integracion
    configurar()

    for autorizacion in (None, 'Bearer mal', 'Basic abc'):
        assert TOKEN not in _pedir(cliente, autorizacion).get_data(as_text=True)


def test_la_plataforma_de_desarrollo_marca_success_false(integracion):
    variable, cliente, configurar = integracion
    configurar()

    cuerpo = _pedir(cliente, 'Bearer mal').get_json()

    if variable.startswith('DEV_PLATFORM'):
        assert cuerpo['success'] is False


def test_compara_en_tiempo_constante(integracion, monkeypatch):
    _, cliente, configurar = integracion
    configurar()
    llamadas = []
    real = decorators.hmac.compare_digest

    def espia(a, b):
        llamadas.append((a, b))
        return real(a, b)

    monkeypatch.setattr(decorators.hmac, 'compare_digest', espia)

    _pedir(cliente, 'Bearer mal')

    assert llamadas == [('mal', TOKEN)]  # nunca `==`, que filtra el largo del prefijo coincidente


@pytest.mark.xfail(strict=True, reason=(
    "BUG: hmac.compare_digest lanza TypeError con un token con caracteres no ASCII, asi que una "
    "cabecera como 'Bearer tokén' produce un 500 en vez de un 401 (sin impacto de seguridad, pero "
    "cualquiera puede generar errores 500 a voluntad y ensuciar las alertas)."))
def test_un_token_con_caracteres_no_ascii_es_401(integracion):
    _, cliente, configurar = integracion
    configurar()

    assert _pedir(cliente, 'Bearer tokén').status_code == 401


# --- Las rutas reales de /api/external/* -------------------------------------------------------

def _rutas_externas(app):
    rutas = []
    for regla in app.url_map.iter_rules():
        if regla.rule.startswith('/api/external/'):
            url = re.sub(r'<int:\w+>', '1', regla.rule)
            url = re.sub(r'<string:\w+>', 'x', url)
            for metodo in sorted((regla.methods or set()) - {'HEAD', 'OPTIONS'}):
                rutas.append((metodo, url))
    return rutas


def test_hay_rutas_externas_que_proteger(app):
    assert len(_rutas_externas(app)) >= 14


def test_todas_las_rutas_externas_exigen_el_token(app, db, client, monkeypatch):
    monkeypatch.setenv('ACADEMY_INBOUND_API_TOKEN', TOKEN)
    monkeypatch.setenv('DEV_PLATFORM_INBOUND_API_TOKEN', TOKEN)

    sin_proteccion = []
    for metodo, url in _rutas_externas(app):
        for cabeceras in ({}, {'Authorization': 'Bearer mal'}):
            respuesta = client.open(url, method=metodo, headers=cabeceras, json={})
            if respuesta.status_code != 401:
                sin_proteccion.append((metodo, url, respuesta.status_code))

    assert sin_proteccion == []


def test_con_el_token_correcto_las_rutas_de_lectura_llegan_a_su_vista(app, db, client, monkeypatch):
    monkeypatch.setenv('ACADEMY_INBOUND_API_TOKEN', TOKEN)
    monkeypatch.setenv('DEV_PLATFORM_INBOUND_API_TOKEN', TOKEN)

    rechazadas = []
    for metodo, url in _rutas_externas(app):
        if metodo != 'GET':
            continue  # las de escritura no se ejecutan aca
        respuesta = client.get(url, headers={'Authorization': f'Bearer {TOKEN}'})
        if respuesta.status_code in (401, 403):
            rechazadas.append((url, respuesta.status_code))

    assert rechazadas == []
