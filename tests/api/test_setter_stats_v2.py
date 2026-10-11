"""La Vista General de /admin/ventas › Setters con reportes v1 y v2 mezclados.

Un v2 sigue llenando los totales del v1 (`setter_reporte_v2.escribir`), así que entrantes,
cualificados, embudo y agendas suman los dos. Lo que el v2 no pide son las respuestas a las
APERTURAS: esa tasa se calcula solo con los reportes v1, que son los que la miden. Las respuestas a
los follow-ups las piden los dos desde el 11/10/2026 y suman los dos. Y `por_canal` trae lo nuevo
del v2.
"""
from datetime import date

import pytest

from app.models import SetterDailyStats
from app.services import setter_reporte_v2 as rv2

STATS = '/api/public/setter-stats'
OCTUBRE = {'start_date': '2026-10-01', 'end_date': '2026-10-31'}


@pytest.fixture()
def equipo(make_user):
    return {'directora': make_user(role='director_comercial', username='Directora'),
            'elias': make_user(role='setter', username='Elias')}


def v2_del_dia(dia, setter_id):
    datos = rv2.vacio()
    datos['anuncios'].update(entrantes=10, no_lead=1, inabribles=0, ap_entrantes=3, ap_dolor=5, agendas=2)
    datos['inbound'].update(entrantes=6, no_lead=0, inabribles=1, ap_entrantes=1, ap_dolor=3, agendas=1)
    datos['bienvenidas'].update(hechas=12, respondidas=5, aperturas=4)
    datos['embudo'].update(dolor=10, oferta=7, link=5)
    datos['followups'].update(entrantes=9, dolor=5, oferta=3, link=3)
    datos['followups_respondidos'].update(entrantes=4, dolor=2, oferta=1, link=1)
    return rv2.escribir(SetterDailyStats(setter_id=setter_id, date=dia), datos)


@pytest.fixture()
def mezcla(db, equipo):
    elias = equipo['elias'].id
    # El 08/10 con el formulario viejo: 20 entrantes, 15 respondieron, 2 no leads → 13 cualificados.
    db.session.add(SetterDailyStats(
        setter_id=elias, date=date(2026, 10, 8), inbox_entrantes=20, not_lead=2, inbox_inabribles=5,
        inbox_leads=13, funnel_qualification=15, funnel_pain=9, funnel_offer=6, funnel_link=4, funnel_agenda=2,
        qualification_opening_submitted=10, qualification_opening_responded=4,
        pain_opening_submitted=10, pain_opening_responded=6,
        qualification_fu=8, qualification_fur=4, pain_fu=2, pain_fur=1))
    # El 10/10 con el v2 (16 entrantes, 14 cualificados, 3 agendas, 12 aperturas, 20 follow-ups).
    db.session.add(v2_del_dia(date(2026, 10, 10), elias))
    db.session.commit()


def stats(client, auth_headers, quien, **extra):
    return client.get(STATS, headers=auth_headers(quien), query_string={**OCTUBRE, **extra}).get_json()


def test_los_totales_suman_los_dos_formularios(client, equipo, mezcla, auth_headers):
    t = stats(client, auth_headers, equipo['directora'])['totals']

    assert t['entrantes'] == 36
    assert t['leads'] == 27            # 13 + 14 cualificados
    assert t['funnel_qualification'] == 30   # respondieron: 15 + (16 − 1 in-abrible)
    assert t['not_lead'] == 3
    assert (t['funnel_pain'], t['funnel_offer'], t['funnel_link'], t['funnel_agenda']) == (19, 13, 9, 5)
    assert t['no_response'] == 6       # 5 + 1 in-abribles
    assert t['opening_submitted'] == 32


def test_las_tasas_de_respuesta_solo_miran_los_reportes_que_la_miden(client, equipo, mezcla, auth_headers):
    p = stats(client, auth_headers, equipo['directora'])['percentages']

    # Aperturas, solo el v1: 10 respondidas de 20 aperturas.
    assert p['rates']['opening_response'] == 50.0
    assert p['rates']['qualification_opening_rate'] == 40.0
    # Follow-ups, los dos: (4 + 1) + (4 + 2 + 1 + 1) = 13 respuestas de 10 + 20 follow-ups.
    assert p['rates']['total_fur'] == round(13 / 30 * 100, 2)
    assert p['rates']['qualification_fur'] == round(8 / 17 * 100, 2)
    assert p['rates']['link_fur'] == round(1 / 3 * 100, 2)
    # Sin mezclar: 2 agendas del v1 sobre sus 10 aperturas respondidas.
    assert p['conversions_to_agenda']['opening_to_agenda'] == 20.0
    # Lo que no depende de respuestas suma todo: 27 cualificados de 36 entrantes; 5 agendas / 27.
    assert p['rates']['opening_rate'] == 75.0
    assert p['funnel_evolution']['link_to_agenda'] == round(5 / 9 * 100, 2)


def test_lo_mismo_que_antes_cuando_todo_es_v1(client, db, equipo, auth_headers):
    db.session.add(SetterDailyStats(setter_id=equipo['elias'].id, date=date(2026, 10, 8), inbox_entrantes=20,
                                    qualification_opening_submitted=10, qualification_opening_responded=4,
                                    qualification_fu=8, qualification_fur=2))
    db.session.commit()

    p = stats(client, auth_headers, equipo['directora'])['percentages']

    assert (p['rates']['opening_response'], p['rates']['total_fur']) == (40.0, 25.0)


def test_por_canal_trae_lo_nuevo_del_v2(client, equipo, mezcla, auth_headers):
    datos = stats(client, auth_headers, equipo['directora'])

    assert datos['reportes_por_version'] == {'v1': 1, 'v2': 1}
    canal = datos['por_canal']
    assert canal['canales']['anuncios']['entrantes'] == 10
    assert canal['canales']['inbound']['cualificados'] == 5
    assert canal['canales']['anuncios']['aperturas'] == 8
    assert canal['canales']['inbound']['agendas'] == 1
    assert canal['bienvenidas'] == {'hechas': 12, 'respondidas': 5, 'aperturas': 4}
    # Lo del v1 no se reparte entre canales: queda aparte.
    assert canal['sin_canal']['entrantes'] == 20
    assert canal['totales']['entrantes'] == datos['totals']['entrantes']


def test_la_comparacion_tambien_trae_los_canales(client, equipo, mezcla, auth_headers):
    datos = stats(client, auth_headers, equipo['directora'], compare='true', compare_mode='month')

    assert datos['comparison']['por_canal']['reportes'] == 0
    assert datos['comparison']['reportes_por_version'] == {'v1': 0, 'v2': 0}
