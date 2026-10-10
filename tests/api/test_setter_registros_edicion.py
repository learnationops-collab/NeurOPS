"""Editar una fila de Registros (/admin/ventas › Setters) con `PUT /public/setter-reports/<id>`.

Un número llevado a 0 volvía al de antes (`data.get(x) or actual`), y los follow-ups de Link y las
aperturas de cualificación y dolor se editaban en la tabla pero no se guardaban.
"""
from datetime import date

import pytest

from app.models import SetterDailyStats


@pytest.fixture()
def directora(make_user):
    return make_user(role='director_comercial', username='Directora')


@pytest.fixture()
def fila(db, make_user):
    elias = make_user(role='setter', username='Elias')
    stat = SetterDailyStats(setter_id=elias.id, date=date(2026, 10, 8), inbox_entrantes=20, not_lead=3,
                            funnel_agenda=2, link_fu=4, link_fur=1, qualification_opening_submitted=6)
    db.session.add(stat)
    db.session.commit()
    return stat


def test_un_cero_se_guarda(client, directora, fila, auth_headers):
    r = client.put(f'/api/public/setter-reports/{fila.id}', json={'not_lead': 0, 'fun_agenda': 0},
                   headers=auth_headers(directora))

    assert r.status_code == 200
    guardada = SetterDailyStats.query.get(fila.id)
    assert (guardada.not_lead, guardada.funnel_agenda, guardada.inbox_entrantes) == (0, 0, 20)


def test_se_guardan_todas_las_columnas_que_la_tabla_edita(client, directora, fila, auth_headers):
    client.put(f'/api/public/setter-reports/{fila.id}', headers=auth_headers(directora), json={
        'link_fu': 7, 'link_fur': 3, 'qualification_opening_submitted': 9, 'qualification_opening_responded': 2,
        'pain_opening_submitted': 5, 'pain_opening_responded': 1})

    g = SetterDailyStats.query.get(fila.id)
    assert (g.link_fu, g.link_fur) == (7, 3)
    assert (g.qualification_opening_submitted, g.qualification_opening_responded) == (9, 2)
    assert (g.pain_opening_submitted, g.pain_opening_responded) == (5, 1)


def test_lo_que_no_viene_no_se_toca(client, directora, fila, auth_headers):
    client.put(f'/api/public/setter-reports/{fila.id}', json={'entrantes': ''}, headers=auth_headers(directora))

    assert SetterDailyStats.query.get(fila.id).inbox_entrantes == 20


# --- Un reporte v2 en Registros ------------------------------------------------------------------

def _v2(db, setter_id):
    from app.services import setter_reporte_v2 as rv2

    datos = rv2.vacio()
    datos['anuncios'].update(entrantes=10, no_lead=1, agendas=2)
    datos['inbound'].update(entrantes=6, inabribles=1, agendas=1)
    datos['bienvenidas'].update(hechas=12, respondidas=5)
    datos['embudo'].update(dolor=10, oferta=7, link=5)
    stat = rv2.escribir(SetterDailyStats(setter_id=setter_id, date=date(2026, 10, 10)), datos)
    db.session.add(stat)
    db.session.commit()
    return stat


def test_el_listado_dice_la_version_y_trae_los_canales(client, db, directora, fila, auth_headers):
    nuevo = _v2(db, fila.setter_id)

    reportes = client.get('/api/public/setter-reports', headers=auth_headers(directora)).get_json()['reports']

    por_id = {r['id']: r for r in reportes}
    assert (por_id[fila.id]['version'], por_id[fila.id]['v2']) == (1, None)
    r = por_id[nuevo.id]
    assert r['version'] == 2
    assert r['v2']['canales']['anuncios']['agendas'] == 2
    assert r['v2']['bienvenidas']['hechas'] == 12
    # Las columnas de siempre, con los totales que llenó el v2.
    assert (r['entrantes'], r['leads'], r['fun_agenda']) == (16, 14, 3)


def test_un_v2_se_edita_por_canal_y_los_totales_lo_siguen(client, db, directora, fila, auth_headers):
    nuevo = _v2(db, fila.setter_id)

    r = client.put(f'/api/public/setter-reports/{nuevo.id}', headers=auth_headers(directora),
                   json={'version': 2, 'inbound': {'agendas': 0, 'entrantes': 9}, 'bienvenidas': {'respondidas': 7}})

    assert r.status_code == 200
    g = SetterDailyStats.query.get(nuevo.id)
    assert (g.inb_agendas, g.inb_entrantes, g.bnv_respondidas) == (0, 9, 7)
    # Lo que no vino queda; los totales se recalculan con los canales.
    assert (g.ads_entrantes, g.funnel_pain) == (10, 10)
    assert (g.inbox_entrantes, g.funnel_agenda, g.inbox_leads) == (19, 2, 17)
    assert r.get_json()['reporte']['canales']['inbound']['cualificados'] == 8


def test_un_v2_no_se_edita_por_sus_totales(client, db, directora, fila, auth_headers):
    nuevo = _v2(db, fila.setter_id)

    r = client.put(f'/api/public/setter-reports/{nuevo.id}', json={'entrantes': 99}, headers=auth_headers(directora))

    assert r.status_code == 409
    assert SetterDailyStats.query.get(nuevo.id).inbox_entrantes == 16
