"""Secretos compartidos con sistemas externos que llaman sin usuario: los crons y los webhooks.

Cada ruta traia un valor por defecto escrito en el codigo (`CRON_SECRET` valia un literal del
repositorio cuando la variable no estaba definida): conocido por cualquiera con acceso al codigo e
imposible de rotar sin desplegar. Ahora fallan CERRADAS: sin la variable, o con un valor demasiado
corto para ser un secreto, contestan 503 y nada abre la puerta. La comparacion es en tiempo
constante sobre bytes.
"""
import logging

import pytest
from flask import Flask, jsonify

from app import decorators
from app.decorators import LARGO_MINIMO_DE_SECRETO, require_cron_secret

SECRETO = 'secreto-de-prueba-con-mas-de-veinte-caracteres'
# Valor que estuvo escrito en el codigo como respaldo de CRON_SECRET. Ya no vale en ningun caso.
CRON_POR_DEFECTO_ANTERIOR = 'token-seguro-neur0ps-2026'
NO_AUTORIZADO = {'status': 'error', 'message': 'Unauthorized'}


def _bearer(valor):
    return {'Authorization': f'Bearer {valor}'}


# --- El decorador, sobre una app minima -------------------------------------------------------

@pytest.fixture()
def ruta_de_cron():
    """(cliente, lista de ejecuciones de la vista) sobre una ruta protegida por CRON_SECRET."""
    app = Flask(__name__)
    ejecuciones = []

    @app.route('/cron')
    @require_cron_secret
    def cron():
        ejecuciones.append(1)
        return jsonify(ok=True)

    return app.test_client(), ejecuciones


def test_sin_la_variable_la_ruta_queda_cerrada_y_la_vista_no_corre(ruta_de_cron):
    cliente, ejecuciones = ruta_de_cron

    respuesta = cliente.get('/cron', query_string={'token': SECRETO})

    assert respuesta.status_code == 503
    assert 'CRON_SECRET' in respuesta.get_json()['message']
    assert ejecuciones == []


