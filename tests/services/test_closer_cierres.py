"""El close rate del dashboard del closer: sin señas, con señas, por llamada y por presentación.

Pedido del usuario (30/09/2026): "el close rate no debe tomar señas; solo los que son pago
completo y los que son pago parcial o split pay". Y una tarjeta que muestre las cuatro lecturas
(sin/con señas × por llamada/por presentación) para ver con claridad qué está pasando.

Lo que se prueba acá es `CloserService.get_comprehensive_stats`, que es de donde sale el
dashboard del closer (`CloserDashboardService`), el de "Ver mis datos" y el panel público. Tres
cosas que pueden dar un número plausible pero equivocado:

  · una seña sola NO es un cierre;
  · la seña que después se completó con un pago del mismo período no cuenta dos veces en el
    close rate con señas (antes era `ventas + todas las señas`);
  · en modo promedio las presentaciones se escalan igual que las ventas.
"""
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale
from app.services.closer_dashboard_service import CloserDashboardService
from app.services.closer_service import CloserService, matriz_de_cierres

HOY = '2026-09-29 15:00:00'
DESDE, HASTA = '2026-09-01', '2026-09-30'
VENDEDOR = 'marlon@thelearnation.com'


@pytest.fixture()
def marlon(make_user):
    return make_user(role='closer', username='Marlon', email=VENDEDOR)


def llamada(db, closer, email, *, dia=10, resultado='Show up', presento=True):
    cli = Client(full_name=email.split('@')[0], email=email)
    db.session.add(cli)
    db.session.commit()
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=datetime(2026, 9, dia, 15, 0),
                    result='Confirmado', closer_result=resultado, offer_presented=presento,
                    created_at=datetime(2026, 9, 1))
    db.session.add(a)
    db.session.commit()
    return a


def pago(db, email, tipo, *, dia=10, monto=500.0, vendedor=VENDEDOR, estado='Completada'):
    v = FinancialSale(mail_cliente=email, tipo_pago=tipo, monto=monto, metodo_pago='zelle',
                      email_vendedor=vendedor, date=datetime(2026, 9, dia), estado=estado,
                      nombre_cliente=email.split('@')[0])
    db.session.add(v)
    db.session.commit()
    return v


def stats(closer, agg='sum'):
    return CloserService.get_comprehensive_stats(closer.id, DESDE, HASTA, agg_type=agg)


# --- La forma del bloque ----------------------------------------------------------------------

def test_la_matriz_tiene_las_cuatro_tasas_con_sus_conteos():
    m = matriz_de_cierres(ventas=2, senas=1, asistieron=8, presentaciones=4)

    assert m['sin_senas']['por_llamada'] == {'num': 2, 'den': 8, 'pct': 25.0}
    assert m['sin_senas']['por_presentacion'] == {'num': 2, 'den': 4, 'pct': 50.0}
    assert m['con_senas']['por_llamada'] == {'num': 3, 'den': 8, 'pct': 37.5}
    assert m['con_senas']['por_presentacion'] == {'num': 3, 'den': 4, 'pct': 75.0}
    assert (m['ventas'], m['senas'], m['asistieron'], m['presentaciones']) == (2, 1, 8, 4)


def test_sin_denominador_la_tasa_es_none_y_no_cero():
    m = matriz_de_cierres(ventas=0, senas=0, asistieron=0, presentaciones=0)

    assert m['sin_senas']['por_llamada']['pct'] is None
    assert m['con_senas']['por_presentacion']['pct'] is None


# --- get_comprehensive_stats --------------------------------------------------------------------

@freeze_time(HOY)
def test_una_sena_sola_no_es_un_cierre_pero_si_cuenta_con_senas(db, marlon):
    for email, tipo in [('pif@x.com', 'AL - Completo'), ('split@x.com', 'RR - Parcial'),
                        ('sena@x.com', 'RR - Seña')]:
        llamada(db, marlon, email)
        pago(db, email, tipo)
    llamada(db, marlon, 'nada@x.com')

    s = stats(marlon)
    cierres = s['cierres']

    assert s['percentages']['close_rate'] == 50.0          # 2 de 4: la seña no entra
    assert cierres['sin_senas']['por_llamada'] == {'num': 2, 'den': 4, 'pct': 50.0}
    assert cierres['con_senas']['por_llamada'] == {'num': 3, 'den': 4, 'pct': 75.0}
    assert cierres['sin_senas']['por_presentacion']['pct'] == 50.0
    assert cierres['con_senas']['por_presentacion']['pct'] == 75.0
    # "Close rate promesa" ES el close rate con señas por llamada.
    assert s['percentages']['close_rate_promesa'] == 75.0
    assert s['percentages']['offer_to_sale_con_senas'] == 75.0


