"""AdminOperationService: dos botones del panel de Base de Datos (solo admin/operator, ver
test_admin_db_agendas.py y la política de acceso para el resto del panel) — borrar TODOS los datos de
negocio y generar datos falsos de demostración. `clear_business_data` es lo más destructivo del panel:
importa que borre exactamente lo que dice borrar y nada más (ni usuarios, ni las tablas de ventas/
agendas que sincroniza n8n).
"""
from datetime import datetime

import pytest

from app.models import (
    Appointment, Client, Enrollment, FinancialSale, Payment, PaymentMethod, Program, SurveyAnswer,
    SurveyQuestion, User,
)
from app.services.admin_ops_service import AdminOperationService


@pytest.fixture()
def catalogo(db):
    programa_activo = Program(name='AL', price=1000.0, is_active=True)
    programa_inactivo = Program(name='Viejo', price=500.0, is_active=False)
    metodo_activo = PaymentMethod(name='Zelle', is_active=True)
    metodo_inactivo = PaymentMethod(name='Viejo', is_active=False)
    db.session.add_all([programa_activo, programa_inactivo, metodo_activo, metodo_inactivo])
    db.session.commit()
    return {'programa': programa_activo, 'programa_inactivo': programa_inactivo, 'metodo': metodo_activo,
           'metodo_inactivo': metodo_inactivo}


# --- clear_business_data ---------------------------------------------------------------------

