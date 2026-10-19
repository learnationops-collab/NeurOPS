"""Las agendas que crea el equipo desde NeurOPS (Nueva agenda del closer, otra llamada desde la ficha,
reprogramar y 2da llamada) siguen el mismo camino que una reserva de Thalamus (operacion.py):

  - `agenda_payload` con la marca `manual` (quién y desde dónde), el lead, la duración y el grupo;
  - el evento en el Google Calendar del closer con Meet e invitación al lead;
  - los avisos a Discord y al WhatsApp del closer;
  - un lead con una agenda futura abierta no suma otra sin que se decida: se reprograma esa o se
    crea una adicional (`decision`), como le pregunta Thalamus al lead.

La hora es libre (decisión del 17/10/2026): no hace falta que caiga en la disponibilidad de Thalamus.
Solo se frena si choca con otra agenda vigente del closer o con su Google Calendar.

Una agenda nueva lleva un payload sin `version` ni `respuestas`: no es un formulario, así que la ficha
sigue mostrando el último formulario del cliente (formulario_lead.form_data_de). Una reprogramación
es la misma sesión en otra fecha: conserva el payload que tenía (formulario y evento incluidos).

El tracking de NeurOPS NO cambia: reprogramar y 2da llamada siguen siendo dos filas (la vieja cerrada
como 'Reagendado' o '2da call', la nueva con `is_rescheduled` o result '2TH Call'), porque de ahí
salen el embudo del closer, la cartera y el roadmap. Lo que suma este camino es el evento, el payload
y los avisos. El link de Thalamus, en cambio, mueve la misma fila cuando el lead reprograma solo.
"""

from datetime import datetime, timedelta

from app import db
from app.agendas_v2 import avisos_discord, operacion, servicio

DURACION_MIN = servicio.DURACION_AGENDA_OPERACION_MIN
# Lo que una llamada nueva hereda de la agenda de la que sale (otra llamada, 2da llamada).
HEREDADOS = ('evento_nombre', 'indicaciones', 'duracion_min', 'margen_min', 'prioridad_nombre')
# Lo que una reprogramación le actualiza al payload que ya tenía.
ACTUALIZADOS = ('manual', 'closer_id', 'closer_user_id', 'lead')


class AgendaManualError(Exception):
    """`codigo`: 'ocupado' (choca con otra agenda o con su Google Calendar) o 'ya_tiene' (el lead tiene
    una agenda futura abierta y falta decidir). `datos`: lo que necesita la pantalla para explicarlo."""

    def __init__(self, codigo, mensaje, datos=None):
        super().__init__(mensaje)
        self.codigo, self.mensaje, self.datos = codigo, mensaje, datos or {}


def _persona_de(user):
    """El id de Team (Thalamus) del closer, para que la agenda se vea en su columna."""
    email = (user.email or '').lower()
    if not email:
        return None
    return next((p['id'] for p in servicio.colecciones().get('personas', []) if p.get('email') == email), None)


def armar_payload(cliente, closer, usuario, via, anterior=None, fuente=None):
    """El payload de una llamada nueva. `anterior`: la agenda de la que sale (otra llamada, 2da
    llamada): de ahí se heredan el evento, la duración, el grupo, la fuente y el setter."""
    base = (anterior.agenda_payload or {}) if anterior is not None else {}
    payload = {k: base[k] for k in HEREDADOS if base.get(k) is not None}
    payload.setdefault('evento_nombre', 'Llamada')
    payload.setdefault('duracion_min', DURACION_MIN)
    payload.setdefault('prioridad_nombre', cliente.grupo or None)
    lead_previo = base.get('lead') or {}
    return {
        **payload,
        'manual': {'por': usuario.id if usuario else None, 'via': via},
        'origen': fuente or (anterior.origin if anterior is not None else '') or '',
        'closer_id': _persona_de(closer),
        'closer_user_id': closer.id,
        'setter_user_id': anterior.setter_id if anterior is not None else None,
        'lead': {
            'nombre': cliente.full_name or lead_previo.get('nombre') or '',
            'telefono': cliente.phone or lead_previo.get('telefono') or '',
            'email': (cliente.email or lead_previo.get('email') or '').lower(),
            'instagram': (cliente.instagram or lead_previo.get('instagram') or '').lstrip('@'),
            **({'tz': lead_previo['tz']} if lead_previo.get('tz') else {}),
            **({'pais': lead_previo['pais']} if lead_previo.get('pais') else {}),
        },
    }


