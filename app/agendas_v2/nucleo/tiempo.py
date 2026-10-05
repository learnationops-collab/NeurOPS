"""Fechas y zonas horarias con zoneinfo. Port de core/tiempo.js. Los instantes son milisegundos UTC.

Las funciones dan lo mismo que las de Intl del navegador, incluida la forma de resolver los cambios
de horario en zoned_to_utc. Las de texto solo están las que usa el núcleo (fecha_corta).
"""

import math
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

from app.agendas_v2.nucleo.util import js_round

EPOCA = datetime(1970, 1, 1, tzinfo=timezone.utc)
MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']  # CLDR es


@lru_cache(maxsize=64)
def zona(tz):
    return ZoneInfo(tz)


def date_utc(y, m, d=1, h=0, mi=0, s=0, ms=0):
    """Date.UTC: el mes empieza en 0 y todo puede desbordar (día 32, hora 24...)."""
    y += m // 12
    m %= 12
    base = datetime(y, m + 1, 1, tzinfo=timezone.utc)
    t = base + timedelta(days=d - 1, hours=h, minutes=mi, seconds=s, milliseconds=ms)
    return (t - EPOCA) // timedelta(milliseconds=1)


def ms_a_dt(ts, tz='UTC'):
    """Instante (ms) → datetime con zona."""
    return (EPOCA + timedelta(milliseconds=ts)).astimezone(zona(tz))


def iso(ts):
    """new Date(ts).toISOString(): '2026-10-05T12:00:00.000Z'."""
    t = EPOCA + timedelta(milliseconds=int(ts))
    return t.strftime('%Y-%m-%dT%H:%M:%S') + '.%03dZ' % (t.microsecond // 1000)


def offset_min(ts, tz):
    """Desfase de la zona en ese instante, en minutos (UTC-4 → -240). Igual que el JS: la hora
    local se toma con segundos enteros y se redondea."""
    off = ms_a_dt(ts, tz).utcoffset()
    local_ms = ts + off // timedelta(milliseconds=1)
    local_seg = math.floor(local_ms / 1000) * 1000
    return js_round((local_seg - ts) / 60000)


def zoned_to_utc(y, m, d, h, mi, tz):
    """Hora local de una zona → instante UTC. Contempla cambios de horario con un segundo cálculo del
    desfase. `m` empieza en 0, como en JS."""
    g = date_utc(y, m, d, h, mi)
    o1 = offset_min(g, tz)
    t = g - o1 * 60000
    o2 = offset_min(t, tz)
    return t if o2 == o1 else g - o2 * 60000


def clave_dia(ts, tz):
    """'YYYY-MM-DD' del instante en la zona."""
    return ms_a_dt(ts, tz).strftime('%Y-%m-%d')


def dia_semana(ts, tz):
    """0 = domingo … 6 = sábado, en la zona."""
    return (ms_a_dt(ts, tz).weekday() + 1) % 7


def minuto_del_dia(ts, tz):
    """Minutos desde la medianoche local."""
    t = ms_a_dt(ts, tz)
    return t.hour * 60 + t.minute


def utc_de_clave(k):
    a = [int(x) for x in k.split('-')]
    return date_utc(a[0], a[1] - 1, a[2], 12)


def fecha_corta(k):
    """'2026-10-05' → '5 oct' (como Intl en español, mes corto)."""
    t = ms_a_dt(utc_de_clave(k))
    return '%d %s' % (t.day, MESES_CORTOS[t.month - 1])
