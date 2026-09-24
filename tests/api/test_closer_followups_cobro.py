"""GET /api/closer/followups/today: la fila de la cola de cobro y lo que dice el chip.

Bug visto en la pantalla del closer el 24/sep/2026: una misma fila mostraba "Debe $500" y
"Al día" al mismo tiempo. El endpoint mandaba la deuda pero no la próxima cuota, así que el
chip de cuota caía en su caso por defecto ("Al día") mientras el chip de deuda decía lo
contrario. Estos tests fijan que la fila traiga las dos cosas y que no se puedan contradecir.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import (
    Appointment,
    Client,
    Enrollment,
    FinancialSale,
    InstallmentPlan,
    Payment,
    Program,
)

URL = '/api/closer/followups/today'


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='cerrador', email='cerrador@neuro.com')


@pytest.fixture()
def en_cobro(db, closer):
    """Cliente que compró 1000, pagó 500 y tiene un seguimiento de cobro vencido para hoy."""
    cliente = Client(full_name='Fabio Ruiz', email='fabio@x.com', total_amount=1000.0)
    programa = Program(name='AL', price=1000.0)
    db.session.add_all([cliente, programa])
    db.session.commit()

    db.session.add(FinancialSale(mail_cliente='fabio@x.com', tipo_pago='AL - Parcial', monto=500.0,
                                 estado='Completada', date=date(2026, 8, 1)))
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=closer.id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=500.0, status='completed',
                           date=datetime(2026, 8, 1)))
    db.session.add(Appointment(closer_id=closer.id, client_id=cliente.id,
                               start_time=datetime(2026, 8, 1, 15, 0),
                               closer_result='Show up', closer_processed=True,
                               seguimiento_tipo='cerrada', seguimiento_realizado=False,
                               fecha_seguimiento=date.today().isoformat()))
    db.session.commit()
    return cliente


def fila_de_cobro(client, closer, auth_headers):
    respuesta = client.get(f'{URL}?selected_date={date.today().isoformat()}', headers=auth_headers(closer))
    assert respuesta.status_code == 200
    cerradas = respuesta.get_json()['grouped']['cerrada']
    assert len(cerradas) == 1
    return cerradas[0]


def test_la_fila_de_cobro_trae_la_proxima_cuota_y_no_solo_la_deuda(client, db, closer, auth_headers, en_cobro):
    fila = fila_de_cobro(client, closer, auth_headers)
    assert fila['deuda'] == 500.0
    assert fila['proxima_cuota'] is not None


def test_quien_debe_no_puede_figurar_al_dia(client, db, closer, auth_headers, en_cobro):
    """La contradicción exacta del reporte: deuda > 0 y a la vez sin nada que cobrar."""
    fila = fila_de_cobro(client, closer, auth_headers)
    assert not (fila['deuda'] > 0 and fila['proxima_cuota'] is None)
    assert fila['etapa_cobro']['clave'] != 'al_dia'


def test_la_deuda_sin_cronograma_se_reporta_como_sin_plan(client, db, closer, auth_headers, en_cobro):
    fila = fila_de_cobro(client, closer, auth_headers)
    assert fila['proxima_cuota']['sin_plan'] is True
    assert fila['etapa_cobro']['clave'] == 'sin_plan'


def test_con_cronograma_armado_la_fila_apunta_a_la_cuota_mas_proxima(client, db, closer, auth_headers, en_cobro):
    """Dos cuotas pendientes: la que se cobra es la que vence antes, no la primera cargada."""
    appt = Appointment.query.filter_by(client_id=en_cobro.id).first()
    db.session.add_all([
        InstallmentPlan(appointment_id=appt.id, client_id=en_cobro.id, programa_code='AL',
                        numero_cuota=2, monto=250.0, fecha_vencimiento=date.today() + timedelta(days=40)),
        InstallmentPlan(appointment_id=appt.id, client_id=en_cobro.id, programa_code='AL',
                        numero_cuota=1, monto=250.0, fecha_vencimiento=date.today() - timedelta(days=3)),
    ])
    db.session.commit()

    fila = fila_de_cobro(client, closer, auth_headers)
    assert fila['proxima_cuota']['numero_cuota'] == 1
    assert fila['proxima_cuota']['vencida'] is True
    assert fila['etapa_cobro']['clave'] == 'cuota_vencida'


def test_el_cliente_al_dia_no_trae_nada_que_cobrar(client, db, closer, auth_headers, en_cobro):
    inscripcion = Enrollment.query.filter_by(client_id=en_cobro.id).first()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=500.0, status='completed',
                           date=datetime(2026, 9, 1)))
    db.session.commit()

    fila = fila_de_cobro(client, closer, auth_headers)
    assert fila['deuda'] == 0.0
    assert fila['proxima_cuota'] is None
    assert fila['etapa_cobro']['clave'] in ('permanencia', 'renovacion')
