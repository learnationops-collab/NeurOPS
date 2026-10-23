"""El close rate real: lo cerrado en el período, venga de la llamada que venga (23/10/2026).

Pedido del usuario: el close rate de arriba mide las llamadas del mes, así que una seña de la llamada
del mes pasado que se paga este mes no entraba, aunque sea una venta de este mes (9 ventas en el
ticket de Jean Carlo y 4 en el close rate). Lo que se prueba:

  · cada cobro de venta se rastrea hasta la llamada de la que salió: del período, anterior o ninguna;
  · la llamada anterior suma al numerador Y al denominador (nunca pasa de 100%);
  · el cobro sin llamada queda fuera de la tasa y se cuenta aparte;
  · la seña pagada por completo con una «Cuota» cuenta; si no llega al precio, no;
"""
import itertools
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale
from app.services import comercial_analitica as ca
from app.services.closer_service import CloserService

HOY = '2026-10-23 12:00:00'
DESDE, HASTA = datetime(2026, 10, 1).date(), datetime(2026, 10, 31).date()
VENDEDOR = 'jc@thelearnation.com'

_n = itertools.count(1)


@pytest.fixture()
def jean(make_user):
    return make_user(role='closer', username='Jean Carlo', email=VENDEDOR)


def lead(db):
    email = f'lead{next(_n)}@x.com'
    cli = Client(full_name=email.split('@')[0], email=email)
    db.session.add(cli)
    db.session.commit()
    return cli


def llamada(db, closer, cli, fecha, *, resultado='Show up'):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=fecha, result='Confirmado',
                    closer_result=resultado, created_at=datetime(2026, 8, 1))
    db.session.add(a)
    db.session.commit()
    return a


def pago(db, cli, tipo, fecha, monto=500.0, estado='Completada'):
    # Con `client_id`, como en producción: así el pago hereda la persona del cliente (person_service).
    v = FinancialSale(mail_cliente=cli.email, tipo_pago=tipo, monto=monto, metodo_pago='zelle',
                      email_vendedor=VENDEDOR, date=fecha, estado=estado, nombre_cliente=cli.full_name,
                      client_id=cli.id)
    db.session.add(v)
    db.session.commit()
    return v


def bloque(jean):
    return ca.bloque_closers(DESDE, HASTA, closer_id=jean.id, closer_nombre='Jean Carlo')


def reales(jean):
    return bloque(jean)['cierres']['reales']


@freeze_time(HOY)
def test_el_cierre_de_una_llamada_del_periodo_cuenta_una_vez(db, jean):
    cli = lead(db)
    llamada(db, jean, cli, datetime(2026, 10, 10, 15))
    pago(db, cli, 'AL - Completo', datetime(2026, 10, 12))

    r = reales(jean)

    assert (r['cierres'], r['del_periodo'], r['anteriores'], r['sin_llamada']) == (1, 1, 0, 0)
    assert (r['asistieron'], r['base'], r['pct']) == (1, 1, 100.0)
    assert r['filas'][0]['origen'] == 'periodo'


@freeze_time(HOY)
def test_la_sena_del_mes_pasado_cerrada_ahora_suma_arriba_y_abajo(db, jean):
    """El caso de Jean Carlo: la llamada es de septiembre, el cierre es de octubre. Por llamada no
    entra (no hay agenda de octubre); el real la cuenta como cierre y como oportunidad trabajada."""
    sin_cierre, de_septiembre = lead(db), lead(db)
    llamada(db, jean, sin_cierre, datetime(2026, 10, 5, 15))
    llamada(db, jean, de_septiembre, datetime(2026, 9, 20, 15))
    pago(db, de_septiembre, 'AL - Seña', datetime(2026, 9, 22), monto=100.0)
    pago(db, de_septiembre, 'AL - Completo', datetime(2026, 10, 8), monto=900.0)

    b = bloque(jean)
    r = b['cierres']['reales']

    assert (r['cierres'], r['del_periodo'], r['anteriores']) == (1, 0, 1)
    assert (r['asistieron'], r['base'], r['pct']) == (1, 2, 50.0)
    assert b['close_rate_real'] == 50.0
    assert b['close_rate'] == 0.0                      # por llamada: la de octubre no cerró
    assert b['cierres']['sin_senas']['por_llamada']['num'] == 0
    anterior = r['filas'][0]
    assert anterior['origen'] == 'anterior' and anterior['llamada']['closer'] == 'Jean Carlo'


