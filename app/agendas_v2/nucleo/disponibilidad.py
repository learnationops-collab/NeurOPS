"""Horarios libres de una persona según su horario semanal y las reglas de agenda del evento.
Port de core/disponibilidad.js. Los instantes son milisegundos UTC, igual que en el frontend.
"""

import math
import time
from datetime import date, timedelta

from app.agendas_v2.nucleo.catalogos import MS_U, TZ_DEF, a_min
from app.agendas_v2.nucleo.normalizar import franjas, normal_horario
from app.agendas_v2.nucleo.tiempo import clave_dia, zoned_to_utc

MAX_DIAS = 120

AG_DEF = {
    'reservas': {'modo': 'dias', 'n': 30, 'tipo': 'corridos', 'desde': '', 'hasta': ''},
    'antel': {'n': 4, 'u': 'h'},
}


def ahora_ms():
    return int(time.time() * 1000)


def agenda_opt(ag, dur):
    """Reglas del evento en minutos y milisegundos: hasta cuándo, antelación mínima e intervalo entre inicios."""
    ag = ag or {**AG_DEF, 'paso': {'n': 30 if dur <= 30 else 60, 'u': 'min'}}
    r = ag['reservas']
    u = ag['antel'].get('u')
    return {
        'paso': max(5, ag['paso']['n'] * (60 if ag['paso'].get('u') == 'h' else 1)),
        'ant': ag['antel']['n'] * MS_U[u] if isinstance(u, str) and u in MS_U else math.nan,
        'modo': r.get('modo'),
        'n': r.get('n'),
        'tipo': r.get('tipo'),
        'desde': r.get('desde') or '',
        'hasta': r.get('hasta') or '',
    }


def dias_del_horizonte(o, tz, ahora):
    """Días (claves YYYY-MM-DD en la zona `tz`) en los que el evento ofrece horarios, desde hoy.
    "Días hábiles" cuenta y ofrece solo de lunes a viernes. `m` del resultado empieza en 0, como en JS."""
    hoy = date.fromisoformat(clave_dia(ahora, tz))
    if o['modo'] == 'siempre':
        tope = MAX_DIAS
    elif o['modo'] == 'rango':
        tope = 400
    else:
        tope = o['n'] * 2 + 6 if o['tipo'] == 'habiles' else o['n'] + 1
    out, habiles = [], 0
    for i in range(min(tope, 400)):
        if len(out) >= MAX_DIAS:
            break
        b = hoy + timedelta(days=i)
        dow, clave = (b.weekday() + 1) % 7, b.isoformat()
        if o['modo'] == 'dias' and o['tipo'] == 'habiles':
            if dow in (0, 6):
                continue
            if i > 0:
                habiles += 1
            if habiles > o['n']:
                break
        if o['modo'] == 'rango':
            if o['desde'] and clave < o['desde']:
                continue
            if o['hasta'] and clave > o['hasta']:
                break
        out.append({'y': b.year, 'm': b.month - 1, 'd': b.day, 'dow': dow, 'clave': clave})
    return out


def slots_persona(p, dur, o=None, ahora=None, ocupado=None):
    """Inicios libres (ms UTC, ordenados) de la persona `p` para un evento de `dur` minutos.
    `ocupado(persona_id, inicio, dur)` dice si ya tiene algo en ese rato (reservas, Google Calendar)."""
    o = o or agenda_opt(None, dur)
    ahora = ahora_ms() if ahora is None else ahora
    ocupado = ocupado or (lambda pid, t, dur: False)
    tz = p.get('tz') or TZ_DEF
    minimo = ahora + o['ant']
    out = []
    for dia in dias_del_horizonte(o, tz, ahora):
        for r in franjas(p.get('horario'), dia['dow']):
            m = a_min(r[0])
            while m + dur <= a_min(r[1]):
                t = zoned_to_utc(dia['y'], dia['m'], dia['d'], m // 60, m % 60, tz)
                if t >= minimo and not ocupado(p.get('id'), t, dur):
                    out.append(t)
                m += o['paso']
    return sorted(out)


# Horario genérico, solo para probar un evento cuando todavía no hay closers con horario.
GENERICA = {
    'id': '',
    'tz': TZ_DEF,
    'horario': normal_horario(
        {
            1: [['09:00', '19:00']],
            2: [['09:00', '19:00']],
            3: [['09:00', '19:00']],
            4: [['09:00', '19:00']],
            5: [['09:00', '19:00']],
            6: [['09:00', '13:00']],
        }
    ),
}


def se_solapa(reservas, t, dur):
    """¿Se pisa [t, t+dur) con alguna reserva de la lista? Las reservas traen {inicio, fin} en ms."""
    fin = t + dur * 60000
    # Sin `fin` (null en JS) la comparación da falso, como allá.
    return any(
        r.get('inicio') is not None and r.get('fin') is not None and r['inicio'] < fin and t < r['fin']
        for r in reservas
    )
