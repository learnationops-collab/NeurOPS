"""Las notas de Meet que no cuelgan de ninguna agenda, repartidas en grupales, con alumnos y otras
(Operaciones › Reuniones, app/api/notas_meet.py). Las de una agenda de venta se ven en la ficha."""
from sqlalchemy import String, cast, func, or_

from app import db
from app.models import MeetingNote

GRUPOS = ('grupales', 'alumnos', 'otras')
POR_PAGINA = 50


def _fecha():
    # Algunas notas no traen la hora en el título: se ordenan por cuándo se escribió el Doc.
    return func.coalesce(MeetingNote.meeting_at, MeetingNote.drive_modified_at, MeetingNote.created_at)


def _del_grupo(consulta, grupo):
    if grupo == 'grupales':
        return consulta.filter(MeetingNote.category == 'team')
    if grupo == 'alumnos':
        return consulta.filter(MeetingNote.category == 'student')
    return consulta.filter(or_(MeetingNote.category.is_(None), MeetingNote.category.notin_(('team', 'student'))))


def _base():
    return MeetingNote.query.filter(MeetingNote.appointment_id.is_(None))


def cuentas():
    return {g: _del_grupo(_base(), g).count() for g in GRUPOS}


def series_del_grupo(grupo):
    filas = (_del_grupo(db.session.query(MeetingNote.series, func.count()), grupo)
             .filter(MeetingNote.appointment_id.is_(None), MeetingNote.series.isnot(None))
             .group_by(MeetingNote.series).order_by(func.count().desc(), MeetingNote.series).all())
    return [{'serie': s, 'notas': n} for s, n in filas]


def fila(nota):
    """Lo que dibuja la lista: sin el resumen ni el Doc entero."""
    fecha = nota.meeting_at or nota.drive_modified_at or nota.created_at
    return {
        'id': nota.id, 'title': nota.title, 'kind': nota.kind, 'series': nota.series, 'category': nota.category,
        'fecha': fecha.isoformat() + 'Z' if fecha else None, 'fecha_del_doc': nota.meeting_at is None,
        'invitados': len(nota.guests or []), 'grabacion': bool(nota.recording_url),
    }


def listar(grupo, q=None, serie=None, offset=0):
    if grupo not in GRUPOS:
        raise ValueError(f'grupo desconocido: {grupo}')
    consulta = _del_grupo(_base(), grupo)
    if serie:
        consulta = consulta.filter(MeetingNote.series == serie)
    if q:
        patron = f'%{q.strip()}%'
        consulta = consulta.filter(or_(MeetingNote.title.ilike(patron), cast(MeetingNote.guests, String).ilike(patron)))
    total = consulta.count()
    notas = consulta.order_by(_fecha().desc(), MeetingNote.id.desc()).offset(offset).limit(POR_PAGINA).all()
    return {'total': total, 'notas': [fila(n) for n in notas]}


def detalle(nota):
    datos = nota.to_dict(con_contenido=True)
    datos.update(fila(nota))
    return datos
