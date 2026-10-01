"""Mis reportes: al lado de las agendas reportadas, las generadas de "Mis datos" del mismo rango.

La tarjeta sumaba lo tipeado en los reportes (`funnel_agenda`) con el nombre de la métrica real,
"Agendas Generadas" (septiembre de 2026: Elias 75 reportadas contra 70 generadas, Paula 55 contra
52). Ahora se llama "Agendas reportadas" y la respuesta trae `generadas`, el número de "Mis datos".
"""
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, SetterDailyStats
from app.services import comercial_analitica as ca

HOY = '2026-10-01 12:00:00'
STATS = '/api/public/setter-stats'
SEP = {'start_date': '2026-09-01', 'end_date': '2026-09-30'}


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'marlon': make_user(role='closer', username='Marlon'),
        'elias': make_user(role='setter', username='Elias'),
        'paula': make_user(role='setter', username='Paula'),
    }


@pytest.fixture()
def septiembre(db, equipo):
    elias, paula, marlon = equipo['elias'], equipo['paula'], equipo['marlon']
    # Lo que Elias tipeó: 3 + 2 = 5 agendas reportadas.
    for dia, agendas in ((10, 3), (11, 2)):
        db.session.add(SetterDailyStats(setter_id=elias.id, date=date(2026, 9, dia), funnel_agenda=agendas))
    # Lo que generó de verdad: 4 personas en septiembre (una más de Paula, para el equipo).
    for n, quien in enumerate([elias] * 4 + [paula]):
        cliente = Client(full_name=f'Lead {n}', email=f'lead{n}@test.local')
        db.session.add(cliente)
        db.session.commit()
        db.session.add(Appointment(closer_id=marlon.id, setter_id=quien.id, client_id=cliente.id,
                                   created_at=datetime(2026, 9, 10 + n, 12, 0),
                                   start_time=datetime(2026, 9, 20, 15, 0), result='Confirmado'))
    db.session.commit()


@freeze_time(HOY)
def test_las_reportadas_van_con_las_generadas_de_mis_datos(client, equipo, septiembre, auth_headers):
    elias = equipo['elias']
    datos = client.get(STATS, headers=auth_headers(elias),
                       query_string={**SEP, 'setter_id': elias.id}).get_json()

    assert datos['totals']['funnel_agenda'] == 5
    assert datos['generadas'] == 4
    assert datos['generadas'] == ca.bloque_setters(date(2026, 9, 1), date(2026, 9, 30), setter_id=elias.id,
                                                   setter_nombre='Elias')['generadas']


@freeze_time(HOY)
def test_un_setter_no_ve_las_generadas_de_otro(client, equipo, septiembre, auth_headers):
    """Los reportes de otro los puede mirar (como siempre); los números de "Mis datos", no."""
    for setter_id in (equipo['elias'].id, ''):
        datos = client.get(STATS, headers=auth_headers(equipo['paula']),
                           query_string={**SEP, 'setter_id': setter_id}).get_json()
        assert datos['generadas'] is None


@freeze_time(HOY)
def test_la_direccion_ve_las_de_cada_uno_y_las_del_equipo(client, equipo, septiembre, auth_headers):
    headers = auth_headers(equipo['director'])
    elias = client.get(STATS, headers=headers, query_string={**SEP, 'setter_id': equipo['elias'].id}).get_json()
    equipo_entero = client.get(STATS, headers=headers, query_string=SEP).get_json()

    assert (elias['generadas'], equipo_entero['generadas']) == (4, 5)


@freeze_time(HOY)
def test_sin_rango_no_hay_numero_que_comparar(client, equipo, septiembre, auth_headers):
    elias = equipo['elias']
    datos = client.get(STATS, headers=auth_headers(elias), query_string={'setter_id': elias.id}).get_json()

    assert datos['generadas'] is None
