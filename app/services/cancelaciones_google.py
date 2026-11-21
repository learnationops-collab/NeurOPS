"""El motivo de las agendas que el closer cancela en su Google Calendar (ADR-W191).

Work detecta el evento cancelado o borrado (`agendas_v2/movidas.py`) y cancela la agenda con una nota automática
(«el closer canceló el evento en su Google Calendar (lo detectó Work)»), que no dice por qué. Acá:

- `pendientes`: las de un closer que siguen con esa nota como único motivo, desde `DESDE`. Se ven en su mazo y en el
  aviso diario de reportes faltantes.
- `registrar`: el closer elige una opción (y suma un detalle). «Lo pidió el lead» y «Ya compró» dejan la agenda
  cancelada con ese motivo; «La pasé a otro closer», «La reagendé por fuera» y «Error mío» la reabren (vuelve a
  pendiente): no fue una cancelación del lead.
- `avisar`: el mensaje de Discord al closer en el momento en que Work la detecta.

Una agenda que se reasignó después de cancelarse (el closer canceló su evento y le pasó el lead a otro) no se pide:
la siguió otra persona.
"""
import logging
import os
from datetime import datetime

from app import db
from app.models import Appointment, LeadEventLog
from app.services import lead_log_service, motivo_estado_service

logger = logging.getLogger(__name__)

SUFIJO = 'en su Google Calendar (lo detectó Work)'
# Las de antes de noviembre no se piden (decisión de Kerwin, 21/11/2026).
DESDE = datetime(2026, 11, 1)

OPCIONES = {
    'lead': 'Lo pidió el lead',
    'compro': 'Ya compró o pagó por otro lado',
    'otro_closer': 'La pasé a otro closer',
    'reagendo': 'La reagendé por fuera',
    'error': 'Error mío, no debía cancelarse',
}
REABREN = {'otro_closer', 'reagendo', 'error'}


class MotivoGoogleInvalido(ValueError):
    """La opción no existe o la agenda ya no espera motivo. El mensaje se muestra tal cual."""


def es_automatica(texto):
    return bool(texto) and SUFIJO in texto


def _ultima_nota_de_motivo(appt_id):
    return (LeadEventLog.query.filter(LeadEventLog.origen == 'appointment', LeadEventLog.origen_id == appt_id,
                                      LeadEventLog.action_type == 'nota')
            .order_by(LeadEventLog.created_at.desc(), LeadEventLog.id.desc()).all())


def _espera_motivo(appt, notas):
    """¿Sigue cancelada con la nota automática como último motivo, sin reasignarse después?"""
    if appt.closer_result != 'Cancelado':
        return None
    automatica = None
    for n in notas:  # de la más nueva a la más vieja
        descripcion = n.description or ''
        if descripcion.startswith('Lead reasignado'):
            return None
        if (n.payload or {}).get('motivo_estado') == motivo_estado_service.CANCELADO:
            if es_automatica((n.payload or {}).get('motivo') or descripcion):
                automatica = n
            break
    return automatica


def pendientes(closer_id=None, desde=DESDE):
    """[{id, cliente, fecha, fuente, cancelada, client_id}] de las agendas que esperan el motivo, de la más nueva a
    la más vieja. Sin `closer_id`, las de todo el equipo."""
    ids = {i for (i,) in db.session.query(LeadEventLog.origen_id).filter(
        LeadEventLog.origen == 'appointment', LeadEventLog.action_type == 'nota',
        LeadEventLog.created_at >= desde, LeadEventLog.description.like(f'%{SUFIJO}%'))}
    if not ids:
        return []
    q = Appointment.query.filter(Appointment.id.in_(ids))
    if closer_id:
        q = q.filter(Appointment.closer_id == closer_id)
    salida = []
    for appt in q.all():
        nota = _espera_motivo(appt, _ultima_nota_de_motivo(appt.id))
        if not nota:
            continue
        cliente = appt.client
        salida.append({
            'id': appt.id,
            'cliente': (cliente.full_name or cliente.email or 'Sin nombre') if cliente else 'Sin cliente',
            'client_id': appt.client_id,
            'fecha': appt.start_time.isoformat() if appt.start_time else None,
            'fuente': appt.origin or 'Sin fuente',
            'cancelada': nota.created_at.isoformat() if nota.created_at else None,
        })
    salida.sort(key=lambda f: f['cancelada'] or '', reverse=True)
    return salida


def registrar(appt, usuario, opcion, detalle=''):
    """Guarda el motivo elegido (sin commit). Devuelve `{'reabierta': bool, 'texto': str}`."""
    if opcion not in OPCIONES:
        raise MotivoGoogleInvalido('Elegí una de las opciones.')
    if not _espera_motivo(appt, _ultima_nota_de_motivo(appt.id)):
        raise MotivoGoogleInvalido('Esta agenda ya no espera el motivo.')
    detalle = ' '.join(str(detalle or '').split())[:motivo_estado_service.MAXIMO]
    texto = f'{OPCIONES[opcion]}: {detalle}' if detalle else OPCIONES[opcion]
    quien = getattr(usuario, 'username', None) or 'el equipo'
    if opcion in REABREN:
        appt.closer_result = 'Pendiente'
        appt.closer_processed = False
        lead_log_service.nota(f'Reabierta por {quien} (la había cancelado en Google): {texto}', usuario, appt=appt,
                              payload={'cancelacion_google': opcion, 'motivo': texto})
        return {'reabierta': True, 'texto': texto}
    motivo_estado_service.registrar(appt, usuario, 'Cancelado', texto)
    return {'reabierta': False, 'texto': texto}


def avisar(appt):
    """Discord: le pide el motivo al closer en #📋-reportes, etiquetado, con el link a su mazo. Nunca lanza."""
    try:
        from app.services.discord_avisos import envio
        from app.services.discord_avisos.reportes_faltantes import CANAL, _mencion

        closer = appt.closer
        if not closer or not envio.configurado(CANAL):
            return False
        cliente = appt.client
        nombre = (cliente.full_name or cliente.email) if cliente else 'un lead'
        cuando = ''
        if appt.start_time:
            # La hora en la zona del closer, como la ve en su mazo.
            import pytz
            from app.services.user_time_service import zona_del_usuario
            cuando = pytz.utc.localize(appt.start_time).astimezone(zona_del_usuario(closer)).strftime('%d/%m %H:%M')
        base = (os.environ.get('FRONTEND_URL') or 'https://work.thelearnation.com').rstrip('/')
        texto = (f'🗓️ {_mencion(closer)} cancelaste en tu Google Calendar la agenda de **{nombre}** ({cuando}). '
                 f'¿Por qué se canceló? Escribilo en tu mazo: {base}/closer/deck?step=confirmations')
        return envio.despachar(CANAL, {'content': texto[:1990], 'allowed_mentions': {'parse': ['users']}},
                               etiqueta='CANCELADA EN GOOGLE')
    except Exception as e:  # noqa: BLE001  (el aviso nunca frena la cancelación)
        logger.error(f'[CANCELADA EN GOOGLE] No se pudo avisar la agenda #{appt.id}: {e}')
        return False
