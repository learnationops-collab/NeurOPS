"""Comisiones de Fulfillment: % por persona según programa (AL/RR/SI) y fuente del ingreso
(renovación, upsell, conversión de seña, cuota), desde septiembre de 2026, sobre el neto."""
from datetime import datetime

import pytest

from app.api.public.finance import comision_de_miembro, get_commissions_calculated
from app.models import FinancialSale
from app.models.financial import TeamMember
from app.services.fulfillment_commission_service import clave_de_miembro, comisiones_del_mes


def venta(db, tipo, monto, fecha=datetime(2026, 9, 10), metodo='zelle', instagram=None, mail=None,
          estado='Completada'):
    v = FinancialSale(tipo_pago=tipo, monto=monto, metodo_pago=metodo, date=fecha, instagram=instagram,
                      mail_cliente=mail, estado=estado)
    db.session.add(v)
    db.session.commit()
    return v


def del_mes(db, mes='2026-09'):
    return [s for s in FinancialSale.query.all() if s.date.strftime('%Y-%m') == mes]


def test_cada_fuente_paga_su_porcentaje_por_programa(db):
    venta(db, 'SI - Renovación', 1000.0)
    venta(db, 'SI - Upsell', 1000.0)
    venta(db, 'SI - Cuota', 1000.0)

    comisiones = comisiones_del_mes('2026-09', del_mes(db))

    assert comisiones['andy'] == 150.0   # 5% + 5% + 5%
    assert comisiones['dari'] == 50.0    # 2% + 2% + 1%
    assert comisiones['santi'] == 30.0   # 1% de cada una
    assert comisiones['belu'] == 60.0    # 2% de cada una
    assert comisiones['pedro'] == 10.0   # solo el upsell (1%)


def test_belu_no_cobra_renovaciones_ni_cuotas_de_ace(db):
    venta(db, 'AL - Renovacion', 1000.0)
    venta(db, 'AL - Cuota', 1000.0)

    assert comisiones_del_mes('2026-09', del_mes(db))['belu'] == 0.0


def test_un_pago_con_sena_previa_es_conversion(db):
    venta(db, 'SI - Seña', 100.0, fecha=datetime(2026, 8, 20), instagram='@lead')
    venta(db, 'SI - Parcial', 1000.0, instagram='lead')

    comisiones = comisiones_del_mes('2026-09', del_mes(db))

    assert comisiones['andy'] == 30.0    # 3% de la conversión en Specialist
    assert comisiones['pedro'] == 10.0


def test_un_pago_sin_sena_previa_es_venta_del_closer(db):
    venta(db, 'RR - Completo', 1000.0, mail='nuevo@test.local')
    venta(db, 'RR - Seña', 100.0, fecha=datetime(2026, 9, 20), mail='nuevo@test.local')  # posterior

    assert set(comisiones_del_mes('2026-09', del_mes(db)).values()) == {0.0}


def test_la_sena_misma_no_paga_comision(db):
    venta(db, 'RR - Seña', 500.0, mail='x@test.local')

    assert set(comisiones_del_mes('2026-09', del_mes(db)).values()) == {0.0}


def test_se_cobra_sobre_el_neto(db):
    venta(db, 'RR - Upsell', 1000.0, metodo='stripe')

    assert comisiones_del_mes('2026-09', del_mes(db))['santi'] == 9.55


def test_antes_de_septiembre_no_hay_comision(db):
    venta(db, 'SI - Upsell', 1000.0, fecha=datetime(2026, 8, 10))

    assert set(comisiones_del_mes('2026-08', del_mes(db, '2026-08')).values()) == {0.0}


@pytest.mark.parametrize('nombre,clave', [
    ('Andres ', 'andy'), ('Darian', 'dari'), ('Santiago', 'santi'), ('Belu', 'belu'), ('Pedro', 'pedro'),
    ('Kerwin', None), ('Elias', None),
])
def test_cada_integrante_se_reconoce_por_su_nombre(nombre, clave):
    assert clave_de_miembro(nombre) == clave


def test_la_nomina_suma_la_comision_encima_del_sueldo_fijo(db):
    venta(db, 'RR - Cuota', 1000.0)
    venta(db, 'RR - Cuota', 1000.0, estado='Cancelada')

    comisiones = get_commissions_calculated('2026-09')
    belu = TeamMember(name='Belu', role='Fullfilment', salary_type='fijo', base_salary=300.0)

    assert comision_de_miembro(belu, comisiones) == 20.0   # 2% de la cuota completada
