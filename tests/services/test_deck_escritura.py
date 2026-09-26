"""El write del mazo, probado sin pasar por la ruta del closer.

`tests/api/test_ficha_deck_contrato.py` fija el contrato de `POST /api/closer/deck/<id>`. Acá se
prueba el servicio directamente, que es lo que van a llamar las rutas de `/api/ficha` con un
usuario que NO es closer: si la regla de `closer_processed` o los logs condicionales dependieran
del rol o de algo del request, se vería acá.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client, Comment, LeadEventLog
from app.services.deck_escritura_service import CLAVES_SOLO_CONFIRMACION, aplicar_cambios


@pytest.fixture()
def cita(db, make_user):
    closer = make_user(role='closer')
    cliente = Client(full_name='Ana Gomez', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id,
                       start_time=datetime(2026, 9, 25, 18, 0),
                       result='conversando', closer_result='Pendiente', closer_processed=False)
    db.session.add(appt)
    db.session.commit()
    return appt


@pytest.fixture()
def director(make_user):
    return make_user(role='director_comercial', username='direccion', email='dir@neuro.com')


def acciones(appt_id):
    return [e.action_type for e in LeadEventLog.query.filter_by(appointment_id=appt_id).all()]


def test_la_direccion_comercial_reporta_una_llamada_con_el_mismo_efecto(db, cita, director):
    """Es el punto del ejercicio: el rol no cambia lo que se escribe, solo quién puede pedirlo."""
    aplicar_cambios(cita, {'result': 'Asistió', 'with_decision_maker': True}, director)
    db.session.commit()

    assert cita.closer_result == 'Show up'
    assert cita.closer_processed is True
    assert cita.with_decision_maker is True
    assert acciones(cita.id) == ['closer_notes', 'show_up_reported']


def test_la_nota_se_espeja_en_el_hilo_del_cliente(db, cita, director):
    aplicar_cambios(cita, {'closer_notes': '  pidio hablar con la esposa  '}, director)
    db.session.commit()

    comentarios = Comment.query.filter_by(comment_type='client', associated_id=cita.client_id).all()
    assert [c.text for c in comentarios] == ['pidio hablar con la esposa']
    assert comentarios[0].author_id == director.id


def test_volver_a_pendiente_desprocesa_tambien_desde_la_ficha(db, cita, director):
    cita.closer_processed = True
    db.session.commit()

    aplicar_cambios(cita, {'result': 'Pendiente', 'seguimiento_realizado': False}, director)
    db.session.commit()

    assert cita.closer_processed is False


def test_el_subconjunto_de_confirmacion_es_el_que_documenta_la_regla(db, cita, director):
    cita.closer_processed = True
    db.session.commit()

    # `closer_notes` viaja siempre como texto (el textarea manda '' cuando está vacío).
    payload = {clave: None for clave in CLAVES_SOLO_CONFIRMACION}
    payload['closer_notes'] = ''

    aplicar_cambios(cita, payload, director)
    db.session.commit()

    assert cita.closer_processed is True


def test_las_claves_desconocidas_se_ignoran(db, cita, director):
    """Es lo que permite que el mismo payload sirva al wizard, al árbol y a los seguimientos."""
    aplicar_cambios(cita, {'inventada': 'x', 'result': 'No Show'}, director)
    db.session.commit()

    assert cita.closer_result == 'No Show'


def test_un_payload_vacio_marca_la_cita_como_procesada_y_deja_su_log(db, cita, director):
    """Rama por defecto: sin `result` ni `confirm_status`, el guardado resuelve la carta."""
    aplicar_cambios(cita, {}, director)
    db.session.commit()

    assert cita.closer_processed is True
    assert acciones(cita.id) == ['closer_notes']