def payload_reprogramada(appt, closer, usuario, via='reprogramar'):
    """La misma sesión en otra fecha: el payload que tenía, con el closer, el lead y la marca al día."""
    nuevo = armar_payload(appt.client, closer, usuario, via, anterior=appt)
    payload = {**(appt.agenda_payload or {}), **{k: nuevo[k] for k in ACTUALIZADOS}}
    payload.setdefault('duracion_min', DURACION_MIN)
    payload.setdefault('evento_nombre', nuevo['evento_nombre'])
    payload.setdefault('origen', nuevo['origen'])
    return payload


def _ventana(inicio, payload):
    ini = servicio.dt_a_ms(inicio)
    bloque = int(payload.get('duracion_min') or DURACION_MIN) + int(payload.get('margen_min') or 0)
    return ini, ini + bloque * 60000


def _sin_la_propia(franjas, propia):
    """Lo ocupado en Google sin el evento de la agenda que se está moviendo (todavía no se borró)."""
    if not franjas or propia is None or not propia.google_event_id:
        return franjas
    ini, fin = _ventana(propia.start_time, propia.agenda_payload or {})
    return [(a, b) for a, b in franjas if not (a == ini and b in (fin, ini + DURACION_MIN * 60000))]


def _error_ocupado(inicio):
    return AgendaManualError(
        'ocupado',
        f'El closer ya tiene algo a esa hora ({inicio.strftime("%d/%m/%Y %H:%M")} UTC) en NeurOPS o en su '
        'Google Calendar: elegí otro horario.',
    )


def verificar_horario(closer_id, inicio, payload, propia=None):
    """Lanza AgendaManualError('ocupado') si [inicio, fin) choca con otra agenda vigente del closer o con
    su Google Calendar. `propia`: la agenda que se mueve (no choca consigo misma). Deja al closer
    bloqueado hasta el próximo commit. Devuelve los ids de las agendas que se cruzan pero ya no están en
    su Google Calendar (no frenan). Llamar ANTES de cambiar nada: leer Google puede hacer commit."""
    from app.models import Appointment

    ini, fin = _ventana(inicio, payload)
    # Google primero, sin bloqueo: renovar el token hace commit y soltaría el bloqueo.
    franjas = _sin_la_propia(servicio._franjas_frescas(closer_id, ini, fin), propia)
    _, choca, fuera_de_google = servicio._bloquear_y_verificar(closer_id, ini, fin, franjas)
    if choca and propia is not None:
        # La que se mueve todavía figura vigente: choca solo si hay OTRA (o algo en Google).
        otras = Appointment.query.filter(
            Appointment.closer_id == closer_id,
            Appointment.id != propia.id,
            Appointment.id.notin_(fuera_de_google or [0]),
            Appointment.start_time < servicio.ms_a_dt(fin),
            Appointment.start_time >= inicio - timedelta(hours=4),
            *operacion.filtro_vigente(),
        ).all()
        en_google = bool(franjas) and any(a < fin and ini < b for a, b in franjas)
        choca = en_google or any(
            servicio.dt_a_ms(a.start_time) + servicio._bloque_min(a) * 60000 > ini for a in otras)
    if choca:
        db.session.rollback()
        raise _error_ocupado(inicio)
    return [i for i in fuera_de_google if propia is None or i != propia.id]


