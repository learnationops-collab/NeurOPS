"""Trae al día las notas de Gemini del Drive de team@ y las cuelga de su agenda y de su persona.

Corre cada MINUTOS desde el scheduler (app/services/reminder_scheduler.py) y a mano desde la configuración.
Lee los Docs modificados desde la última vuelta (menos MARGEN: Gemini sigue editando el Doc un rato
después de la reunión); la primera vez, o con `completa`, todos. Un Doc que no cambió no se vuelve a bajar.
"""
import logging
from datetime import datetime, timedelta

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy import func, or_

from app import db
from app.models import Appointment, Client, MeetingNote, User
from app.services.notas_meet import conexion, parseo

logger = logging.getLogger(__name__)

MINUTOS = 15
MARGEN = timedelta(hours=2)
# A qué distancia de la hora de la reunión se acepta una agenda del invitado cuando el Doc no trae evento.
VENTANA_INVITADO = timedelta(hours=3)
REVINCULAR_DIAS = 14
DOMINIOS_PROPIOS = ('@thelearnation.com', '@neurocogniciones.com')
_CONSULTA = ("(name contains 'Notas de Gemini' or name contains 'Notes by Gemini') "
             "and mimeType = 'application/vnd.google-apps.document' and trashed = false")


def _iso(dt):
    return dt.replace(microsecond=0).isoformat() + 'Z'


def _fecha_drive(texto):
    return datetime.fromisoformat(texto.replace('Z', '+00:00')).replace(tzinfo=None)


def _listar(drive, desde):
    consulta = _CONSULTA + (f" and modifiedTime > '{_iso(desde)}'" if desde else '')
    pagina = None
    while True:
        r = drive.files().list(q=consulta, fields='nextPageToken, files(id, name, modifiedTime)',
                               orderBy='modifiedTime', pageSize=100, pageToken=pagina).execute()
        yield from r.get('files', [])
        pagina = r.get('nextPageToken')
        if not pagina:
            return


def _exportar(drive, file_id):
    try:
        datos = drive.files().export(fileId=file_id, mimeType='text/markdown').execute()
    except HttpError as e:
        if e.resp.status != 400:
            raise
        datos = drive.files().export(fileId=file_id, mimeType='text/plain').execute()
    return datos.decode('utf-8') if isinstance(datos, bytes) else datos


def _emails_del_equipo():
    return {e.lower() for (e,) in db.session.query(User.email).filter(User.email.isnot(None))}


def _agenda(nota):
    """(agenda, cómo) de la nota: por el evento de Calendar o por un invitado a la misma hora."""
    if nota.calendar_event_id:
        appt = (Appointment.query
                .filter(or_(Appointment.calendar_evento_id == nota.calendar_event_id,
                            Appointment.google_event_id == nota.calendar_event_id))
                .order_by(Appointment.id.desc()).first())
        if appt:
            return appt, 'evento'
    if nota.meeting_at and nota.guests:
        candidatas = (Appointment.query.join(Client, Appointment.client_id == Client.id)
                      .filter(func.lower(Client.email).in_(nota.guests),
                              Appointment.start_time.between(nota.meeting_at - VENTANA_INVITADO,
                                                             nota.meeting_at + VENTANA_INVITADO))
                      .all())
        if candidatas:
            return min(candidatas, key=lambda a: abs(a.start_time - nota.meeting_at)), 'invitado'
    return None, None


def _vincular(nota):
    if not nota.appointment_id:
        appt, como = _agenda(nota)
        if appt:
            nota.appointment_id, nota.link_method = appt.id, como
            nota.person_uuid = appt.person_uuid or (appt.client.person_uuid if appt.client else None)
    if not nota.person_uuid and nota.guests:
        cliente = Client.query.filter(func.lower(Client.email).in_(nota.guests),
                                      Client.person_uuid.isnot(None)).first()
        if cliente:
            nota.person_uuid = cliente.person_uuid


def _guardar(archivo, texto, equipo):
    nota = MeetingNote.query.filter_by(drive_file_id=archivo['id']).first()
    if nota is None:
        nota = MeetingNote(drive_file_id=archivo['id'])
        db.session.add(nota)
    t = parseo.titulo(archivo['name'])
    nota.title = (t['asunto'] or archivo['name'])[:500]
    nota.kind, nota.meeting_at = t['kind'], t['meeting_at']
    nota.calendar_event_id, nota.calendar_ref = parseo.evento(texto)
    nota.guests = [e for e in parseo.invitados(texto, DOMINIOS_PROPIOS) if e not in equipo]
    nota.recording_url = parseo.grabacion(texto)
    nota.summary = parseo.resumen(texto)
    nota.content = parseo.contenido(texto)
    nota.drive_modified_at = _fecha_drive(archivo['modifiedTime'])
    _vincular(nota)
    return nota


def sincronizar(completa=False):
    """{leidas, guardadas, errores} o None si team@ no está conectada."""
    creds = conexion.credenciales()
    if not creds:
        return None
    inicio = datetime.utcnow()
    ultima = conexion.estado().get('ultima_lectura')
    desde = None if completa or not ultima else _fecha_drive(ultima) - MARGEN
    drive = build('drive', 'v3', credentials=creds, cache_discovery=False)
    equipo = _emails_del_equipo()
    leidas = guardadas = errores = 0
    try:
        for archivo in _listar(drive, desde):
            leidas += 1
            previa = MeetingNote.query.filter_by(drive_file_id=archivo['id']).first()
            if previa and previa.drive_modified_at and previa.drive_modified_at >= _fecha_drive(archivo['modifiedTime']):
                continue
            try:
                _guardar(archivo, _exportar(drive, archivo['id']), equipo)
                db.session.commit()
                guardadas += 1
            except Exception as e:  # noqa: BLE001  (un Doc roto no frena al resto)
                db.session.rollback()
                errores += 1
                logger.error(f"[NOTAS_MEET] No se pudo guardar el Doc {archivo['id']}: {e}")
    except HttpError as e:
        logger.error(f'[NOTAS_MEET] Google rechazó la lectura del Drive: {e}')
        conexion.anotar_error(str(e))
        raise
    conexion.marcar_lectura(inicio)
    vinculadas = revincular()
    return {'leidas': leidas, 'guardadas': guardadas, 'errores': errores, 'revinculadas': vinculadas}


def revincular(dias=REVINCULAR_DIAS):
    """Vuelve a buscar agenda y persona para las notas recientes que quedaron sueltas (p. ej. la agenda se
    cargó después de la reunión). Las internas quedan sueltas siempre: por eso solo las de `dias`."""
    n = 0
    desde = datetime.utcnow() - timedelta(days=dias)
    for nota in MeetingNote.query.filter(MeetingNote.meeting_at >= desde,
                                         or_(MeetingNote.appointment_id.is_(None),
                                             MeetingNote.person_uuid.is_(None))).all():
        antes = (nota.appointment_id, nota.person_uuid)
        _vincular(nota)
        n += antes != (nota.appointment_id, nota.person_uuid)
    db.session.commit()
    return n
