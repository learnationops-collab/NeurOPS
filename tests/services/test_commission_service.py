"""CommissionService: comisión del mes en curso visible en el espacio de trabajo de closers (10%) y
setters (8%), sobre el cash collected NETO (ya sin las fees de Stripe/Hotmart).

`get_closer_commission` reusa `CloserService.get_comprehensive_stats` (~3000 líneas, fuera de alcance
de esta etapa): se simula esa llamada para probar solo la lógica propia de CommissionService (extraer
`cash_neto`, aplicar la tasa, redondear). `get_setter_commission` es autocontenida (FinancialSale +
FinancialAgenda + AttributionService, ya probado en test_attribution_service.py) y se prueba de punta a
punta con datos reales.
"""
from datetime import datetime
from unittest.mock import patch

import pytest
from freezegun import freeze_time

from app.models import FinancialAgenda, FinancialSale
from app.services.commission_service import CLOSER_RATE, SETTER_RATE, CommissionService

HOY = '2026-09-22 15:00:00'  # 11:00 en America/La_Paz (UTC-4): sin ambiguedad de dia calendario


@pytest.fixture()
def ivan(make_user):
    return make_user(role='setter', username='ivan')


def venta(db, setter=None, instagram=None, mail=None, monto=100.0, metodo='zelle', tipo='parcial',
         estado='Completada', fecha=None):
    v = FinancialSale(setter=setter, instagram=instagram, mail_cliente=mail, monto=monto, metodo_pago=metodo,
                      tipo_pago=tipo, estado=estado, date=fecha or datetime(2026, 9, 10))
    db.session.add(v)
    db.session.commit()
    return v


def agenda(db, nombre, instagram, mail, fecha=None):
    a = FinancialAgenda(nombre=nombre, instagram=instagram, mail=mail, date=fecha or datetime(2026, 9, 1))
    db.session.add(a)
    db.session.commit()
    return a


# --- _rango_mes_actual ---------------------------------------------------------------------------

@freeze_time(HOY)
def test_rango_mes_actual_va_del_primero_del_mes_a_hoy(db, ivan):
    inicio, fin, mes = CommissionService._rango_mes_actual(ivan)

    assert (inicio, fin, mes) == ('2026-09-01', '2026-09-22', '2026-09')


# --- get_setter_commission: lo basico ------------------------------------------------------------

@freeze_time(HOY)
def test_sin_ventas_la_comision_es_cero(db, ivan):
    resultado = CommissionService.get_setter_commission(ivan)

    assert resultado == {'role': 'setter', 'month': '2026-09', 'rate': SETTER_RATE, 'cash_neto': 0.0,
                         'commission': 0.0}


@freeze_time(HOY)
def test_una_venta_por_zelle_cuenta_el_monto_completo(db, ivan):
    venta(db, setter='Ivan', monto=500.0, metodo='zelle')

    resultado = CommissionService.get_setter_commission(ivan)

    assert (resultado['cash_neto'], resultado['commission']) == (500.0, 40.0)


@pytest.mark.parametrize('metodo,factor', [('stripe', 0.955), ('hotmart', 0.911), ('Stripe', 0.955)])
@freeze_time(HOY)
def test_stripe_y_hotmart_descuentan_su_fee_zelle_no(db, ivan, metodo, factor):
    venta(db, setter='Ivan', monto=1000.0, metodo=metodo)

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == round(1000.0 * factor, 2)


@freeze_time(HOY)
def test_el_username_no_distingue_mayusculas(db, make_user):
    venta(db, setter='Ivan', monto=100.0)

    mayusculas = make_user(role='setter', username='IVAN', email='ivan2@x.com')

    assert CommissionService.get_setter_commission(mayusculas)['cash_neto'] == 100.0


@freeze_time(HOY)
def test_la_venta_de_otro_setter_no_cuenta(db, ivan):
    venta(db, setter='Otro Setter', monto=999.0)

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 0.0


# --- get_setter_commission: atribucion por agenda vs. campo setter de la venta -------------------

@freeze_time(HOY)
def test_la_agenda_atribuida_manda_sobre_el_campo_setter_de_la_venta(db, ivan):
    # El campo `setter` de la venta trae otro nombre (dato de la planilla); la agenda que originó la
    # venta (misma identidad por instagram+mail) es de Ivan: gana la agenda.
    agenda(db, nombre='Ivan', instagram='lead1', mail='lead1@x.com')
    venta(db, setter='nombre-de-planilla-no-es-ivan', instagram='lead1', mail='lead1@x.com', monto=500.0)

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 500.0


@pytest.mark.parametrize('nombre_invalido', ['S/F', 'N/A', '', 'Entrevista Ivan', 'Diagnostica Ivan', 'Diagnóstica'])
@freeze_time(HOY)
def test_una_fuente_de_agenda_invalida_cae_al_campo_setter_de_la_venta(db, ivan, nombre_invalido):
    agenda(db, nombre=nombre_invalido, instagram='lead1', mail='lead1@x.com')
    venta(db, setter='Ivan', instagram='lead1', mail='lead1@x.com', monto=500.0)

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 500.0


@pytest.mark.parametrize('setter_de_la_venta', ['', 'Sin Setter', 'sin setter', 'Confirmada'])
@freeze_time(HOY)
def test_un_campo_setter_vacio_o_generico_no_cuenta_para_nadie(db, ivan, setter_de_la_venta):
    # Ni siquiera con una fuente de agenda invalida: no hay a quien atribuirle la venta.
    agenda(db, nombre='N/A', instagram='lead1', mail='lead1@x.com')
    venta(db, setter=setter_de_la_venta, instagram='lead1', mail='lead1@x.com', monto=500.0)

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 0.0


