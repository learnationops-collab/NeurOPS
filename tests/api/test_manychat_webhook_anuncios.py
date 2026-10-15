"""POST /api/manychat-webhook con la palabra clave (pedido de Kerwin, 14/10/2026).

"Ya no se va a hacer por ID [...] ahora va a llegar la palabra clave directamente desde ManyChat y ahí
se va a crear el anuncio". El webhook crea el anuncio la primera vez que llega una palabra clave y
después lo reusa (también uno viejo con la misma, escrita distinto); no mezcla la respuesta de un
anuncio con el envío de otro; un webhook sin calificación no borra la que ya se sabía; y un anuncio
nuevo se asocia solo a los anuncios de Meta que lo nombran.

Como cualquiera que mande una palabra clave crea un anuncio, el POST exige el header X-ManyChat-Token
(el mismo secreto que /api/webhooks/manychat, MANYCHAT_WEBHOOK_TOKEN); el GET de verificación sigue abierto.
"""
import logging
from datetime import date

import pytest

from app.models import Ad, LeadAnswer, ManychatLead, MetaAnuncio
from app.services import meta_ads_service
from tests.services.test_meta_ads_service import meta  # noqa: F401  (la Graph API falsa)

WEBHOOK = '/api/manychat-webhook'
TOKEN = 'token-de-manychat-de-prueba-largo-1234'


