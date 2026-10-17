"""La calificación que manda ManyChat: «yes» es calificado y «no» descalificado (Kerwin, 16/10/2026),
venga en `cualificacion` o en `cualificado`."""
import logging

import pytest

from app.models import LeadAnswer, ManychatLead

URL = '/api/manychat-webhook'
TOKEN = 'token-de-manychat-de-prueba-largo-1234'


@pytest.fixture(autouse=True)
def token(monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', TOKEN)


def enviar(client, **campos):
    cuerpo = {'manychat_id': 'mc-1', 'lead_name': 'Ana', 'keyword': 'GUIA PERU', **campos}
    return client.post(URL, json=cuerpo, headers={'X-ManyChat-Token': TOKEN})


def calificacion(db):
    lead = ManychatLead.query.filter_by(manychat_id='mc-1').one()
    return [a.qualification for a in LeadAnswer.query.filter_by(lead_id=lead.id).order_by(LeadAnswer.id)][-1]


@pytest.mark.parametrize('campo, valor, esperada', [
    ('cualificacion', 'yes', 'true'),
    ('cualificacion', 'no', 'false'),
    ('cualificado', 'yes', 'true'),
    ('cualificado', 'no', 'false'),
    ('cualificado', 'No', 'false'),
    ('calificado', 'no', 'false'),
])
def test_yes_es_calificado_y_no_descalificado(client, db, campo, valor, esperada):
    assert enviar(client, id_option_send='1', id_option='0').status_code in (200, 201)
    assert enviar(client, id_option_send='0', id_option='1', **{campo: valor}).status_code in (200, 201)

    assert calificacion(db) == esperada


def test_la_variable_sin_expandir_no_cuenta(client, db):
    """«{{cuf_…}}» es la variable de ManyChat sin valor: no es ni yes ni no."""
    enviar(client, id_option_send='1', id_option='0')
    enviar(client, id_option_send='0', id_option='1', cualificado='{{cuf_123}}')
    assert calificacion(db) == 'null'


def test_registra_que_manda_manychat_sin_datos_personales(client, db, caplog):
    with caplog.at_level(logging.WARNING):
        enviar(client, id_option_send='0', id_option='1', cualificado='no')
    linea = next(r.getMessage() for r in caplog.records if 'WEBHOOK CALIFICACION' in r.getMessage())
    assert "'cualificado': 'no'" in linea
    assert 'Ana' not in linea
