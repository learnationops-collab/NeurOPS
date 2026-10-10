"""Los dos tableros dicen el mismo close rate para el mismo conjunto de llamadas.

El close rate se calcula en dos lugares que no comparten la unidad:

  · el dashboard del closer (`CloserService.get_comprehensive_stats`) cuenta PAGOS del período
    (`FinancialSale` atribuidos por el mail del vendedor) sobre llamadas con show up;
  · el panel Cierre del dashboard comercial (`comercial_analitica.bloque_closers`) cuenta
    AGENDAS cuyo lead tiene un pago cruzado por contacto.

Para un conjunto "limpio" —cada llamada con show up, a lo sumo una compra, todo dentro del
período y del mismo closer, y la oferta tildada donde se presentó— las dos cuentas tienen que dar
exactamente lo mismo en las cuatro tasas. Si alguna vez divergen acá, una de las dos está
contando algo que no es un cierre (típicamente, una seña).
"""
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale
from app.services import comercial_analitica as ca
from app.services.closer_service import CloserService

HOY = '2026-09-29 15:00:00'
DESDE, HASTA = datetime(2026, 9, 1).date(), datetime(2026, 9, 30).date()
VENDEDOR = 'marlon@thelearnation.com'


@pytest.fixture()
def marlon(make_user):
    return make_user(role='closer', username='Marlon', email=VENDEDOR)


def llamada(db, closer, email, *, resultado='Show up', presento=True, **campos):
    cli = Client(full_name=email.split('@')[0], email=email)
    db.session.add(cli)
    db.session.commit()
    db.session.add(Appointment(closer_id=closer.id, client_id=cli.id,
                               start_time=datetime(2026, 9, 12, 15, 0), result='Confirmado',
                               closer_result=resultado, offer_presented=presento,
                               created_at=datetime(2026, 9, 1), **campos))
    db.session.commit()


def pago(db, email, tipo, *, dia=12, monto=500.0):
    db.session.add(FinancialSale(mail_cliente=email, tipo_pago=tipo, monto=monto, metodo_pago='zelle',
                                 email_vendedor=VENDEDOR, date=datetime(2026, 9, dia),
                                 estado='Completada', nombre_cliente=email.split('@')[0]))
    db.session.commit()


@freeze_time(HOY)
def test_los_dos_backends_dan_la_misma_matriz_de_cierres(db, marlon):
    llamada(db, marlon, 'pif@x.com')
    pago(db, 'pif@x.com', 'AL - Completo')
    llamada(db, marlon, 'split@x.com')
    pago(db, 'split@x.com', 'RR - Parcial')
    # Solo seña: cuenta en la fila de señas, no en la de ventas.
    llamada(db, marlon, 'sena@x.com')
    pago(db, 'sena@x.com', 'RR - Seña', monto=100.0)
    # Seña el 3 y pago completo el 10: UNA venta, y no además una seña.
    llamada(db, marlon, 'completo@x.com')
    pago(db, 'completo@x.com', 'RR - Seña', dia=3, monto=100.0)
    pago(db, 'completo@x.com', 'RR - Completo', dia=10, monto=1900.0)
    # Presentó y no compró.
    llamada(db, marlon, 'no@x.com')
    # Se cortó antes de la oferta, con un seguimiento abierto.
    llamada(db, marlon, 'corto@x.com', presento=False, seguimiento_tipo='tomada')
    # No vino: no entra en ningún denominador.
    llamada(db, marlon, 'noshow@x.com', resultado='No Show', presento=False)

    del_closer = CloserService.get_comprehensive_stats(marlon.id, DESDE, HASTA)['cierres']
    del_comercial = ca.bloque_closers(DESDE, HASTA, closer_id=marlon.id, closer_nombre='Marlon')['cierres']

    esperado = {
        'ventas': 3, 'senas': 1, 'asistieron': 6, 'presentaciones': 5,
        # El desglose de la leyenda: pif@ y completo@ pagaron completo, split@ abrió un split.
        'ventas_completo': 2, 'ventas_split': 1,
        'presentacion': {'num': 5, 'den': 6, 'pct': 83.3},
        'sin_senas': {'por_llamada': {'num': 3, 'den': 6, 'pct': 50.0},
                      'por_presentacion': {'num': 3, 'den': 5, 'pct': 60.0}},
        # Solo la seña de sena@: la de completo@ terminó en venta y ya está arriba.
        'solo_senas': {'por_llamada': {'num': 1, 'den': 6, 'pct': 16.7},
                       'por_presentacion': {'num': 1, 'den': 5, 'pct': 20.0}},
    }
    assert del_comercial == esperado
    assert del_closer == esperado


@freeze_time(HOY)
def test_el_close_rate_de_siempre_es_la_fila_sin_senas_en_los_dos(db, marlon):
    llamada(db, marlon, 'pif@x.com')
    pago(db, 'pif@x.com', 'AL - Completo')
    llamada(db, marlon, 'sena@x.com')
    pago(db, 'sena@x.com', 'RR - Seña', monto=100.0)

    stats = CloserService.get_comprehensive_stats(marlon.id, DESDE, HASTA)
    bloque = ca.bloque_closers(DESDE, HASTA, closer_id=marlon.id, closer_nombre='Marlon')

    assert stats['percentages']['close_rate'] == bloque['close_rate'] == 50.0
    assert stats['percentages']['offer_to_sale'] == bloque['close_presentacion'] == 50.0
    assert bloque['cierres']['sin_senas']['por_llamada']['pct'] == bloque['close_rate']
    assert bloque['cierres']['sin_senas']['por_presentacion']['pct'] == bloque['close_presentacion']
    # El embudo del comercial termina en ventas reales: la seña no es un escalón de "Ventas".
    assert {p['paso']: p['n'] for p in bloque['funnel']}['Ventas'] == 1
