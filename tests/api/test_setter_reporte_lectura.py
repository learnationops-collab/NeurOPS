"""Reabrir el reporte de un día y las marcas «Enviado» del calendario del formulario.

`GET /api/public/setter-report` devuelve el reporte de ese día como `setter_reporte_v2.leer`;
`GET /api/public/setter-report/fechas`, los días de un rango que tienen reporte. Un setter solo ve
los suyos: el `setter_id` lo fija la sesión. La dirección mira el de cualquiera.
"""
from datetime import date

import pytest

from app.models import SetterDailyStats
from app.services import setter_reporte_v2 as rv2

URL = '/api/public/setter-report'
FECHAS = '/api/public/setter-report/fechas'


@pytest.fixture()
def equipo(make_user):
    return {'elias': make_user(role='setter', username='Elias'),
            'paula': make_user(role='setter', username='Paula'),
            'directora': make_user(role='director_comercial', username='Directora')}


@pytest.fixture()
def reportes(db, equipo):
    elias = equipo['elias']
    datos = rv2.vacio()
    datos['anuncios'].update(entrantes=10, no_lead=1, agendas=2)
    datos['reflexion']['win_del_dia'] = 'Agendó una fría'
    db.session.add(rv2.escribir(SetterDailyStats(setter_id=elias.id, date=date(2026, 10, 9)), datos))
    db.session.add(SetterDailyStats(setter_id=elias.id, date=date(2026, 10, 1), inbox_entrantes=20,
                                    inbox_leads=12, funnel_agenda=1))
    db.session.add(SetterDailyStats(setter_id=elias.id, date=date(2026, 10, 4), is_non_working_day=True))
    db.session.add(SetterDailyStats(setter_id=equipo['paula'].id, date=date(2026, 10, 9), inbox_entrantes=3))
    db.session.commit()


def test_reabre_el_v2_del_dia_con_sus_canales(client, equipo, reportes, auth_headers):
    elias = equipo['elias']
    r = client.get(URL, query_string={'setter_id': elias.id, 'date': '2026-10-09'}, headers=auth_headers(elias))

    assert r.status_code == 200
    reporte = r.get_json()['reporte']
    assert reporte['version'] == 2
    assert reporte['canales']['anuncios']['agendas'] == 2
    assert reporte['canales']['anuncios']['cualificados'] == 9
    assert reporte['reflexion']['win_del_dia'] == 'Agendó una fría'


def test_un_v1_vuelve_sin_canales(client, equipo, reportes, auth_headers):
    elias = equipo['elias']
    reporte = client.get(URL, query_string={'date': '2026-10-01'}, headers=auth_headers(elias)).get_json()['reporte']

    assert (reporte['version'], reporte['canales']) == (1, None)
    assert reporte['totales']['entrantes'] == 20


def test_un_dia_sin_reporte_es_null(client, equipo, reportes, auth_headers):
    r = client.get(URL, query_string={'date': '2026-10-08'}, headers=auth_headers(equipo['elias']))

    assert (r.status_code, r.get_json()) == (200, {'reporte': None})


def test_sin_setter_id_el_setter_es_el_de_la_sesion(client, equipo, reportes, auth_headers):
    r = client.get(URL, query_string={'date': '2026-10-09'}, headers=auth_headers(equipo['paula']))

    assert r.get_json()['reporte']['totales']['entrantes'] == 3


def test_un_setter_no_lee_el_reporte_de_otro(client, equipo, reportes, auth_headers):
    r = client.get(URL, query_string={'setter_id': equipo['elias'].id, 'date': '2026-10-09'},
                   headers=auth_headers(equipo['paula']))

    assert r.status_code == 403


def test_la_direccion_lee_el_de_cualquiera(client, equipo, reportes, auth_headers):
    r = client.get(URL, query_string={'setter_id': equipo['elias'].id, 'date': '2026-10-09'},
                   headers=auth_headers(equipo['directora']))

    assert r.status_code == 200
    assert r.get_json()['reporte']['setter_id'] == equipo['elias'].id


def test_la_direccion_tiene_que_decir_de_quien(client, equipo, reportes, auth_headers):
    r = client.get(URL, query_string={'date': '2026-10-09'}, headers=auth_headers(equipo['directora']))

    assert r.status_code == 400


def test_una_fecha_rota_es_400(client, equipo, auth_headers):
    r = client.get(URL, query_string={'date': '10/09/2026'}, headers=auth_headers(equipo['elias']))

    assert r.status_code == 400


def test_las_fechas_del_mes_con_reporte(client, equipo, reportes, auth_headers):
    r = client.get(FECHAS, query_string={'desde': '2026-10-01', 'hasta': '2026-10-31'},
                   headers=auth_headers(equipo['elias']))

    assert r.status_code == 200
    assert r.get_json() == {'fechas': ['2026-10-01', '2026-10-04', '2026-10-09'],
                            'no_laborables': ['2026-10-04']}


def test_las_fechas_respetan_el_rango(client, equipo, reportes, auth_headers):
    r = client.get(FECHAS, query_string={'desde': '2026-10-02', 'hasta': '2026-10-08'},
                   headers=auth_headers(equipo['elias']))

    assert r.get_json()['fechas'] == ['2026-10-04']


def test_las_fechas_de_otro_setter_son_403(client, equipo, reportes, auth_headers):
    r = client.get(FECHAS, query_string={'setter_id': equipo['elias'].id, 'desde': '2026-10-01',
                                         'hasta': '2026-10-31'}, headers=auth_headers(equipo['paula']))

    assert r.status_code == 403


@pytest.mark.parametrize('rango', [{'desde': '2026-10-31', 'hasta': '2026-10-01'},
                                   {'desde': '2024-01-01', 'hasta': '2026-10-01'},
                                   {'desde': '2026-10-01'}])
def test_un_rango_invalido_es_400(client, equipo, auth_headers, rango):
    assert client.get(FECHAS, query_string=rango, headers=auth_headers(equipo['elias'])).status_code == 400


def test_un_closer_no_entra(client, make_user, auth_headers):
    closer = make_user(role='closer')

    assert client.get(URL, query_string={'date': '2026-10-09'}, headers=auth_headers(closer)).status_code == 403
    assert client.get(FECHAS, query_string={'desde': '2026-10-01', 'hasta': '2026-10-31'},
                      headers=auth_headers(closer)).status_code == 403
