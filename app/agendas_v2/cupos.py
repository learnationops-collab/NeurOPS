"""Cuántos cupos libres tiene el closer en los próximos días (Configuración › Disponibilidad e Integraciones).
Son los mismos inicios que le ofrece el motor a un lead (slots_persona con su sesión, sus agendas y lo ocupado
en sus calendarios de conflicto de Google), y cuántos tendría con solo su horario: la diferencia es lo que le
sacan sus agendas y su calendario. Con `horario`/`tz` calcula sobre un horario todavía sin guardar."""

from app.agendas_v2 import servicio
from app.agendas_v2.nucleo.catalogos import TZ_DEF
from app.agendas_v2.nucleo.disponibilidad import agenda_opt, dias_del_horizonte, slots_persona
from app.agendas_v2.nucleo.normalizar import normal_horario
from app.agendas_v2.nucleo.tiempo import clave_dia

DIAS = 7


def _estado_google(user_id, ahora):
    """'ok' (se leyó su calendario), 'error' (Google no respondió: no bloquea nada) o 'sin_google'.
    Lee el mismo rango que _ocupacion, así la lectura queda en la caché y no se repite."""
    if not servicio._con_calendar({user_id}):
        return 'sin_google'
    hasta = ahora + servicio.VENTANA_GOOGLE_DIAS * servicio.DIA_MS
    return 'ok' if servicio._franjas_google(user_id, ahora - 3600000, hasta) is not None else 'error'


def cupos_de(user, horario=None, tz=None, fresco=False):
    from app.agendas_v2.a_triage import sesion_de_la_persona

    d = servicio.colecciones()
    p = servicio.persona_de_usuario(d, user)
    if not p:
        return {'en_team': False}
    if isinstance(horario, dict):
        p = {**p, 'horario': normal_horario(horario)}
    if tz and servicio.zona_valida(tz):
        p = {**p, 'tz': tz}
    zona = p.get('tz') or TZ_DEF
    dur, margen = sesion_de_la_persona(d, p)
    ahora = servicio.ahora_ms()
    o = agenda_opt({'reservas': {'modo': 'dias', 'n': DIAS - 1, 'tipo': 'corridos', 'desde': '', 'hasta': ''},
                    'antel': {'n': 1, 'u': 'h'}, 'paso': {'n': 15, 'u': 'min'}}, dur)
    if fresco:
        # Recién cambió sus calendarios de conflicto: se vuelve a leer Google.
        servicio._google_cache.pop(user.id, None)
    google = _estado_google(user.id, ahora)
    ocupado = servicio._ocupacion(ahora, {p['id']: user.id})['ocupado']
    todos = slots_persona(p, dur, o, ahora=ahora, margen=margen)
    libres = set(slots_persona(p, dur, o, ahora=ahora, ocupado=ocupado, margen=margen))
    dias = [{'clave': x['clave'], 'dow': x['dow'], 'total': 0, 'libres': 0} for x in dias_del_horizonte(o, zona, ahora)]
    por_clave = {x['clave']: x for x in dias}
    for t in todos:
        x = por_clave.get(clave_dia(t, zona))
        if x:
            x['total'] += 1
            x['libres'] += t in libres
    return {
        'en_team': True,
        'dias': dias,
        'total': sum(x['total'] for x in dias),
        'libres': sum(x['libres'] for x in dias),
        'duracion': dur,
        'margen': margen,
        'tope_semana': p.get('llamadas_semana') or 0,
        'google': google,
    }
