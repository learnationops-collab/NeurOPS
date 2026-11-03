"""Las llamadas de venta de un alumno para la Scale en vivo de la Academia (`GET /calls`)."""
from datetime import datetime

import pytest

from app.models import Appointment, Client, User

TOKEN = 'token-de-la-academia-para-tests-123'
H = {'Authorization': f'Bearer {TOKEN}'}
URL = '/api/external/academy/calls'


@pytest.fixture(autouse=True)
def _token(monkeypatch):
    monkeypatch.setenv('ACADEMY_INBOUND_API_TOKEN', TOKEN)


@pytest.fixture()
def ana(db):
    closer = User(username='jean', email='jean@x.com')
    c = Client(full_name='Ana', email='ana@x.com')
    db.session.add_all([closer, c])
    db.session.commit()
    db.session.add_all([
        Appointment(closer_id=closer.id, client_id=c.id, start_time=datetime(2026, 10, 1, 15),
                    closer_notes='No llega con el tiempo, estudia de noche.', examen='ENARM', closer_result='Venta'),
        Appointment(closer_id=closer.id, client_id=c.id, start_time=datetime(2026, 9, 20, 15)),
        Appointment(closer_id=closer.id, client_id=c.id, start_time=datetime(2026, 10, 5, 15),
                    agenda_payload={'respuestas': [{'pregunta': '¿Qué examen?', 'respuesta': 'ENARM | México'},
                                                   {'pregunta': 'Vacía', 'respuesta': ''}]}),
    ])
    db.session.commit()
    return c


def test_trae_las_llamadas_con_algo_escrito_la_mas_nueva_primero(client, db, ana):
    r = client.get(URL, headers=H, query_string={'email': 'ana@x.com'})
    assert r.status_code == 200
    calls = r.get_json()['calls']
    assert [c['fecha'][:10] for c in calls] == ['2026-10-05', '2026-10-01']
    assert calls[0]['respuestas'] == [{'pregunta': '¿Qué examen?', 'respuesta': 'ENARM | México'}]
    assert (calls[1]['closer'], calls[1]['examen'], calls[1]['resultado']) == ('jean', 'ENARM', 'Venta')
    assert calls[1]['closer_notes'].startswith('No llega')


def test_pide_token_y_un_cliente_que_exista(client, db, ana):
    assert client.get(URL, query_string={'email': 'ana@x.com'}).status_code == 401
    assert client.get(URL, headers=H, query_string={'email': 'nadie@x.com'}).status_code == 404
