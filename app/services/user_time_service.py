"""El "hoy" de cada usuario, no el del servidor.

Todos los `created_at` / `start_time` se guardan en UTC naive, pero el servidor
corre en UTC y el equipo trabaja en UTC-3/-4. Calcular el rango del dia con
`date.today()` + `datetime.combine` mezcla las dos cosas: a las 20:00 de Caracas
ya es el dia siguiente en UTC, asi que "hoy" pasaba a ser una ventana de una
hora y las bandejas se vaciaban solas cada noche.

`User.timezone` la sincroniza el login desde el navegador (ver `auth.py`), con
'America/La_Paz' como respaldo para quien nunca entro.
"""
from datetime import datetime, time as time_cls

import pytz

ZONA_POR_DEFECTO = 'America/La_Paz'


def zona_del_usuario(user):
    try:
        return pytz.timezone(getattr(user, 'timezone', None) or ZONA_POR_DEFECTO)
    except Exception:
        return pytz.timezone(ZONA_POR_DEFECTO)


def hoy_del_usuario(user):
    """Fecha calendario en la zona del usuario, no la del servidor."""
    return datetime.now(zona_del_usuario(user)).date()


def limites_dia_utc(user, dia):
    """El dia calendario `dia` del usuario, como rango UTC naive comparable
    contra las columnas de la base."""
    tz = zona_del_usuario(user)
    inicio = tz.localize(datetime.combine(dia, time_cls.min)).astimezone(pytz.UTC).replace(tzinfo=None)
    fin = tz.localize(datetime.combine(dia, time_cls.max)).astimezone(pytz.UTC).replace(tzinfo=None)
    return inicio, fin


def limites_rango_utc(user, dia_inicio, dia_fin):
    """Igual que `limites_dia_utc` pero para un rango de dias completo."""
    inicio, _ = limites_dia_utc(user, dia_inicio)
    _, fin = limites_dia_utc(user, dia_fin)
    return inicio, fin
