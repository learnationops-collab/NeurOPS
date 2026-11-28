"""Las Momentum no cuentan en el show up ni en el closing (ADR-W276): son otro embudo, el del alumno.

Siguen contando como agenda donde se muestra un conteo simple y siguen en las listas. Se reconocen por
el origen: 'Momentum' (Academia y manual) y 'momentum-sessions' (el link de Agendas 2.0).
"""
import sqlalchemy as sa

from app.models import Appointment


def is_momentum_call(appt):
    return 'momentum' in ((appt.origin if appt is not None else None) or '').lower()


def not_momentum():
    """Filtro SQL de las agendas que no son Momentum."""
    return sa.func.lower(sa.func.coalesce(Appointment.origin, '')).notlike('%momentum%')
