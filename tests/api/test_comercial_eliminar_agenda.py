"""DELETE /api/comercial/agendas/<id>: borrar una agenda desde el libro de la dirección.

El borrado del mazo (`DELETE /closer/deck/<id>`) pide rol closer y además que la agenda sea del
closer que pregunta, así que a la dirección le respondía 403: desde su propio tablero no había
forma de borrar nada, ni siquiera las agendas de prueba que crea ella misma.

Lo que estos tests fijan es QUIÉN puede borrar. Se limitó a la dirección a propósito: la
alternativa natural era reusar `_puede_corregir`, que también habilita al closer dueño y al
setter que generó la agenda, pero eso le daría al setter un poder de borrado que hoy no tiene en
ninguna pantalla. Corregir un estado y borrar la fila no son la misma responsabilidad.
"""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client, SurveyAnswer, SurveyQuestion


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'admin': make_user(role='admin', username='jefa', email='jefa@neuro.com'),
        'closer': make_user(role='closer', username='cerrador', email='cerrador@neuro.com'),
        'setter': make_user(role='setter', username='setter1', email='setter1@neuro.com'),
        'triage': make_user(role='triage', username='triage1', email='triage1@neuro.com'),
    }


@pytest.fixture()
def agenda(db, equipo):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                       client_id=cliente.id, start_time=datetime.utcnow() + timedelta(days=1),
                       origin='PRUEBA')
    db.session.add(appt)
    db.session.commit()
    return appt


def borrar(client, usuario, auth_headers, agenda):
    return client.delete(f'/api/comercial/agendas/{agenda.id}', headers=auth_headers(usuario))


# --- Quién puede ------------------------------------------------------------------------------

@pytest.mark.parametrize('quien', ['director', 'admin'])
def test_la_direccion_borra_la_agenda(client, db, equipo, auth_headers, agenda, quien):
    assert borrar(client, equipo[quien], auth_headers, agenda).status_code == 200
    assert Appointment.query.get(agenda.id) is None


@pytest.mark.parametrize('quien', ['closer', 'setter', 'triage'])
def test_el_resto_del_equipo_no_borra_desde_aca(client, db, equipo, auth_headers, agenda, quien):
    """El closer borra por su propia ruta; el setter no borra en ninguna."""
    assert borrar(client, equipo[quien], auth_headers, agenda).status_code == 403
    assert Appointment.query.get(agenda.id) is not None


def test_sin_sesion_no_se_borra_nada(client, db, agenda):
    assert client.delete(f'/api/comercial/agendas/{agenda.id}').status_code in (401, 403)
    assert Appointment.query.get(agenda.id) is not None


def test_una_agenda_que_no_existe_da_404(client, db, equipo, auth_headers):
    assert client.delete('/api/comercial/agendas/999999',
                         headers=auth_headers(equipo['director'])).status_code == 404


# --- Qué se lleva puesto ------------------------------------------------------------------------

def test_las_respuestas_de_la_encuesta_se_desvinculan_pero_no_se_borran(client, db, equipo, auth_headers, agenda):
    """Son del cliente y valen aunque la cita desaparezca. Y si no se desvincularan, el borrado
    fallaría por la foreign key."""
    pregunta = SurveyQuestion(text='¿Para qué examen?')
    db.session.add(pregunta)
    db.session.commit()
    respuesta = SurveyAnswer(client_id=agenda.client_id, appointment_id=agenda.id,
                             question_id=pregunta.id, answer='ENARM')
    db.session.add(respuesta)
    db.session.commit()
    respuesta_id = respuesta.id

    assert borrar(client, equipo['director'], auth_headers, agenda).status_code == 200

    sobrevive = SurveyAnswer.query.get(respuesta_id)
    assert sobrevive is not None
    assert sobrevive.appointment_id is None
    assert sobrevive.answer == 'ENARM'


def test_el_cliente_sigue_existiendo(client, db, equipo, auth_headers, agenda):
    """Se borra la cita, no la persona: puede tener historial, ventas y otras agendas."""
    client_id = agenda.client_id
    assert borrar(client, equipo['director'], auth_headers, agenda).status_code == 200
    assert Client.query.get(client_id) is not None
