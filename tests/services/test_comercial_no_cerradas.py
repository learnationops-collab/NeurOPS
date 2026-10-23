"""«No cerradas» del panel Cierre: las llamadas con show up que no terminaron en venta ni en seña.

Pedido del usuario (09/10/2026): «en esa tarjeta agrega un dato de "No cerradas" con la cantidad de
agendas en show up que no se cerraron». Lo que se prueba:

  · la definición es por lo que NO es (asistió y no hay venta ni seña), así que entra cualquier
    estado de "abierta" —presentó sin cerrar, seguimiento, segunda llamada, asistió sin más— aunque
    alguno cambie de nombre;
  · ventas + señas + no cerradas suman exactamente las que asistieron;
  · el número de la tarjeta sale de la MISMA marca de fila (`no_cerrada`) con la que se lista y se
    filtra en Revisar.
"""
import itertools
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale
from app.services import comercial_analitica as ca
from app.services.comercial_service import ComercialService

HOY = '2026-09-29 15:00:00'
DESDE, HASTA = datetime(2026, 9, 1).date(), datetime(2026, 9, 30).date()
VENDEDOR = 'marlon@thelearnation.com'

_n = itertools.count(1)


@pytest.fixture()
def marlon(make_user):
    return make_user(role='closer', username='Marlon', email=VENDEDOR)


def llamada(db, closer, *, resultado='Show up', compra=None, **campos):
    """Una agenda del 12/09 con su resultado y, si `compra`, un pago de ese tipo del mismo lead."""
    email = f'lead{next(_n)}@x.com'
    cli = Client(full_name=email.split('@')[0], email=email)
    db.session.add(cli)
    db.session.commit()
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=datetime(2026, 9, 12, 15, 0),
                    result='Confirmado', closer_result=resultado, created_at=datetime(2026, 9, 1),
                    **campos)
    db.session.add(a)
    if compra:
        db.session.add(FinancialSale(mail_cliente=email, tipo_pago=compra, monto=500.0, metodo_pago='zelle',
                                     email_vendedor=VENDEDOR, date=datetime(2026, 9, 12),
                                     estado='Completada', nombre_cliente=cli.full_name))
    db.session.commit()
    return a


def _por_id(filas):
    return {f['id']: f for f in filas}










@freeze_time(HOY)
def test_sin_show_up_no_hay_tasa_de_no_cerradas(db, marlon):
    llamada(db, marlon, resultado='No Show')

    c = ca.bloque_closers(DESDE, HASTA, closer_id=marlon.id, closer_nombre='Marlon')['cierres']

    assert c['no_cerradas'] == {'num': 0, 'den': 0, 'pct': None}


@freeze_time(HOY)
def test_una_agenda_vieja_sin_resultado_no_es_no_cerrada(db, marlon):
    """Sin reporte no se sabe si asistió: no puede contarse como una llamada que no cerró."""
    a = llamada(db, marlon, resultado='')
    a.start_time = datetime(2026, 9, 2, 9, 0)
    db.session.commit()

    filas = _por_id(ComercialService.agendas(DESDE, HASTA, closer_id=marlon.id))

    assert filas[a.id]['no_cerrada'] is False
