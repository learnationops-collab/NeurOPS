"""Qué pasó con las personas que agendaron en un taller (Talleres › detalle › Agendas).

Parte de las MISMAS agendas que cuenta el embudo del taller (`workshop_metrics_service`: la ventana de
atribución, el corte de citas anteriores a la clase, las repetidas descartadas, una persona = una) y
las reparte entre los estados del libro de agendas del closer (`closer_agendas_service.derivar_estado`),
para que el taller y el libro hablen igual: «Asistió», «No show», «Sin reportar»…

Una persona, un estado: si asistió a alguna de sus citas es «Asistió» (una reprogramación posterior no
lo borra); si no, el de su última cita. El estado de cada cita sale del Appointment del closer cuando
existe (lo que reportó) y, si no, de la hoja de agendas (`FinancialAgenda.estado`). Esto es a propósito
más fino que `breakdown` del embudo, que mete «2da llamada», «Lead perdido» y compañía en «Otros».

No escribe nada: se calcula al abrir el detalle.
"""
from collections import Counter
from datetime import datetime
from types import SimpleNamespace

from app.services import closer_agendas_service as ledger
from app.services.agenda_dedup_descarte import citas_de
from app.services.workshop_metrics_service import (
    ESTADOS_DE_VENTA, _agendas_por_embudo, _agrupar_por_persona, ventana_evento, _tz,
)

# Cómo se agrupan los estados del libro para leer de un vistazo por qué la asistencia sale como sale.
# El orden es el de la lectura: lo bueno, lo malo, lo que falta saber, lo que se movió y lo que aún no ocurre.
GRUPOS = [
    {'key': 'asistieron', 'label': 'Asistieron', 'tono': 'success',
     'estados': ('show_up', 'segunda_llamada'),
     'desc': 'Hicieron la llamada (incluye las que pidieron una 2da).'},
    {'key': 'no_asistieron', 'label': 'No show', 'tono': 'error',
     'estados': ('no_show',),
     'desc': 'Reservaron y no se presentaron.'},
    {'key': 'sin_reporte', 'label': 'Sin reporte', 'tono': 'warning',
     'estados': ('sin_reportar', 'reportada_sin_resultado'),
     'desc': 'La hora ya pasó y nadie dejó qué pasó.'},
    {'key': 'se_cayeron', 'label': 'Se cayeron', 'tono': 'info',
     'estados': ('reagendada', 'cancelada', 'descalificada', 'lead_perdido', 'archivada_sin_reporte'),
     'desc': 'Reprogramaron, cancelaron o el closer las descartó.'},
    {'key': 'por_ocurrir', 'label': 'Por ocurrir', 'tono': 'muted',
     'estados': ('por_confirmar', 'confirmada'),
     'desc': 'La llamada todavía no llegó.'},
]
_GRUPO_DE = {e: g['key'] for g in GRUPOS for e in g['estados']}


def _estado_de_cita(agenda, cita, ahora):
    """El estado del libro de UNA cita. Con Appointment manda lo que reportó el closer; sin él, la
    hoja: una venta cargada ahí (`ESTADOS_DE_VENTA`) quiere decir que la persona sí asistió."""
    if cita is not None:
        return ledger.derivar_estado(cita, ahora)
    hoja = (agenda.estado or '').strip().lower()
    if hoja in ESTADOS_DE_VENTA:
        return 'show_up'
    # Mismas columnas que mira el libro, pero con la hoja como único dato.
    falsa = SimpleNamespace(closer_result=agenda.estado, result=None, start_time=agenda.date, closer_processed=False)
    return ledger.derivar_estado(falsa, ahora)


def _estado_de_persona(agendas, citas, ahora):
    """Un estado por persona: «Asistió» si lo logró alguna vez; si no, el de su última cita."""
    estados = [(a.date, _estado_de_cita(a, citas.get(a.id), ahora)) for a in agendas]
    for _, estado in estados:
        if estado == 'show_up':
            return estado
    return max(estados, key=lambda par: (par[0] is not None, par[0] or datetime.min))[1]


def _contar(personas, citas, ahora):
    conteo = Counter(_estado_de_persona(p, citas, ahora) for p in personas)
    total = len(personas)
    return {
        'total': total,
        'estados': [
            {'key': e['key'], 'label': e['label'], 'color': e['color'], 'desc': e['desc'],
             'grupo': _GRUPO_DE.get(e['key']), 'n': conteo.get(e['key'], 0)}
            for e in ledger.ESTADOS
        ],
        'grupos': [
            {'key': g['key'], 'label': g['label'], 'tono': g['tono'], 'desc': g['desc'],
             'n': sum(conteo.get(e, 0) for e in g['estados'])}
            for g in GRUPOS
        ],
    }


def estados_del_taller(evento, tz_nombre='America/La_Paz', ahora=None):
    """El reparto por estado de las personas que agendaron en la ventana del taller, en total y por
    entrada (clase en vivo / grabación), con la misma ventana y reglas que el embudo."""
    tz = _tz(tz_nombre)
    ahora = ahora or datetime.utcnow()
    desde, hasta, siguiente = ventana_evento(evento.date, tz)
    grupos = _agendas_por_embudo(desde, hasta, tz)

    # Quien está en el vivo y en la grabación cuenta una vez, del lado del vivo (como el embudo).
    vistas = set()
    personas = {
        'vivo': _agrupar_por_persona(grupos['vivo'], vistas),
        'landing': _agrupar_por_persona(grupos['landing'], vistas),
    }
    todas = [a for gente in personas.values() for p in gente for a in p]
    citas = citas_de(todas)

    todos = personas['vivo'] + personas['landing']
    return {
        **_contar(todos, citas, ahora),
        'llamadas': len(todas),
        'por_entrada': {k: _contar(v, citas, ahora) for k, v in personas.items()},
        'ventana': {
            'desde': desde.isoformat(), 'hasta': hasta.isoformat(), 'abierta': siguiente is None,
        },
    }
