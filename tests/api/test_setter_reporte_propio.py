"""Un setter carga, lista, edita y borra solo SU reporte diario.

El formulario viejo dejaba elegir el perfil de cualquier setter y mandar el reporte a su nombre, y
`PUT`/`DELETE /public/setter-reports/<id>` editaban o borraban el de otro con solo cambiar el
número. Con un setter logueado el `setter_id` lo fija la sesión; simulando, la sesión ES el setter
simulado. La dirección comercial lista, edita y borra los de cualquiera.
"""
from datetime import date

import pytest

from app.models import SetterDailyStats


@pytest.fixture(autouse=True)
def _sin_discord(monkeypatch):
    monkeypatch.setattr('app.api.setter._trigger_setter_report_webhook', lambda stat: None)


@pytest.fixture()
def equipo(make_user):
    return {'elias': make_user(role='setter', username='Elias'),
            'paula': make_user(role='setter', username='Paula'),
            'directora': make_user(role='director_comercial', username='Directora')}


@pytest.fixture()
def de_elias(db, equipo):
    fila = SetterDailyStats(setter_id=equipo['elias'].id, date=date(2026, 10, 9), inbox_entrantes=10)
    db.session.add(fila)
    db.session.add(SetterDailyStats(setter_id=equipo['paula'].id, date=date(2026, 10, 9), inbox_entrantes=4))
    db.session.commit()
    return fila


def test_un_setter_no_manda_el_reporte_a_nombre_de_otro(client, equipo, auth_headers):
    r = client.post('/api/public/setter-report', headers=auth_headers(equipo['paula']),
                    json={'setter_id': equipo['elias'].id, 'date': '2026-10-10', 'version': 2})

    assert r.status_code == 403
    assert SetterDailyStats.query.count() == 0


def test_sin_setter_id_el_reporte_es_del_de_la_sesion(client, equipo, auth_headers):
    r = client.post('/api/public/setter-report', headers=auth_headers(equipo['paula']),
                    json={'date': '2026-10-10', 'version': 2, 'anuncios': {'entrantes': 3}})

    assert r.status_code == 201
    assert SetterDailyStats.query.one().setter_id == equipo['paula'].id


def test_el_v1_tambien_queda_atado_a_la_sesion(client, equipo, auth_headers):
    r = client.post('/api/public/setter-report', headers=auth_headers(equipo['paula']),
                    json={'setter_id': equipo['elias'].id, 'date': '2026-10-10', 'inbox_entrantes': 5})

    assert r.status_code == 403


def test_simulando_al_setter_se_carga_el_del_simulado(client, equipo, auth_headers):
    # La simulación entrega la sesión del setter (con la marca de quién simula).
    simulado = auth_headers(equipo['elias'], is_impersonating=True, original_user_id=equipo['directora'].id)

    r = client.post('/api/public/setter-report', headers=simulado,
                    json={'setter_id': equipo['elias'].id, 'date': '2026-10-10', 'version': 2})

    assert r.status_code == 201
    assert SetterDailyStats.query.one().setter_id == equipo['elias'].id


def test_la_lista_de_un_setter_trae_solo_los_suyos(client, equipo, de_elias, auth_headers):
    r = client.get('/api/public/setter-reports', headers=auth_headers(equipo['paula']))

    assert [x['setter_name'] for x in r.get_json()['reports']] == ['Paula']
    otro = client.get('/api/public/setter-reports', query_string={'setter_id': equipo['elias'].id},
                      headers=auth_headers(equipo['paula']))
    assert otro.status_code == 403


def test_la_direccion_lista_los_de_todos(client, equipo, de_elias, auth_headers):
    r = client.get('/api/public/setter-reports', headers=auth_headers(equipo['directora']))

    assert sorted(x['setter_name'] for x in r.get_json()['reports']) == ['Elias', 'Paula']


def test_un_setter_no_edita_ni_borra_el_de_otro(client, equipo, de_elias, auth_headers):
    paula = auth_headers(equipo['paula'])

    assert client.put(f'/api/public/setter-reports/{de_elias.id}', json={'entrantes': 99}, headers=paula).status_code == 403
    assert client.delete(f'/api/public/setter-reports/{de_elias.id}', headers=paula).status_code == 403
    assert SetterDailyStats.query.get(de_elias.id).inbox_entrantes == 10


def test_el_suyo_si_y_la_direccion_cualquiera(client, equipo, de_elias, auth_headers):
    r = client.put(f'/api/public/setter-reports/{de_elias.id}', json={'entrantes': 12},
                   headers=auth_headers(equipo['elias']))
    assert r.status_code == 200

    r = client.delete(f'/api/public/setter-reports/{de_elias.id}', headers=auth_headers(equipo['directora']))
    assert r.status_code == 200
    assert SetterDailyStats.query.get(de_elias.id) is None
