"""La lista de deuda por cobrar del dashboard del closer tiene que decir DE QUIÉN es cada saldo.

`_pending_collections` devolvía el nombre del cliente y nada más. Era la única lista del sistema
que dice a quién hay que cobrarle sin dar forma de llegar a su cobro: para abrir su ficha había
que cruzar por nombre, que es exactamente lo que el resto del código evita (hay homónimos, y el
nombre se edita).

Se fija con tests el `client_id` y, de paso, el resto del contrato de la fila: la atribución al
dueño de la agenda y la descomposición en vencido / por vencer / sin plan, que es lo que el
dashboard muestra al lado.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import Appointment, Client, Enrollment, InstallmentPlan, Payment, Program
from app.services.closer_dashboard_service import CloserDashboardService


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='closer_cobra', email='cobra@neuro.com')


@pytest.fixture()
def otro_closer(make_user):
    return make_user(role='closer', username='closer_ajeno', email='ajeno@neuro.com')


@pytest.fixture()
def programa(db):
    p = Program(name='Residency Roadmap', price=1000.0)
    db.session.add(p)
    db.session.commit()
    return p


def _cliente_con_deuda(db, programa, closer, nombre, pagado, total=1000.0):
    """Un cliente que debe plata, con la agenda que lo atribuye a `closer`."""
    cliente = Client(full_name=nombre, email=f'{nombre.lower().replace(" ", ".")}@x.com',
                     total_amount=total)
    db.session.add(cliente)
    db.session.commit()

    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=closer.id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()

    if pagado:
        db.session.add(Payment(enrollment_id=inscripcion.id, amount=pagado, status='completed',
                               date=datetime(2026, 8, 1)))
    agenda = Appointment(closer_id=closer.id, client_id=cliente.id,
                         start_time=datetime(2026, 8, 1, 15, 0))
    db.session.add(agenda)
    db.session.commit()
    return cliente, agenda


def test_cada_fila_de_deuda_trae_el_client_id(db, programa, closer):
    cliente, _agenda = _cliente_con_deuda(db, programa, closer, 'Ana Gomez', pagado=400.0)

    filas, _ = CloserDashboardService._pending_collections(closer.id)

    assert len(filas) == 1
    assert filas[0]['client_id'] == cliente.id
    assert filas[0]['client_name'] == 'Ana Gomez'
    assert filas[0]['pending_amount'] == 600.0


def test_el_client_id_esta_en_todas_las_filas_y_no_se_repite(db, programa, closer):
    uno, _a1 = _cliente_con_deuda(db, programa, closer, 'Ana Gomez', pagado=400.0)
    dos, _a2 = _cliente_con_deuda(db, programa, closer, 'Beto Diaz', pagado=100.0)

    filas, totales = CloserDashboardService._pending_collections(closer.id)

    ids = [f['client_id'] for f in filas]
    assert sorted(ids) == sorted([uno.id, dos.id])
    assert all(isinstance(i, int) for i in ids)
    assert totales['count'] == 2


def test_la_fila_ajena_no_aparece_ni_filtra_su_id(db, programa, closer, otro_closer):
    """La atribución es al dueño de la agenda: la deuda del otro closer no entra."""
    mio, _a1 = _cliente_con_deuda(db, programa, closer, 'Ana Gomez', pagado=400.0)
    _cliente_con_deuda(db, programa, otro_closer, 'Carla Ruiz', pagado=0.0)

    filas, _ = CloserDashboardService._pending_collections(closer.id)

    assert [f['client_id'] for f in filas] == [mio.id]


def test_una_cuota_vencida_no_pierde_el_client_id(db, programa, closer):
    """El camino con cronograma armado es otro `if` dentro del bucle: se fija igual."""
    cliente, agenda = _cliente_con_deuda(db, programa, closer, 'Ana Gomez', pagado=400.0)
    ayer = date.today() - timedelta(days=3)
    db.session.add(InstallmentPlan(appointment_id=agenda.id, client_id=cliente.id, numero_cuota=2,
                                   monto=600.0, fecha_vencimiento=ayer, estado='pendiente'))
    db.session.commit()

    filas, totales = CloserDashboardService._pending_collections(closer.id)

    assert filas[0]['client_id'] == cliente.id
    assert filas[0]['is_overdue'] is True
    assert filas[0]['sin_plan'] is False
    assert totales['vencido'] == 600.0
