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
