"""El evento de Google sigue a la agenda cuando Work la cambia en la misma fila (reagenda del Resultado
de triage o del closer, corrección de fecha o de closer, reasignar, Tablero de Agendas).

Antes esos caminos solo cambiaban `start_time`: el evento quedaba a la hora vieja y movidas.py lo leía
como «movido en Google» y devolvía la agenda a esa hora con otra fila (Gerardo Morales, 05/11/2026).

Se llama DESPUÉS del commit: si el guardado falla, Google no se toca. Y nunca rompe al que llama.
"""

import logging
import re
from datetime import datetime, timedelta

from app import db

logger = logging.getLogger(__name__)

# Lo que dejan `_mover_la_llamada` y `PATCH /closer/appointments/<id>` en la bitácora (hora UTC).
_REAGENDA = re.compile(r'reagendó la cita: (\d{2}/\d{2}/\d{4} \d{2}:\d{2}) → (\d{2}/\d{2}/\d{4} \d{2}:\d{2})')
_FORMATO = '%d/%m/%Y %H:%M'
# En el payload: la hora a la que Work dejó el evento al día. Una movida posterior es del closer.
AL_DIA = 'evento_al_dia'


def _vigente(appt):
    from app.agendas_v2.operacion import RESULTADOS_NO_VIGENTES

    return not appt.closer_processed and (appt.result or '') not in RESULTADOS_NO_VIGENTES


def _soltar(appt):
    appt.google_event_id = None
    appt.calendar_evento_id = appt.calendar_id = appt.calendar_vinculo = None


def seguir(appt, dueno_anterior_id=None, ahora=None):
    """Deja el evento de la agenda a su hora y en el calendario de su dueño. `dueno_anterior_id`: quien
    tenía el evento si la agenda cambió de manos. Con el mismo dueño se mueve el evento (Google avisa al
    lead); si no se puede o cambió el dueño, se borra el viejo y se crea otro. Una llamada que ya pasó no
    se toca: no se le manda nada al lead por corregir el registro. Devuelve True si el evento quedó al día."""
    ahora = ahora or datetime.utcnow()
    if not appt or not appt.start_time or not appt.closer_id or not _vigente(appt) or appt.start_time <= ahora:
        return False
    try:
        return _seguir(appt, dueno_anterior_id or appt.closer_id)
    except Exception as e:  # noqa: BLE001  (la agenda ya está guardada: Google no puede romper la respuesta)
        db.session.rollback()
        logger.error(f'[EVENTO] No se pudo poner al día el evento de la agenda #{appt.id}: {e}')
        return False


def _seguir(appt, dueno_evento):
    from app.agendas_v2 import operacion
    from app.agendas_v2.a_triage import _payload_con_lead
    from app.services import avisos_service
    from app.services.google_service import GoogleService

    payload = _payload_con_lead(appt)
    if appt.google_event_id and dueno_evento == appt.closer_id:
        fin = appt.start_time + timedelta(minutes=int(payload.get('duracion_min') or 60))
        try:
            GoogleService.mover_evento(appt.closer_id, appt.google_event_id, appt.start_time, fin,
                                       calendar_id=appt.calendar_id)
            appt.calendar_evento_id, appt.calendar_vinculo = appt.google_event_id, 'propio'
            _al_dia(appt)
            db.session.commit()
            return True
        except Exception as e:  # noqa: BLE001  (sigue con borrar y crear)
            logger.warning(f'[EVENTO] No se pudo mover el evento de la agenda #{appt.id}: {e}')
    if appt.google_event_id:
        con_lead = bool((payload.get('lead') or {}).get('email'))
        if not GoogleService.delete_event(dueno_evento, appt.google_event_id, appt.calendar_id, avisar=con_lead):
            avisos_service.avisar(
                'agenda_sin_evento', *avisos_service.destino(['admin'], [dueno_evento]),
                'Evento viejo sin borrar en Google Calendar',
                f'La agenda de {(payload.get("lead") or {}).get("nombre") or "un lead"} cambió de hora o de dueño, '
                'pero su evento anterior no se pudo borrar de Google Calendar. Borralo a mano para que el lead '
                'no tenga dos invitaciones.',
                'appointment', appt.id, person_uuid=appt.person_uuid,
            )
    # Un evento ajeno (n8n, Calendly) no se toca, pero se suelta: si no, movidas lo seguiría a la hora vieja.
    _soltar(appt)
    appt.agenda_payload = payload
    db.session.commit()
    creado = operacion.crear_evento(appt, payload.get('evento_nombre') or 'Llamada')
    if creado:
        _al_dia(appt)
        db.session.commit()
    return creado


def _al_dia(appt):
    appt.agenda_payload = {**(appt.agenda_payload or {}), AL_DIA: appt.start_time.isoformat() + 'Z'}


def quedo_atras(appt, inicio_evento):
    """¿El evento quedó en la hora de la que Work movió la agenda la última vez, sin que Work lo pusiera al
    día después? Es el evento que no siguió a una reagenda hecha en Work (antes de este arreglo, o si Google
    falló). Si Work ya lo había dejado al día, la movida es del closer y se sigue como siempre."""
    from app.models import LeadEventLog

    if (appt.agenda_payload or {}).get(AL_DIA) == appt.start_time.isoformat() + 'Z':
        return False
    log = (LeadEventLog.query.filter_by(appointment_id=appt.id, action_type='reschedule')
           .order_by(LeadEventLog.id.desc()).first())
    m = _REAGENDA.search(log.description or '') if log else None
    if not m:
        return False
    vieja, nueva = (datetime.strptime(x, _FORMATO) for x in m.groups())
    return abs((nueva - appt.start_time).total_seconds()) < 60 and abs((vieja - inicio_evento).total_seconds()) < 60
