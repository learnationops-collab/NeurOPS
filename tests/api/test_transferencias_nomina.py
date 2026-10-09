"""Lo que alguien del equipo recibió por transferencia de un cliente, en Finanzas, Payroll y la Nómina.

Pedido de Kerwin (09/10/2026): una transferencia que se le hizo a Jean Carlo (o a Pedro) es plata de
la empresa que ya tiene él: «que se refleje en finanzas y payroll para descontárselo». Se le
descuenta de lo que hay que PAGARLE (Payroll: `a_pagar`; Nómina: `transferencias_recibidas` y el
«por pagar» de Medios de pago), no de lo que CUESTA: sueldo, comisión, los sueldos del Resumen y los
KPIs de Payroll no cambian. «Otro» no le descuenta a nadie: solo se ve en Finanzas. El ingreso del
período tampoco cambia: lo que cambia es dónde está la plata.
"""
from datetime import datetime

import pytest

from app.models import FinancialSale
from app.models.financial import TeamMember

MES = '2026-09'
RANGO = 'start_date=2026-09-01&end_date=2026-09-30'


@pytest.fixture()
def finanzas(make_user, auth_headers):
    return auth_headers(make_user(role='admin', can_view_finance=True))


@pytest.fixture()
def septiembre(db):
    """Jean Carlo vende 2000 (10% = 200 de comisión) y entran cuatro transferencias sin marcar."""
    jean = TeamMember(name='Jean Carlos', role='Closer', salary_type='variable', base_salary=0.0,
                      payment_method='Mercury', is_active=True)
    pedro = TeamMember(name='Pedro', role='Fullfilment', salary_type='fijo', base_salary=800.0,
                       payment_method='AirTM', is_active=True)
    db.session.add_all([jean, pedro])

    def venta(monto, metodo, **campos):
        db.session.add(FinancialSale(monto=monto, metodo_pago=metodo, tipo_pago='Bootcamp - Pago completo',
                                     estado='Completada', date=datetime(2026, 9, 9), **campos))

    venta(2000.0, 'zelle', email_vendedor='jeancarlo@thelearnation.com')
    venta(150.0, 'Transferencia Bancaria')
    venta(300.0, 'Transferencia')
    venta(80.0, 'Transferencia')
    venta(50.0, 'Transferencia')
    db.session.commit()
    return {'jean': jean, 'pedro': pedro}


def _marcar(db, *marcas):
    """Marca las transferencias en orden de monto: 150, 300, 80, 50."""
    transferencias = (FinancialSale.query.filter(FinancialSale.metodo_pago.like('Transfer%'))
                      .order_by(FinancialSale.id).all())
    for venta, marca in zip(transferencias, marcas):
        venta.transferido_a = marca
    db.session.commit()


def _payroll(client, cabeceras):
    return client.get(f'/api/public/financial-sales/payroll?{RANGO}', headers=cabeceras).get_json()


def _nomina(client, cabeceras):
    return client.get(f'/api/public/finance/payroll?month={MES}', headers=cabeceras).get_json()


def _de(nomina, miembro):
    return next(f for f in nomina if f['member_id'] == miembro.id)


# --- Payroll --------------------------------------------------------------------------------------

def test_payroll_le_descuenta_a_cada_uno_lo_que_recibio(client, db, finanzas, septiembre):
    _marcar(db, 'jean_carlo', 'pedro', 'otro', None)

    datos = _payroll(client, finanzas)

    jean, pedro = datos['jeancarlo'], datos['pedro']
    assert (jean['comision_total'], jean['transferencias_recibidas'], jean['a_pagar']) == (200.0, 150.0, 50.0)
    assert (pedro['sueldo_base'], pedro['transferencias_recibidas'], pedro['a_pagar']) == (800.0, 300.0, 500.0)
    assert [(t['monto'], t['metodo_pago']) for t in jean['transferencias']] == [(150.0, 'Transferencia Bancaria')]
    # «Otro» y la sin marcar no se le descuentan a nadie.
    otros = [c for c in datos if c not in ('totales', 'jeancarlo', 'pedro')]
    assert all(datos[c]['transferencias_recibidas'] == 0.0 for c in otros)
    assert all(datos[c]['a_pagar'] == round(datos[c]['sueldo_base'] + datos[c]['comision_total'], 2)
               for c in otros)


def test_payroll_no_cambia_lo_que_cuesta_la_nomina(client, db, finanzas, septiembre):
    """Los KPIs (cash, sueldo base, comisiones, total y peso) salen de `totales` y de la comisión y
    el sueldo de cada persona: marcar las transferencias no mueve ninguno."""
    antes = _payroll(client, finanzas)
    _marcar(db, 'jean_carlo', 'pedro', 'otro', None)
    despues = _payroll(client, finanzas)

    assert despues['totales'] == antes['totales']
    for clave in antes:
        if clave != 'totales':
            assert (despues[clave]['comision_total'], despues[clave]['sueldo_base']) == \
                (antes[clave]['comision_total'], antes[clave]['sueldo_base'])


