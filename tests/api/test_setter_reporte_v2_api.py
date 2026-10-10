"""`POST /api/public/setter-report` con el reporte v2 (10/10/2026) y con el v1 de siempre.

El espacio del setter manda el formulario por pasos (`version: 2`, por canal y con bienvenidas);
cualquier otro cliente que siga mandando el v1 se guarda igual que antes. Discord se reemplaza por
un registro: estos tests miran qué se guarda, no qué sale.
"""
from datetime import date

import pytest

from app.models import SetterDailyStats

URL = '/api/public/setter-report'
DIA = '2026-10-10'


@pytest.fixture(autouse=True)
def _sin_discord(monkeypatch):
    disparos = []
    monkeypatch.setattr('app.api.setter._trigger_setter_report_webhook', lambda stat: disparos.append(stat.id))
    return disparos


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias')


def v2(setter_id, **cambios):
    datos = {
        'setter_id': setter_id, 'date': DIA, 'version': 2,
        'anuncios': {'entrantes': 10, 'no_lead': 1, 'inabribles': 0, 'ap_entrantes': 3, 'ap_dolor': 5, 'agendas': 2},
        'inbound': {'entrantes': 6, 'no_lead': 0, 'inabribles': 1, 'ap_entrantes': 1, 'ap_dolor': 3, 'agendas': 1},
        'bienvenidas': {'hechas': 12, 'respondidas': 5, 'aperturas': 4},
        'embudo': {'dolor': 10, 'oferta': 7, 'link': 5},
        'followups': {'entrantes': 9, 'dolor': 5, 'oferta': 3, 'link': 3},
        'reflexion': {'flujo_trabajo': 'Abrí 40 conversaciones', 'win_del_dia': 'Agendó una fría'},
        'is_non_working_day': False,
    }
    datos.update(cambios)
    return datos


def test_el_v2_se_guarda_por_canal_y_devuelve_lo_que_quedo(client, elias, auth_headers, _sin_discord):
    r = client.post(URL, json=v2(elias.id), headers=auth_headers(elias))

    assert r.status_code == 201
    fila = SetterDailyStats.query.one()
    assert (fila.report_version, fila.date) == (2, date(2026, 10, 10))
    assert (fila.ads_entrantes, fila.inb_agendas, fila.bnv_respondidas) == (10, 1, 5)
    # Los totales del v1 siguen llenos: la Vista General y el historial los leen.
    assert (fila.inbox_entrantes, fila.inbox_leads, fila.funnel_agenda) == (16, 14, 3)
    cuerpo = r.get_json()
    assert cuerpo['id'] == fila.id
    assert cuerpo['reporte']['canales']['anuncios']['cualificados'] == 9
    assert cuerpo['reporte']['reflexion']['win_del_dia'] == 'Agendó una fría'
    assert _sin_discord == [fila.id]


def test_volver_a_mandar_el_mismo_dia_lo_pisa(client, elias, auth_headers):
    client.post(URL, json=v2(elias.id), headers=auth_headers(elias))
    corregido = v2(elias.id)
    corregido['anuncios']['agendas'] = 4

    r = client.post(URL, json=corregido, headers=auth_headers(elias))

    assert r.status_code == 201
    fila = SetterDailyStats.query.one()
    assert (fila.ads_agendas, fila.funnel_agenda) == (4, 5)


def test_un_dia_del_v1_se_rehace_con_el_v2(client, db, elias, auth_headers):
    db.session.add(SetterDailyStats(setter_id=elias.id, date=date(2026, 10, 10), inbox_entrantes=30,
                                    qualification_fur=8))
    db.session.commit()

    client.post(URL, json=v2(elias.id), headers=auth_headers(elias))

    fila = SetterDailyStats.query.one()
    assert (fila.report_version, fila.inbox_entrantes, fila.qualification_fur) == (2, 16, 0)


def test_el_dia_no_laborable_viaja_en_el_v2(client, elias, auth_headers):
    client.post(URL, json=v2(elias.id, is_non_working_day=True), headers=auth_headers(elias))

    assert SetterDailyStats.query.one().is_non_working_day is True


def test_el_v1_sigue_guardandose_como_siempre(client, elias, auth_headers, _sin_discord):
    r = client.post(URL, headers=auth_headers(elias), json={
        'setter_id': elias.id, 'date': DIA, 'inbox_entrantes': 20, 'not_lead': 2,
        'funnel_qualification': 15, 'funnel_agenda': 3, 'qualification_fu': 6, 'qualification_fur': 2,
        'pain_opening_submitted': 4, 'pain_opening_responded': 1,
        'reflections': {'daily_reflection': 'Buen día', 'win_of_day': 'Una venta'},
    })

    assert r.status_code == 201
    fila = SetterDailyStats.query.one()
    assert fila.report_version == 1
    assert (fila.inbox_entrantes, fila.funnel_qualification, fila.funnel_agenda) == (20, 15, 3)
    assert (fila.qualification_fur, fila.pain_opening_responded) == (2, 1)
    assert fila.reflections == {'daily_reflection': 'Buen día', 'win_of_day': 'Una venta'}
    assert _sin_discord == [fila.id]


def test_un_setter_que_no_existe_es_404(client, make_user, auth_headers):
    admin = make_user(role='admin')

    r = client.post(URL, json=v2(98765), headers=auth_headers(admin))

    assert r.status_code == 404
    assert SetterDailyStats.query.count() == 0
