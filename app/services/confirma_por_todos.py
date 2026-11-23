"""El triage confirma todas las agendas de los closers (ADR-W194, extendido a todo el rol en ADR-W200).

En Confirmaciones del mazo, cada cuenta ve solo sus agendas (`closer_id`). Quien tiene el rol triage ve todas las
agendas con closer, confirmadas o no: las confirmadas quedan en su columna «Confirmado», así ve todo lo del día. El
closer las sigue viendo en su tablero y puede confirmarlas él como respaldo.
"""
from app.models import Appointment


def confirma_por_todos(usuario):
    return bool(usuario and usuario.tiene_rol('triage'))


def acotar(query, usuario):
    """El filtro de Confirmaciones de `usuario`: sus agendas o, si es triage, todas las que tienen closer.
    Recibe la consulta ya filtrada por fecha y estado."""
    if not confirma_por_todos(usuario):
        return query.filter(Appointment.closer_id == usuario.id)
    return query.filter(Appointment.closer_id.isnot(None))
