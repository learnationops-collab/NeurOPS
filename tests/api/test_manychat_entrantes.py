"""Marketing › Entrantes: una fila por persona con su estado y su etapa del flujo de ManyChat (16/10/2026)."""
from datetime import datetime

import pytest

from app.models import ConversationalMessage, LeadAnswer, ManychatLead, MetaAnuncio

RANGO = 'desde=2026-10-01&hasta=2026-10-31'


@pytest.fixture()
def director(make_user, auth_headers):
    return auth_headers(make_user(role='director_marketing'))


def lead(db, nombre, setter=None):
    persona = ManychatLead(manychat_id=f'mc-{nombre}', name=nombre, ig=nombre.lower(), setter=setter)
    db.session.add(persona)
    db.session.commit()
    return persona


def webhook(db, persona, minuto, keyword='GUIA PERU', calificacion='null', enviado=None, respondido=None):
    cuando = datetime(2026, 10, 5, 12, minuto)
    db.session.add(LeadAnswer(lead_id=persona.id, keyword=keyword, qualification=calificacion,
                              id_option_send=enviado, id_option=respondido, created_at=cuando, updated_at=cuando))
    db.session.commit()


def entrantes(client, headers):
    respuesta = client.get(f'/api/manychat-webhook/entrantes?{RANGO}', headers=headers)
    assert respuesta.status_code == 200
    return {f['nombre']: f for f in respuesta.get_json()['filas']}


def test_una_fila_por_persona_con_estado_y_etapa(client, db, director):
    db.session.add_all([
        ConversationalMessage(message_id='1', title='Opening', category='opening'),
        ConversationalMessage(message_id='4', title='Cualificacion 3', category='cualificacion'),
        MetaAnuncio(meta_ad_id='a1', nombre='Ad', campana='LM Funnel', conjunto='Guía Perú', clave='GUIA PERU',
                    estado='ACTIVE'),
    ])
    ana, beto, caro = lead(db, 'Ana'), lead(db, 'Beto'), lead(db, 'Caro')
    webhook(db, ana, 0, enviado='1', respondido='0')
    webhook(db, ana, 1, calificacion='true', enviado='4', respondido='1')
    webhook(db, beto, 0, enviado='1', respondido='0')
    webhook(db, caro, 0, enviado='1', respondido='1')

    filas = entrantes(client, director)

    assert set(filas) == {'Ana', 'Beto', 'Caro'}
    assert (filas['Ana']['estado'], filas['Ana']['interacciones']) == ('calificado', 2)
    assert filas['Ana']['ultimo_enviado'] == {'id': '4', 'titulo': 'Cualificacion 3', 'categoria': 'cualificacion'}
    assert filas['Ana']['ultimo_respondido']['titulo'] == 'Opening'
    assert (filas['Ana']['clave'], filas['Ana']['campana'], filas['Ana']['conjunto']) == ('GUIA PERU', 'LM Funnel', 'Guía Perú')
    assert filas['Beto']['estado'] == 'sin_respuesta'
    assert filas['Beto']['ultimo_respondido']['id'] is None
    assert filas['Caro']['estado'] == 'en_conversacion'


def test_fuera_del_periodo_no_entra(client, db, director):
    persona = lead(db, 'Vieja')
    db.session.add(LeadAnswer(lead_id=persona.id, keyword='EARN', created_at=datetime(2026, 9, 1),
                              updated_at=datetime(2026, 9, 1)))
    db.session.commit()

    assert 'Vieja' not in entrantes(client, director)


def test_el_historial_de_una_persona(client, db, director):
    ana, beto = lead(db, 'Ana'), lead(db, 'Beto')
    webhook(db, ana, 0)
    webhook(db, ana, 1)
    webhook(db, beto, 0)

    respuesta = client.get(f'/api/manychat-webhook/log?lead_id={ana.id}&limit=50', headers=director)

    assert [f['lead_name'] for f in respuesta.get_json()] == ['Ana', 'Ana']


def test_un_closer_no_ve_los_entrantes(client, db, make_user, auth_headers):
    respuesta = client.get(f'/api/manychat-webhook/entrantes?{RANGO}', headers=auth_headers(make_user(role='closer')))
    assert respuesta.status_code == 403