def test_una_venta_sacada_de_la_nomina_se_descuenta_igual(client, db, finanzas, septiembre):
    """Sacarla de la nómina es que no paga comisión; la plata la tiene igual."""
    _marcar(db, 'jean_carlo')
    FinancialSale.query.filter_by(monto=150.0).one().is_excluded_from_payroll = True
    db.session.commit()

    assert _payroll(client, finanzas)['jeancarlo']['transferencias_recibidas'] == 150.0


def test_cuenta_la_fecha_del_pago(client, db, finanzas, septiembre):
    _marcar(db, 'jean_carlo')
    FinancialSale.query.filter_by(monto=150.0).one().date = datetime(2026, 10, 2)
    db.session.commit()

    assert _payroll(client, finanzas)['jeancarlo']['transferencias_recibidas'] == 0.0
    octubre = client.get('/api/public/financial-sales/payroll?start_date=2026-10-01&end_date=2026-10-31',
                         headers=finanzas).get_json()
    assert octubre['jeancarlo']['transferencias_recibidas'] == 150.0


# --- La Nómina de Finanzas ------------------------------------------------------------------------

def test_la_nomina_trae_lo_que_recibio_cada_integrante(client, db, finanzas, septiembre):
    _marcar(db, 'jean_carlo', 'pedro', 'otro', None)

    nomina = _nomina(client, finanzas)

    jean, pedro = _de(nomina, septiembre['jean']), _de(nomina, septiembre['pedro'])
    assert (jean['commissions'], jean['transferencias_recibidas']) == (200.0, 150.0)
    assert (pedro['base_salary'], pedro['transferencias_recibidas']) == (800.0, 300.0)
    assert sum(f['transferencias_recibidas'] for f in nomina) == 450.0   # «otro» no es nadie


def test_payroll_y_la_nomina_descuentan_lo_mismo(client, db, finanzas, septiembre):
    _marcar(db, 'jean_carlo', 'pedro', 'jean_carlo', None)

    payroll = _payroll(client, finanzas)
    nomina = _nomina(client, finanzas)

    assert _de(nomina, septiembre['jean'])['transferencias_recibidas'] == \
        payroll['jeancarlo']['transferencias_recibidas'] == 230.0
    assert _de(nomina, septiembre['pedro'])['transferencias_recibidas'] == \
        payroll['pedro']['transferencias_recibidas'] == 300.0


def test_editar_una_fila_la_devuelve_con_lo_que_recibio(client, db, finanzas, septiembre):
    """La tabla reemplaza la fila con la que vuelve del POST: sin esto, tildar «pagado» la
    dejaba sin la transferencia hasta recargar."""
    _marcar(db, 'jean_carlo')

    r = client.post('/api/public/finance/payroll', headers=finanzas,
                    json={'member_id': septiembre['jean'].id, 'month': MES, 'is_paid': True})

    assert r.status_code == 200
    assert r.get_json()['transferencias_recibidas'] == 150.0


def test_el_por_pagar_descuenta_y_los_sueldos_del_resumen_no(client, db, finanzas, septiembre):
    def leer():
        resumen = client.get(f'/api/public/finance/summary?month={MES}', headers=finanzas).get_json()
        saldos = client.get(f'/api/public/finance/balances?month={MES}', headers=finanzas).get_json()
        return resumen, {b['payment_method']: b['expected_amount'] for b in saldos['balances']}

    resumen_antes, por_pagar_antes = leer()
    _marcar(db, 'jean_carlo', 'pedro', 'otro', None)
    resumen, por_pagar = leer()

    # Lo que cuesta el equipo y lo que entró no cambian.
    assert resumen['expenses_breakdown'] == resumen_antes['expenses_breakdown']
    assert resumen['kpis'] == resumen_antes['kpis']
    # Lo que hay que pagarle por cada pasarela, sí: Jean Carlo cobra por Mercury y Pedro por AirTM.
    assert por_pagar['Mercury'] == round(por_pagar_antes['Mercury'] - 150.0, 2)
    assert por_pagar['AirTM'] == round(por_pagar_antes['AirTM'] - 300.0, 2)


# --- El Resumen de Finanzas -----------------------------------------------------------------------

def test_el_resumen_abre_las_transferencias_por_destino_sin_cambiar_el_ingreso(client, db, finanzas, septiembre):
    _marcar(db, 'jean_carlo', 'pedro', 'otro', None)

    resumen = client.get(f'/api/public/finance/summary?month={MES}', headers=finanzas).get_json()

    transferencias = resumen['transferencias']
    assert (transferencias['total'], transferencias['ventas']) == (580.0, 4)
    assert {d['clave']: d['total'] for d in transferencias['destinos']} == \
        {'pedro': 300.0, 'jean_carlo': 150.0, 'otro': 80.0}
    assert transferencias['sin_marcar'] == {'total': 50.0, 'ventas': 1}
    # Es parte del ingreso: suma lo mismo que sus filas de «Ingresos por medio de pago».
    por_medio = {i['metodo_pago']: i['total'] for i in resumen['income_breakdown']}
    assert por_medio['Transferencia Bancaria'] + por_medio['Transferencia'] == transferencias['total']
    assert resumen['kpis']['total_income'] == 2580.0
