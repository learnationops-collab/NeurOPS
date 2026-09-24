"""A quién le muestra la cartera la tabla Clientes del dashboard comercial.

La atribución es por quién VENDIÓ, y para un closer el alcance es él mismo. El conjunto de sus
identificadores se comparaba con `pedido or de_quien`: escrito así, un conjunto VACÍO es falsy y
cae en `de_quien`, que son todos los closers. Es decir, un closer sin ninguna venta reconocible
—uno recién entrado, o uno cuyas ventas están cargadas bajo un correo que no resuelve a su
nombre— no veía su cartera vacía: veía la del equipo entero, con nombres y deudas.

Es la misma clase de fuga que se corrigió sacándole Comparativas al closer, así que se fija con
tests en vez de confiar en que la expresión no vuelva.
"""
from datetime import date, datetime

import pytest

from app.models import Appointment, Client, Enrollment, FinancialSale, Payment, Program
from app.services.comercial_service import ComercialService


@pytest.fixture()
def vendedor(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com')


@pytest.fixture()
def recien_entrado(make_user):
    """Closer real, sin una sola venta a su nombre."""
    return make_user(role='closer', username='nuevo', email='nuevo@neuro.com')


@pytest.fixture()
def cliente_del_vendedor(db, vendedor):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', total_amount=1000.0)
    programa = Program(name='RR', price=1000.0)
    db.session.add_all([cliente, programa])
    db.session.commit()
    db.session.add(FinancialSale(mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=400.0,
                                 estado='Completada', date=date(2026, 8, 1),
                                 email_vendedor='vendedor@neuro.com'))
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id,
                             closer_id=vendedor.id, enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=400.0, status='completed',
                           date=datetime(2026, 8, 1)))
    db.session.add(Appointment(closer_id=vendedor.id, client_id=cliente.id,
                               start_time=datetime(2026, 8, 1, 15, 0),
                               closer_result='Show up', closer_processed=True))
    db.session.commit()
    return cliente


def test_el_closer_que_vendio_ve_a_su_cliente(db, vendedor, cliente_del_vendedor):
    filas = ComercialService.clientes(closer_id=vendedor.id)
    assert [f['client_id'] for f in filas] == [cliente_del_vendedor.id]


def test_un_closer_sin_ventas_ve_su_cartera_vacia_y_no_la_del_equipo(db, vendedor, recien_entrado, cliente_del_vendedor):
    """La fuga: sin ventas propias, su conjunto de identificadores queda vacío."""
    assert ComercialService.clientes(closer_id=recien_entrado.id) == []


def test_un_closer_que_no_existe_no_abre_la_cartera_entera(db, vendedor, cliente_del_vendedor):
    assert ComercialService.clientes(closer_id=999999) == []


def test_sin_acotar_se_ve_la_cartera_del_equipo(db, vendedor, cliente_del_vendedor):
    """La dirección y el setter piden sin acotar: ahí sí corresponde ver todo."""
    filas = ComercialService.clientes(closer_id=None)
    assert [f['client_id'] for f in filas] == [cliente_del_vendedor.id]
