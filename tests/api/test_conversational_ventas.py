"""La "tasa de cierre" de los mensajes conversacionales no cuenta señas.

`_compute_stats_for_dates` atribuye a cada mensaje del setter las agendas y las ventas de los leads
que lo recibieron, y muestra `ventas / agendas` como "Tasa de cierre". Contaba cada fila de
`FinancialSale`: una seña, una cuota o una renovación del lead sumaban como una venta más. El
pedido del usuario (30/09/2026) vale para todo el sistema: solo pago completo y split pay.
"""
from datetime import datetime

from app.api.conversational import _compute_stats_for_dates
from app.models import FinancialAgenda, FinancialSale, LeadAnswer, ManychatLead

DESDE = datetime(2026, 9, 1)
HASTA = datetime(2026, 9, 30, 23, 59, 59)
DIA = datetime(2026, 9, 15, 12, 0)


def lead_con_agenda(db, ig, *tipos):
    lead = ManychatLead(manychat_id=f'mc-{ig}', name=ig.title(), ig=f'@{ig}', setter='Elias',
                        created_at=DIA)
    db.session.add(lead)
    db.session.commit()
    db.session.add(LeadAnswer(lead_id=lead.id, id_option_send='msg-1', qualification='true',
                              created_at=DIA))
    db.session.add(FinancialAgenda(nombre=ig.title(), instagram=ig, date=DIA, created_at=DIA))
    for tipo in tipos:
        db.session.add(FinancialSale(instagram=ig, nombre_cliente=ig.title(), tipo_pago=tipo,
                                     monto=500.0, date=DIA, estado='Completada'))
    db.session.commit()


def test_la_tasa_de_cierre_por_mensaje_solo_cuenta_pago_completo_y_split(db):
    lead_con_agenda(db, 'ana', 'AL - Completo')
    lead_con_agenda(db, 'beto', 'RR - Parcial')
    lead_con_agenda(db, 'caro', 'RR - Seña')
    lead_con_agenda(db, 'dani', 'RR - Cuota')

    kpis, filas = _compute_stats_for_dates(DESDE, HASTA, None, None)

    assert (kpis['total_agendas'], kpis['total_ventas']) == (4, 2)
    assert kpis['venta_rate_from_agendas'] == 50.0
    [fila] = [f for f in filas if f['message_id'] == 'msg-1']
    assert (fila['ventas'], fila['venta_rate']) == (2, 50.0)


def test_una_venta_anulada_no_es_un_cierre(db):
    lead_con_agenda(db, 'ana', 'AL - Completo')
    FinancialSale.query.update({'estado': 'Cancelada'})
    db.session.commit()

    kpis, _ = _compute_stats_for_dates(DESDE, HASTA, None, None)

    assert kpis['total_ventas'] == 0
