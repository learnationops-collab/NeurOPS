"""GET /api/comercial/resumen con Setters: el alcance del tablero de setters.

Desde el 10/10/2026 la dirección (Analizar con Setters) y el setter (su «Mis datos») ven el MISMO
tablero, así que lo que separa una cosa de la otra es el backend: un setter ve lo suyo pida lo que
pida, también cuando la dirección lo simula; la dirección elige un setter o ve el equipo. Un setter
sin nada ve ceros, no lo del equipo. El viejo `/comercial/setter/mis-datos` ya no existe.
"""
from datetime import date

import pytest
from freezegun import freeze_time

from app.models import SetterDailyStats
from app.services import setter_reporte_v2 as rv2

RESUMEN = '/api/comercial/resumen'
HOY = '2026-10-10 15:00:00'
SEPT = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30', 'compare': 'none',
        'rol': 'setters'}


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'closer': make_user(role='closer', username='Marlon'),
        'elias': make_user(role='setter', username='Elias'),
        'paula': make_user(role='setter', username='Paula'),
    }


@pytest.fixture(autouse=True)
def sin_comision(monkeypatch):
    """La comisión del mes recorre las ventas y su atribución: acá se mira el alcance, no la plata."""
    from app.services.commission_service import CommissionService
    monkeypatch.setattr(CommissionService, 'get_setter_commission', staticmethod(lambda u: {
        'role': 'setter', 'month': '2026-10', 'rate': 0.08, 'cash_neto': 0.0, 'commission': float(u.id)}))


def reporte(db, setter, dia, anuncios, inbound=0, agendas=0):
    datos = rv2.vacio()
    datos['anuncios'].update(entrantes=anuncios, agendas=agendas)
    datos['inbound'].update(entrantes=inbound)
    db.session.add(rv2.escribir(SetterDailyStats(setter_id=setter.id, date=dia), datos))
    db.session.commit()


def pedir(client, headers, **extra):
    return client.get(RESUMEN, headers=headers, query_string={**SEPT, **extra})


@freeze_time(HOY)
def test_un_setter_ve_solo_lo_suyo_aunque_pida_lo_de_otro(client, db, equipo, auth_headers):
    reporte(db, equipo['elias'], date(2026, 9, 2), 30)
    reporte(db, equipo['paula'], date(2026, 9, 2), 70)

    respuesta = pedir(client, auth_headers(equipo['elias']), miembro_id=equipo['paula'].id, rol='closers')

    assert respuesta.status_code == 200
    datos = respuesta.get_json()
    assert (datos['rol'], datos['miembro']) == ('setters', {'id': equipo['elias'].id, 'nombre': 'Elias'})
    assert datos['actual']['entrantes'] == 30
    assert datos['comision']['commission'] == float(equipo['elias'].id)


@freeze_time(HOY)
def test_un_setter_sin_reportes_ve_ceros_y_no_lo_del_equipo(client, db, equipo, auth_headers):
    reporte(db, equipo['paula'], date(2026, 9, 2), 70, agendas=4)

    actual = pedir(client, auth_headers(equipo['elias'])).get_json()['actual']

    assert (actual['entrantes'], actual['agendas']) == (0, 0)
    assert [e['n'] for e in actual['funnel']] == [0] * 9


@freeze_time(HOY)
def test_la_direccion_elige_un_setter_o_ve_el_equipo_con_sus_canales(client, db, equipo, auth_headers):
    reporte(db, equipo['elias'], date(2026, 9, 2), 30)
    reporte(db, equipo['paula'], date(2026, 9, 2), 50, inbound=20)
    headers = auth_headers(equipo['director'])

    de_paula = pedir(client, headers, miembro_id=equipo['paula'].id).get_json()
    del_equipo = pedir(client, headers).get_json()

    assert de_paula['actual']['entrantes'] == 70
    assert de_paula['actual']['canales']['inbound']['entrantes'] == 20
    assert del_equipo['miembro'] is None
    assert del_equipo['actual']['entrantes'] == 100
    assert del_equipo['actual']['canales']['anuncios']['entrantes'] == 80
    assert del_equipo['comision']['commission'] == float(equipo['elias'].id + equipo['paula'].id)


@freeze_time(HOY)
def test_la_direccion_simulando_a_un_setter_ve_lo_de_ese_setter(client, db, equipo, auth_headers):
    reporte(db, equipo['elias'], date(2026, 9, 2), 30)
    reporte(db, equipo['paula'], date(2026, 9, 2), 70)
    simulacion = client.post('/api/auth/impersonate', headers=auth_headers(equipo['director']),
                             json={'user_id': equipo['elias'].id, 'isolated': True})
    token = simulacion.get_json()['token']

    datos = pedir(client, {'Authorization': f'Bearer {token}'}, miembro_id=equipo['paula'].id).get_json()

    assert datos['miembro']['id'] == equipo['elias'].id
    assert datos['actual']['entrantes'] == 30


@freeze_time(HOY)
def test_un_closer_no_ve_el_tablero_de_setters(client, db, equipo, auth_headers):
    reporte(db, equipo['elias'], date(2026, 9, 2), 30)

    datos = pedir(client, auth_headers(equipo['closer'])).get_json()

    assert datos['rol'] == 'closers'
    assert 'canales' not in datos['actual'] and 'comision' not in datos


def test_el_endpoint_viejo_de_mis_datos_ya_no_existe(client, db, equipo, auth_headers):
    respuesta = client.get('/api/comercial/setter/mis-datos', headers=auth_headers(equipo['elias']),
                           query_string=SEPT)

    assert respuesta.status_code == 404
