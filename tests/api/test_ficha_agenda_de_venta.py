"""`POST /ficha/cliente/<id>/agenda-de-venta`: la agenda en la que declarar una venta.

«Declarar venta» del dock del closer era una pagina aparte (`/closer/sales/new`) que registraba la
venta de cualquier cliente, tuviera agenda o no. Ahora lleva al mazo: el closer elige al cliente en
el buscador y la ficha se abre en «Registrar una venta». La ficha cuelga de una agenda, y la de un
cliente sin ninguna es de solo lectura: esta ruta da la agenda donde vender, y la crea si no hay.
"""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client
from app.services.closer_service import CloserService


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'otro': make_user(role='closer', username='otro', email='otro@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
        'triage': make_user(role='triage', username='triaje', email='triaje@neuro.com'),
    }


@pytest.fixture()
def cliente(db):
    c = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g')
    db.session.add(c)
    db.session.commit()
    return c


def pedir(client, auth_headers, usuario, client_id):
    return client.post(f'/api/ficha/cliente/{client_id}/agenda-de-venta',
                       headers=auth_headers(usuario))


def test_con_agendas_da_la_mas_reciente_sin_crear_nada(client, db, cliente, equipo, auth_headers):
    """La misma con la que se abre la ficha por cliente."""
    vieja, nueva = (Appointment(closer_id=equipo['closer'].id, client_id=cliente.id,
                                start_time=datetime.utcnow() - timedelta(days=dias))
                    for dias in (30, 2))
    db.session.add_all([vieja, nueva])
    db.session.commit()

    r = pedir(client, auth_headers, equipo['closer'], cliente.id)

    assert r.status_code == 200
    assert r.get_json() == {'appointment_id': nueva.id, 'creada': False}
    assert Appointment.query.filter_by(client_id=cliente.id).count() == 2


def test_sin_agendas_crea_una_a_nombre_del_closer_que_vende(client, db, cliente, equipo,
                                                            auth_headers):
    r = pedir(client, auth_headers, equipo['closer'], cliente.id)

    assert r.status_code == 201
    datos = r.get_json()
    assert datos['creada'] is True
    agenda = db.session.get(Appointment, datos['appointment_id'])
    assert agenda.client_id == cliente.id
    assert agenda.closer_id == equipo['closer'].id
    assert agenda.origin == 'Venta sin agenda'
    # Procesada: no aparece en el mazo como una llamada sin reportar. En 'Pendiente': si el closer
    # cierra la ficha sin vender, no queda contada una asistencia que no hubo.
    assert agenda.closer_processed is True and agenda.seguimiento_realizado is True
    assert agenda.closer_result == 'Pendiente'
    assert agenda.closer_notes.startswith('[Sistema]')


def test_pedirla_de_nuevo_no_crea_otra(client, db, cliente, equipo, auth_headers):
    primera = pedir(client, auth_headers, equipo['closer'], cliente.id).get_json()

    r = pedir(client, auth_headers, equipo['closer'], cliente.id)

    assert r.status_code == 200
    assert r.get_json() == {'appointment_id': primera['appointment_id'], 'creada': False}


def test_la_venta_marca_como_asistida_la_agenda_creada(client, db, cliente, equipo, auth_headers):
    """La venta directa no le pasa agenda a `post_to_sheets`: la elige por fecha y es esta."""
    agenda_id = pedir(client, auth_headers, equipo['closer'], cliente.id).get_json()['appointment_id']

    marcada = CloserService.mark_sale_appointment_as_show_up(cliente.id,
                                                             registered_at=datetime.utcnow())
    db.session.commit()

    assert marcada['appointment_id'] == agenda_id
    assert db.session.get(Appointment, agenda_id).closer_result == 'Show up'


def test_la_direccion_la_deja_en_el_closer_placeholder(client, db, cliente, equipo, auth_headers):
    """La direccion vende PARA un closer, que elige en la venta: la agenda no es suya."""
    r = pedir(client, auth_headers, equipo['director'], cliente.id)

    assert r.status_code == 201
    agenda = db.session.get(Appointment, r.get_json()['appointment_id'])
    assert agenda.closer_id == equipo['otro'].id


