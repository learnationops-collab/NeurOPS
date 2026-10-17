"""Corregir a mano la calificación de los leads de ManyChat: de a uno y en lote (16/10/2026)."""
from datetime import datetime

import pytest

from app.models import LeadAnswer, ManychatLead


@pytest.fixture()
def director(make_user, auth_headers):
    return auth_headers(make_user(role='director_marketing'))


def persona(db, mid, ig, calificaciones):
    lead = ManychatLead(manychat_id=mid, name=mid, ig=ig)
    db.session.add(lead)
    db.session.commit()
    for i, valor in enumerate(calificaciones):
        cuando = datetime(2026, 10, 5, 12, i)
        db.session.add(LeadAnswer(lead_id=lead.id, keyword='GUIA PERU', qualification=valor,
                                  created_at=cuando, updated_at=cuando))
    db.session.commit()
    return lead


def estado(lead):
    filas = LeadAnswer.query.filter_by(lead_id=lead.id).order_by(LeadAnswer.created_at.desc()).all()
    return next((f.qualification for f in filas if f.qualification in ('true', 'false')), 'null')


def test_corregir_una_persona(client, db, director):
    ana = persona(db, 'mc-1', 'ana', ['null', 'true'])
    r = client.put(f'/api/manychat-webhook/lead/{ana.id}/calificacion', json={'estado': 'descalificado'}, headers=director)
    assert r.status_code == 200 and r.get_json()['cambio'] is True
    assert estado(ana) == 'false'

    client.put(f'/api/manychat-webhook/lead/{ana.id}/calificacion', json={'estado': 'sin_dato'}, headers=director)
    assert estado(ana) == 'null'


def test_estado_invalido(client, db, director):
    ana = persona(db, 'mc-1', 'ana', ['true'])
    r = client.put(f'/api/manychat-webhook/lead/{ana.id}/calificacion', json={'estado': 'quizas'}, headers=director)
    assert r.status_code == 400


def test_lote_con_vista_previa_y_aplicar(client, db, director):
    ana = persona(db, 'mc-1', 'ana.gomez', ['true'])
    beto = persona(db, 'mc-2', 'beto', ['true'])
    filas = [{'quien': '@Ana.Gomez', 'calificacion': 'no'}, {'quien': 'mc-2', 'calificacion': '1'},
             {'quien': 'nadie', 'calificacion': 'yes'}, {'quien': 'mc-2', 'calificacion': 'quizas'}]

    previa = client.post('/api/manychat-webhook/calificaciones', json={'filas': filas}, headers=director).get_json()
    assert (previa['encontrados'], previa['cantidad_no_encontrados'], previa['invalidas']) == (2, 1, 1)
    assert previa['por_estado'] == {'calificado': 1, 'descalificado': 1, 'sin_dato': 0}
    assert estado(ana) == 'true'  # la vista previa no cambia nada

    hecho = client.post('/api/manychat-webhook/calificaciones', json={'filas': filas, 'aplicar': True}, headers=director).get_json()
    assert (hecho['aplicado'], hecho['cambios']) == (True, 1)
    assert (estado(ana), estado(beto)) == ('false', 'true')
