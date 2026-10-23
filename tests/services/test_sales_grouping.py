"""Agrupado de los pagos históricos en ventas (`sales_grouping`) y el script que lo guarda."""
from datetime import date, datetime

from app.models import Client, FinancialSale, InstallmentPlan, Sale
from app.services.sales_grouping import (
    NOTA_CUOTA_DE_COMPLETO,
    NOTA_CUOTA_SIN_VENTA,
    NOTA_CUOTA_TARDE,
    NOTA_SIN_CLIENTE,
    Pago,
    agrupar,
)
from scripts import backfill_sales as script


def pago(id, tipo, dia, programa='AL', claves=('mail:ana@x.com',)):
    return Pago(id=id, claves=claves, programa=programa, tipo=tipo, dia=dia)


def ids(ventas):
    return sorted([p.id for p in v.pagos] for v in ventas)


def test_sena_saldo_y_cuotas_son_una_venta():
    ventas = agrupar([pago(1, 'seña', date(2026, 7, 1)), pago(2, 'parcial', date(2026, 7, 3)),
                      pago(3, 'cuota', date(2026, 8, 3)), pago(4, 'cuota', date(2026, 9, 3))])
    assert ids(ventas) == [[1, 2, 3, 4]]
    assert ventas[0].kind == 'new' and not ventas[0].notas


def test_renovacion_y_upsell_son_ventas_nuevas_con_sus_cuotas():
    ventas = agrupar([pago(1, 'completo', date(2026, 1, 5)), pago(2, 'renovacion', date(2026, 5, 5)),
                      pago(3, 'cuota', date(2026, 6, 5)), pago(4, 'upsell', date(2026, 7, 1))])
    assert ids(ventas) == [[1], [2, 3], [4]]
    assert [v.kind for v in ventas] == ['new', 'renewal', 'upsell']


def test_dos_pagos_de_venta_nueva_a_pocos_dias_son_la_misma_venta():
    ventas = agrupar([pago(1, 'parcial', date(2026, 9, 29)), pago(2, 'completo', date(2026, 10, 2))])
    assert ids(ventas) == [[1, 2]]




def test_programas_distintos_son_ventas_distintas():
    ventas = agrupar([pago(1, 'completo', date(2026, 1, 5), 'AL'), pago(2, 'completo', date(2026, 1, 6), 'RR')])
    assert ids(ventas) == [[1], [2]]


def test_el_mismo_cliente_por_mail_o_por_instagram():
    ventas = agrupar([pago(1, 'parcial', date(2026, 3, 1), claves=('id:7', 'mail:ana@x.com')),
                      pago(2, 'cuota', date(2026, 4, 1), claves=('ig:ana',)),
                      pago(3, 'cuota', date(2026, 5, 1), claves=('mail:ana@x.com', 'ig:ana'))])
    assert ids(ventas) == [[1, 2, 3]]


def test_lo_dudoso_se_agrupa_igual_y_queda_anotado():
    ventas = agrupar([pago(1, 'cuota', date(2026, 2, 1)), pago(2, 'cuota', date(2026, 3, 1))])
    assert ids(ventas) == [[1, 2]]
    assert ventas[0].review_note == NOTA_CUOTA_SIN_VENTA

    tarde = agrupar([pago(1, 'seña', date(2026, 2, 1)), pago(2, 'cuota', date(2026, 4, 1))])
    assert ids(tarde) == [[1, 2]] and tarde[0].review_note == NOTA_CUOTA_TARDE

    completo = agrupar([pago(1, 'completo', date(2026, 2, 1)), pago(2, 'cuota', date(2026, 3, 1))])
    assert completo[0].review_note == NOTA_CUOTA_DE_COMPLETO

    sueltos = agrupar([pago(1, 'completo', date(2026, 2, 1), claves=()),
                       pago(2, 'completo', date(2026, 2, 1), claves=())])
    assert ids(sueltos) == [[1], [2]] and sueltos[0].review_note == NOTA_SIN_CLIENTE


def _como_historicos(db):
    """Los pagos de antes de las ventas: sin venta. Ahora nacen con una (`sale_service`), así que se
    les saca con un UPDATE directo, que no pasa por el `before_flush`."""
    FinancialSale.query.update({FinancialSale.sale_id: None})
    Sale.query.delete()
    db.session.commit()


def _cobro(db, client, tipo, fecha, estado='Completada'):
    v = FinancialSale(client_id=client.id, mail_cliente=client.email, nombre_cliente=client.full_name,
                      tipo_pago=tipo, monto=500.0, date=fecha, estado=estado,
                      email_vendedor='closer@thelearnation.com')
    db.session.add(v)
    db.session.commit()
    return v


def test_el_script_en_prueba_no_escribe(db):
    client = Client(full_name='Ana', email='ana@x.com')
    db.session.add(client)
    db.session.commit()
    _cobro(db, client, 'AL - Parcial', datetime(2026, 3, 1))
    _como_historicos(db)

    numeros = script.ejecutar(apply=False)
    assert numeros['ventas'] == 1
    assert Sale.query.count() == 0
    assert FinancialSale.query.first().sale_id is None


def test_el_script_crea_las_ventas_cuelga_el_plan_y_no_duplica(db):
    client = Client(full_name='Ana', email='ana@x.com')
    db.session.add(client)
    db.session.commit()
    parcial = _cobro(db, client, 'AL - Parcial', datetime(2026, 3, 1))
    cuota = _cobro(db, client, 'AL - Cuota', datetime(2026, 4, 1))
    pendiente = _cobro(db, client, 'AL - Cuota', datetime(2026, 5, 1), estado='Pendiente')
    renovacion = _cobro(db, client, 'AL - Renovación', datetime(2026, 8, 1))
    plan = InstallmentPlan(appointment_id=0, client_id=client.id, programa_code='AL', numero_cuota=2,
                           monto=500.0, fecha_vencimiento=date(2026, 5, 1), created_at=datetime(2026, 3, 1, 12))
    db.session.add(plan)
    db.session.commit()
    _como_historicos(db)
    InstallmentPlan.query.update({InstallmentPlan.sale_id: None})
    db.session.commit()

    numeros = script.ejecutar(apply=True)
    assert numeros['ventas'] == 2 and numeros['pagos_fuera'] == 1 and numeros['planes_colgados'] == 1

    alta, renov = Sale.query.order_by(Sale.sold_at).all()
    assert (alta.kind, alta.client_id, alta.program_code, alta.source) == ('new', client.id, 'AL', 'backfill')
    assert renov.kind == 'renewal'
    assert db.session.get(FinancialSale, parcial.id).sale_id == alta.id
    assert db.session.get(FinancialSale, cuota.id).sale_id == alta.id
    assert db.session.get(FinancialSale, renovacion.id).sale_id == renov.id
    assert db.session.get(FinancialSale, pendiente.id).sale_id is None
    assert db.session.get(InstallmentPlan, plan.id).sale_id == alta.id

    assert script.ejecutar(apply=True)['ventas'] == 0
    assert Sale.query.count() == 2