def agendar(cliente, closer, inicio, usuario, via, fuente=None, decision=None, anterior=None, ahora=None):
    """Crea la agenda de `cliente` con `closer` a las `inicio` (UTC sin zona), y después crea el evento
    con Meet y avisa. Con `decision == 'reprogramar'` reagenda la que ya tenía, con su closer (ver
    _reprogramar_en_neurops). Hace commit.
    Devuelve (appointment, con_evento). Lanza AgendaManualError."""
    ahora = ahora or datetime.utcnow()
    previa = operacion.proxima_de(cliente.id, ahora)
    if previa and decision not in ('reprogramar', 'adicional'):
        db.session.rollback()
        raise AgendaManualError(
            'ya_tiene',
            f'{cliente.full_name or "Este lead"} ya tiene una agenda el '
            f'{previa.start_time.strftime("%d/%m/%Y %H:%M")} UTC: elegí si la reprogramás o creás una adicional.',
            {'agenda_id': previa.id, 'inicio': previa.start_time.isoformat() + 'Z',
             'closer': previa.closer.username if previa.closer else None},
        )

    if decision == 'reprogramar':
        return _reprogramar_en_neurops(previa, inicio, usuario)

    payload = armar_payload(cliente, closer, usuario, via, anterior=anterior, fuente=fuente)
    if usuario is not None and usuario.role == 'setter':
        payload['setter_user_id'] = usuario.id

    ignorar = verificar_horario(closer.id, inicio, payload)
    appt, _ = operacion.registrar_agenda(
        payload, closer, None, inicio, ahora=ahora, decision='adicional' if previa else None, ignorar_ids=ignorar,
        cliente=cliente, fuente=payload.get('origen') or None, setter_id=payload.get('setter_user_id'),
    )
    if not appt:
        raise _error_ocupado(inicio)
    servicio._subir_version()
    db.session.commit()
    return appt, terminar(appt)


def _reprogramar_en_neurops(previa, inicio, usuario):
    """Reprogramar desde NeurOPS es «Reagendado» del mazo (CloserService.process_agenda), no mover la
    fila como hace el link de Thalamus: la vieja queda cerrada como 'Reagendado' y la nueva nace con
    `is_rescheduled`. De esas dos filas salen el embudo del closer (agendas y reagendas), el estado de
    la cartera, la cola «reagendar» y el comentario del roadmap. Sigue con el closer de esa agenda.
    Devuelve (agenda nueva, con_evento)."""
    from app.models import Appointment
    from app.services.closer_service import CloserService

    quien = usuario.username if usuario else 'el equipo'
    CloserService.process_agenda(
        usuario.id if usuario else None, previa.id,
        {'status': 'Reagendado', 'reschedule_date': inicio.isoformat(), 'role': 'closer',
         'note': f'reprogramada desde «Nueva agenda» por {quien}'},
        is_admin=bool(usuario and usuario.role == 'admin'),
    )
    nueva = (Appointment.query
             .filter(Appointment.client_id == previa.client_id, Appointment.start_time == inicio,
                     Appointment.is_rescheduled.is_(True), Appointment.id != previa.id)
             .order_by(Appointment.id.desc()).first())
    if not nueva:
        raise _error_ocupado(inicio)
    return nueva, bool(nueva.google_event_id)


def terminar(appt, evento_a_borrar=None):
    """Lo que va después de guardar: evento con Meet e invitación, y los avisos. Nunca rompe la agenda.
    Devuelve True si el evento de Calendar quedó creado."""
    servicio._google_cache.pop(appt.closer_id, None)
    con_evento = operacion.crear_evento(
        appt, (appt.agenda_payload or {}).get('evento_nombre') or 'Llamada', evento_a_borrar=evento_a_borrar)
    avisos_discord.avisar_agenda(appt)
    operacion.avisar_whatsapp(appt)
    return con_evento