@freeze_time(HOY)
def test_el_cobro_sin_llamada_queda_fuera_de_la_tasa_y_se_cuenta_aparte(db, jean):
    con_llamada, directo = lead(db), lead(db)
    llamada(db, jean, con_llamada, datetime(2026, 10, 3, 15))
    pago(db, directo, 'AL - Completo', datetime(2026, 10, 9))

    r = reales(jean)

    assert (r['cierres'], r['sin_llamada']) == (0, 1)
    assert (r['base'], r['pct']) == (1, 0.0)
    assert r['filas'][0]['origen'] == 'sin_llamada' and r['filas'][0]['llamada'] is None


@freeze_time(HOY)
def test_una_llamada_de_hace_mas_de_noventa_dias_no_es_de_ese_cierre(db, jean):
    viejo = lead(db)
    llamada(db, jean, viejo, datetime(2026, 6, 1, 15))
    pago(db, viejo, 'AL - Completo', datetime(2026, 10, 9))

    r = reales(jean)

    assert (r['anteriores'], r['sin_llamada']) == (0, 1)


@freeze_time(HOY)
def test_nunca_pasa_de_cien_por_ciento(db, jean):
    for _ in range(3):
        cli = lead(db)
        llamada(db, jean, cli, datetime(2026, 9, 15, 15))
        pago(db, cli, 'AL - Completo', datetime(2026, 10, 6))

    r = reales(jean)

    assert (r['cierres'], r['anteriores'], r['asistieron'], r['base']) == (3, 3, 0, 3)
    assert r['pct'] == 100.0


@freeze_time(HOY)
def test_la_sena_completada_con_una_cuota_que_llega_al_precio_es_un_cierre(db, jean):
    cli = lead(db)
    llamada(db, jean, cli, datetime(2026, 9, 24, 15))
    pago(db, cli, 'AL - Seña', datetime(2026, 9, 25), monto=50.0)
    pago(db, cli, 'AL - Cuota', datetime(2026, 10, 2), monto=950.0)

    r = reales(jean)

    assert (r['cierres'], r['anteriores'], r['por_cuota']) == (1, 1, 1)
    assert r['filas'][0]['via'] == 'cuota'
    # El ticket y el close rate por llamada no la ven: solo este número.
    assert ca.bloque_closers(DESDE, HASTA, closer_id=jean.id, closer_nombre='Jean Carlo')['ventas'] == 0


@freeze_time(HOY)
def test_la_cuota_que_no_llega_al_precio_no_cierra_nada(db, jean):
    cli = lead(db)
    llamada(db, jean, cli, datetime(2026, 9, 24, 15))
    pago(db, cli, 'AL - Seña', datetime(2026, 9, 25), monto=50.0)
    pago(db, cli, 'AL - Cuota', datetime(2026, 10, 2), monto=100.0)

    assert reales(jean)['cierres'] == 0


@freeze_time(HOY)
def test_la_sena_completada_con_cuota_no_cuenta_dos_veces_si_ya_hay_otra_venta(db, jean):
    cli = lead(db)
    llamada(db, jean, cli, datetime(2026, 9, 24, 15))
    pago(db, cli, 'AL - Seña', datetime(2026, 9, 25), monto=50.0)
    pago(db, cli, 'AL - Cuota', datetime(2026, 10, 2), monto=950.0)
    pago(db, cli, 'RR - Parcial', datetime(2026, 10, 4), monto=300.0)

    r = reales(jean)

    assert (r['cierres'], r['por_cuota']) == (1, 0)


@freeze_time(HOY)
def test_el_tablero_del_closer_trae_el_mismo_bloque(db, jean):
    cli = lead(db)
    llamada(db, jean, cli, datetime(2026, 9, 20, 15))
    pago(db, cli, 'AL - Completo', datetime(2026, 10, 8))

    r = CloserService.get_comprehensive_stats(jean.id, '2026-10-01', '2026-10-31')['cierres']['reales']

    assert (r['cierres'], r['anteriores']) == (1, 1)
    assert r['filas'][0]['cliente'] == cli.full_name


@freeze_time(HOY)
def test_el_ranking_no_paga_el_calculo(db, jean):
    cli = lead(db)
    llamada(db, jean, cli, datetime(2026, 10, 10, 15))
    pago(db, cli, 'AL - Completo', datetime(2026, 10, 12))

    b = ca.bloque_closers(DESDE, HASTA, closer_id=jean.id, closer_nombre='Jean Carlo', con_reales=False)

    assert b['cierres']['reales'] is None and b['close_rate_real'] is None
