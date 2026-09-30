"""`POST /closer/deck/referrals/manual` despues de pasar su logica a `referidos_service`.

La creacion de un referido la comparten ahora el mazo y la ficha del lead (que pregunta "¿le
pediste referidos?" al declarar una venta). Estos tests fijan que la ruta del mazo haga lo mismo
que hacia: dueno, origen, contacto y el aviso en el perfil de quien lo refirio.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client, Comment


@pytest.fixture()
def equipo(make_user):
    return {
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
        'triage': make_user(role='triage', username='triaje', email='triaje@neuro.com'),
    }


@pytest.fixture()
def lead(db, equipo):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, client_id=cliente.id,
                       start_time=datetime(2026, 9, 25, 18, 0), closer_result='Show up')
    db.session.add(appt)
    db.session.commit()
    return appt


def crear(client, auth_headers, usuario, **payload):
    return client.post('/api/closer/deck/referrals/manual', json=payload,
                       headers=auth_headers(usuario))


def test_el_referido_manual_entra_como_lead_nuevo_del_closer(client, db, lead, equipo,
                                                            auth_headers):
    r = crear(client, auth_headers, equipo['closer'], from_lead_id=lead.id, lead_name='Dani',
              phone='+59170001111', instagram='@dani', email='dani@x.com', notes='amigo')

    assert r.status_code == 201
    nueva = db.session.get(Appointment, r.get_json()['id'])
    assert nueva.origin == 'Referido de Ana Gomez'
    assert nueva.closer_id == equipo['closer'].id
    assert nueva.closer_processed is False
    assert (nueva.client.instagram, nueva.client.email) == ('dani', 'dani@x.com')
    assert nueva.closer_notes == ('Referido por Ana Gomez. Contacto: +59170001111, @dani, '
                                  'dani@x.com. Notas: amigo')
    aviso = Comment.query.filter_by(comment_type='client', associated_id=lead.client_id).one()
    assert "creó un nuevo referido 'Dani'" in aviso.text


@pytest.mark.parametrize('contacto,instagram,telefono', [
    ('@eva.ig', 'eva.ig', None),
    ('eva ig', 'eva ig', None),
    ('+591 700-01111', None, '+591 700-01111'),
])
def test_el_contacto_libre_se_clasifica_en_instagram_o_telefono(client, db, lead, equipo,
                                                               auth_headers, contacto, instagram,
                                                               telefono):
    r = crear(client, auth_headers, equipo['closer'], from_lead_id=lead.id, lead_name='Eva',
              contact=contacto)

    assert r.status_code == 201
    nueva = db.session.get(Appointment, r.get_json()['id'])
    assert nueva.client.instagram == instagram
    if telefono:
        assert ''.join(c for c in nueva.client.phone if c.isdigit()).endswith('70001111')
    else:
        assert not nueva.client.phone
    assert f'Contacto: {contacto}.' in nueva.closer_notes


def test_un_setter_que_crea_un_referido_se_lo_deja_al_closer_del_lead(client, db, lead, equipo,
                                                                     auth_headers):
    r = crear(client, auth_headers, equipo['setter'], from_lead_id=lead.id, lead_name='Eva',
              contact='eva.ig')

    assert r.status_code == 201
    assert db.session.get(Appointment, r.get_json()['id']).closer_id == equipo['closer'].id


@pytest.mark.parametrize('con_origen,nombre,motivo', [
    (False, 'Dani', 'Selecciona el lead origen del referido'),
    (True, '  ', 'El nombre del referido es obligatorio'),
])
def test_sin_origen_o_sin_nombre_no_se_crea_nada(client, db, lead, equipo, auth_headers,
                                                 con_origen, nombre, motivo):
    payload = {'lead_name': nombre, **({'from_lead_id': lead.id} if con_origen else {})}

    r = crear(client, auth_headers, equipo['closer'], **payload)

    assert r.status_code == 400
    assert r.get_json()['error'] == motivo
    assert Appointment.query.count() == 1


def test_triage_no_crea_referidos(client, db, lead, equipo, auth_headers):
    r = crear(client, auth_headers, equipo['triage'], from_lead_id=lead.id, lead_name='Dani')

    assert r.status_code == 403
    assert Appointment.query.count() == 1