def test_una_variable_vacia_cuenta_como_no_configurada(ruta_de_cron, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', '')
    cliente, ejecuciones = ruta_de_cron

    assert cliente.get('/cron', query_string={'token': ''}).status_code == 503
    assert ejecuciones == []


def test_un_secreto_demasiado_corto_no_abre_la_puerta_ni_con_su_propio_valor(ruta_de_cron, monkeypatch):
    corto = 'x' * (LARGO_MINIMO_DE_SECRETO - 1)
    monkeypatch.setenv('CRON_SECRET', corto)
    cliente, ejecuciones = ruta_de_cron

    respuesta = cliente.get('/cron', query_string={'token': corto})

    assert respuesta.status_code == 503
    assert str(LARGO_MINIMO_DE_SECRETO) in respuesta.get_json()['message']
    assert ejecuciones == []


def test_un_secreto_del_largo_minimo_ya_sirve(ruta_de_cron, monkeypatch):
    minimo = 'x' * LARGO_MINIMO_DE_SECRETO
    monkeypatch.setenv('CRON_SECRET', minimo)
    cliente, _ = ruta_de_cron

    assert cliente.get('/cron', query_string={'token': minimo}).status_code == 200


def test_acepta_el_secreto_por_parametro_o_por_bearer(ruta_de_cron, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, ejecuciones = ruta_de_cron

    por_parametro = cliente.get('/cron', query_string={'token': SECRETO})
    por_bearer = cliente.get('/cron', headers=_bearer(SECRETO))

    assert (por_parametro.status_code, por_bearer.status_code) == (200, 200)
    assert por_bearer.get_json() == {'ok': True}
    assert len(ejecuciones) == 2


def test_el_bearer_manda_sobre_el_parametro(ruta_de_cron, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, _ = ruta_de_cron

    bueno_y_malo = cliente.get('/cron', headers=_bearer(SECRETO), query_string={'token': 'mal'})
    malo_y_bueno = cliente.get('/cron', headers=_bearer('mal'), query_string={'token': SECRETO})

    assert (bueno_y_malo.status_code, malo_y_bueno.status_code) == (200, 401)


def test_tolera_espacios_alrededor_del_bearer(ruta_de_cron, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, _ = ruta_de_cron

    assert cliente.get('/cron', headers=_bearer(f'  {SECRETO}  ')).status_code == 200


@pytest.mark.parametrize('cabeceras,parametros', [
    ({}, {}),  # nada
    ({}, {'token': ''}),
    ({}, {'token': 'mal'}),
    ({}, {'token': SECRETO[:-1]}),  # prefijo del real
    ({}, {'token': SECRETO + 'x'}),  # el real mas un caracter
    ({}, {'token': SECRETO.upper()}),
    ({}, {'token': 'tokén-con-acento'}),  # no ASCII: antes con str daba TypeError, es decir un 500
    ({}, {'token': CRON_POR_DEFECTO_ANTERIOR}),
    (_bearer(''), {}),
    (_bearer('mal'), {}),
    (_bearer(CRON_POR_DEFECTO_ANTERIOR), {}),
    ({'Authorization': 'Basic dXNlcjpwYXNz'}, {}),  # otro esquema
    ({'Authorization': SECRETO}, {}),  # el secreto a secas, sin 'Bearer '
])
def test_todo_lo_demas_es_401_y_la_vista_no_corre(ruta_de_cron, monkeypatch, cabeceras, parametros):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, ejecuciones = ruta_de_cron

    respuesta = cliente.get('/cron', headers=cabeceras, query_string=parametros)

    assert respuesta.status_code == 401
    assert respuesta.get_json() == NO_AUTORIZADO
    assert ejecuciones == []


def test_los_errores_nunca_devuelven_el_secreto_esperado(ruta_de_cron, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, _ = ruta_de_cron

    for respuesta in (cliente.get('/cron'), cliente.get('/cron', query_string={'token': 'mal'})):
        assert SECRETO not in respuesta.get_data(as_text=True)
    monkeypatch.setenv('CRON_SECRET', 'corto')  # tampoco se repite el valor mal configurado
    assert 'corto' not in cliente.get('/cron').get_data(as_text=True)


def test_compara_en_tiempo_constante_sobre_bytes(ruta_de_cron, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, _ = ruta_de_cron
    llamadas = []
    real = decorators.hmac.compare_digest

    def espia(a, b):
        llamadas.append((a, b))
        return real(a, b)

    monkeypatch.setattr(decorators.hmac, 'compare_digest', espia)

    cliente.get('/cron', query_string={'token': 'mal'})

    # Nunca con `==`, que filtra el largo del prefijo coincidente.
    assert llamadas == [(b'mal', SECRETO.encode())]


# --- Las rutas reales de los crons -------------------------------------------------------------

CRONS = {
    'sheets': '/api/sheets/cron-sync',
    'seguimientos': '/api/closer/followups/cron/send-reminders',
}


@pytest.fixture(params=sorted(CRONS))
def cron_real(request, monkeypatch):
    """(url, lista de ejecuciones reales) de un cron con lo externo (Sheets, alertas, WhatsApp) simulado."""
    ejecuciones = []
    if request.param == 'sheets':
        from app.services.alert_service import AlertService
        from app.services.sheets_service import SheetsService

        def sincronizar(tabla, force=False):
            ejecuciones.append(tabla)
            return {'status': 'success'}

        monkeypatch.setattr(SheetsService, 'sync_from_sheets', staticmethod(sincronizar))
        monkeypatch.setattr(AlertService, 'evaluate_rules', staticmethod(lambda: 0))
    else:
        from app.services.closer_followup_service import CloserFollowUpService

        def enviar(fecha=None):
            ejecuciones.append(fecha)
            return {'sent': 0}

        monkeypatch.setattr(CloserFollowUpService, 'send_due_reminders', staticmethod(enviar))
    return CRONS[request.param], ejecuciones


def test_los_dos_crons_reales_quedan_cerrados_sin_CRON_SECRET(client, cron_real):
    url, ejecuciones = cron_real

    # Antes: sin la variable valia un literal del repositorio y cualquiera que lo conociera pasaba.
    for parametros in ({}, {'token': CRON_POR_DEFECTO_ANTERIOR}):
        respuesta = client.get(url, query_string=parametros)

        assert respuesta.status_code == 503
        assert 'CRON_SECRET' in respuesta.get_json()['message']
    assert ejecuciones == []


def test_con_CRON_SECRET_el_valor_por_defecto_anterior_ya_no_vale(client, cron_real, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    url, ejecuciones = cron_real

    respuesta = client.get(url, query_string={'token': CRON_POR_DEFECTO_ANTERIOR})

    assert respuesta.status_code == 401
    assert ejecuciones == []


@pytest.mark.parametrize('como', ['parametro', 'bearer'])
def test_con_el_secreto_correcto_los_crons_reales_hacen_su_trabajo(client, cron_real, monkeypatch, como):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    url, ejecuciones = cron_real
    pedido = ({'query_string': {'token': SECRETO}} if como == 'parametro' else {'headers': _bearer(SECRETO)})

    respuesta = client.get(url, **pedido)

    assert respuesta.status_code == 200
    assert respuesta.get_json()['status'] == 'success'
    assert len(ejecuciones) == 1


def test_con_un_secreto_equivocado_los_crons_reales_no_hacen_nada(client, cron_real, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    url, ejecuciones = cron_real

    respuesta = client.get(url, query_string={'token': 'mal'})

    assert respuesta.status_code == 401
    assert respuesta.get_json() == NO_AUTORIZADO
    assert ejecuciones == []


# --- Modo de migracion (INTEGRATIONS_AUTH_MODE=log_only) ---------------------------------------
# Valvula opt-in para desplegar la proteccion sin cortar flujos que todavia no mandan su secreto: lo que
# se habria rechazado PASA pero queda registrado para localizar a quien falta configurar. Sin la variable,
# todo sigue fallando cerrado.

@pytest.fixture()
def migracion(monkeypatch):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')


def _avisos(caplog):
    return [r.getMessage() for r in caplog.records if 'MIGRACION DE SECRETOS' in r.getMessage()]


def test_en_migracion_una_ruta_sin_configurar_pasa_y_avisa(ruta_de_cron, migracion, caplog):
    cliente, ejecuciones = ruta_de_cron

    with caplog.at_level(logging.WARNING):
        respuesta = cliente.get('/cron')

    assert respuesta.status_code == 200 and len(ejecuciones) == 1
    avisos = _avisos(caplog)
    assert len(avisos) == 1
    assert 'GET /cron' in avisos[0] and 'CRON_SECRET sin configurar' in avisos[0]


def test_en_migracion_una_llamada_sin_secreto_pasa_y_avisa(ruta_de_cron, migracion, monkeypatch, caplog):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, ejecuciones = ruta_de_cron

    with caplog.at_level(logging.WARNING):
        respuesta = cliente.get('/cron')

    assert respuesta.status_code == 200 and len(ejecuciones) == 1
    assert 'no presento el secreto' in _avisos(caplog)[0]


def test_en_migracion_un_secreto_equivocado_pasa_y_avisa(ruta_de_cron, migracion, monkeypatch, caplog):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, ejecuciones = ruta_de_cron

    with caplog.at_level(logging.WARNING):
        respuesta = cliente.get('/cron', headers=_bearer('mal'))

    assert respuesta.status_code == 200 and len(ejecuciones) == 1
    assert 'secreto incorrecto' in _avisos(caplog)[0]


def test_en_migracion_con_el_secreto_correcto_no_hay_aviso(ruta_de_cron, migracion, monkeypatch, caplog):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, ejecuciones = ruta_de_cron

    with caplog.at_level(logging.WARNING):
        respuesta = cliente.get('/cron', headers=_bearer(SECRETO))

    assert respuesta.status_code == 200 and len(ejecuciones) == 1
    assert _avisos(caplog) == []


def test_el_aviso_registra_ruta_origen_y_agente_pero_nunca_secretos_ni_la_cadena_de_consulta(
        ruta_de_cron, migracion, monkeypatch, caplog):
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, _ = ruta_de_cron

    with caplog.at_level(logging.WARNING):
        cliente.get('/cron?token=presentado-en-la-url-1234&otro=dato', headers={
            'X-Forwarded-For': '203.0.113.7, 10.0.0.1', 'User-Agent': 'n8n-workflow/1.0'})

    aviso = _avisos(caplog)[0]
    assert 'GET /cron' in aviso and '203.0.113.7' in aviso and '10.0.0.1' not in aviso
    assert 'n8n-workflow/1.0' in aviso
    for secreto in (SECRETO, 'presentado-en-la-url-1234', 'otro=dato'):
        assert secreto not in aviso


@pytest.mark.parametrize('valor', ['log_only', 'LOG_ONLY', ' Log_Only '])
def test_el_modo_de_migracion_se_activa_con_log_only(monkeypatch, valor):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', valor)

    assert decorators.en_modo_de_migracion() is True


@pytest.mark.parametrize('valor', ['', 'true', '1', 'off', 'enforce', 'log-only', 'log_only_x'])
def test_cualquier_otro_valor_no_activa_el_modo_de_migracion(ruta_de_cron, monkeypatch, valor):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', valor)
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    cliente, ejecuciones = ruta_de_cron

    assert decorators.en_modo_de_migracion() is False
    assert cliente.get('/cron').status_code == 401
    assert ejecuciones == []


def test_sin_la_variable_el_modo_de_migracion_esta_apagado(ruta_de_cron):
    cliente, ejecuciones = ruta_de_cron

    assert decorators.en_modo_de_migracion() is False
    assert cliente.get('/cron').status_code == 503
    assert ejecuciones == []


def test_en_migracion_los_crons_reales_pasan_sin_secreto_y_avisan(client, cron_real, migracion, caplog):
    url, ejecuciones = cron_real

    with caplog.at_level(logging.WARNING):
        respuesta = client.get(url)

    assert respuesta.status_code == 200
    assert len(ejecuciones) == 1
    assert len(_avisos(caplog)) == 1
