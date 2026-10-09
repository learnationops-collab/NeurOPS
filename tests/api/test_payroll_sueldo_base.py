"""El sueldo base en Payroll (08/10/2026): cada persona trae el suyo del rango y `totales` la suma,
para los KPIs de Sueldo base, Comisiones y Total.

El sueldo de un mes es el de la fila guardada de la nómina de ese mes o, sin ella, el del integrante
de Finanzas. Un mes entero del rango cuenta el sueldo completo; uno a medias, prorrateado por días.
"""
from datetime import date, datetime

import pytest

from app.models import FinancialSale
from app.models.financial import MonthlyPayroll, TeamMember
from app.services.nomina_service import clave_de_nomina, meses_del_rango


@pytest.fixture()
def equipo(db):
    andres = TeamMember(name='Andres ', role='Fullfilment', salary_type='fijo', base_salary=600.0, is_active=True)
    pedro = TeamMember(name='Pedro', role='Fullfilment', salary_type='fijo', base_salary=150.0, is_active=True)
    belu = TeamMember(name='Belu', role='Fullfilment', salary_type='fijo', base_salary=300.0, is_active=False)
    kerwin = TeamMember(name='Kerwin', role='Operaciones', salary_type='fijo', base_salary=275.0, is_active=True)
    db.session.add_all([andres, pedro, belu, kerwin])
    db.session.commit()
    # Septiembre de Pedro quedó guardado con otro sueldo: vale ese.
    db.session.add(MonthlyPayroll(member_id=pedro.id, month='2026-09', base_salary=200.0, commissions=0.0, bonuses=0.0))
    db.session.add(FinancialSale(monto=1000.0, metodo_pago='zelle', tipo_pago='SI - Upsell', estado='Completada',
                                 date=datetime(2026, 9, 20)))
    db.session.commit()


def _payroll(client, cabeceras, desde, hasta):
    return client.get(f'/api/public/financial-sales/payroll?start_date={desde}&end_date={hasta}',
                      headers=cabeceras).get_json()


@pytest.fixture()
def finanzas(make_user, auth_headers):
    return auth_headers(make_user(role='admin', can_view_finance=True))


def test_un_mes_entero_cuenta_el_sueldo_completo(client, finanzas, equipo):
    datos = _payroll(client, finanzas, '2026-09-01', '2026-09-30')

    assert (datos['andy']['sueldo_base'], datos['pedro']['sueldo_base']) == (600.0, 200.0)
    # Belu está inactiva y no tiene la nómina de septiembre guardada: no cobra. Kerwin no está en Payroll.
    assert datos['belu']['sueldo_base'] == 0.0
    assert datos['elias']['sueldo_base'] == 0.0
    assert datos['totales']['sueldo_base'] == 800.0
    # Las comisiones de todos: el upsell de Specialist le paga 5% a Andy, 2% a Dari y Belu, 1% a Santi y Pedro.
    assert datos['totales']['comisiones'] == 110.0


def test_un_mes_a_medias_se_prorratea_por_dias(client, finanzas, equipo):
    datos = _payroll(client, finanzas, '2026-09-16', '2026-10-15')

    assert datos['andy']['sueldo_base'] == 590.32    # 600 × 15/30 + 600 × 15/31
    assert datos['pedro']['sueldo_base'] == 172.58   # 200 × 15/30 (su fila de septiembre) + 150 × 15/31


def test_sin_fechas_no_hay_sueldo_que_prorratear(client, finanzas, equipo):
    datos = client.get('/api/public/financial-sales/payroll', headers=finanzas).get_json()

    assert datos['andy']['sueldo_base'] == 0.0
    assert datos['totales']['sueldo_base'] == 0.0


def test_meses_del_rango():
    assert meses_del_rango(date(2026, 9, 1), date(2026, 9, 30)) == [('2026-09', 1.0)]
    assert meses_del_rango(date(2026, 9, 16), date(2026, 11, 1)) == [
        ('2026-09', 0.5), ('2026-10', 1.0), ('2026-11', 1 / 30)]
    assert meses_del_rango(date(2026, 12, 31), date(2027, 1, 1)) == [('2026-12', 1 / 31), ('2027-01', 1 / 31)]


@pytest.mark.parametrize('nombre,clave', [
    ('Andres ', 'andy'), ('Darian', 'dari'), ('Santiago', 'santi'), ('Jean Carlos', 'jeancarlo'),
    ('Marlon', 'marlon'), ('Nerina', 'nerina'), ('Gabriel', 'gabriel'), ('Kerwin', None),
])
def test_cada_integrante_es_su_persona_de_payroll(nombre, clave):
    assert clave_de_nomina(nombre) == clave
