"""Las Momentum las organiza team@ (ADR-W127): el evento se crea en un calendario de team@ y se invita al
closer y al alumno. Así la reunión es de team@ y Gemini deja sus notas en el Drive de team@, el que Work lee
(app/services/notas_meet/). Con la cuenta propia del closer (Gmail personal, o una de Workspace sin conectar)
las notas no llegaban: de las 8 Momentum al 09/11/2026, ninguna tenía nota.

Work no tiene un token propio de team@: usa el de cualquier persona de fulfillment que conectó esa cuenta
para sus sesiones (sched_perfiles.datos.academia.cuenta). El calendario («Momentum · closers») se crea una
vez y su id queda en `integrations` (clave CLAVE). Si no hay nadie con team@ conectado, la Momentum se crea
como antes, en el calendario de ventas del closer.

La agenda guarda `agenda_payload.organizador = {cuenta, calendar_id}`: con eso, mover o borrar el evento
usa la cuenta de team@ (`dueno`) y no la del closer, que solo es invitado.
"""
import logging
import os

from app import db

logger = logging.getLogger(__name__)

CLAVE = 'momentum_calendario'
NOMBRE_CALENDARIO = 'Momentum · closers'
ZONA = 'America/La_Paz'


def cuenta():
    return (os.environ.get('MOMENTUM_ORGANIZADOR') or 'team@thelearnation.com').strip().lower()


def _titular():
    """El id de un usuario de Work con team@ conectado y vigente, o None."""
    from app.agendas_v2.modelos import SchedPerfil
    from app.models import GoogleCalendarToken

    for perfil in SchedPerfil.query.all():
        datos = perfil.datos if isinstance(perfil.datos, dict) else {}
        if ((datos.get('academia') or {}).get('cuenta') or '').lower() != cuenta():
            continue
        token = GoogleCalendarToken.query.filter_by(user_id=perfil.user_id).first()
        if token and not token.vencido_en:
            return perfil.user_id
    return None


def cuenta_equipo():
    """(user_id, calendar_id) para crear una Momentum como team@, o None (sin team@ conectado o Google falla)."""
    from app.models import Integration
    from app.services.google_service import GoogleService

    user_id = _titular()
    if not user_id:
        logger.warning(f'[MOMENTUM] Nadie tiene {cuenta()} conectado: la Momentum va al calendario del closer')
        return None
    fila = Integration.query.filter_by(key=CLAVE).first()
    calendar_id = ((fila.payload_config or {}) if fila else {}).get('calendar_id')
    if calendar_id:
        return user_id, calendar_id
    try:
        calendar_id = GoogleService.crear_calendario(user_id, NOMBRE_CALENDARIO, ZONA)
    except Exception as e:  # noqa: BLE001
        logger.error(f'[MOMENTUM] No se pudo crear el calendario de las Momentum en {cuenta()}: {e}')
        return None
    if fila is None:
        fila = Integration(key=CLAVE, name='Calendario de las Momentum (team@)', payload_config={})
        db.session.add(fila)
    fila.payload_config = {'calendar_id': calendar_id, 'cuenta': cuenta()}
    db.session.flush()
    return user_id, calendar_id


def dueno(appt):
    """(user_id, calendar_id) de quien tiene el evento de la agenda: team@ si la organiza, si no su closer."""
    organizador = (appt.agenda_payload or {}).get('organizador') if appt else None
    if organizador and organizador.get('calendar_id'):
        user_id = _titular()
        if user_id:
            return user_id, organizador['calendar_id']
        logger.warning(f'[MOMENTUM] Agenda #{appt.id}: su evento es de {cuenta()} y nadie la tiene conectada')
    return appt.closer_id, appt.calendar_id


def borrar_evento(appt, avisar=False):
    """Borra el evento de la agenda con la cuenta de su dueño."""
    from app.services.google_service import GoogleService

    user_id, calendar_id = dueno(appt)
    return GoogleService.delete_event(user_id, appt.google_event_id, calendar_id, avisar=avisar)
