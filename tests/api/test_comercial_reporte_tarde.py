"""La dirección ve el reporte de ayer mandado hoy en el día que reporta, y cuándo llegó.

El closer puede mandar el reporte de ayer. Se guarda con la fecha del día reportado, así que el
paso 1 del reporte de la dirección y la constancia ya lo ponen en ese día; lo que faltaba es que
no se lea como un reporte hecho a tiempo. La hora de envío se muestra en la zona del closer
(`created_at` está en UTC).
"""
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, CloserDailyReport

REPORTE_HOY = '/api/comercial/reporte/hoy'
CONSTANCIA = '/api/comercial/reporte/constancia'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'closer': make_user(role='closer', username='Marlon', email='marlon@thelearnation.com',
                            timezone='America/La_Paz'),
    }


def reporte(db, closer, dia, enviado):
    db.session.add(CloserDailyReport(closer_id=closer.id, date=dia, slots=4, created_at=enviado))
    db.session.commit()


def estado_de(client, auth_headers, equipo, fecha):
    datos = client.get(REPORTE_HOY, headers=auth_headers(equipo['director']),
                       query_string={'fecha': fecha}).get_json()
    return next(p for p in datos['personas'] if p['nombre'] == 'Marlon')['estado']


@freeze_time('2026-09-30 15:00:00')
def test_el_reporte_de_ayer_mandado_hoy_dice_cuando_llego(client, db, equipo, auth_headers):
    # 30/09 09:15 en La Paz.
    reporte(db, equipo['closer'], date(2026, 9, 29), datetime(2026, 9, 30, 13, 15))

    estado = estado_de(client, auth_headers, equipo, '2026-09-29')

    assert estado['key'] == 'reporto'
    assert estado['label'] == 'Reportó el 30/09 · 09:15'


@freeze_time('2026-09-30 15:00:00')
def test_a_tiempo_muestra_la_hora_del_closer_y_no_la_de_utc(client, db, equipo, auth_headers):
    # 29/09 23:00 UTC = 29/09 19:00 en La Paz: mismo día, a tiempo.
    reporte(db, equipo['closer'], date(2026, 9, 29), datetime(2026, 9, 29, 23, 0))

    assert estado_de(client, auth_headers, equipo, '2026-09-29')['label'] == 'Reportó 19:00'


@freeze_time('2026-09-30 15:00:00')
def test_la_constancia_lo_cuenta_en_su_dia_y_avisa_que_llego_tarde(client, db, equipo, auth_headers):
    closer = equipo['closer']
    cliente = Client(full_name='Ana', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()
    for cuando in (datetime(2026, 9, 28, 15, 0), datetime(2026, 9, 29, 15, 0)):
        db.session.add(Appointment(closer_id=closer.id, client_id=cliente.id, start_time=cuando,
                                   result='Confirmado', closer_result='Show up', closer_processed=True))
    db.session.commit()
    reporte(db, closer, date(2026, 9, 28), datetime(2026, 9, 28, 22, 0))  # a tiempo
    reporte(db, closer, date(2026, 9, 29), datetime(2026, 9, 30, 13, 15))  # el de ayer, hoy

    datos = client.get(CONSTANCIA, headers=auth_headers(equipo['director']),
                       query_string={'dias': 7}).get_json()

    fila = next(p for p in datos['personas'] if p['nombre'] == 'Marlon')
    celdas = {c['fecha']: c for c in fila['celdas']}
    assert celdas['2026-09-29']['estado'] == 'completo'
    assert celdas['2026-09-29']['tarde'] is True
    assert celdas['2026-09-29']['label'] == 'cargado y completo · enviado el 30/09'
    assert celdas['2026-09-28']['estado'] == 'completo'
    assert 'tarde' not in celdas['2026-09-28']
    # Cuenta como cargado: llegó tarde, pero llegó.
    assert (fila['reportados'], fila['esperados']) == (2, 2)
