"""El "hoy" de cada usuario, no el del servidor.

Todos los `created_at` / `start_time` se guardan en UTC naive, pero el servidor
corre en UTC y el equipo trabaja en UTC-3/-4. Calcular el rango del dia con
`date.today()` + `datetime.combine` mezcla las dos cosas: a las 20:00 de Caracas
ya es el dia siguiente en UTC, asi que "hoy" pasaba a ser una ventana de una
hora y las bandejas se vaciaban solas cada noche.

`User.timezone` la sincroniza el login desde el navegador (ver `auth.py`), con
'America/La_Paz' como respaldo para quien nunca entro.

Lo que corre SIN usuario detras (crons, el motor de alertas) no tiene de donde
sacar una zona personal, pero tampoco puede usar la del servidor: ahi va
`zona_del_negocio()` y sus derivados, que son la misma zona de respaldo pero
dicha en voz alta.
"""
from datetime import datetime, time as time_cls

import pytz

ZONA_POR_DEFECTO = 'America/La_Paz'


def zona_del_negocio():
    """La unica zona del negocio: la que usa todo lo que no tiene un usuario detras."""
    return pytz.timezone(ZONA_POR_DEFECTO)


def zona_del_usuario(user):
    try:
        nombre = getattr(user, 'timezone', None)
        return pytz.timezone(nombre) if nombre else zona_del_negocio()
    except Exception:
        return zona_del_negocio()


def hoy_del_usuario(user):
    """Fecha calendario en la zona del usuario, no la del servidor."""
    return datetime.now(zona_del_usuario(user)).date()


def hoy_del_negocio():
    """Fecha calendario del negocio, no la del servidor (que en Railway da UTC por casualidad
    y en la maquina de quien desarrolla da cualquier otra cosa)."""
    return datetime.now(zona_del_negocio()).date()


def dia_del_negocio(dt):
    """El dia del calendario del negocio al que pertenece un instante UTC naive de la base."""
    return pytz.UTC.localize(dt).astimezone(zona_del_negocio()).date()


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


def limites_rango_utc_del_negocio(dia_inicio, dia_fin):
    """`limites_rango_utc` para lo que corre sin usuario: mismo rango, zona del negocio."""
    return limites_rango_utc(None, dia_inicio, dia_fin)
