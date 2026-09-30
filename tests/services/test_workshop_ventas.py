"""Compradores de un workshop: quién cuenta como venta en el embudo del taller.

`sales` del taller es el numerador de su close rate (`WorkshopEvent.pct_close_rate` = compradores /
show up). Contaba como compradora a quien había dejado solo una seña, y el usuario lo pidió
explícito el 30/09/2026: "el close rate no debe tomar señas; solo pago completo y split pay".

La seña sigue sumando al cash del taller —es plata que el taller trajo— pero no hace compradora a
nadie.
"""
from datetime import datetime

from app.models import FinancialAgenda, FinancialSale
from app.services.workshop_metrics_service import _ventas_de

AGENDADA = datetime(2026, 9, 20, 15, 0)


def agenda(db, ig, *, estado='Show Up'):
    a = FinancialAgenda(nombre='Workshop', lead=f'Persona {ig}', instagram=ig, mail=f'{ig}@test.local',
                        estado=estado, closer='Marlon', created_at=AGENDADA, date=AGENDADA)
    db.session.add(a)
    db.session.commit()
    return a


def pago(db, ig, tipo, monto=500.0):
    db.session.add(FinancialSale(instagram=ig, mail_cliente=f'{ig}@test.local', tipo_pago=tipo,
                                 monto=monto, date=datetime(2026, 9, 22), estado='Completada'))
    db.session.commit()


def test_pago_completo_y_split_pay_hacen_compradora_a_la_persona(db):
    agendas = [agenda(db, 'pif'), agenda(db, 'split')]
    pago(db, 'pif', 'AL - Completo')
    pago(db, 'split', 'RR - Parcial')

    compradores, ventas = _ventas_de(agendas, set())

    assert compradores == {'pif', 'split'}
    assert len(ventas) == 2


def test_una_sena_sola_no_es_una_compra_pero_su_cash_si_cuenta(db):
    agendas = [agenda(db, 'sena')]
    pago(db, 'sena', 'RR - Seña', monto=100.0)

    compradores, ventas = _ventas_de(agendas, set())

    assert compradores == set()
    assert sum(v.monto for v in ventas) == 100.0


def test_la_sena_que_se_completo_es_una_sola_compra(db):
    agendas = [agenda(db, 'kary')]
    pago(db, 'kary', 'RR - Seña', monto=100.0)
    pago(db, 'kary', 'RR - Completo', monto=1900.0)

    compradores, ventas = _ventas_de(agendas, set())

    assert compradores == {'kary'}
    assert sum(v.monto for v in ventas) == 2000.0


def test_la_hoja_marcada_como_sena_tampoco_hace_compradora(db):
    """El respaldo por estado de la hoja (venta no cargada todavía) ya no toma 'Seña'."""
    compradores, _ = _ventas_de([agenda(db, 'hoja', estado='Seña')], set())

    assert compradores == set()


def test_la_hoja_marcada_como_cierre_sigue_contando_sin_la_venta_cargada(db):
    compradores, _ = _ventas_de([agenda(db, 'hoja', estado='Cierre')], set())

    assert compradores == {'hoja'}
