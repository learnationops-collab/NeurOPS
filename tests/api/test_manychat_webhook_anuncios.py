"""POST /api/manychat-webhook con la palabra clave (pedido de Kerwin, 14/10/2026).

"Ya no se va a hacer por ID [...] ahora va a llegar la palabra clave directamente desde ManyChat y ahí
se va a crear el anuncio". El webhook crea el anuncio la primera vez que llega una palabra clave y
después lo reusa (también uno viejo con la misma, escrita distinto); no mezcla la respuesta de un
anuncio con el envío de otro; un webhook sin calificación no borra la que ya se sabía; y un anuncio
nuevo se asocia solo a los anuncios de Meta que lo nombran.

Las llamadas mandan el header X-ManyChat-Token: los casos del secreto (503, 401, log_only, GET abierto)
están en test_manychat_webhook_secreto.py.
"""
from datetime import date

import pytest

from app.models import Ad, LeadAnswer, MetaAnuncio
from app.services import meta_ads_service
from tests.services.test_meta_ads_service import meta  # noqa: F401  (la Graph API falsa)

WEBHOOK = '/api/manychat-webhook'
TOKEN = 'token-de-manychat-de-prueba-largo-1234'


@pytest.fixture(autouse=True)
def token_configurado(monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', TOKEN)


def enviar(client, cuerpo):
    return client.post(WEBHOOK, json=cuerpo, headers={'X-ManyChat-Token': TOKEN})


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
