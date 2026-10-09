"""El período de Finanzas (08/10/2026): un mes como siempre o un rango personalizado de fechas.

- La nómina de un mes está en un solo lugar (`nomina_del_mes`): la pestaña Nómina, el «por pagar»
  de cada pasarela y los sueldos del resumen salen de la misma cuenta.
- Lo fechado (ventas, software) va por las fechas exactas; los libros mensuales (nómina, saldos,
  anuncios) cuentan entero el mes cubierto y prorrateado por días el que el rango corta; los ahorros
  solo por mes entero.
"""
from datetime import date, datetime

import pytest

from app.api.public.finance import meses_del_rango, nomina_del_mes, periodo_pedido, total_de_item
from app.models import AdPeriodSpend, Expense, FinancialSale, MarketingBudget
from app.models.financial import MonthlyPaymentMethodBalance, MonthlyPayroll, MonthlySaving, TeamMember


@pytest.fixture()
def equipo(db):
    """Un fijo sin nada guardado, uno con la fila del mes guardada, un inactivo con nómina guardada
    y uno inactivo sin nada (que no cuenta)."""
    fijo = TeamMember(name='Kerwin', role='Operaciones', salary_type='fijo', base_salary=1000.0,
                      payment_method='AirTM', is_active=True)
    guardado = TeamMember(name='Santi', role='Fulfillment', salary_type='fijo', base_salary=500.0,
                          payment_method='Mercury', is_active=True)
    ex_con_nomina = TeamMember(name='Ex', role='Operaciones', salary_type='fijo', base_salary=80.0,
                               payment_method='Mercury', is_active=False)
    ex_sin_nomina = TeamMember(name='Otro ex', role='Operaciones', salary_type='fijo', base_salary=999.0,
                               payment_method='Mercury', is_active=False)
    db.session.add_all([fijo, guardado, ex_con_nomina, ex_sin_nomina])
    db.session.commit()
    db.session.add_all([
        MonthlyPayroll(member_id=guardado.id, month='2026-09', base_salary=450.0, commissions=0.0,
                       bonuses=25.0, payment_method='Mercury', is_paid=True),
        MonthlyPayroll(member_id=ex_con_nomina.id, month='2026-09', base_salary=80.0, commissions=0.0,
                       bonuses=0.0, payment_method='Stripe'),
    ])
    db.session.commit()
    return {'fijo': fijo, 'guardado': guardado, 'ex': ex_con_nomina}


def test_la_pestana_nomina_es_la_nomina_del_mes(client, make_user, auth_headers, equipo):
    admin = make_user(role='admin', can_view_finance=True)

    r = client.get('/api/public/finance/payroll?month=2026-09', headers=auth_headers(admin))

    assert r.status_code == 200
    # El GET siembra a los integrantes variables que falten: después de él, la cuenta es la misma.
    assert r.get_json() == nomina_del_mes('2026-09')
    por_nombre = {item['member_name']: item for item in r.get_json()}
    assert 'Otro ex' not in por_nombre
    assert por_nombre['Kerwin']['id'] is None and por_nombre['Kerwin']['base_salary'] == 1000.0
    assert (por_nombre['Santi']['base_salary'], por_nombre['Santi']['bonuses'], por_nombre['Santi']['is_paid']) \
        == (450.0, 25.0, True)


def test_el_resumen_y_los_saldos_suman_la_misma_nomina(client, make_user, auth_headers, equipo):
    cabeceras = auth_headers(make_user(role='admin', can_view_finance=True))

    resumen = client.get('/api/public/finance/summary?month=2026-09', headers=cabeceras).get_json()
    saldos = client.get('/api/public/finance/balances?month=2026-09', headers=cabeceras).get_json()

    total = sum(total_de_item(item) for item in nomina_del_mes('2026-09'))
    assert total == 1000.0 + 475.0 + 80.0
    assert resumen['expenses_breakdown']['sueldos'] == total
    # 'Stripe' ya no es una pasarela: la nómina lo muestra (y lo suma) como Mercury.
    assert {b['payment_method']: b['expected_amount'] for b in saldos['balances']} \
        == {'Mercury': 555.0, 'AirTM': 1000.0}


# ------------------------------------------------------------------------------------------------
# El período: un mes o un rango de fechas


