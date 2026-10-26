"""Comentarios en hilo del mazo de leads: GET y POST de /api/closer/deck/comments/<id> y /api/setter/....

Cada comentario tambien queda en la bitacora del lead (LeadEventLog) y avisa a la otra parte con una
Notification: al closer si comenta el setter y al setter si comenta el closer (a todo el rol cuando el
lead viene de ManyChat, sin un setter/closer concreto; al usuario asignado en el resto).

El POST del closer usaba Comment y Notification sin importarlos: el NameError daba un 500 en cada
llamada y ningun closer podia comentar en el mazo. El del setter los importaba dentro de la funcion.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client, Comment, LeadEventLog, Notification


@pytest.fixture()
def equipo(make_user):
    return {
        'closer': make_user(role='closer', username='carla'),
        'setter': make_user(role='setter', username='sofia'),
        'admin': make_user(role='admin', username='root'),
    }


@pytest.fixture()
def cita(db, equipo):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id, client_id=cliente.id,
                       start_time=datetime(2026, 9, 19, 14, 0), origin='vsl')
    db.session.add(appt)
    db.session.commit()
    return appt


def url(rol, appt):
    return f'/api/{rol}/deck/comments/{appt.id}'


def comentar(client, rol, usuario, auth_headers, appt, **cuerpo):
    return client.post(url(rol, appt), headers=auth_headers(usuario), json=cuerpo)


# --- POST: el closer comenta ------------------------------------------------------------------


def test_el_comentario_del_closer_queda_en_la_bitacora_del_lead(client, equipo, auth_headers, cita):
    comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='Pidio mas tiempo')

    registro = LeadEventLog.query.one()
    assert (registro.appointment_id, registro.user_id, registro.action_type) == (cita.id, equipo['closer'].id, 'comment')
    assert 'Closer carla' in registro.description and 'Pidio mas tiempo' in registro.description


def test_el_closer_puede_responder_a_un_comentario(client, equipo, auth_headers, cita):
    primero = comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='primero').get_json()

    respuesta = comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='segundo', parent_id=primero['id'])

    assert respuesta.status_code == 201
    assert respuesta.get_json()['parent_id'] == primero['id']


def test_comentar_una_cita_inexistente_es_404(client, equipo, auth_headers):
    respuesta = client.post('/api/closer/deck/comments/9999', headers=auth_headers(equipo['closer']), json={'text': 'x'})

    assert respuesta.status_code == 404


# --- POST: el setter comenta ------------------------------------------------------------------


# --- GET --------------------------------------------------------------------------------------


def test_lo_que_comenta_un_rol_lo_lee_el_otro(client, equipo, auth_headers, cita):
    comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='del closer')

    respuesta = client.get(url('setter', cita), headers=auth_headers(equipo['setter']))

    assert [c['text'] for c in respuesta.get_json()] == ['del closer']


# --- Permisos ---------------------------------------------------------------------------------

@pytest.mark.parametrize('rol', ['closer', 'setter'])
@pytest.mark.parametrize('metodo', ['get', 'post'])
def test_sin_sesion_es_401(client, cita, rol, metodo):
    assert getattr(client, metodo)(url(rol, cita), json={'text': 'x'}).status_code == 401


@pytest.mark.parametrize('rol', ['triage', 'hiring', 'director_marketing'])
def test_otros_roles_no_comentan(client, make_user, auth_headers, cita, rol):
    respuesta = client.post(url('closer', cita), headers=auth_headers(make_user(role=rol)), json={'text': 'x'})

    assert respuesta.status_code == 403


def test_el_admin_puede_comentar_como_closer(client, equipo, auth_headers, cita):
    respuesta = comentar(client, 'closer', equipo['admin'], auth_headers, cita, text='desde admin')

    assert respuesta.status_code == 201
    assert respuesta.get_json()['author_name'] == 'root'
