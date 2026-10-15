"""Hora, Google Meet y grupo de WhatsApp de cada taller: lo que antes era workshops.csv.

Hasta el 15/10/2026 las landings de institute-site tomaban la fecha, la hora y los dos links
del próximo taller de un CSV que había que editar y subir por FTP, con la hora escrita en
hora de Argentina. Ahora viven en cada `WorkshopEvent` y las landings los leen de
/api/public/workshops/proximos.

La hora se guarda como instante absoluto (`inicio_at`, UTC naive). Quien la carga lo hace en
la hora de su zona (el panel manda la zona de su navegador) y quien la mira la ve en la suya:
Kerwin en Venezuela y su jefe en otro país ven el mismo taller cada uno en su hora.
"""
from datetime import datetime, timedelta

import pytz

from app import db
from app.models import WorkshopEvent

MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO',
         'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

LARGO_URL = 300
MAX_SEMANAS = 26


class DatoInvalido(ValueError):
    """Un valor del formulario que no se puede guardar; el mensaje va tal cual al usuario."""


def nombre_por_defecto(dia):
    """'WEBINAR 19 DE OCTUBRE 2026', como se vienen llamando los talleres."""
    return f'WEBINAR {dia.day} DE {MESES[dia.month - 1]} {dia.year}'


def zona(nombre, respaldo='America/La_Paz'):
    try:
        return pytz.timezone(nombre or respaldo)
    except Exception:
        return pytz.timezone(respaldo)


def parsear_inicio(valor, tz_respaldo):
    """ISO con zona ('...Z' o '...-03:00') -> UTC naive. Sin zona, se lee en `tz_respaldo`.

    Vacío -> None (el taller se queda sin hora y no sale en las landings).
    """
    if valor in (None, ''):
        return None
    texto = str(valor).strip()
    if texto.endswith('Z'):
        texto = texto[:-1] + '+00:00'
    try:
        instante = datetime.fromisoformat(texto)
    except ValueError:
        raise DatoInvalido('La fecha y hora del taller no es válida')
    if instante.tzinfo is None:
        instante = tz_respaldo.localize(instante)
    return instante.astimezone(pytz.UTC).replace(tzinfo=None)


def limpiar_url(valor, que):
    """'' o None -> None. Tiene que ser un link http(s) completo."""
    if valor in (None, ''):
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    if not texto.lower().startswith(('https://', 'http://')):
        raise DatoInvalido(f'El link {que} tiene que empezar con https://')
    if len(texto) > LARGO_URL:
        raise DatoInvalido(f'El link {que} es demasiado largo')
    return texto


def aplicar_agenda(evento, data, tz_respaldo):
    """Copia al evento los campos de agenda que vengan en `data` (solo los presentes)."""
    if 'inicio_at' in data:
        evento.inicio_at = parsear_inicio(data.get('inicio_at'), tz_respaldo)
    if 'meet_url' in data:
        evento.meet_url = limpiar_url(data.get('meet_url'), 'de Google Meet')
    if 'whatsapp_url' in data:
        evento.whatsapp_url = limpiar_url(data.get('whatsapp_url'), 'del grupo de WhatsApp')


def programar_semanal(inicio_local, nombre_zona, semanas, meet_url, whatsapp_url):
    """Crea un taller por semana desde `inicio_local` ('YYYY-MM-DDTHH:MM' en `nombre_zona`).

    Cada semana se repite la misma hora de reloj en esa zona (si la zona cambia de horario
    de verano, el taller sigue a la misma hora para quien lo cargó). Las fechas que ya tienen
    taller no se tocan: se devuelven en `existentes`. No commitea.
    """
    tz = zona(nombre_zona)
    try:
        primero = datetime.fromisoformat(str(inicio_local).strip())
    except ValueError:
        raise DatoInvalido('La fecha y hora del primer taller no es válida')
    if primero.tzinfo is not None:
        primero = primero.astimezone(tz).replace(tzinfo=None)
    try:
        semanas = int(semanas)
    except (TypeError, ValueError):
        raise DatoInvalido('La cantidad de semanas no es válida')
    if not 1 <= semanas <= MAX_SEMANAS:
        raise DatoInvalido(f'Se pueden programar entre 1 y {MAX_SEMANAS} semanas')
    meet = limpiar_url(meet_url, 'de Google Meet')
    whatsapp = limpiar_url(whatsapp_url, 'del grupo de WhatsApp')

    creados, existentes = [], []
    for i in range(semanas):
        local = primero + timedelta(days=7 * i)
        dia = local.date()
        if WorkshopEvent.query.filter_by(date=dia).first():
            existentes.append(dia.isoformat())
            continue
        evento = WorkshopEvent(
            date=dia,
            name=nombre_por_defecto(dia),
            inicio_at=tz.localize(local).astimezone(pytz.UTC).replace(tzinfo=None),
            meet_url=meet,
            whatsapp_url=whatsapp,
        )
        db.session.add(evento)
        creados.append(evento)
    db.session.flush()
    return creados, existentes


def dia_local(inicio_utc, tz):
    """El día del taller en la zona de quien lo carga (es la `date` del WorkshopEvent)."""
    return pytz.UTC.localize(inicio_utc).astimezone(tz).date()
