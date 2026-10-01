"""Rendimiento conversacional: una agenda se atribuye al lead por su nombre, no por su fuente.

`FinancialAgenda.nombre` es la FUENTE de la agenda (el setter, 'workshop', 'vsl') y el nombre de la
persona es `lead`. Cuando el instagram no cruzaba, la agenda se buscaba en ManyChat por la fuente:
caía en el lead que se llama como el setter (en producción, la conversación de prueba del propio
Elias y la de Paula) y se le atribuía al último mensaje que recibió ese. 44 agendas en septiembre
de 2026.
"""
from datetime import datetime

from app.api.conversational import _compute_stats_for_dates
from app.models import FinancialAgenda, LeadAnswer, ManychatLead

DESDE = datetime(2026, 9, 1)
HASTA = datetime(2026, 9, 30, 23, 59, 59)
DIA = datetime(2026, 9, 15, 12, 0)


def lead(db, nombre, ig, mensaje):
    l = ManychatLead(manychat_id=f'mc-{ig}', name=nombre, ig=ig, setter='Elias', created_at=DIA)
    db.session.add(l)
    db.session.commit()
    db.session.add(LeadAnswer(lead_id=l.id, id_option_send=mensaje, qualification='true', created_at=DIA))
    db.session.commit()


def test_la_agenda_va_al_mensaje_que_recibio_la_persona_y_no_al_del_setter(db):
    lead(db, 'Ana Real', 'ana_real', 'msg-cualificacion')
    # La conversación de prueba del setter: se llama como él.
    lead(db, 'elias', 'cuenta_del_setter', 'msg-prueba')
    # La agenda de Ana, de la fuente "Elias", con un instagram que no está en ManyChat.
    db.session.add(FinancialAgenda(nombre='Elias', lead='Ana Real', instagram='ana.otra.cuenta',
                                   date=DIA, created_at=DIA))
    db.session.commit()

    kpis, filas = _compute_stats_for_dates(DESDE, HASTA, None, None)
    agendas = {f['message_id']: f['agendas'] for f in filas}

    assert agendas == {'msg-cualificacion': 1, 'msg-prueba': 0}
    assert kpis['total_agendas'] == 1
