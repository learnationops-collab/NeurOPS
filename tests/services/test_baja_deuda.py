"""La deuda de un cliente dado de baja es 0 en todo cálculo; lo que pagó sigue contando.

La deuda sale de `_client_debt` (cliente por cliente) y de `CarteraEnLote.deuda` (la tabla Clientes
y la cola de cobro), y la cuota que se cobra de `_proxima_cuota`. Si una sola de las tres se olvida
de la baja, el cliente aparece "debiendo" en una pantalla y "al día" en otra.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import Appointment, Client, Enrollment, FinancialSale, InstallmentPlan, Payment, Program
from app.services import baja_service
from app.services.closer_followup_service import CarteraEnLote, CloserFollowUpService


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com')


@pytest.fixture()
def debe(db, closer):
    """Compró 1000, pagó 400 y tiene una cuota vencida de 300 en el cronograma."""
    c = Client(full_name='Ana Gomez', email='ana@x.com', total_amount=1000.0)
    programa = Program(name='RR', price=1000.0)
    db.session.add_all([c, programa])
    db.session.commit()
    db.session.add(FinancialSale(mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=400.0,
                                 estado='Completada', date=datetime(2026, 8, 1),
                                 email_vendedor='vendedor@neuro.com'))
    inscripcion = Enrollment(client_id=c.id, program_id=programa.id, closer_id=closer.id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=c.id, start_time=datetime(2026, 8, 1, 15, 0),
                       closer_result='Show up', closer_processed=True)
    db.session.add_all([Payment(enrollment_id=inscripcion.id, amount=400.0, status='completed',
                                date=datetime(2026, 8, 1)), appt])
    db.session.commit()
    db.session.add(InstallmentPlan(appointment_id=appt.id, client_id=c.id, programa_code='RR',
                                   numero_cuota=1, monto=300.0,
                                   fecha_vencimiento=date.today() - timedelta(days=5)))
    db.session.commit()
    return c


def _baja(db, cliente, closer):
    baja_service.dar_de_baja(cliente, 'No puede pagar', closer)
    db.session.commit()


def test_antes_de_la_baja_debe(db, debe):
    """El punto de partida: sin esto, el resto de los tests pasarían en vacío."""
    assert CloserFollowUpService._client_debt(debe.id) == 600.0
    assert CloserFollowUpService._proxima_cuota(debe.id, 600.0)['vencida'] is True


def test_de_baja_no_debe_nada(db, debe, closer):
    _baja(db, debe, closer)
    assert CloserFollowUpService._client_debt(debe.id) == 0.0


def test_la_lectura_en_lote_dice_lo_mismo(db, debe, closer):
    _baja(db, debe, closer)
    lote = CarteraEnLote([debe.id])
    assert lote.deuda(debe.id) == 0.0
    assert CloserFollowUpService._client_debt(debe.id, lote) == 0.0


def test_ninguna_cuota_es_la_proxima_aunque_siga_en_el_cronograma(db, debe, closer):
    _baja(db, debe, closer)

    assert CloserFollowUpService._proxima_cuota(debe.id, 600.0) is None
    assert CloserFollowUpService._proxima_cuota(debe.id, 600.0, CarteraEnLote([debe.id])) is None
    # El cronograma no se tocó: si la baja se revierte vuelve igual.
    assert InstallmentPlan.query.filter_by(client_id=debe.id, estado='pendiente').count() == 1


def test_lo_cobrado_sigue_contando(db, debe, closer):
    """Lo que ya pagó es plata recaudada: la venta y su espejo en la deuda quedan como estaban."""
    _baja(db, debe, closer)

    ventas = CloserFollowUpService._resolve_sales_and_clients()
    appt = Appointment.query.filter_by(client_id=debe.id).first()
    item = CloserFollowUpService._build_cartera_item(debe.id, debe, appt, ventas)

    assert sum(p['monto'] for p in item['pagos']) == 400.0
    assert FinancialSale.query.count() == 1
    assert Payment.query.filter_by(status='completed').count() == 1
    assert item['deuda'] == 0.0
    assert item['proxima_cuota'] is None
    assert item['baja']['motivo'] == 'No puede pagar'
    assert item['etapa_cobro']['clave'] == 'baja'


def test_la_busqueda_del_closer_lo_abre_como_baja(db, debe, closer):
    _baja(db, debe, closer)

    etapa = CloserFollowUpService.get_client_lead_stage(debe.id)

    assert etapa['stage'] == 'cerrada'
    assert etapa['deuda'] == 0.0
    assert etapa['proxima_cuota'] is None
    assert etapa['etapa_cobro']['clave'] == 'baja'
    assert etapa['baja']['por'] == 'vendedor'


def test_revertir_devuelve_la_deuda_y_la_cuota_exactas(db, debe, closer):
    _baja(db, debe, closer)
    baja_service.revertir(debe)
    db.session.commit()

    assert CloserFollowUpService._client_debt(debe.id) == 600.0
    cuota = CloserFollowUpService._proxima_cuota(debe.id, 600.0)
    assert cuota['monto'] == 300.0 and cuota['vencida'] is True