@pytest.mark.parametrize('placeholder', ['Sin Setter', 'sin setter', 'Confirmada'])
@freeze_time(HOY)
def test_sin_setter_y_confirmada_no_son_un_setter_valido_ni_para_quien_se_llame_asi(db, make_user, placeholder):
    # 'Sin Setter'/'Confirmada' son placeholders del campo, no el nombre de nadie: ni siquiera un
    # usuario cuyo username coincidiera literalmente con el placeholder deberia cobrar por esa venta.
    mismo_nombre = make_user(role='setter', username=placeholder, email='raro@x.com')
    venta(db, setter=placeholder, monto=500.0)

    assert CommissionService.get_setter_commission(mismo_nombre)['cash_neto'] == 0.0


@freeze_time(HOY)
def test_sin_agenda_atribuida_cae_directo_al_campo_setter(db, ivan):
    venta(db, setter='Ivan', monto=300.0)  # sin instagram/mail: no hay agenda con quien unificarla

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 300.0


# --- get_setter_commission: filtros de estado y de fecha -----------------------------------------

@pytest.mark.parametrize('estado', ['Cancelada', 'Pendiente', 'Reembolsada', 'rechazada'])
@freeze_time(HOY)
def test_una_venta_que_no_esta_completada_ni_confirmada_no_cuenta(db, ivan, estado):
    venta(db, setter='Ivan', monto=500.0, estado=estado)

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 0.0


@pytest.mark.parametrize('estado', ['Completada', 'completada', 'Confirmada', 'CONFIRMADA', '', None])
@freeze_time(HOY)
def test_completada_confirmada_o_sin_estado_todavia_si_cuentan(db, ivan, estado):
    venta(db, setter='Ivan', monto=500.0, estado=estado)

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 500.0


@freeze_time(HOY)
def test_una_venta_del_mes_pasado_no_cuenta(db, ivan):
    venta(db, setter='Ivan', monto=999.0, fecha=datetime(2026, 8, 31, 23, 59))

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 0.0


@freeze_time(HOY)
def test_una_venta_de_hoy_si_cuenta(db, ivan):
    venta(db, setter='Ivan', monto=500.0, fecha=datetime(2026, 9, 22, 20, 0))

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 500.0


@freeze_time(HOY)
def test_una_venta_de_manana_no_cuenta_todavia(db, ivan):
    venta(db, setter='Ivan', monto=999.0, fecha=datetime(2026, 9, 23, 0, 0))

    assert CommissionService.get_setter_commission(ivan)['cash_neto'] == 0.0


@freeze_time(HOY)
def test_varias_ventas_del_mes_se_suman(db, ivan):
    venta(db, setter='Ivan', monto=100.0, metodo='zelle')
    venta(db, setter='Ivan', monto=100.0, metodo='stripe')
    venta(db, setter='Otro', monto=99999.0)  # no deberia sumar

    resultado = CommissionService.get_setter_commission(ivan)

    assert resultado['cash_neto'] == round(100.0 + 100.0 * 0.955, 2)


# --- get_closer_commission (CloserService simulado) ----------------------------------------------

@freeze_time(HOY)
def test_get_closer_commission_aplica_la_tasa_sobre_el_cash_neto(db, make_user):
    closer = make_user(role='closer')
    stats = {'sales': {'totals': {'cash_neto': 1000.0}}}

    with patch('app.services.closer_service.CloserService.get_comprehensive_stats', return_value=stats) as mock:
        resultado = CommissionService.get_closer_commission(closer)

    mock.assert_called_once_with(closer.id, start_date='2026-09-01', end_date='2026-09-22')
    assert resultado == {'role': 'closer', 'month': '2026-09', 'rate': CLOSER_RATE, 'cash_neto': 1000.0,
                         'commission': 100.0}


@pytest.mark.parametrize('stats', [{}, {'sales': {}}, {'sales': {'totals': {}}}, {'sales': None}])
@freeze_time(HOY)
def test_get_closer_commission_sin_datos_no_rompe(db, make_user, stats):
    closer = make_user(role='closer')

    with patch('app.services.closer_service.CloserService.get_comprehensive_stats', return_value=stats):
        resultado = CommissionService.get_closer_commission(closer)

    assert (resultado['cash_neto'], resultado['commission']) == (0.0, 0.0)


@freeze_time(HOY)
def test_get_closer_commission_redondea_a_dos_decimales(db, make_user):
    closer = make_user(role='closer')
    stats = {'sales': {'totals': {'cash_neto': 333.333}}}

    with patch('app.services.closer_service.CloserService.get_comprehensive_stats', return_value=stats):
        resultado = CommissionService.get_closer_commission(closer)

    assert (resultado['cash_neto'], resultado['commission']) == (333.33, 33.33)


# --- get_for_user ---------------------------------------------------------------------------------

@freeze_time(HOY)
def test_get_for_user_despacha_closer(db, make_user):
    closer = make_user(role='closer')

    with patch('app.services.closer_service.CloserService.get_comprehensive_stats',
              return_value={'sales': {'totals': {'cash_neto': 0.0}}}):
        resultado = CommissionService.get_for_user(closer)

    assert resultado['role'] == 'closer'


@freeze_time(HOY)
def test_get_for_user_despacha_setter(db, ivan):
    assert CommissionService.get_for_user(ivan)['role'] == 'setter'


@pytest.mark.parametrize('rol', ['admin', 'operator', 'triage', 'director_comercial', 'hiring'])
@freeze_time(HOY)
def test_get_for_user_ningun_otro_rol_tiene_comision(db, make_user, rol):
    assert CommissionService.get_for_user(make_user(role=rol)) is None
