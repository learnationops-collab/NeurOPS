"""Ocupación de los closers a partir de las reservas. Port de reservasDe y opcionesDeOcupacion
(frontend data/almacen.js). Las reservas traen `estado`, `closer_id`, `inicio_ms`, `fin_ms` (fin de la sesión) y
`margen_min` (lo que el closer se reservó después; también bloquea).
"""

from datetime import date, timedelta

from app.agendas_v2.nucleo.disponibilidad import ahora_ms, se_solapa
from app.agendas_v2.nucleo.tiempo import clave_dia, dia_semana


def semana_de(ts, tz):
    """El lunes (AAAA-MM-DD) de la semana de `ts` en la zona `tz`."""
    lunes = date.fromisoformat(clave_dia(ts, tz)) - timedelta(days=(dia_semana(ts, tz) + 6) % 7)
    return lunes.isoformat()


def reservas_de(reservas, persona_id):
    """Reservas vigentes (agendadas, con closer y horario) de una persona."""
    return [
        r
        for r in reservas
        if r.get('estado') == 'agendada' and r.get('closer_id') == persona_id and r.get('inicio_ms') is not None
    ]


def opciones_de_ocupacion(reservas, ahora=None):
    """Lo que necesita asignacion(): si un closer ya tiene algo en ese rato, y cuántas agendas tiene por delante.
    Devuelve {'ahora', 'ocupado', 'carga_de'}, listo para pasar como `opts`."""
    ahora = ahora_ms() if ahora is None else ahora
    por = {}
    for r in reservas:
        if r.get('estado') != 'agendada' or not r.get('closer_id') or r.get('inicio_ms') is None:
            continue
        fin = r.get('fin_ms')
        if fin is not None:
            fin += int(r.get('margen_min') or 0) * 60000
        por.setdefault(r['closer_id'], []).append({'inicio': r['inicio_ms'], 'fin': fin})
    return {
        'ahora': ahora,
        'ocupado': lambda pid, t, dur: se_solapa(por.get(pid, []), t, dur),
        'carga_de': lambda pid: len([x for x in por.get(pid, []) if x['inicio'] >= ahora]),
        # Cuántas agendas tiene en la semana de `t` (para el tope de llamadas por semana).
        'en_semana': lambda pid, t, tz: sum(1 for x in por.get(pid, []) if semana_de(x['inicio'], tz) == semana_de(t, tz)),
    }
