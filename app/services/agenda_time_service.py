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


# Campos del payload de n8n donde puede venir la hora de la cita, en orden de prioridad.
# `registro` NO es la hora de la cita (es cuando el lead se registro): esta ultimo como red de
# seguridad historica, pero usarlo se reporta como problema, no como algo normal.
CAMPOS_FECHA_CITA = ('fecha', 'date')
CAMPO_FECHA_REGISTRO = 'registro'


def resolver_hora_agenda(item):
    """Decide el instante de la cita a partir del payload del webhook.

    Devuelve `(utc_naive, diagnostico)`. El diagnostico dice de que campo salio, que string
    llego, si traia zona y que nivel de confianza tiene. Se guarda junto a la agenda para que
    "esta hora esta bien?" se pueda contestar mirando la fila, sin depender de los logs.

    Es la MISMA funcion que usa el endpoint de verificacion en seco, a proposito: si el
    verificador usara otro camino no probaria nada sobre lo que realmente pasa al guardar.
    """
    diagnostico = {
        'campo': None,
        'valor_recibido': None,
        'traia_zona': None,
        'zona_asumida': None,
        'utc': None,
        'es_respaldo': False,  # True = no se pudo usar el dato y se guarda la hora de llegada
        'nivel': None,        # 'ok' | 'zona_asumida' | 'campo_incorrecto' | 'ilegible' | 'ausente'
        'detalle': None,
    }

    campo, valor = None, None
    for nombre in CAMPOS_FECHA_CITA:
        if item.get(nombre):
            campo, valor = nombre, item[nombre]
            break
    if valor is None and item.get(CAMPO_FECHA_REGISTRO):
        campo, valor = CAMPO_FECHA_REGISTRO, item[CAMPO_FECHA_REGISTRO]

    if valor is None:
        respaldo = datetime.utcnow()
        diagnostico.update(
            nivel='ausente', utc=respaldo.isoformat(), es_respaldo=True,
            detalle="El payload no trae 'fecha' ni 'date'. La agenda queda con la hora en que "
                    "llego el webhook, que casi nunca es la hora real de la cita.")
        return respaldo, diagnostico

    diagnostico['campo'] = campo
    diagnostico['valor_recibido'] = str(valor)

    utc, traia_offset = parse_a_utc(valor)
    diagnostico['traia_zona'] = traia_offset
    if utc is None:
        respaldo = datetime.utcnow()
        diagnostico.update(
            nivel='ilegible', utc=respaldo.isoformat(), es_respaldo=True,
            detalle=f"No se pudo interpretar '{valor}' como fecha. La agenda queda con la hora "
                    f"en que llego el webhook.")
        return respaldo, diagnostico

    diagnostico['utc'] = utc.isoformat()
    if campo == CAMPO_FECHA_REGISTRO:
        diagnostico.update(
            nivel='campo_incorrecto',
            detalle="La hora salio de 'registro' (cuando el lead se registro), no de 'fecha'. "
                    "n8n dejo de mandar el campo de la cita.")
    elif not traia_offset:
        diagnostico.update(
            nivel='zona_asumida', zona_asumida=str(zona_origen()),
            detalle=f"El string no trae zona horaria, asi que se asumio {zona_origen()}. Si n8n "
                    f"formatea en otra zona, la hora guardada queda corrida.")
    else:
        diagnostico['nivel'] = 'ok'
        diagnostico['detalle'] = 'La zona vino en el dato; no hubo que suponer nada.'

    return utc, diagnostico


def como_se_ve(utc_naive, zonas):
    """El mismo instante en varias zonas, para poder comparar contra Calendly a ojo."""
    if not utc_naive:
        return {}
    aware = pytz.UTC.localize(utc_naive)
    vistas = {}
    for nombre in zonas:
        try:
            vistas[nombre] = aware.astimezone(pytz.timezone(nombre)).strftime('%Y-%m-%d %H:%M')
        except Exception:
            continue
    return vistas
