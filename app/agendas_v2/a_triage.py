"""«Pasar a triage»: el closer le manda una agenda futura al triage (plan_segmentos_triage.md §8.4).

Va a la del triage que esté libre a esa hora (su horario de Team, sus agendas y su Google Calendar). Si
están libres las dos, a la que tiene menos agendas por delante. Si no está libre ninguna, igual se le pasa
a la de menos carga: la que la recibe la reagenda (decidido el 26/10).

El evento de Google se mueve: se borra del calendario del closer sin avisarle al lead y se crea en el de la
triage con un Meet nuevo, que le llega al lead como invitación.

La vuelta (triage → closer, «Califica» en triage_service) usa `horarios_closer` para mostrarle a la triage
los huecos del closer, y `sesion_closing_de` para que esa agenda dure una Sesión de Aceleración.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app import db
from app.models import Appointment, User
from app.models.user import ROLE_TRIAGE
from app.services import avisos_service, lead_log_service
from app.agendas_v2 import operacion, servicio
from app.agendas_v2.nucleo.catalogos import TZ_DEF, a_min
from app.agendas_v2.nucleo.datos import buscar, es_triage, sesion_de
from app.agendas_v2.nucleo.disponibilidad import agenda_opt, slots_persona
from app.agendas_v2.nucleo.normalizar import franjas

# El evento de la llamada de closing: la Sesión de Aceleración.
EVENTO_CLOSING = 'sesion-de-aceleracion'


def _en_horario(p, t, dur):
    """¿La sesión [t, t+dur) entra en una franja del horario semanal de la persona, en su zona?"""
    local = datetime.fromtimestamp(t / 1000, ZoneInfo(p.get('tz') or TZ_DEF))
    m = local.hour * 60 + local.minute
    return any(a_min(r[0]) <= m and m + dur <= a_min(r[1]) for r in franjas(p.get('horario'), (local.weekday() + 1) % 7))


def _carga(user_id, ahora):
    return Appointment.query.filter(Appointment.closer_id == user_id, Appointment.start_time >= ahora,
                                    *operacion.filtro_vigente()).count()


def candidatas(appt, ahora=None):
    """[(user, libre)] de las personas del triage con usuario activo y horario, la elegida primero."""
    ahora = ahora or datetime.utcnow()
    d = servicio.colecciones()
    usuarios = servicio._usuarios_de_personas(d)
    personas = {p['id']: p for p in d['personas'] if es_triage(d, p) and p['id'] in usuarios}
    users = {u.id: u for u in User.query.filter(User.id.in_([usuarios[pid] for pid in personas] or [0]),
                                                 User.role == ROLE_TRIAGE).all()}
    personas = {pid: p for pid, p in personas.items() if usuarios[pid] in users}
    if not personas:
        return []
    t, dur = servicio.dt_a_ms(appt.start_time), servicio._bloque_min(appt)
    ocupado = servicio._ocupacion(servicio.dt_a_ms(ahora), {pid: usuarios[pid] for pid in personas})['ocupado']
    filas = [(users[usuarios[pid]], _en_horario(p, t, dur) and not ocupado(pid, t, dur)) for pid, p in personas.items()]
    return sorted(filas, key=lambda f: (not f[1], _carga(f[0].id, ahora), f[0].username))


def sesion_closing(d, p):
    """(duración, margen) de la llamada de closing con ese closer: su Sesión de Aceleración (la del evento,
    o la que él ajustó), no la de la llamada de triage, que suele ser más corta."""
    e = buscar(d, 'eventos', EVENTO_CLOSING) or {}
    return sesion_de(p, EVENTO_CLOSING, e.get('duracion') or servicio.DURACION_AGENDA_OPERACION_MIN, e.get('margen') or 0)


def sesion_closing_de(user):
    """{'duracion_min', 'margen_min'} para el payload de la agenda de closing, o None si no está en Team."""
    d = servicio.colecciones()
    p = servicio.persona_de_usuario(d, user)
    if not p:
        return None
    dur, margen = sesion_closing(d, p)
    return {'duracion_min': int(dur), 'margen_min': int(margen or 0)}


def horarios_closer(closer_id, dias=7, ahora=None):
    """Inicios libres (ISO UTC) del closer en los próximos `dias` para la llamada de closing que le agenda
    el triage: su horario de Team, sus agendas y su Google, como la página pública. [] si no está en Team."""
    ahora = ahora or datetime.utcnow()
    user = db.session.get(User, int(closer_id)) if closer_id else None
    d = servicio.colecciones()
    p = servicio.persona_de_usuario(d, user) if user else None
    if not p:
        return []
    dur, margen = sesion_closing(d, p)
    o = agenda_opt({'reservas': {'modo': 'dias', 'n': dias, 'tipo': 'corridos', 'desde': '', 'hasta': ''},
                    'antel': {'n': 1, 'u': 'h'}, 'paso': {'n': 15, 'u': 'min'}}, dur)
    ahora_ms = servicio.dt_a_ms(ahora)
    ocupado = servicio._ocupacion(ahora_ms, {p['id']: user.id})['ocupado']
    slots = slots_persona(p, dur, o, ahora=ahora_ms, ocupado=ocupado, margen=margen)
    return [servicio.ms_a_dt(t).isoformat() + 'Z' for t in slots]


def _validar(appt, ahora):
    if appt.closer and appt.closer.role == ROLE_TRIAGE:
        raise ValueError('Esta agenda ya es del triage.')
    if not servicio._vigente(appt):
        raise ValueError('La agenda ya no está vigente.')
    if not appt.start_time or appt.start_time <= ahora:
        raise ValueError('Solo se pasa al triage una agenda que todavía no empezó.')


def _payload_con_lead(appt):
    """El evento invita al lead del payload. Las agendas que no son de Agendas 2.0 no lo traen: va el cliente."""
    payload = dict(appt.agenda_payload or {})
    if not (payload.get('lead') or {}).get('email') and appt.client:
        payload['lead'] = {**(payload.get('lead') or {}), 'nombre': appt.client.full_name, 'email': appt.client.email}
    return payload


def pasar(appt, usuario, ahora=None):
    """Le pasa la agenda a la triage elegida y mueve su evento de Google. Devuelve lo que muestra la ficha."""
    from app.services.booking_service import BookingService
    from app.services.google_service import GoogleService

    ahora = ahora or datetime.utcnow()
    _validar(appt, ahora)
    filas = candidatas(appt, ahora)
    if not filas:
        raise ValueError('No hay nadie del triage con su cuenta activa en Team.')
    triage, libre = filas[0]

    anterior = appt.closer.username if appt.closer else 'sin asignar'
    viejo = (appt.closer_id, appt.google_event_id, appt.calendar_id) if appt.google_event_id else None
    appt.closer_id = triage.id
    appt.google_event_id = None
    appt.agenda_payload = _payload_con_lead(appt)
    reagendar = '' if libre else ' No tenía ese horario libre: hay que reagendarla.'
    lead_log_service.nota(f'Pasada al triage: de {anterior} a {triage.username} (por {usuario.username}).{reagendar}',
                          usuario, appt=appt)
    nombre = (appt.client.full_name if appt.client else None) or 'un lead'
    avisos_service.avisar('agenda_nueva', 'user', triage.id, f'Agenda del triage: {nombre}',
                          f'{anterior} te pasó la agenda de {nombre} del {appt.start_time.strftime("%d/%m/%Y %H:%M")} UTC.'
                          + reagendar, 'appointment', appt.id, person_uuid=appt.person_uuid)
    db.session.commit()
    BookingService.sync_appointment_to_financial_agenda(appt)
    db.session.commit()

    if viejo:
        GoogleService.delete_event(*viejo)
    servicio._google_cache.pop(viejo[0] if viejo else None, None)
    servicio._google_cache.pop(triage.id, None)
    con_evento = operacion.crear_evento(appt, appt.agenda_payload.get('evento_nombre') or 'Llamada')
    return {'id': appt.id, 'closer_id': triage.id, 'closer_name': triage.username, 'libre': libre,
            'con_evento': con_evento}
