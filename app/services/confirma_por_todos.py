"""Darian confirma las agendas de todos los closers (reunión del 20/11/2026, ADR-W194).

En Confirmaciones del mazo, cada cuenta ve solo sus agendas (`closer_id`). Darian, además, ve las de todos los
closers que todavía no están confirmadas, de cualquier segmento: al confirmar una de otro closer sale de su tablero
y sigue en el del closer, que la ve pasar de columna y puede confirmarla él como respaldo. Las de otras personas de
triage no entran: son sus sesiones diagnósticas.

Es una persona fija por pedido de Kerwin (sin opción en Equipo): para cambiarla, cambiar `NOMBRES`.
"""
from sqlalchemy import and_, func, or_

from app.models import Appointment
from app.services.setter_assignment_service import normalizar_nombre

# El nombre de usuario, normalizado (sin tildes ni mayúsculas).
NOMBRES = {'dari gonzalez'}


def confirma_por_todos(usuario):
    return bool(usuario and normalizar_nombre(getattr(usuario, 'username', '') or '') in NOMBRES)


def _ids_de_triage():
    from app.models import User
    return [u.id for u in User.query.all() if u.tiene_rol('triage')]


def acotar(query, usuario):
    """El filtro de Confirmaciones de `usuario`: sus agendas y, si confirma por todos, las de los closers sin
    confirmar. Recibe la consulta ya filtrada por fecha y estado."""
    if not confirma_por_todos(usuario):
        return query.filter(Appointment.closer_id == usuario.id)
    sin_confirmar = or_(Appointment.result.is_(None), func.lower(func.trim(Appointment.result)) != 'confirmado')
    triage = [i for i in _ids_de_triage() if i != usuario.id]
    de_otros = and_(Appointment.closer_id.isnot(None), Appointment.closer_id != usuario.id, sin_confirmar,
                    *([Appointment.closer_id.notin_(triage)] if triage else []))
    return query.filter(or_(Appointment.closer_id == usuario.id, de_otros))
