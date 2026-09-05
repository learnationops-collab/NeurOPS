"""Una sola convencion horaria para las agendas: en la base TODO es UTC naive.

Por que existe: el webhook de n8n/Calendly normalizaba la fecha de la cita a hora local
de America/La_Paz antes de guardarla (`astimezone(la_paz_tz).replace(tzinfo=None)`), pero
el resto del sistema lee esa misma columna como UTC -- las ventanas de dia de
`user_time_service`, el `isoformat()` que sale por la API, el `parseUtcIso()` del frontend
y `google_service.start_time.isoformat() + 'Z'`. Resultado: toda agenda que entro por
Calendly quedo corrida 4 horas hacia atras y el contador del Kanban del closer decia
"Hace 3 horas" para una cita a la que todavia le faltaba una hora.

La regla, entonces:
- Si el string trae offset (`...Z`, `-04:00`), se convierte a UTC. Punto.
- Si viene sin offset, se asume `AGENDAS_SOURCE_TZ` (por defecto America/La_Paz, que es
  como n8n formatea cuando pierde la zona) y recien ahi se pasa a UTC.
"""
import os
from datetime import datetime

import pytz
from dateutil import parser as date_parser

# Zona en la que la fuente (n8n/Calendly) escribe las fechas cuando manda el string SIN offset.
ZONA_ORIGEN_POR_DEFECTO = 'America/La_Paz'


def zona_origen():
    nombre = os.environ.get('AGENDAS_SOURCE_TZ') or ZONA_ORIGEN_POR_DEFECTO
    try:
        return pytz.timezone(nombre)
    except Exception:
        return pytz.timezone(ZONA_ORIGEN_POR_DEFECTO)


def parse_flexible(valor):
    """Parsea la fecha tal como llega del webhook, SIN tocarle la zona.

    Mantiene el criterio de dia/mes que ya usaba `parse_date_robustly`: ISO (`YYYY-...`)
    con dia al final, `dd/mm/yyyy` con dia primero.
    """
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor
    texto = str(valor).strip()
    if not texto:
        return None
    try:
        if '-' in texto and texto.find('-') == 4:
            return date_parser.parse(texto, dayfirst=False)
        if '/' in texto:
            partes = texto.split('/')
            if partes and len(partes[0]) <= 2:
                return date_parser.parse(texto, dayfirst=True)
        return date_parser.parse(texto)
    except Exception:
        return None


def a_utc_naive(dt, zona=None):
    """Cualquier datetime -> UTC naive, que es lo que guardan las columnas DateTime."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(pytz.UTC).replace(tzinfo=None)
    tz = zona or zona_origen()
    return tz.localize(dt).astimezone(pytz.UTC).replace(tzinfo=None)


def parse_a_utc(valor, zona=None):
    """(utc_naive, traia_offset). `traia_offset=False` = la zona se asumio, no vino en el dato."""
    dt = parse_flexible(valor)
    if dt is None:
        return None, False
    return a_utc_naive(dt, zona), dt.tzinfo is not None


def limites_dia_origen(utc_naive, zona=None):
    """El dia calendario de `utc_naive` EN LA ZONA DE ORIGEN, devuelto como rango UTC naive.

    Lo usa el deduplicador de agendas ("la misma agenda del mismo dia para el mismo lead"):
    con las fechas ya en UTC, un dia calendario crudo cortaria por medianoche UTC y una cita
    de las 21:00 caeria en el dia siguiente.
    """
    from datetime import time as time_cls

    tz = zona or zona_origen()
    dia = pytz.UTC.localize(utc_naive).astimezone(tz).date()
    inicio = tz.localize(datetime.combine(dia, time_cls.min)).astimezone(pytz.UTC).replace(tzinfo=None)
    fin = tz.localize(datetime.combine(dia, time_cls.max)).astimezone(pytz.UTC).replace(tzinfo=None)
    return inicio, fin
