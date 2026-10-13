"""El aviso de cada pago a la Academia: hasta cuándo le da acceso y qué se le manda.

Regla (2026-10-13): seña, 7 días desde el pago; con una cuota pendiente que vence después del pago,
esa fecha + 5 días de gracia; sin cuotas pendientes, 4 meses. La Academia solo extiende: acá se fija
la fecha y el aviso, no qué hace la Academia con él. Nunca se llama a la Academia real.
"""
from datetime import date, datetime, timedelta
from unittest.mock import patch

from app.models import Client, FinancialSale, InstallmentPlan
from app.services import academy_payment_sync as sync

PAGO = date(2026, 10, 13)


def _cliente(db, email='alumna@example.com'):
    cliente = Client(full_name='Alumna', email=email)
    db.session.add(cliente)
    db.session.commit()
    return cliente


def _cuota(db, cliente, dias, estado='pendiente', programa='RR'):
    db.session.add(InstallmentPlan(appointment_id=1, client_id=cliente.id, programa_code=programa, numero_cuota=1,
                                   monto=250.0, fecha_vencimiento=PAGO + timedelta(days=dias), estado=estado))
    db.session.commit()


def test_la_sena_da_siete_dias(db):
    cliente = _cliente(db)
    _cuota(db, cliente, 30)
    assert sync.compute_payment_expiration(cliente.id, 'RR', 'seña', PAGO) == PAGO + timedelta(days=7)


def test_con_cuota_pendiente_vence_en_la_proxima_mas_la_gracia(db):
    cliente = _cliente(db)
    _cuota(db, cliente, 60)
    _cuota(db, cliente, 30)
    assert sync.compute_payment_expiration(cliente.id, 'RR', 'parcial', PAGO) == PAGO + timedelta(days=30 + sync.GRACE_DAYS)


def test_la_cuota_vencida_que_se_esta_pagando_no_cuenta(db):
    """La cuota que se paga suele seguir «pendiente» hasta que el closer la marca: no achica el acceso."""
    cliente = _cliente(db)
    _cuota(db, cliente, -2)
    _cuota(db, cliente, 28)
    assert sync.compute_payment_expiration(cliente.id, 'RR', 'cuota', PAGO) == PAGO + timedelta(days=28 + sync.GRACE_DAYS)


def test_sin_cuotas_pendientes_son_cuatro_meses(db):
    cliente = _cliente(db)
    _cuota(db, cliente, 30, estado='pagado')
    _cuota(db, cliente, 30, programa='AL')
    assert sync.compute_payment_expiration(cliente.id, 'RR', 'completo', PAGO) == date(2027, 2, 13)


def test_el_aviso_de_la_hoja_toma_tipo_y_correo_de_raw_data(db):
    cliente = _cliente(db)
    _cuota(db, cliente, 30)
    venta = FinancialSale(setter='x', monto=250.0, nombre_cliente='Alumna', date=datetime(2026, 10, 13),
                          raw_data={'tipo_pago': 'RR - Cuota', 'mail_cliente': 'Alumna@Example.com'})
    db.session.add(venta)
    db.session.commit()

    with patch.object(sync.AcademyAccessService, 'get_product_mapping', return_value={'RR': 'residency-roadmap'}):
        aviso = sync.build_payment_payload(venta)

    assert aviso['email'] == 'alumna@example.com'
    assert aviso['work_client_id'] == cliente.id
    assert aviso['product_slug'] == 'residency-roadmap'
    assert aviso['is_deposit_payment'] is False
    assert aviso['expires_at'] == (PAGO + timedelta(days=30 + sync.GRACE_DAYS)).isoformat()


def test_una_venta_no_completada_no_se_avisa(db):
    venta = FinancialSale(setter='x', monto=100.0, mail_cliente='a@example.com', tipo_pago='RR - Seña', estado='Reembolsada')
    db.session.add(venta)
    db.session.commit()
    assert sync.build_payment_payload(venta) is None