def test_cada_mes_del_rango_cuenta_entero_o_por_dias():
    assert meses_del_rango(date(2026, 9, 1), date(2026, 9, 30)) == [('2026-09', 1.0)]
    assert meses_del_rango(date(2026, 9, 16), date(2026, 10, 15)) == [('2026-09', 0.5), ('2026-10', 15 / 31)]
    # Cruza el año, con un mes entero en el medio.
    assert meses_del_rango(date(2026, 12, 31), date(2027, 2, 14)) == [
        ('2026-12', 1 / 31), ('2027-01', 1.0), ('2027-02', 0.5)]


def test_un_rango_del_1_al_ultimo_dia_es_ese_mes():
    assert periodo_pedido({'start_date': '2026-02-01', 'end_date': '2026-02-28'})['mes'] == '2026-02'
    assert periodo_pedido({'month': '2026-02'})['mes'] == '2026-02'
    assert periodo_pedido({'start_date': '2026-02-01', 'end_date': '2026-02-27'})['mes'] is None
    # Al revés se da vuelta, como en el tablero.
    al_reves = periodo_pedido({'start_date': '2026-10-15', 'end_date': '2026-09-16'})
    assert (al_reves['desde'], al_reves['hasta']) == (date(2026, 9, 16), date(2026, 10, 15))
    assert periodo_pedido({'start_date': '2026-10-15'}) is None
    assert periodo_pedido({'month': '2026-13'}) is None


@pytest.fixture()
def libros(db):
    """Septiembre (30 días) y octubre (31) con ventas, software, anuncios, nómina, saldos y ahorros."""
    for dia, monto in ((datetime(2026, 9, 10), 100.0), (datetime(2026, 9, 20, 22, 30), 200.0),
                       (datetime(2026, 10, 5), 300.0), (datetime(2026, 10, 25), 400.0)):
        db.session.add(FinancialSale(monto=monto, metodo_pago='zelle', estado='Completada', date=dia))
    db.session.add_all([
        Expense(description='Zoom', amount=10.0, date=datetime(2026, 9, 14), category='software'),
        Expense(description='Notion', amount=20.0, date=datetime(2026, 9, 16, 9), category='software'),
        Expense(description='Figma', amount=30.0, date=datetime(2026, 10, 15, 23), category='Software'),
        MarketingBudget(date=date(2026, 9, 1), budget=300.0),
        MarketingBudget(date=date(2026, 10, 1), budget=310.0),
        AdPeriodSpend(start_date=date(2026, 9, 1), end_date=date(2026, 9, 10), spend=40.0),
        AdPeriodSpend(start_date=date(2026, 9, 25), end_date=date(2026, 10, 2), spend=60.0),
        TeamMember(name='Kerwin', role='Operaciones', salary_type='fijo', base_salary=3000.0,
                   payment_method='AirTM', is_active=True),
        MonthlyPaymentMethodBalance(month='2026-09', payment_method='Mercury', actual_amount=1000.0),
        MonthlyPaymentMethodBalance(month='2026-10', payment_method='Mercury', actual_amount=620.0),
        MonthlySaving(month='2026-09', savings=50.0),
        MonthlySaving(month='2026-10', savings=70.0),
    ])
    db.session.commit()


@pytest.fixture()
def pedir(client, make_user, auth_headers):
    cabeceras = auth_headers(make_user(role='admin', can_view_finance=True))

    def _pedir(ruta, **params):
        r = client.get('/api/public/finance/' + ruta, headers=cabeceras, query_string=params)
        assert r.status_code == 200, r.get_json()
        return r.get_json()
    return _pedir


def test_el_mes_y_su_rango_dan_el_mismo_resumen(libros, pedir):
    por_mes = pedir('summary', month='2026-09')
    por_rango = pedir('summary', start_date='2026-09-01', end_date='2026-09-30')

    assert por_mes == por_rango
    assert (por_mes['month'], por_mes['desde'], por_mes['hasta']) == ('2026-09', '2026-09-01', '2026-09-30')
    assert por_mes['kpis']['total_income'] == 300.0
    assert por_mes['expenses_breakdown'] == {'software': 30.0, 'anuncios': 300.0, 'sueldos': 3000.0}
    assert por_mes['kpis']['savings'] == 50.0


