"""Una llamada ya no es «Venta» por un pago anterior a ella (23/10/2026).

Un cliente que ya había comprado en agosto y volvía a hablar en septiembre marcaba esa llamada como
cierre aunque el pago fuera anterior, y esa plata ya había contado en agosto. Ahora la llamada cierra
solo con un pago del día de la llamada en adelante, con un día de tolerancia (la hora de la llamada
está en UTC y el pago tiene fecha de día). Ver `ventas_previas.py`.
"""
import itertools
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale
from app.services.comercial_service import ComercialService

HOY = '2026-10-23 12:00:00'
VENDEDOR = 'jc@thelearnation.com'

_n = itertools.count(1)


@pytest.fixture()
def jean(make_user):
    return make_user(role='closer', username='Jean Carlo', email=VENDEDOR)


def lead(db):
    email = f'previo{next(_n)}@x.com'
    cli = Client(full_name=email.split('@')[0], email=email)
    db.session.add(cli)
    db.session.commit()
    return cli


def llamada(db, closer, cli, fecha):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=fecha, result='Confirmado',
                    closer_result='Show up', created_at=datetime(2026, 8, 1))
    db.session.add(a)
    db.session.commit()
    return a


def pago(db, cli, tipo, fecha, monto=500.0):
    # Con `client_id`, como en producción: así el pago hereda la persona del cliente (person_service).
    db.session.add(FinancialSale(mail_cliente=cli.email, tipo_pago=tipo, monto=monto, metodo_pago='zelle',
                                 email_vendedor=VENDEDOR, date=fecha, estado='Completada',
                                 nombre_cliente=cli.full_name, client_id=cli.id))
    db.session.commit()


def _agenda(jean, cli):
    filas = ComercialService.agendas(datetime(2026, 9, 1).date(), datetime(2026, 9, 30).date(), closer_id=jean.id)
    return next(f for f in filas if f['client_id'] == cli.id)


@freeze_time(HOY)
@pytest.mark.parametrize('pago_el, es_venta', [
    (datetime(2026, 8, 16), False),    # el cliente ya había comprado: esa plata es de agosto
    (datetime(2026, 9, 7), False),     # tres días antes
    (datetime(2026, 9, 9), True),      # un día antes: el closer cobra durante la llamada (UTC)
    (datetime(2026, 9, 10), True),     # el mismo día
    (datetime(2026, 9, 25), True),     # después
])
def test_la_llamada_cierra_solo_con_un_pago_de_su_dia_en_adelante(db, jean, pago_el, es_venta):
    cli = lead(db)
    llamada(db, jean, cli, datetime(2026, 9, 10, 15))
    pago(db, cli, 'AL - Completo', pago_el)

    fila = _agenda(jean, cli)

    assert fila['con_venta'] is es_venta
    assert (fila['post_call']['key'] == 'venta') is es_venta


@freeze_time(HOY)
def test_el_pago_anterior_no_deja_la_llamada_como_venta_pero_si_asistio(db, jean):
    cli = lead(db)
    llamada(db, jean, cli, datetime(2026, 9, 10, 15))
    pago(db, cli, 'AL - Completo', datetime(2026, 8, 16))

    fila = _agenda(jean, cli)

    assert fila['asistio'] is True and fila['no_cerrada'] is True
