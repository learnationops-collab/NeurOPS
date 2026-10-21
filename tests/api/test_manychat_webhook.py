"""POST /api/webhooks/manychat: ManyChat manda aqui cada lead de Instagram (crear o actualizar).

No hay usuario detras: la unica proteccion es el header X-ManyChat-Token contra la variable de entorno
MANYCHAT_WEBHOOK_TOKEN. El token estaba escrito en el codigo (conocido por cualquiera con acceso al
repositorio, imposible de rotar sin desplegar) y ahora, sin la variable, la ruta queda CERRADA (503).
"""
import logging

import pytest

from app.models import ManychatLead

URL = '/api/webhooks/manychat'
TOKEN = 'token-de-manychat-de-prueba-largo-1234'
# Valor que estuvo escrito en el codigo. Ya no vale en ningun caso.
TOKEN_ANTERIOR = 'neur_ops_manychat_secure_token_2026'
LEAD = {'manychat_id': 'mc-100', 'name': 'Ana Gomez'}


@pytest.fixture()
def token_configurado(monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', TOKEN)


def enviar(client, cuerpo=None, token=TOKEN, **extra):
    cabeceras = {'X-ManyChat-Token': token} if token is not None else {}
    return client.post(URL, json=LEAD if cuerpo is None else cuerpo, headers=cabeceras, **extra)


# --- El token ---------------------------------------------------------------------------------

@pytest.mark.parametrize('enviado', [TOKEN, TOKEN_ANTERIOR, None])
def test_sin_la_variable_de_entorno_la_ruta_queda_cerrada(client, enviado):
    respuesta = enviar(client, token=enviado)

    assert respuesta.status_code == 503
    assert 'MANYCHAT_WEBHOOK_TOKEN' in respuesta.get_json()['message']
    assert ManychatLead.query.count() == 0


def test_un_token_configurado_demasiado_corto_no_abre_la_puerta(client, monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', 'corto')

    assert enviar(client, token='corto').status_code == 503
    assert ManychatLead.query.count() == 0


@pytest.mark.parametrize('enviado', [None, '', 'mal', TOKEN[:-1], TOKEN + 'x', TOKEN.upper(), 'tokén', TOKEN_ANTERIOR])
def test_un_token_que_no_es_el_configurado_es_401_y_no_crea_nada(client, token_configurado, enviado):
    respuesta = enviar(client, token=enviado)

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'status': 'error', 'message': 'Unauthorized'}
    assert ManychatLead.query.count() == 0


def test_el_token_por_otra_via_no_sirve(client, token_configurado):
    # Solo el header X-ManyChat-Token: ni un Bearer ni el parametro de la URL.
    por_bearer = client.post(URL, json=LEAD, headers={'Authorization': f'Bearer {TOKEN}'})
    por_parametro = client.post(URL, json=LEAD, query_string={'token': TOKEN})

    assert (por_bearer.status_code, por_parametro.status_code) == (401, 401)
    assert ManychatLead.query.count() == 0


# --- El cuerpo --------------------------------------------------------------------------------

def test_un_cuerpo_que_no_es_json_es_400(client, token_configurado):
    respuesta = client.post(URL, data='manychat_id=1', headers={'X-ManyChat-Token': TOKEN})

    assert respuesta.status_code == 400
    assert respuesta.get_json()['message'] == 'Request must be JSON'


@pytest.mark.parametrize('cuerpo', [{'name': 'Ana'}, {'manychat_id': 'mc-1'}, {'manychat_id': '', 'name': 'Ana'}, {}])
def test_faltan_campos_obligatorios_es_400(client, token_configurado, cuerpo):
    respuesta = enviar(client, cuerpo)

    assert respuesta.status_code == 400
    assert 'manychat_id, name' in respuesta.get_json()['message']
    assert ManychatLead.query.count() == 0


# --- Modo de migracion --------------------------------------------------------------------------
# INTEGRATIONS_AUTH_MODE=log_only deja pasar (y registra) lo que se habria rechazado: sirve para desplegar
# sin cortar la entrada de leads mientras ManyChat todavia no manda el header. Opt-in; sin la variable, 503.

@pytest.mark.parametrize('enviado', [None, 'mal'])
def test_en_modo_de_migracion_el_webhook_pasa_sin_token_valido_y_avisa(client, monkeypatch, caplog, enviado):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')

    with caplog.at_level(logging.WARNING):
        respuesta = enviar(client, token=enviado)

    assert respuesta.status_code == 201
    assert ManychatLead.query.count() == 1
    avisos = [r.getMessage() for r in caplog.records if 'MIGRACION DE SECRETOS' in r.getMessage()]
    assert len(avisos) == 1 and 'POST /api/webhooks/manychat' in avisos[0]


def test_con_el_token_correcto_el_modo_de_migracion_no_avisa(client, token_configurado, monkeypatch, caplog):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')

    with caplog.at_level(logging.WARNING):
        respuesta = enviar(client)

    assert respuesta.status_code == 201
    assert not [r for r in caplog.records if 'MIGRACION DE SECRETOS' in r.getMessage()]