@pytest.fixture()
def negocio_completo(db, make_user, catalogo):
    """Una fila de cada tabla que clear_business_data debe vaciar, mas datos que NO debe tocar."""
    closer = make_user(role='closer')
    cliente = Client(full_name='Ana', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()
    cita = Appointment(client_id=cliente.id, closer_id=closer.id, start_time=datetime(2026, 9, 1))
    db.session.add(cita)
    db.session.commit()
    inscripcion = Enrollment(client_id=cliente.id, program_id=catalogo['programa'].id, closer_id=closer.id)
    pregunta = SurveyQuestion(text='¿Meta?')
    db.session.add_all([inscripcion, pregunta])
    db.session.commit()
    db.session.add(SurveyAnswer(client_id=cliente.id, question_id=pregunta.id, answer='x'))
    db.session.add(Payment(enrollment_id=inscripcion.id, payment_method_id=catalogo['metodo'].id, amount=100.0))
    db.session.add(FinancialSale(monto=200.0, setter='x'))  # NO es una de las tablas que se vacian
    db.session.commit()
    return closer


def test_borra_las_5_tablas_de_negocio(db, negocio_completo):
    exito, mensaje = AdminOperationService.clear_business_data()

    assert exito is True
    assert 'correctamente' in mensaje
    for modelo in (Client, Appointment, Enrollment, Payment, SurveyAnswer):
        assert modelo.query.count() == 0


def test_no_toca_usuarios_ni_ventas_financieras(db, negocio_completo):
    AdminOperationService.clear_business_data()

    assert User.query.count() == 1  # el closer del fixture sigue ahi
    assert FinancialSale.query.count() == 1


def test_no_toca_el_catalogo_de_programas_ni_metodos_de_pago(db, negocio_completo, catalogo):
    AdminOperationService.clear_business_data()

    assert Program.query.count() == 2
    assert PaymentMethod.query.count() == 2


def test_sin_ningun_dato_de_negocio_igual_reporta_exito(db):
    exito, _ = AdminOperationService.clear_business_data()

    assert exito is True


def test_un_error_al_borrar_devuelve_false_y_hace_rollback(db, negocio_completo, monkeypatch):
    def falla(*args, **kwargs):
        raise RuntimeError('boom')

    monkeypatch.setattr('app.services.admin_ops_service.db.session.commit', falla)

    exito, mensaje = AdminOperationService.clear_business_data()

    assert exito is False
    assert 'boom' in mensaje
    assert Client.query.count() == 1  # nada se borro de verdad: el commit nunca llego a la base


# --- generate_mock_data: validaciones previas --------------------------------------------------

def test_sin_closers_no_genera_nada(db, catalogo):
    exito, mensaje = AdminOperationService.generate_mock_data()

    assert exito is False
    assert 'closer' in mensaje.lower()
    assert Client.query.count() == 0


def test_sin_programas_activos_no_genera_nada(db, make_user):
    make_user(role='closer')

    exito, mensaje = AdminOperationService.generate_mock_data()

    assert exito is False
    assert 'programa' in mensaje.lower()
    assert Client.query.count() == 0


def test_con_solo_programas_inactivos_tampoco_genera_nada(db, make_user, catalogo):
    make_user(role='closer')
    Program.query.filter_by(is_active=True).delete()
    db.session.commit()

    exito, _ = AdminOperationService.generate_mock_data()

    assert exito is False


def test_sin_metodos_de_pago_activos_no_genera_nada(db, make_user, catalogo):
    make_user(role='closer')
    PaymentMethod.query.filter_by(is_active=True).delete()
    db.session.commit()

    exito, mensaje = AdminOperationService.generate_mock_data()

    assert exito is False
    assert 'pago' in mensaje.lower()


def test_un_admin_o_setter_no_cuentan_como_closer_para_generar_datos(db, make_user, catalogo):
    make_user(role='admin')
    make_user(role='setter')

    exito, _ = AdminOperationService.generate_mock_data()

    assert exito is False


# --- generate_mock_data: el caso feliz ----------------------------------------------------------

@pytest.fixture()
def listo_para_generar(db, make_user, catalogo):
    closer1 = make_user(role='closer', username='closer1')
    closer2 = make_user(role='closer', username='closer2')
    return {'closers': {closer1.id, closer2.id}, **catalogo}


def test_genera_exactamente_la_cantidad_de_leads_agendas_y_ventas_pedida(db, listo_para_generar, monkeypatch):
    # Todas las agendas quedan 'Terminada' (sin depender del azar) para no toparse con el limite de
    # "no hay tantas agendas terminadas como ventas pedidas" que prueba el test de mas abajo.
    monkeypatch.setattr('app.services.admin_ops_service.random.choice',
                        lambda opciones: 'Terminada' if 'Terminada' in opciones else opciones[0])

    exito, mensaje = AdminOperationService.generate_mock_data(client_count=6, appt_count=4, sale_count=2)

    assert exito is True
    assert Client.query.count() == 6
    assert Appointment.query.count() == 4
    assert Enrollment.query.count() == 2
    assert Payment.query.count() == 2
    assert '6 leads, 4 agendas y 2 ventas' in mensaje


def test_cada_agenda_referencia_un_cliente_y_un_closer_creados(db, listo_para_generar):
    AdminOperationService.generate_mock_data(client_count=5, appt_count=8, sale_count=0)

    ids_de_clientes = {c.id for c in Client.query.all()}
    for cita in Appointment.query.all():
        assert cita.client_id in ids_de_clientes
        assert cita.closer_id in listo_para_generar['closers']


def test_el_monto_de_cada_pago_es_la_mitad_del_precio_de_su_programa(db, listo_para_generar):
    AdminOperationService.generate_mock_data(client_count=5, appt_count=5, sale_count=3)

    for pago in Payment.query.all():
        inscripcion = Enrollment.query.get(pago.enrollment_id)
        programa = Program.query.get(inscripcion.program_id)
        assert pago.amount == programa.price / 2
        assert pago.status == 'completed'


def test_las_ventas_prefieren_agendas_terminadas_cuando_las_hay(db, listo_para_generar, monkeypatch):
    # Fuerza a que TODAS las agendas generadas queden con result='Terminada' (sin depender del azar).
    monkeypatch.setattr('app.services.admin_ops_service.random.choice',
                        lambda opciones: 'Terminada' if 'Terminada' in opciones else opciones[0])

    AdminOperationService.generate_mock_data(client_count=3, appt_count=3, sale_count=2)

    citas_con_venta = {e.closer_id for e in Enrollment.query.all()}
    terminadas = {a.closer_id for a in Appointment.query.filter_by(result='Terminada').all()}
    assert citas_con_venta <= terminadas


def test_sin_ninguna_agenda_terminada_las_ventas_usan_cualquier_agenda(db, listo_para_generar, monkeypatch):
    # Ninguna cita queda 'Terminada': generate_mock_data debe caer a usar cualquiera igual, sin fallar.
    monkeypatch.setattr('app.services.admin_ops_service.random.choice',
                        lambda opciones: 'No Show' if 'Terminada' in opciones else opciones[0])

    exito, _ = AdminOperationService.generate_mock_data(client_count=3, appt_count=3, sale_count=2)

    assert exito is True
    assert Appointment.query.filter_by(result='Terminada').count() == 0
    assert Enrollment.query.count() == 2


def test_pedir_mas_ventas_que_agendas_disponibles_se_limita_a_las_que_hay(db, listo_para_generar, monkeypatch):
    monkeypatch.setattr('app.services.admin_ops_service.random.choice',
                        lambda opciones: 'Terminada' if 'Terminada' in opciones else opciones[0])

    exito, mensaje = AdminOperationService.generate_mock_data(client_count=3, appt_count=2, sale_count=10)

    assert exito is True
    assert Enrollment.query.count() == 2  # nunca mas ventas que agendas generadas
    assert Payment.query.count() == 2
    assert '2 ventas' in mensaje  # el mensaje informa lo que de verdad se genero, no lo pedido (10)


def test_pedir_cero_de_todo_no_genera_nada_pero_reporta_exito(db, listo_para_generar):
    exito, mensaje = AdminOperationService.generate_mock_data(client_count=0, appt_count=0, sale_count=0)

    assert exito is True
    assert (Client.query.count(), Appointment.query.count(), Enrollment.query.count()) == (0, 0, 0)


def test_un_error_al_generar_devuelve_false_y_hace_rollback(db, listo_para_generar, monkeypatch):
    monkeypatch.setattr('app.services.admin_ops_service.db.session.commit',
                        lambda: (_ for _ in ()).throw(RuntimeError('boom')))

    exito, mensaje = AdminOperationService.generate_mock_data(client_count=3, appt_count=2, sale_count=1)

    assert exito is False
    assert 'boom' in mensaje
    assert Client.query.count() == 0  # nada quedo a medias
