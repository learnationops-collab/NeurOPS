"""El closing rate del tablero viejo (`DashboardService.get_detailed_closer_metrics`) no cuenta señas.

Lo sirven `GET /admin/analysis/closer-performance` y `GET /closer/dashboard`. Contaba como venta
toda inscripción con algún pago cobrado, y una inscripción que solo tenía la seña
(`down_payment`) sumaba en `closing_rate` como un cierre. La regla del usuario (30/09/2026) vale en
todos lados: solo pago completo y split pay.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client, Enrollment, Payment, Program
from app.services.dashboard_service import DashboardService

DIA = datetime(2026, 9, 15, 15, 0)


@pytest.fixture()
def marlon(make_user):
    return make_user(role='closer', username='Marlon', email='marlon@thelearnation.com')


@pytest.fixture()
def programa(db):
    p = Program(name='Residency Roadmap', price=2000.0)
    db.session.add(p)
    db.session.commit()
    return p


def cierre(db, closer, programa, nombre, tipo):
    cli = Client(full_name=nombre, email=f'{nombre}@test.local')
    db.session.add(cli)
    db.session.commit()
    db.session.add(Appointment(closer_id=closer.id, client_id=cli.id, start_time=DIA,
                               result='Confirmado', closer_result='Show up'))
    insc = Enrollment(client_id=cli.id, program_id=programa.id, closer_id=closer.id, enrollment_date=DIA)
    db.session.add(insc)
    db.session.commit()
    db.session.add(Payment(enrollment_id=insc.id, amount=500.0, payment_type=tipo, status='completed',
                           date=DIA))
    db.session.commit()


@pytest.mark.parametrize('tipo', ['full', 'first_payment', 'Pago Completo', 'Primer Pago'])
def test_pago_completo_y_primer_pago_son_ventas(db, marlon, programa, tipo):
    cierre(db, marlon, programa, 'compro', tipo)

    datos = DashboardService.get_detailed_closer_metrics(datetime(2026, 9, 1), datetime(2026, 9, 30),
                                                         marlon.id)

    assert datos['sales'] == 1
    assert datos['kpis']['closing_rate'] == 100.0


@pytest.mark.parametrize('tipo', ['down_payment', 'Seña', 'installment', 'Cuota', 'renewal'])
def test_una_sena_o_una_cuota_sola_no_son_una_venta(db, marlon, programa, tipo):
    cierre(db, marlon, programa, 'reservo', tipo)

    datos = DashboardService.get_detailed_closer_metrics(datetime(2026, 9, 1), datetime(2026, 9, 30),
                                                         marlon.id)

    assert datos['sales'] == 0
    assert datos['kpis']['closing_rate'] == 0
