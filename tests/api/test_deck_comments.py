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

def test_el_closer_comenta_y_queda_guardado(client, equipo, auth_headers, cita):
    respuesta = comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='Pidio mas tiempo')

    assert respuesta.status_code == 201
    cuerpo = respuesta.get_json()
    assert (cuerpo['text'], cuerpo['author_id'], cuerpo['type'], cuerpo['associated_id'], cuerpo['parent_id']) == (
        'Pidio mas tiempo', equipo['closer'].id, 'appointment', cita.id, None)
    assert cuerpo['author_name'] == 'carla'
    guardado = Comment.query.one()
    assert (guardado.text, guardado.author_id, guardado.comment_type, guardado.associated_id) == (
        'Pidio mas tiempo', equipo['closer'].id, 'appointment', cita.id)


def test_el_comentario_del_closer_queda_en_la_bitacora_del_lead(client, equipo, auth_headers, cita):
    comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='Pidio mas tiempo')

    registro = LeadEventLog.query.one()
    assert (registro.appointment_id, registro.user_id, registro.action_type) == (cita.id, equipo['closer'].id, 'comment')
    assert 'Closer carla' in registro.description and 'Pidio mas tiempo' in registro.description


def test_el_comentario_del_closer_avisa_al_setter_asignado(client, equipo, auth_headers, cita):
    comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='Pidio mas tiempo')

    aviso = Notification.query.one()
    assert aviso.target_users == [equipo['setter'].id]
    assert 'Ana Gomez' in aviso.subject
    assert 'Pidio mas tiempo' in aviso.content and 'Closer carla' in aviso.content
    assert (aviso.associated_id, aviso.associated_type) == (cita.id, 'deck_comment')


@pytest.mark.parametrize('origen,setter_asignado', [('ManyChat', True), ('vsl', False)])
def test_sin_setter_concreto_el_aviso_va_a_todo_el_rol_setter(client, db, equipo, auth_headers, cita, origen, setter_asignado):
    cita.origin = origen
    cita.setter_id = equipo['setter'].id if setter_asignado else None
    db.session.commit()

    comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='hola')

    assert Notification.query.one().target_users == 'role:setter'


def test_el_closer_puede_responder_a_un_comentario(client, equipo, auth_headers, cita):
    primero = comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='primero').get_json()

    respuesta = comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='segundo', parent_id=primero['id'])

    assert respuesta.status_code == 201
    assert respuesta.get_json()['parent_id'] == primero['id']


@pytest.mark.parametrize('cuerpo', [{}, {'text': ''}, {'text': '   '}])
def test_un_comentario_vacio_es_400_y_no_deja_nada(client, equipo, auth_headers, cita, cuerpo):
    respuesta = comentar(client, 'closer', equipo['closer'], auth_headers, cita, **cuerpo)

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'message': 'El texto del comentario es requerido'}
    assert (Comment.query.count(), Notification.query.count(), LeadEventLog.query.count()) == (0, 0, 0)


def test_comentar_una_cita_inexistente_es_404(client, equipo, auth_headers):
    respuesta = client.post('/api/closer/deck/comments/9999', headers=auth_headers(equipo['closer']), json={'text': 'x'})

    assert respuesta.status_code == 404


# --- POST: el setter comenta ------------------------------------------------------------------

def test_el_setter_comenta_y_avisa_al_closer_asignado(client, equipo, auth_headers, cita):
    respuesta = comentar(client, 'setter', equipo['setter'], auth_headers, cita, text='Ya lo califique')

    assert respuesta.status_code == 201
    assert respuesta.get_json()['author_id'] == equipo['setter'].id
    aviso = Notification.query.one()
    assert aviso.target_users == [equipo['closer'].id]
    assert 'Setter sofia' in aviso.content
    assert 'Setter sofia' in LeadEventLog.query.one().description


def test_el_comentario_del_setter_de_un_lead_de_manychat_avisa_a_todo_el_rol_closer(client, db, equipo, auth_headers, cita):
    cita.origin = 'ManyChat'
    db.session.commit()

    comentar(client, 'setter', equipo['setter'], auth_headers, cita, text='hola')

    assert Notification.query.one().target_users == 'role:closer'


# --- GET --------------------------------------------------------------------------------------

@pytest.mark.parametrize('rol,quien', [('closer', 'closer'), ('setter', 'setter')])
def test_los_comentarios_se_listan_en_orden(client, db, equipo, auth_headers, cita, rol, quien):
    for texto, minuto in (('segundo', 20), ('primero', 10)):
        db.session.add(Comment(author_id=equipo[quien].id, text=texto, comment_type='appointment',
                               associated_id=cita.id, created_at=datetime(2026, 9, 19, 12, minuto)))
    db.session.add(Comment(author_id=equipo[quien].id, text='de otra cita', comment_type='appointment',
                           associated_id=cita.id + 1))
    db.session.add(Comment(author_id=equipo[quien].id, text='de otro tipo', comment_type='client', associated_id=cita.id))
    db.session.commit()

    respuesta = client.get(url(rol, cita), headers=auth_headers(equipo[quien]))

    assert respuesta.status_code == 200
    assert [c['text'] for c in respuesta.get_json()] == ['primero', 'segundo']


def test_lo_que_comenta_un_rol_lo_lee_el_otro(client, equipo, auth_headers, cita):
    comentar(client, 'closer', equipo['closer'], auth_headers, cita, text='del closer')

    respuesta = client.get(url('setter', cita), headers=auth_headers(equipo['setter']))

    assert [c['text'] for c in respuesta.get_json()] == ['del closer']


# --- Permisos ---------------------------------------------------------------------------------

@pytest.mark.parametrize('rol', ['closer', 'setter'])
@pytest.mark.parametrize('metodo', ['get', 'post'])
def test_sin_sesion_es_401(client, cita, rol, metodo):
    assert getattr(client, metodo)(url(rol, cita), json={'text': 'x'}).status_code == 401


@pytest.mark.parametrize('metodo', ['get', 'post'])
def test_el_setter_no_entra_a_los_comentarios_del_closer(client, equipo, auth_headers, cita, metodo):
    respuesta = getattr(client, metodo)(url('closer', cita), headers=auth_headers(equipo['setter']), json={'text': 'x'})

    assert respuesta.status_code == 403
    assert Comment.query.count() == 0


@pytest.mark.parametrize('metodo', ['get', 'post'])
def test_el_closer_no_entra_a_los_comentarios_del_setter(client, equipo, auth_headers, cita, metodo):
    respuesta = getattr(client, metodo)(url('setter', cita), headers=auth_headers(equipo['closer']), json={'text': 'x'})

    assert respuesta.status_code == 403
    assert Comment.query.count() == 0


@pytest.mark.parametrize('rol', ['triage', 'hiring', 'director_marketing'])
def test_otros_roles_no_comentan(client, make_user, auth_headers, cita, rol):
    respuesta = client.post(url('closer', cita), headers=auth_headers(make_user(role=rol)), json={'text': 'x'})

    assert respuesta.status_code == 403


def test_el_admin_puede_comentar_como_closer(client, equipo, auth_headers, cita):
    respuesta = comentar(client, 'closer', equipo['admin'], auth_headers, cita, text='desde admin')

    assert respuesta.status_code == 201
    assert respuesta.get_json()['author_name'] == 'root'