@freeze_time(HOY)
def test_la_sena_completada_en_el_periodo_no_cuenta_dos_veces(db, marlon):
    """Un lead que dejó seña el 3 y pagó el programa el 10 es UN cierre, en las dos filas. Antes
    el close rate con señas sumaba la venta y además la seña: dos cierres por una llamada."""
    llamada(db, marlon, 'kary@x.com')
    pago(db, 'kary@x.com', 'RR - Seña', dia=3, monto=100.0)
    pago(db, 'kary@x.com', 'RR - Completo', dia=10, monto=1900.0)

    cierres = stats(marlon)['cierres']

    assert (cierres['ventas'], cierres['senas']) == (1, 0)
    assert cierres['sin_senas']['por_llamada']['pct'] == 100.0
    assert cierres['con_senas']['por_llamada']['pct'] == 100.0


@freeze_time(HOY)
def test_la_sena_completada_despues_del_periodo_cuenta_como_sena(db, marlon):
    """La venta de octubre no está en las ventas de septiembre: en septiembre esa llamada terminó
    en una seña, y así se cuenta."""
    llamada(db, marlon, 'kary@x.com')
    pago(db, 'kary@x.com', 'RR - Seña', dia=20, monto=100.0)
    tardia = pago(db, 'kary@x.com', 'RR - Completo', dia=20, monto=1900.0)
    tardia.date = datetime(2026, 10, 5)
    db.session.commit()

    cierres = stats(marlon)['cierres']

    assert (cierres['ventas'], cierres['senas']) == (0, 1)
    assert cierres['sin_senas']['por_llamada']['pct'] == 0.0
    assert cierres['con_senas']['por_llamada']['pct'] == 100.0


@pytest.mark.parametrize('tipo', ['RR - Cuota', 'RR - Renovación', 'AL - Upsell'])
@freeze_time(HOY)
def test_cuotas_renovaciones_y_upsells_no_son_cierres_en_ninguna_fila(db, marlon, tipo):
    llamada(db, marlon, 'viejo@x.com')
    pago(db, 'viejo@x.com', tipo)

    cierres = stats(marlon)['cierres']

    assert (cierres['ventas'], cierres['senas']) == (0, 0)


@freeze_time(HOY)
def test_por_presentacion_divide_por_las_ofertas_presentadas(db, marlon):
    llamada(db, marlon, 'pif@x.com', presento=True)
    pago(db, 'pif@x.com', 'AL - Completo')
    llamada(db, marlon, 'sena@x.com', presento=True)
    pago(db, 'sena@x.com', 'RR - Seña')
    llamada(db, marlon, 'corto@x.com', presento=False)
    llamada(db, marlon, 'corto2@x.com', presento=False)

    cierres = stats(marlon)['cierres']

    assert (cierres['asistieron'], cierres['presentaciones']) == (4, 2)
    assert cierres['sin_senas']['por_presentacion'] == {'num': 1, 'den': 2, 'pct': 50.0}
    assert cierres['con_senas']['por_presentacion'] == {'num': 2, 'den': 2, 'pct': 100.0}


@freeze_time(HOY)
def test_en_modo_promedio_la_tasa_por_presentacion_no_cambia(db, marlon):
    """Una tasa es la misma se sume o se promedie por día. Antes, en modo promedio, las ventas se
    dividían por los días y las presentaciones no."""
    for dia in (8, 9, 10):
        llamada(db, marlon, f'pif{dia}@x.com', dia=dia)
        pago(db, f'pif{dia}@x.com', 'AL - Completo', dia=dia)
    llamada(db, marlon, 'nada@x.com', dia=10)

    suma, promedio = stats(marlon), stats(marlon, agg='avg')

    assert suma['percentages']['offer_to_sale'] == 75.0
    assert promedio['percentages']['offer_to_sale'] == pytest.approx(75.0, abs=0.5)


@freeze_time(HOY)
def test_el_dashboard_del_closer_expone_el_bloque_de_cierres(db, marlon):
    llamada(db, marlon, 'pif@x.com')
    pago(db, 'pif@x.com', 'AL - Completo')
    llamada(db, marlon, 'sena@x.com')
    pago(db, 'sena@x.com', 'RR - Seña')

    datos = CloserDashboardService.get_performance_data(
        closer_id=marlon.id, period='custom', compare='none', start_date=DESDE, end_date=HASTA)
    actual = datos['current']

    assert actual['cierres']['sin_senas']['por_llamada']['pct'] == 50.0
    assert actual['cierres']['con_senas']['por_llamada']['pct'] == 100.0
    # Los números viejos siguen, y dicen lo mismo que el bloque nuevo.
    assert actual['kpis']['close_rate_llamada'] == 50.0
    assert actual['senas']['close_rate_promesa'] == 100.0
