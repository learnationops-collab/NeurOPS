"""La Momentum con un closer bajo el mismo criterio que el link de Thalamus: después de la sesión queda
el margen del closer (el de su Sesión de Aceleración), y para ver si choca se mira que los bloques
(sesión + margen) se pisen, no solo que empiecen a la misma hora. Lo usa app/api/external/agenda.py."""

from app import db
from app.agendas_v2 import servicio
from app.agendas_v2.nucleo.disponibilidad import se_solapa

LEIDO_ANTES_MS = 4 * 3600000  # una agenda que empezó hasta 4 h antes todavía puede ocupar


def margen_de(user):
    """Los minutos que el closer deja libres después de una llamada de closing (0 si no está en Team)."""
    from app.agendas_v2.a_triage import sesion_closing_de

    return int((sesion_closing_de(user) or {}).get('margen_min') or 0)


def ocupado_en_work(user, desde_ms, franjas, libres):
    """[{inicio, fin}] (ms) de sus agendas vigentes en Work, con el margen de cada una. `franjas`: lo leído
    de su Google (o None). `libres`: [(id, inicio, fin)] de las C/D que la Momentum puede tomar (no cuentan)."""
    agendas = servicio._agendas_de_operacion(
        {user.id: user.id}, servicio.ms_a_dt(desde_ms), {user.id: franjas}, leido_desde=desde_ms,
        excluir={i for i, _, _ in libres})
    return [{'inicio': a['inicio_ms'], 'fin': a['fin_ms'] + int(a['margen_min'] or 0) * 60000} for a in agendas]


def choca(user, inicio_ms, fin_ms, libres):
    """Si [inicio, fin) (ms, sesión + margen) se pisa con otra agenda vigente suya en Work, sin contar las
    C/D `libres`: lo mismo que se le ofreció como libre en /horarios. Deja al closer bloqueado hasta el
    próximo commit, para que dos reservas a la vez no tomen el mismo hueco."""
    from app.models import User

    from app.agendas_v2 import desplazar

    desde = inicio_ms - LEIDO_ANTES_MS
    # Google sin caché y antes del bloqueo (leerlo puede hacer commit): un coaching que le pusieron después
    # de que la Academia leyó los horarios también cuenta (cero superposiciones, Estrategia 16/11).
    franjas = servicio._franjas_frescas(user.id, desde, fin_ms)
    db.session.query(User).filter_by(id=user.id).with_for_update().first()
    en_google = [{'inicio': a, 'fin': b} for a, b in desplazar.restar(franjas, libres)] if franjas else []
    return se_solapa(ocupado_en_work(user, desde, franjas, libres) + en_google, inicio_ms, (fin_ms - inicio_ms) // 60000)


def pegadas(u, slots, tz, horario, dur, margen, ocupado, minimo, desde_ms, hasta_ms):
    """Franja fija de las Momentum (revisión del inbox con setters, 17/11; ADR-W183): el día que el closer ya
    tiene una Momentum, a las demás solo se les ofrece el horario pegado a ella (cuando termina con su margen),
    para que no se repartan por el día y le corten las sesiones de closing. Los días sin Momentum, `slots` igual.
    `ocupado`: [{inicio, fin}] (ms) de lo que no se puede pisar; `minimo`: el primer inicio posible (antelación)."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from app.agendas_v2.nucleo.catalogos import a_min
    from app.agendas_v2.nucleo.normalizar import franjas as franjas_del_dia
    from app.models import Appointment

    zona = ZoneInfo(tz)
    dia_de = lambda ms: datetime.fromtimestamp(ms / 1000, zona).date()  # noqa: E731
    previas = Appointment.query.filter(
        Appointment.closer_id == u.id, Appointment.origin == 'Momentum',
        Appointment.start_time >= servicio.ms_a_dt(desde_ms), Appointment.start_time < servicio.ms_a_dt(hasta_ms)).all()
    pegados = {}  # día local → inicios pegados a una Momentum de ese día
    for a in previas:
        if not servicio._vigente(a):
            continue
        t = servicio.dt_a_ms(a.start_time) + servicio._bloque_min(a) * 60000
        pegados.setdefault(dia_de(servicio.dt_a_ms(a.start_time)), set()).add(t)
    if not pegados:
        return slots

    def entra(t):
        local = datetime.fromtimestamp(t / 1000, zona)
        m = local.hour * 60 + local.minute
        en_horario = any(a_min(r[0]) <= m and m + dur <= a_min(r[1]) for r in franjas_del_dia(horario, (local.weekday() + 1) % 7))
        return en_horario and t >= minimo and not se_solapa(ocupado, t, dur + margen)

    libres = [s for s in slots if dia_de(s) not in pegados]
    libres += [t for ts in pegados.values() for t in ts if entra(t)]
    return sorted(set(libres))
