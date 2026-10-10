"""GET /api/comercial/setter/mis-datos: el alcance.

Como en todo el tablero, lo que separa «Mis datos» de los datos del equipo es el backend: un setter
ve lo suyo pida lo que pida, también cuando la dirección lo simula; la dirección elige un setter (o
el equipo de setting); nadie más entra. Y un setter sin nada ve ceros, no lo del equipo.
"""
from datetime import date

import pytest
from freezegun import freeze_time

from app.models import SetterDailyStats
from app.services import setter_reporte_v2 as rv2

MIS_DATOS = '/api/comercial/setter/mis-datos'
HOY = '2026-10-10 15:00:00'
SEPT = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30', 'compare': 'none'}


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'admin': make_user(role='admin', username='root'),
        'closer': make_user(role='closer', username='Marlon'),
        'elias': make_user(role='setter', username='Elias'),
        'paula': make_user(role='setter', username='Paula'),
        'triage': make_user(role='triage', username='tri'),
    }


def reporte(db, setter, dia, entrantes, agendas=0):
    datos = rv2.vacio()
    datos['anuncios'].update(entrantes=entrantes, agendas=agendas)
    db.session.add(rv2.escribir(SetterDailyStats(setter_id=setter.id, date=dia), datos))
    db.session.commit()


def pedir(client, headers, **extra):
    return client.get(MIS_DATOS, headers=headers, query_string={**SEPT, **extra})


@freeze_time(HOY)
def test_un_setter_ve_solo_lo_suyo_aunque_pida_lo_de_otro(client, db, equipo, auth_headers):
    reporte(db, equipo['elias'], date(2026, 9, 2), 30)
    reporte(db, equipo['paula'], date(2026, 9, 2), 70)

    respuesta = pedir(client, auth_headers(equipo['elias']), miembro_id=equipo['paula'].id)

    assert respuesta.status_code == 200
    datos = respuesta.get_json()
    assert datos['miembro'] == {'id': equipo['elias'].id, 'nombre': 'Elias'}
    assert datos['reporte']['totales']['entrantes'] == 30


@freeze_time(HOY)
def test_un_setter_sin_reportes_ve_ceros_y_no_lo_del_equipo(client, db, equipo, auth_headers):
    reporte(db, equipo['paula'], date(2026, 9, 2), 70, agendas=4)

    datos = pedir(client, auth_headers(equipo['elias'])).get_json()

    assert datos['reporte']['totales']['entrantes'] == 0
    assert datos['reporte']['totales']['agendas'] == 0
    assert [e['n'] for e in datos['embudo']] == [0] * 9


@freeze_time(HOY)
def test_la_direccion_elige_un_setter_o_ve_el_equipo(client, db, equipo, auth_headers):
    reporte(db, equipo['elias'], date(2026, 9, 2), 30)
    reporte(db, equipo['paula'], date(2026, 9, 2), 70)
    headers = auth_headers(equipo['director'])

    de_paula = pedir(client, headers, miembro_id=equipo['paula'].id).get_json()
    del_equipo = pedir(client, headers).get_json()

    assert de_paula['reporte']['totales']['entrantes'] == 70
    assert del_equipo['miembro'] is None
    assert del_equipo['reporte']['totales']['entrantes'] == 100
    assert del_equipo['comision'] is None


@freeze_time(HOY)
def test_la_direccion_no_puede_pedirlo_para_alguien_que_no_es_setter(client, db, equipo, auth_headers):
    respuesta = pedir(client, auth_headers(equipo['admin']), miembro_id=equipo['closer'].id)

    assert respuesta.status_code == 404


@pytest.mark.parametrize('quien', ['closer', 'triage'])
def test_ni_los_closers_ni_otros_roles_lo_piden(client, db, equipo, auth_headers, quien):
    assert pedir(client, auth_headers(equipo[quien])).status_code == 403


@freeze_time(HOY)
def test_la_direccion_simulando_a_un_setter_ve_lo_de_ese_setter(client, db, equipo, auth_headers):
    reporte(db, equipo['elias'], date(2026, 9, 2), 30)
    reporte(db, equipo['paula'], date(2026, 9, 2), 70)
    simulacion = client.post('/api/auth/impersonate', headers=auth_headers(equipo['director']),
                             json={'user_id': equipo['elias'].id, 'isolated': True})
    token = simulacion.get_json()['token']

    datos = pedir(client, {'Authorization': f'Bearer {token}'},
                  miembro_id=equipo['paula'].id).get_json()

    assert datos['miembro']['id'] == equipo['elias'].id
    assert datos['reporte']['totales']['entrantes'] == 30


@freeze_time(HOY)
def test_devuelve_las_fechas_del_periodo_y_de_la_comparacion(client, db, equipo, auth_headers):
    datos = pedir(client, auth_headers(equipo['elias']), compare='prev').get_json()

    assert datos['dates'] == {'start': '2026-09-01', 'end': '2026-09-30',
                              'compare_start': '2026-08-02', 'compare_end': '2026-08-31'}
    assert datos['previo'] is not None