def test_el_resumen_de_un_rango_que_corta_dos_meses(libros, pedir):
    datos = pedir('summary', start_date='2026-09-16', end_date='2026-10-15')

    assert datos['month'] is None
    # Lo fechado, por las fechas exactas (el 20/09 a las 22:30 y el 15/10 a las 23 entran).
    assert datos['kpis']['total_income'] == 500.0
    assert datos['income_breakdown'] == [{'metodo_pago': 'zelle', 'count': 2, 'total': 500.0}]
    # Los libros mensuales, la mitad de septiembre y 15/31 de octubre.
    sueldos = round(1500 + 3000 * 15 / 31, 2)
    assert datos['expenses_breakdown'] == {'software': 50.0, 'anuncios': 300.0, 'sueldos': sueldos}
    assert datos['kpis']['total_expenses'] == round(50.0 + 300.0 + sueldos, 2)
    # Ningún mes entero: los ahorros no entran.
    assert datos['kpis']['savings'] == 0.0
    assert datos['kpis']['total_actual_balances'] == 800.0


def test_los_ahorros_cuentan_solo_los_meses_enteros(libros, pedir):
    assert pedir('savings', start_date='2026-09-01', end_date='2026-10-15') \
        == {'month': None, 'desde': '2026-09-01', 'hasta': '2026-10-15', 'savings': 50.0}
    assert pedir('savings', start_date='2026-09-01', end_date='2026-10-31')['savings'] == 120.0
    assert pedir('savings', month='2026-10')['savings'] == 70.0
    resumen = pedir('summary', start_date='2026-09-01', end_date='2026-10-15')
    assert resumen['kpis']['balance_neto'] == round(resumen['kpis']['balance'] + 50.0, 2)


def test_el_software_del_rango_va_por_fecha(libros, pedir):
    lista = pedir('software', start_date='2026-09-15', end_date='2026-10-15')

    assert [g['description'] for g in lista] == ['Notion', 'Figma']
    assert [g['description'] for g in pedir('software', month='2026-09')] == ['Zoom', 'Notion']


def test_anuncios_y_saldos_de_un_rango_se_prorratean(libros, pedir):
    anuncios = pedir('ad-budget', start_date='2026-09-16', end_date='2026-10-15')
    # 300 × 15/30 + 310 × 15/31; lo gastado: los períodos de Marketing que tocan el rango.
    assert (anuncios['month'], anuncios['budget'], anuncios['spent']) == (None, 300.0, 60.0)
    assert pedir('ad-budget', month='2026-09') == {
        'month': '2026-09', 'desde': '2026-09-01', 'hasta': '2026-09-30', 'budget': 300.0, 'spent': 100.0}

    saldos = pedir('balances', start_date='2026-09-16', end_date='2026-10-15')
    filas = {b['payment_method']: b for b in saldos['balances']}
    assert (filas['Mercury']['actual_amount'], filas['Mercury']['id'], filas['Mercury']['month']) == (800.0, None, None)
    assert filas['AirTM']['expected_amount'] == round(1500 + 3000 * 15 / 31, 2)
    # Un mes solo trae la fila guardada, que es la que se edita.
    assert {b['payment_method']: b['id'] is not None for b in pedir('balances', month='2026-09')['balances']} \
        == {'Mercury': True, 'AirTM': False}


@pytest.mark.parametrize('ruta', ['summary', 'software', 'savings', 'ad-budget', 'balances'])
def test_sin_periodo_o_con_uno_enorme_es_400(client, db, make_user, auth_headers, ruta):
    cabeceras = auth_headers(make_user(role='admin', can_view_finance=True))
    url = '/api/public/finance/' + ruta

    assert client.get(url, headers=cabeceras).status_code == 400
    assert client.get(url + '?start_date=2026-09-01', headers=cabeceras).status_code == 400
    assert client.get(url + '?start_date=2026-09-01&end_date=2026-31-12', headers=cabeceras).status_code == 400
    # Más de 24 meses: cada uno pediría su nómina con las comisiones.
    assert client.get(url + '?start_date=2024-01-01&end_date=2026-01-01', headers=cabeceras).status_code == 400
