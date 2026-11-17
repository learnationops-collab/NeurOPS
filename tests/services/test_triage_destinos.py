"""El destino de cada llamada de triage y las cuentas que salen de él (ADR-W145): cada agenda cae en un
solo destino, así que los contadores suman las agendas y la base del % de asistencia es la de closing."""
from datetime import datetime, timedelta
from types import SimpleNamespace

from app.services import triage_filas, triage_service

AHORA = datetime(2026, 11, 16, 12, 0)
BASE = ('asistencias', 'no_show', 'canceladas', 'reagendadas', 'sin_reporte')


def _agenda(closer_result=None, result=None, calificacion=None, low_ticket=None, futura=False):
    return SimpleNamespace(closer_result=closer_result, result=result, triage_calificacion=calificacion,
                           triage_low_ticket=low_ticket, start_time=AHORA + timedelta(days=1 if futura else -1))


AGENDAS = [
    (_agenda('Show up', calificacion='calificado'), 'asistio'),
    (_agenda('Show up', calificacion='descalificado', low_ticket='no_cerrado'), 'asistio'),
    (_agenda('Show up', calificacion='seguimiento'), 'asistio'),
    (_agenda('Show up'), 'asistio'),
    (_agenda('No Show'), 'no_show'),
    (_agenda('Cancelado'), 'cancelo'),
    (_agenda('Pendiente', result='Cancelada'), 'cancelo'),
    (_agenda('Reagendado'), 'reagendo'),
    (_agenda(None, result='Reagendado'), 'reagendo'),
    (_agenda('Pendiente'), 'sin_reporte'),
    (_agenda(None, futura=True), 'por_ocurrir'),
    (_agenda('Descalificado'), 'fuera'),
    (_agenda('Lead Perdido'), 'fuera'),
    (_agenda('Archivada sin reporte'), 'fuera'),
]


def test_cada_agenda_tiene_un_destino():
    for agenda, esperado in AGENDAS:
        assert triage_filas.destino_de(agenda, AHORA) == esperado, agenda.closer_result


def test_los_contadores_suman_las_agendas_y_la_base():
    m = triage_service._vacias()
    for agenda, _ in AGENDAS:
        triage_service._sumar(m, agenda, None, AHORA)

    assert m['agendas'] == len(AGENDAS)
    assert sum(m[c] for c in triage_filas.CONTADOR.values()) == m['agendas']
    # La base del % de asistencia: los cuatro destinos y las ya pasadas sin reportar.
    assert sum(m[c] for c in BASE) == m['agendas'] - m['por_ocurrir'] - m['fuera'] == 10
    assert (m['reagendadas'], m['fuera'], m['sin_reporte'], m['por_ocurrir']) == (2, 3, 1, 1)
    # De los que se presentaron: calificados, no califican, lo piensan y sin calificar suman las asistencias.
    assert m['calificados'] + m['descalificados'] + m['en_seguimiento'] + m['sin_calificar'] == m['asistencias'] == 4


def test_la_lista_de_cada_destino_mide_lo_que_dice_su_contador():
    m = triage_service._vacias()
    for agenda, _ in AGENDAS:
        triage_service._sumar(m, agenda, None, AHORA)
    for destino, contador in triage_filas.CONTADOR.items():
        en_la_lista = [a for a, _ in AGENDAS if triage_filas.destino_de(a, AHORA) == destino]
        assert len(en_la_lista) == m[contador], destino
