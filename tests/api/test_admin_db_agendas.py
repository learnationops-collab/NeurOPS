"""/api/admin/db/agendas: listar, editar y borrar agendas desde la pantalla Base de Datos.

La ruta POST estaba registrada dos veces: `create_admin_appointment` era codigo muerto (nadie la
llamaba y Flask siempre despachaba a la otra) y el POST sin `id` contestaba 200 "Agenda
actualizada" sin hacer nada. La pantalla siempre manda el `id` de la fila que edita.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client

URL = '/api/admin/db/agendas'


@pytest.fixture()
def admin(make_user):
    return make_user(role='admin')


@pytest.fixture()
def cita(db, make_user):
    closer = make_user(role='closer', username='carla')
    cliente = Client(full_name='Ana Gomez', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=datetime(2026, 9, 19, 14, 0),
                       origin='workshop')
    db.session.add(appt)
    db.session.commit()
    return appt


# --- Editar (POST con id) ---------------------------------------------------------------------

def test_editar_una_agenda_por_id(client, db, admin, auth_headers, cita):
    respuesta = client.post(URL, headers=auth_headers(admin), json={
        'id': cita.id, 'status': 'Show Up', 'origin': 'vsl', 'start_time': '2026-09-20T15:30:00.000Z',
    })

    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'message': 'Agenda actualizada'}
    db.session.refresh(cita)
    assert (cita.result, cita.origin, cita.start_time) == ('Show Up', 'vsl', datetime(2026, 9, 20, 15, 30))


def test_editar_solo_cambia_los_campos_enviados(client, db, admin, auth_headers, cita):
    client.post(URL, headers=auth_headers(admin), json={'id': cita.id, 'status': 'No Show'})

    db.session.refresh(cita)
    assert cita.result == 'No Show'
    assert cita.origin == 'workshop'
    assert cita.start_time == datetime(2026, 9, 19, 14, 0)


def test_un_post_sin_id_ya_no_finge_haber_actualizado(client, db, admin, auth_headers, cita):
    # Antes contestaba 200 "Agenda actualizada" sin tocar nada (y sin crear la agenda pedida).
    respuesta = client.post(URL, headers=auth_headers(admin), json={
        'lead_id': 1, 'start_time': '2026-09-20T15:30:00', 'status': 'Show Up',
    })

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'error': 'Falta el id de la agenda'}
    assert Appointment.query.count() == 1
    db.session.refresh(cita)
    assert cita.result is None


def test_un_post_vacio_tambien_es_400(client, admin, auth_headers):
    assert client.post(URL, headers=auth_headers(admin), json={}).status_code == 400


def test_editar_una_agenda_inexistente_es_404(client, admin, auth_headers):
    # Antes admin_required convertia el abort(404) de get_or_404 en un 500 con el traceback en el JSON.
    respuesta = client.post(URL, headers=auth_headers(admin), json={'id': 9999, 'status': 'Show Up'})

    assert respuesta.status_code == 404
    assert 'Traceback' not in respuesta.get_data(as_text=True)


# --- Listar y borrar --------------------------------------------------------------------------

def test_listar_las_agendas(client, admin, auth_headers, cita):
    respuesta = client.get(URL, headers=auth_headers(admin))

    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo['total'] == 1
    fila = cuerpo['data'][0]
    assert (fila['id'], fila['lead'], fila['closer'], fila['origin']) == (cita.id, 'Ana Gomez', 'carla', 'workshop')
    assert fila['status'] == 'Agendada'  # sin resultado todavia
    assert fila['start_time'] == '2026-09-19T14:00:00'


def test_borrar_una_agenda(client, admin, auth_headers, cita):
    respuesta = client.delete(f'{URL}?id={cita.id}', headers=auth_headers(admin))

    assert respuesta.status_code == 200
    assert Appointment.query.count() == 0


# --- Permisos ---------------------------------------------------------------------------------

@pytest.mark.parametrize('metodo', ['get', 'post', 'delete'])
def test_sin_sesion_es_401(client, cita, metodo):
    assert getattr(client, metodo)(URL, json={'id': cita.id}).status_code == 401


@pytest.mark.parametrize('rol', ['closer', 'setter', 'triage', 'hiring', 'director_marketing'])
def test_un_rol_que_no_es_admin_ni_operator_es_403(client, make_user, auth_headers, cita, rol):
    usuario = make_user(role=rol)

    assert client.post(URL, headers=auth_headers(usuario), json={'id': cita.id, 'status': 'x'}).status_code == 403
    assert Appointment.query.one().result is None


@pytest.mark.parametrize('rol', ['admin', 'operator'])
def test_admin_y_operator_pueden_listar(client, make_user, auth_headers, cita, rol):
    assert client.get(URL, headers=auth_headers(make_user(role=rol))).status_code == 200