@pytest.fixture(autouse=True)
def token_configurado(monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', TOKEN)


def enviar(client, cuerpo, token=TOKEN, **extra):
    cabeceras = {'X-ManyChat-Token': token} if token is not None else {}
    return client.post(WEBHOOK, json=cuerpo, headers=cabeceras, **extra)


def test_una_palabra_clave_nueva_crea_el_anuncio_y_despues_se_reusa(client, db):
    primera = enviar(client, {'manychat_id': '1', 'lead_name': 'Ana', 'keyword': 'Guia chile'})
    segunda = enviar(client, {'manychat_id': '2', 'lead_name': 'Beto', 'keyword': 'GUÍA CHILE'})

    assert (primera.status_code, segunda.status_code) == (201, 201)
    anuncios = Ad.query.all()
    assert [(a.keyword, a.clave, a.status, a.ad_set_id) for a in anuncios] == [('Guia chile', 'GUIA CHILE', 'active', None)]
    assert {r.ad_id for r in LeadAnswer.query.all()} == {anuncios[0].id}


def test_un_anuncio_viejo_con_la_misma_palabra_clave_se_reusa(client, db):
    viejo = Ad(name='AD 6 | CURSO GRATUITO', keyword='CURSO GRATUITO', status='active')
    db.session.add(viejo)
    db.session.commit()

    enviar(client, {'manychat_id': '1', 'keyword': 'curso gratuito'})

    assert Ad.query.count() == 1
    assert LeadAnswer.query.one().ad_id == viejo.id


def test_una_variable_sin_reemplazar_no_crea_un_anuncio(client, db):
    enviar(client, {'manychat_id': '1', 'keyword': '{{keyword}}'})

    assert Ad.query.count() == 0
    assert LeadAnswer.query.one().ad_id is None


def test_un_webhook_sin_calificacion_no_borra_la_que_ya_llego(client, db):
    enviar(client, {'manychat_id': '1', 'keyword': 'APLICAR', 'cualificacion': 'yes'})
    enviar(client, {'manychat_id': '1', 'keyword': 'APLICAR', 'cualificacion': ''})

    assert [r.qualification for r in LeadAnswer.query.all()] == ['true']


def test_la_respuesta_a_un_envio_de_otro_anuncio_no_se_mezcla(client, db):
    enviar(client, {'manychat_id': '1', 'keyword': 'APROBACION', 'id_option': '0', 'id_option_send': '4'})
    enviar(client, {'manychat_id': '1', 'keyword': 'Obtener Guia', 'id_option': '4',
                    'id_option_send': '0', 'cualificacion': 'yes'})

    respuestas = LeadAnswer.query.order_by(LeadAnswer.id).all()
    assert [(r.keyword, r.qualification) for r in respuestas] == [('APROBACION', 'null'), ('Obtener Guia', 'true')]
    assert respuestas[0].ad_id != respuestas[1].ad_id


def test_la_respuesta_al_envio_del_mismo_anuncio_se_consolida(client, db):
    enviar(client, {'manychat_id': '1', 'keyword': 'APLICAR', 'id_option': '0', 'id_option_send': '4'})
    enviar(client, {'manychat_id': '1', 'keyword': 'APLICAR', 'id_option': '4',
                    'id_option_send': '0', 'cualificacion': 'yes'})

    assert [(r.id_option, r.id_option_send, r.qualification) for r in LeadAnswer.query.all()] == [('4', '4', 'true')]



@pytest.mark.usefixtures('meta')
def test_una_palabra_clave_nueva_de_manychat_asocia_los_anuncios_de_meta_que_la_nombran(client, db):
    meta_ads_service.sincronizar(date(2026, 10, 12), date(2026, 10, 13))
    assert MetaAnuncio.query.filter_by(meta_ad_id='111').one().clave is None

    enviar(client, {'manychat_id': '1', 'keyword': 'Quiero aplicar'})

    assert MetaAnuncio.query.filter_by(meta_ad_id='111').one().clave == 'QUIERO APLICAR'


# --- El secreto (X-ManyChat-Token) --------------------------------------------------------------

def _nada_creado():
    return (Ad.query.count(), LeadAnswer.query.count(), ManychatLead.query.count()) == (0, 0, 0)


@pytest.mark.parametrize('enviado', [TOKEN, None])
def test_sin_la_variable_de_entorno_el_webhook_queda_cerrado(client, db, monkeypatch, enviado):
    monkeypatch.delenv('MANYCHAT_WEBHOOK_TOKEN')

    respuesta = enviar(client, {'manychat_id': '1', 'keyword': 'APLICAR'}, token=enviado)

    assert respuesta.status_code == 503
    assert 'MANYCHAT_WEBHOOK_TOKEN' in respuesta.get_json()['message']
    assert _nada_creado()


@pytest.mark.parametrize('enviado', [None, '', 'mal', TOKEN[:-1], TOKEN + 'x', TOKEN.upper(), 'tokén'])
def test_sin_el_secreto_correcto_es_401_y_no_crea_ni_el_lead_ni_el_anuncio(client, db, enviado):
    respuesta = enviar(client, {'manychat_id': '1', 'keyword': 'ANUNCIO INVENTADO'}, token=enviado)

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'status': 'error', 'message': 'Unauthorized'}
    assert _nada_creado()


def test_el_secreto_por_otra_via_no_sirve(client, db):
    # Solo el header X-ManyChat-Token: ni un Bearer ni el parametro de la URL (quedaria en los logs de acceso).
    por_bearer = client.post(WEBHOOK, json={'manychat_id': '1'}, headers={'Authorization': f'Bearer {TOKEN}'})
    por_parametro = enviar(client, {'manychat_id': '1'}, token=None, query_string={'token': TOKEN})

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
        respuesta = enviar(client, {'manychat_id': '1', 'keyword': 'APLICAR'}, token=enviado)

    assert respuesta.status_code == 201
    assert [a.clave for a in Ad.query.all()] == ['APLICAR']
    avisos = _avisos(caplog)
    assert len(avisos) == 1 and 'POST /api/manychat-webhook' in avisos[0] and motivo in avisos[0]
    assert TOKEN not in avisos[0]


def test_en_modo_de_migracion_con_el_secreto_correcto_no_avisa(client, db, monkeypatch, caplog):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')

    with caplog.at_level(logging.WARNING):
        respuesta = enviar(client, {'manychat_id': '1', 'keyword': 'APLICAR'})

    assert respuesta.status_code == 201
    assert _avisos(caplog) == []
