"""Cada pago con su venta en vivo (`sale_service`): nuevos, corregidos, movidos a mano y borrados."""
from datetime import datetime

import pytest

from app.models import Client, FinancialSale, InstallmentPlan, Sale
from app.services.sale_service import venta_elegida


@pytest.fixture()
def ana(db):
    client = Client(full_name='Ana', email='ana@x.com')
    db.session.add(client)
    db.session.commit()
    return client


def cobro(db, client, tipo, fecha, **extra):
    v = FinancialSale(client_id=client.id, mail_cliente=client.email, nombre_cliente=client.full_name,
                      tipo_pago=tipo, monto=500.0, date=fecha, estado=extra.pop('estado', 'Completada'),
                      email_vendedor='closer@thelearnation.com', **extra)
    db.session.add(v)
    db.session.commit()
    return v


def test_un_pago_nuevo_abre_su_venta_y_las_cuotas_se_suman(db, ana):
    parcial = cobro(db, ana, 'AL - Parcial', datetime(2026, 3, 1))
    cuota = cobro(db, ana, 'AL - Cuota', datetime(2026, 4, 1))

    venta = Sale.query.one()
    assert (venta.kind, venta.program_code, venta.client_id, venta.source) == ('new', 'AL', ana.id, 'auto')
    assert venta.closer_email == 'closer@thelearnation.com'
    assert parcial.sale_id == cuota.sale_id == venta.id


def test_renovacion_y_upsell_abren_ventas_nuevas(db, ana):
    cobro(db, ana, 'AL - Completo', datetime(2026, 1, 5))
    renovacion = cobro(db, ana, 'AL - Renovación', datetime(2026, 5, 5))
    cuota = cobro(db, ana, 'AL - Cuota', datetime(2026, 6, 5))
    upsell = cobro(db, ana, 'AL - Upsell', datetime(2026, 7, 1))

    assert [v.kind for v in Sale.query.order_by(Sale.sold_at).all()] == ['new', 'renewal', 'upsell']
    assert cuota.sale_id == renovacion.sale_id != upsell.sale_id


def test_un_pago_viejo_va_a_la_venta_de_su_epoca(db, ana):
    alta = cobro(db, ana, 'AL - Parcial', datetime(2026, 1, 5))
    cobro(db, ana, 'AL - Renovación', datetime(2026, 6, 5))
    cuota_vieja = cobro(db, ana, 'AL - Cuota', datetime(2026, 2, 5))
    assert cuota_vieja.sale_id == alta.sale_id


def test_la_cuota_sin_venta_queda_para_revisar(db, ana):
    cuota = cobro(db, ana, 'AL - Cuota', datetime(2026, 2, 5))
    assert 'cuota sin una venta anterior' in cuota.sale.review_note


def test_un_pago_no_completado_no_tiene_venta_hasta_completarse(db, ana):
    pendiente = cobro(db, ana, 'AL - Parcial', datetime(2026, 2, 5), estado='Pendiente')
    assert pendiente.sale_id is None
    pendiente.estado = 'Completada'
    db.session.commit()
    assert pendiente.sale_id is not None




def test_la_venta_elegida_a_mano_se_respeta(db, ana):
    alta = cobro(db, ana, 'AL - Parcial', datetime(2026, 1, 5))
    renovacion = cobro(db, ana, 'AL - Renovación', datetime(2026, 6, 5))
    a_mano = cobro(db, ana, 'AL - Cuota', datetime(2026, 7, 5), sale_id=alta.sale_id)
    assert a_mano.sale_id == alta.sale_id

    vacia = renovacion.sale_id
    renovacion.sale_id = alta.sale_id  # moverla a mano: la venta de la que sale queda vacía
    db.session.commit()
    assert db.session.get(Sale, vacia) is None
    assert Sale.query.count() == 1


def test_borrar_el_unico_pago_borra_la_venta_salvo_que_tenga_plan(db, ana):
    solo = cobro(db, ana, 'RR - Completo', datetime(2026, 1, 5))
    db.session.delete(solo)
    db.session.commit()
    assert Sale.query.count() == 0

    con_plan = cobro(db, ana, 'RR - Parcial', datetime(2026, 2, 5))
    db.session.add(InstallmentPlan(appointment_id=0, client_id=ana.id, programa_code='RR', numero_cuota=2,
                                   monto=500.0, fecha_vencimiento=datetime(2026, 3, 5).date(),
                                   sale_id=con_plan.sale_id))
    db.session.commit()
    db.session.delete(con_plan)
    db.session.commit()
    assert Sale.query.count() == 1


def test_venta_elegida_valida_cliente_y_programa(db, ana):
    otra = Client(full_name='Beto', email='beto@x.com')
    db.session.add(otra)
    db.session.commit()
    venta = cobro(db, ana, 'AL - Parcial', datetime(2026, 1, 5)).sale_id

    assert venta_elegida('', ana.id, 'AL') is None
    assert venta_elegida(str(venta), ana.id, 'AL') == venta
    with pytest.raises(ValueError, match='no es de este cliente'):
        venta_elegida(venta, otra.id, 'AL')
    with pytest.raises(ValueError, match='otro programa|es de AL'):
        venta_elegida(venta, ana.id, 'RR')
