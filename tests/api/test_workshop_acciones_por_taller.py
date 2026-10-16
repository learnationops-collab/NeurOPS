"""Planificar: cada acción del plan se asigna (o no) a un próximo taller.

`event_id` es opcional: las acciones de antes no tienen taller y los clientes que no lo mandan siguen
funcionando igual. Al borrar el taller, sus acciones quedan sin taller en vez de perderse.
"""
import pytest

from app.models import WorkshopAction


@pytest.fixture()
def marketing(make_user, auth_headers):
    return auth_headers(make_user(role='director_marketing'))


def _taller(client, headers, fecha='2026-10-19'):
    res = client.post('/api/workshop/events', headers=headers, json={'date': fecha, 'name': f'WEBINAR {fecha}'})
    assert res.status_code == 201, res.get_json()
    return res.get_json()['id']


def test_crear_sin_taller_sigue_como_antes(client, db, marketing):
    res = client.post('/api/workshop/actions', headers=marketing, json={'title': 'Mejorar el botón', 'stage_key': 'whatsapp'})
    assert res.status_code == 201
    assert res.get_json()['event_id'] is None


def test_crear_asignada_a_un_taller(client, db, marketing):
    taller = _taller(client, marketing)
    res = client.post('/api/workshop/actions', headers=marketing, json={
        'title': 'Recordatorio 1 h antes', 'stage_key': 'asistencia', 'target_delta_pp': 4, 'event_id': taller})
    assert res.status_code == 201, res.get_json()
    assert res.get_json()['event_id'] == taller

    lista = client.get('/api/workshop/actions', headers=marketing).get_json()
    assert [a['event_id'] for a in lista] == [taller]


@pytest.mark.parametrize('valor', [999999, 'abc'])
def test_taller_que_no_existe_se_rechaza(client, db, marketing, valor):
    res = client.post('/api/workshop/actions', headers=marketing, json={'title': 'X', 'event_id': valor})
    assert res.status_code == 400
    assert WorkshopAction.query.count() == 0


def test_editar_mueve_de_taller_y_vacio_la_deja_sin(client, db, marketing):
    a, b = _taller(client, marketing, '2026-10-19'), _taller(client, marketing, '2026-10-26')
    accion = client.post('/api/workshop/actions', headers=marketing, json={'title': 'X', 'event_id': a}).get_json()

    movida = client.put(f"/api/workshop/actions/{accion['id']}", headers=marketing, json={'event_id': b})
    assert movida.status_code == 200 and movida.get_json()['event_id'] == b

    # Tildarla no toca el taller (el cliente viejo solo manda status).
    tildada = client.put(f"/api/workshop/actions/{accion['id']}", headers=marketing, json={'status': 'done'})
    assert tildada.get_json()['event_id'] == b and tildada.get_json()['status'] == 'done'

    suelta = client.put(f"/api/workshop/actions/{accion['id']}", headers=marketing, json={'event_id': None})
    assert suelta.get_json()['event_id'] is None

    mala = client.put(f"/api/workshop/actions/{accion['id']}", headers=marketing, json={'event_id': 999999})
    assert mala.status_code == 400


def test_borrar_el_taller_deja_sus_acciones_sin_taller(client, db, marketing):
    taller = _taller(client, marketing)
    accion = client.post('/api/workshop/actions', headers=marketing, json={'title': 'X', 'event_id': taller}).get_json()

    assert client.delete(f'/api/workshop/events/{taller}', headers=marketing).status_code == 200

    quedo = db.session.get(WorkshopAction, accion['id'])
    assert quedo is not None and quedo.event_id is None
