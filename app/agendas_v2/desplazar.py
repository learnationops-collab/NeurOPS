"""Un lead A o B puede tomar el horario de una agenda C o D (docs/pendientes_santi_reunion_26_10.md §1).

El evento de una C/D se crea «Disponible» en el Google del closer (operacion.crear_evento; las viejas,
scripts/cd_disponibles.py): el closer ve qué horarios puede soltar y Google no los cuenta como ocupados.
En Work la C/D sigue ocupando su horario (servicio.sigue_en_google), salvo para un lead A/B: para él, la
que empieza dentro de más de ANTELACION cuenta como libre, y si su evento no está «Disponible» (uno de
Calendly) se descuenta solo si es lo único que ocupa ese rato (un evento propio del closer la sigue
bloqueando). Si el lead la toma, la C/D sigue en pie marcada `desplazada_por_id` y se le avisa al closer
para que la reagende. Un C o D no desplaza a nadie, y una agenda sin segmento no se desplaza.
"""

import time
from datetime import datetime, timedelta, timezone


QUE_DESPLAZAN = ('A', 'B')
DESPLAZABLES = ('C', 'D')
ANTELACION = timedelta(hours=2)
CACHE_S = 120

# {user_id: (vence (monotonic), desde_ms, hasta_ms, eventos)}: lo leído de Google por closer.
_cache = {}


def _ms(dt):
    return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def _dt(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


def desplaza(seg):
    """¿Ese lead (el segmento de nucleo/segmento.py, o None) puede tomar el horario de un C/D?"""
    return bool(seg) and seg.get('segmento') in QUE_DESPLAZAN


def desplazable(appt):
    """¿Un lead A/B puede tomar el horario de esa agenda? Una C/D de un closer, salvo la que pasó el triage
    (ya la aprobaron) y la llamada del propio triage (sus llamadas son C/D por diseño)."""
    from app.models.user import ROLE_TRIAGE

    return (appt.segmento in DESPLAZABLES and not appt.agenda_triage_id
            and not (appt.closer and appt.closer.role == ROLE_TRIAGE))


def _eventos(user_id, desde, hasta):
    from app.services.google_service import GoogleService

    ahora = time.monotonic()
    guardado = _cache.get(user_id)
    if guardado and guardado[0] > ahora and guardado[1] <= desde and guardado[2] >= hasta:
        return guardado[3]
    eventos = GoogleService.eventos_para_traza(user_id, _dt(desde), _dt(hasta))
    if eventos is None:
        return None
    if len(_cache) > 500:
        _cache.clear()
    _cache[user_id] = (ahora + CACHE_S, desde, hasta, eventos)
    return eventos


def _ocupa_solo(appt, eventos, inicio, fin):
    """¿El evento de esa agenda es lo único que ocupa [inicio, fin) en el Google del closer?"""
    propios = {appt.calendar_evento_id, appt.google_event_id} - {None}
    for e in eventos:
        if e['id'] in propios or e['estado'] == 'cancelled' or e['disponible']:
            continue
        if any(i['propio'] and i['respuesta'] == 'declined' for i in e['invitados']):
            continue
        if e['inicio'] is None or e['fin'] is None:
            return False
        if e['inicio'] < fin and inicio < e['fin']:
            return False
    return True


def libres(elegibles, ahora):
    """{user_id: [(appointment_id, inicio, fin)]} (ms) de las agendas C/D que un lead A/B puede tomar,
    de los closers elegibles ({persona_id: user_id}). Un closer cuyo Google no se pudo leer no libera nada."""
    from app.agendas_v2 import operacion
    from app.agendas_v2.servicio import _bloque_min
    from app.models import Appointment

    usuarios = set((elegibles or {}).values())
    if not usuarios:
        return {}
    filas = Appointment.query.filter(
        Appointment.closer_id.in_(list(usuarios)),
        Appointment.segmento.in_(DESPLAZABLES),
        Appointment.desplazada_por_id.is_(None),
        Appointment.start_time >= _dt(ahora) + ANTELACION,
        *operacion.filtro_vigente(),
    ).all()
    por_closer = {}
    for a in filter(desplazable, filas):
        inicio = _ms(a.start_time)
        por_closer.setdefault(a.closer_id, []).append((a, inicio, inicio + _bloque_min(a) * 60000))
    out = {}
    for user_id, citas in por_closer.items():
        eventos = _eventos(user_id, min(c[1] for c in citas), max(c[2] for c in citas))
        if eventos is None:
            continue
        out[user_id] = [(a.id, ini, fin) for a, ini, fin in citas if _ocupa_solo(a, eventos, ini, fin)]
    return out


def restar(franjas, huecos):
    """Las franjas [(inicio, fin)] sin los tramos de `huecos` [(_, inicio, fin)]."""
    out = list(franjas)
    for _, h0, h1 in huecos:
        nuevo = []
        for a, b in out:
            if b <= h0 or h1 <= a:
                nuevo.append((a, b))
                continue
            if a < h0:
                nuevo.append((a, h0))
            if h1 < b:
                nuevo.append((h1, b))
        out = nuevo
    return out


def que_pisa(huecos, inicio, fin):
    """Ids de las agendas libres que se cruzan con [inicio, fin) (ms)."""
    return [i for i, a, b in huecos if a < fin and inicio < b]


def marcar(appt, ids):
    """La agenda `appt` (del lead A/B) tomó el horario de esas agendas C/D: quedan marcadas y el closer y
    los admins reciben un aviso para reagendarlas. No hace commit."""
    from app.models import Appointment
    from app.services import avisos_service, lead_log_service

    for a in Appointment.query.filter(Appointment.id.in_(list(ids))).all():
        a.desplazada_por_id = appt.id
        cuando = a.start_time.strftime('%d/%m/%Y %H:%M')
        nombre = (a.client.full_name if a.client else None) or 'un lead'
        nuevo = (appt.client.full_name if appt.client else None) or 'un lead'
        texto = (f'El horario del {cuando} UTC lo tomó {nuevo} (segmento {appt.segmento or "?"}). '
                 f'Esta agenda (segmento {a.segmento}) sigue en pie: hay que reagendarla.')
        lead_log_service.nota(texto, a.closer_id, appt=a)
        avisos_service.avisar(
            'agenda_desplazada', *avisos_service.destino(['admin'], [a.closer_id]), 'Agenda para reagendar',
            f'La agenda de {nombre} ({a.segmento}) del {cuando} UTC quedó desplazada por {nuevo}: reagendala.',
            'appointment', a.id, person_uuid=a.person_uuid,
        )
