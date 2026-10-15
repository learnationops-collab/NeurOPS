"""POST /api/manychat-webhook exige el header X-ManyChat-Token (15/10/2026).

Era anónima: cualquiera que mandara un JSON creaba leads (ManychatLead) e interacciones (LeadAnswer), y con
los anuncios por palabra clave también un anuncio. Ahora usa el mismo secreto que /api/webhooks/manychat
(MANYCHAT_WEBHOOK_TOKEN): sin la variable responde 503 y con otro valor 401, sin escribir nada. El GET de
verificación de ManyChat sigue abierto, y INTEGRATIONS_AUTH_MODE=log_only deja pasar y registra.
"""
import logging

import pytest

from app.models import Ad, LeadAnswer, ManychatLead

WEBHOOK = '/api/manychat-webhook'
TOKEN = 'token-de-manychat-de-prueba-largo-1234'
INTERACCION = {'manychat_id': '1', 'lead_name': 'Ana', 'keyword': 'APLICAR'}


@pytest.fixture(autouse=True)
def token_configurado(monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', TOKEN)


def enviar(client, cuerpo=None, token=TOKEN, **extra):
    cabeceras = {'X-ManyChat-Token': token} if token is not None else {}
    return client.post(WEBHOOK, json=INTERACCION if cuerpo is None else cuerpo, headers=cabeceras, **extra)


def _nada_creado():
    return (Ad.query.count(), LeadAnswer.query.count(), ManychatLead.query.count()) == (0, 0, 0)


def test_con_el_secreto_correcto_la_interaccion_entra(client, db):
    respuesta = enviar(client)

    assert respuesta.status_code == 201
    assert (ManychatLead.query.one().manychat_id, LeadAnswer.query.count()) == ('1', 1)


@pytest.mark.parametrize('enviado', [TOKEN, None])
def test_sin_la_variable_de_entorno_el_webhook_queda_cerrado(client, db, monkeypatch, enviado):
    monkeypatch.delenv('MANYCHAT_WEBHOOK_TOKEN')

    respuesta = enviar(client, token=enviado)

    assert respuesta.status_code == 503
    assert 'MANYCHAT_WEBHOOK_TOKEN' in respuesta.get_json()['message']
    assert _nada_creado()


@pytest.mark.parametrize('enviado', [None, '', 'mal', TOKEN[:-1], TOKEN + 'x', TOKEN.upper(), 'tokén'])
def test_sin_el_secreto_correcto_es_401_y_no_crea_nada(client, db, enviado):
    respuesta = enviar(client, {**INTERACCION, 'keyword': 'ANUNCIO INVENTADO'}, token=enviado)

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'status': 'error', 'message': 'Unauthorized'}
    assert _nada_creado()


def test_el_secreto_por_otra_via_no_sirve(client, db):
    # Solo el header X-ManyChat-Token: ni un Bearer ni el parametro de la URL (quedaria en los logs de acceso).
    por_bearer = client.post(WEBHOOK, json=INTERACCION, headers={'Authorization': f'Bearer {TOKEN}'})
    por_parametro = enviar(client, token=None, query_string={'token': TOKEN})

    assert (por_bearer.status_code, por_parametro.status_code) == (401, 401)
    assert _nada_creado()


def test_la_verificacion_de_manychat_sigue_abierta_sin_secreto(client, db, monkeypatch):
    con_variable = client.get(WEBHOOK)
    monkeypatch.delenv('MANYCHAT_WEBHOOK_TOKEN')
    sin_variable = client.get(WEBHOOK)

    assert (con_variable.status_code, sin_variable.status_code) == (200, 200)
    assert sin_variable.get_json() == {'status': 'ok', 'message': 'Webhook activo'}


# INTEGRATIONS_AUTH_MODE=log_only (asi esta produccion): lo que se habria rechazado pasa y queda en el log,
# para no cortar la entrada de leads mientras las solicitudes externas de ManyChat no mandan el header.

def _avisos(caplog):
    return [r.getMessage() for r in caplog.records if 'MIGRACION DE SECRETOS' in r.getMessage()]


@pytest.mark.parametrize('configurado,enviado,motivo', [
    (False, None, 'MANYCHAT_WEBHOOK_TOKEN sin configurar'),
    (True, None, 'no presento el secreto'),
    (True, 'mal', 'secreto incorrecto'),
])
def test_en_modo_de_migracion_el_webhook_pasa_sin_secreto_y_avisa(
        client, db, monkeypatch, caplog, configurado, enviado, motivo):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')
    if not configurado:
        monkeypatch.delenv('MANYCHAT_WEBHOOK_TOKEN')

    with caplog.at_level(logging.WARNING):
        respuesta = enviar(client, token=enviado)

    assert respuesta.status_code == 201
    assert (ManychatLead.query.count(), LeadAnswer.query.count()) == (1, 1)
    avisos = _avisos(caplog)
    assert len(avisos) == 1 and 'POST /api/manychat-webhook' in avisos[0] and motivo in avisos[0]
    assert TOKEN not in avisos[0]


def test_en_modo_de_migracion_con_el_secreto_correcto_no_avisa(client, db, monkeypatch, caplog):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')

    with caplog.at_level(logging.WARNING):
        respuesta = enviar(client)

    assert respuesta.status_code == 201
    assert _avisos(caplog) == []
