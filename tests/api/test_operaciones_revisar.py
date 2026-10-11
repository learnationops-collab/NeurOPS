"""Operaciones en Revisar (10/10/2026): las tablas viejas de Agendas y Ventas del operador pasaron al
Revisar del dashboard comercial. El operador entra al tablero con el alcance de la direccion (el equipo
completo) y a la ficha con sus permisos; operar —edicion masiva, duplicados, acciones sobre las
ventas— es de admin y operador, no de la direccion ni de los closers."""
from datetime import datetime

import pytest

from app.models import Appointment, Client

CONTEXTO = '/api/comercial/contexto'
TABLA = '/api/comercial/tabla'


@pytest.fixture()
def agenda_de_otro(db, make_user):
    closer = make_user(role='closer', username='Nerina')
    cli = Client(full_name='Ana Gomez', email='ana@test.local')
    db.session.add(cli)
    db.session.commit()
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=datetime(2026, 9, 10, 15, 0),
                    result='Confirmado', closer_result='Pendiente', origin='Setter',
                    created_at=datetime(2026, 9, 9, 15, 0))
    db.session.add(a)
    db.session.commit()
    return a


@pytest.mark.parametrize('rol,opera', [
    ('operator', True), ('admin', True), ('director_comercial', False), ('closer', False), ('setter', False),
])
def test_el_contexto_dice_quien_opera(client, make_user, auth_headers, rol, opera):
    datos = client.get(CONTEXTO, headers=auth_headers(make_user(role=rol))).get_json()

    assert datos['puede_operar'] is opera


def test_el_operador_ve_el_equipo_completo_como_la_direccion(client, make_user, auth_headers, agenda_de_otro):
    cabeceras = auth_headers(make_user(role='operator'))

    contexto = client.get(CONTEXTO, headers=cabeceras).get_json()
    tabla = client.get(TABLA, headers=cabeceras, query_string={
        'tabla': 'agendas', 'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30'})

    assert contexto['puede_elegir_equipo'] is True
    assert contexto['puede_reportar'] is False
    assert tabla.status_code == 200
    assert [f['id'] for f in tabla.get_json()['filas']] == [agenda_de_otro.id]


def test_el_operador_abre_la_ficha_con_los_permisos_de_la_direccion(client, make_user, auth_headers,
                                                                     agenda_de_otro):
    r = client.get(f'/api/ficha/lead?appointment_id={agenda_de_otro.id}',
                   headers=auth_headers(make_user(role='operator')))

    assert r.status_code == 200
    permisos = r.get_json()['permisos']
    assert all(permisos[p] for p in ('confirmar', 'reportar', 'cobrar', 'eliminar', 'editar_datos', 'reasignar'))


def test_un_rol_ajeno_sigue_sin_entrar_al_tablero(client, make_user, auth_headers):
    assert client.get(CONTEXTO, headers=auth_headers(make_user(role='hiring'))).status_code == 403