def test_un_cliente_que_no_existe_da_404(client, db, equipo, auth_headers):
    assert pedir(client, auth_headers, equipo['closer'], 999999).status_code == 404


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_setter_y_triage_no_venden(client, db, cliente, equipo, auth_headers, rol):
    r = pedir(client, auth_headers, equipo[rol], cliente.id)

    assert r.status_code == 403
    assert Appointment.query.filter_by(client_id=cliente.id).count() == 0


# --- Un comprador que no esta en el sistema -----------------------------------------------------

def nuevo(client, auth_headers, usuario, **datos):
    return client.post('/api/ficha/cliente-nuevo/agenda-de-venta', json=datos,
                       headers=auth_headers(usuario))


def test_crea_al_cliente_y_su_agenda_de_venta(client, db, equipo, auth_headers):
    r = nuevo(client, auth_headers, equipo['closer'], nombre='Bruno Díaz', email=' Bruno@Mail.com ',
              instagram='@bruno.diaz', telefono='+54 9 11 5555 1234')

    assert r.status_code == 201
    datos = r.get_json()
    assert datos['nuevo'] is True
    creado = db.session.get(Client, datos['client_id'])
    assert (creado.full_name, creado.email, creado.instagram) == ('Bruno Díaz', 'bruno@mail.com', 'bruno.diaz')
    agenda = db.session.get(Appointment, datos['appointment_id'])
    assert (agenda.client_id, agenda.closer_id, agenda.origin) == (creado.id, equipo['closer'].id,
                                                                  'Venta sin agenda')


def test_la_venta_despues_encuentra_al_mismo_cliente(client, db, equipo, auth_headers):
    """La venta resuelve al comprador con `create_or_update_client`: tiene que caer en este."""
    from app.services.booking_service import BookingService

    datos = nuevo(client, auth_headers, equipo['closer'], nombre='Bruno Díaz',
                  email='bruno@mail.com', instagram='bruno.diaz').get_json()

    de_la_venta = BookingService.create_or_update_client(
        {'name': 'Bruno Díaz', 'email': 'bruno@mail.com', 'instagram': 'bruno.diaz', 'phone': '5491155551234'})
    assert de_la_venta.id == datos['client_id']
    assert Client.query.count() == 1


@pytest.mark.parametrize('contacto', [{'email': 'ana@x.com'}, {'email': 'otra@x.com', 'instagram': '@ana.g'}])
def test_si_ya_existe_se_abre_el_suyo_sin_renombrarlo(client, db, cliente, equipo, auth_headers,
                                                      contacto):
    """El buscador no lo encontro porque se lo busco distinto: es el mismo cliente."""
    r = nuevo(client, auth_headers, equipo['closer'], nombre='Anita', **contacto)

    assert r.status_code == 200
    datos = r.get_json()
    assert (datos['nuevo'], datos['client_id'], datos['nombre']) == (False, cliente.id, 'Ana Gomez')
    assert db.session.get(Client, cliente.id).full_name == 'Ana Gomez'
    assert Client.query.count() == 1


@pytest.mark.parametrize('datos,campo', [
    ({'email': 'bruno@mail.com'}, 'nombre'),
    ({'nombre': 'Bruno'}, 'email'),
    ({'nombre': 'Bruno', 'email': 'bruno.mail.com'}, 'email'),
])
def test_sin_nombre_o_sin_email_valido_no_crea_nada(client, db, equipo, auth_headers, datos, campo):
    r = nuevo(client, auth_headers, equipo['closer'], **datos)

    assert r.status_code == 400
    assert r.get_json()['campo'] == campo
    assert (Client.query.count(), Appointment.query.count()) == (0, 0)


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_setter_y_triage_no_registran_compradores(client, db, equipo, auth_headers, rol):
    r = nuevo(client, auth_headers, equipo[rol], nombre='Bruno', email='bruno@mail.com')

    assert r.status_code == 403
    assert Client.query.count() == 0
