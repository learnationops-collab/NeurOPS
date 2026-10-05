"""«Cancelada» y «No show» son dos cuentas distintas en los KPI del deck (closer y setter).

Antes `/deck/stats/kpis` sumaba las dos en «canceladas» (la tarjeta decía «Cancelaciones / No Show»):
una cancelada avisó y no hubo llamada que perder, un no show faltó a una llamada en pie. Ahora
cada una tiene su conteo y su porcentaje sobre el total de agendas.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client

START = datetime(2026, 9, 20, 15, 0)


@pytest.fixture()
def agendas(db, make_user):
    closer = make_user(role='closer', username='carla')
    cliente = Client(full_name='Ana Gomez', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()

    def cita(**campos):
        db.session.add(Appointment(closer_id=closer.id, client_id=cliente.id, start_time=START, **campos))

    cita(closer_result='No Show')                          # no show reportado por el closer
    cita(result='No Show')                                 # carga vieja: el no show quedó en `result`
    cita(closer_result='Cancelado')                        # cancelada reportada por el closer
    cita(result='Cancelada')                               # cancelada desde Confirmación (legacy)
    cita(result='Cancelado')                               # cancelada desde Confirmación (actual)
    cita(result='Cancelada', closer_result='No Show')      # dice las dos cosas: falló a la llamada
    cita(closer_result='Show up')
    cita(result='Pendiente')
    db.session.commit()
    return closer


@pytest.mark.parametrize('rol', ['closer', 'setter'])
def test_cancelada_y_no_show_se_cuentan_por_separado(client, db, make_user, auth_headers, agendas, rol):
    usuario = agendas if rol == 'closer' else make_user(role='setter', username='sofi')
    rutas = {'closer': '/api/closer/deck/stats/kpis', 'setter': '/api/setter/deck/stats/kpis'}

    datos = client.get(rutas[rol], headers=auth_headers(usuario)).get_json()['kpis_top']

    assert datos['total_agendas'] == 8
    assert datos['no_show'] == 3          # closer_result, result legacy, y la que dice las dos
    assert datos['canceladas'] == 3       # Cancelado/Cancelada en cualquiera de los dos campos
    assert datos['pct_no_show'] == 37.5
    assert datos['pct_canceladas'] == 37.5


def test_las_dos_cuentas_no_comparten_filas(client, db, agendas, auth_headers):
    datos = client.get('/api/closer/deck/stats/kpis', headers=auth_headers(agendas)).get_json()

    assert datos['kpis_top']['no_show'] + datos['kpis_top']['canceladas'] == 6
    assert 'no_show_hoy' in datos['kpis_bottom']
    assert 'cancelaciones_hoy' in datos['kpis_bottom']
