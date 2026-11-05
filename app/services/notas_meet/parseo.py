"""Lo que se saca de un Doc «… - Notas de Gemini». Funciones puras: título y texto en, datos fuera.

Título: «Sesión diagnóstica: Ana y Dari González.: 2026/11/03 20:08 GMT-03:00 - Notas de Gemini».
Las reuniones sin evento se titulan «La reunión se inició a las 2026/11/03 23:06 GMT-03:00 - …».
Las de 2025 venían al revés: «Notas de Gemini: Setters, 2025/05/13 12:27 GMT-03:00». Algunas cuentas
(la de Mario) ponen la zona por nombre: «… 2026/07/28 11:00 CST - Notas de Gemini».
El link al evento (`calendar/event?eid=…`) es base64 de «<id del evento> <calendario abreviado>».
"""
import base64
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote

_FECHA = r'(?P<fecha>\d{4}/\d{2}/\d{2} \d{2}:\d{2})(?: (?:GMT(?P<zona>[+-]\d{2}:?\d{2})?|(?P<sigla>[A-Z]{2,5})))?'
_TITULO = re.compile(r'^(?P<asunto>.*?)[\s:\-,]*' + _FECHA + r'\s*-\s*(?:Notas de Gemini|Notes by Gemini)\s*$')
_TITULO_VIEJO = re.compile(r'^(?:Notas de Gemini|Notes by Gemini)(?::| de la reunión que inició a las)?\s*'
                           r'(?P<asunto>.*?)[\s,]*' + _FECHA + r'\s*$')
# Las siglas que aparecen en los Docs; la que no esté queda en la hora local.
_SIGLAS = {'CST': '-06:00', 'CDT': '-05:00', 'EST': '-05:00', 'EDT': '-04:00', 'PST': '-08:00',
           'PDT': '-07:00', 'ART': '-03:00', 'UTC': '+00:00', 'GMT': '+00:00'}
_SIN_EVENTO = re.compile(r'^(la reunión se inició a las|meeting started)', re.I)
# Los calendarios y salas que Calendar suma como invitados: no son personas.
_NO_PERSONA = ('@group.calendar.google.com', '@resource.calendar.google.com')
_EID = re.compile(r'calendar\.google\.com/calendar/(?:u/\d+/)?(?:r/)?event\?(?:[^)\s]*&)?eid=([A-Za-z0-9_\-%=]+)')
_EMAIL = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
_GRABACION = re.compile(r'\[(?:Grabación|Recording)\]\((https://drive\.google\.com/[^)\s]+)\)')
_SECCION = re.compile(r'^#{1,6}\s*\**\s*(.+?)\s*\**\s*$', re.M)
_PIE = re.compile(r'\n\s*\*?(?:Revisa las notas de Gemini|You should review Gemini)', re.I)
_TITULOS_RESUMEN = ('resumen', 'summary')


def titulo(nombre):
    """{asunto, kind, meeting_at (UTC naive)} del nombre del Doc. Lo que no se entiende queda None."""
    m = _TITULO.match(nombre or '') or _TITULO_VIEJO.match(nombre or '')
    if not m:
        return {'asunto': None, 'kind': None, 'meeting_at': None}
    asunto = m.group('asunto').strip(' :.-,') or None
    if asunto and _SIN_EVENTO.match(asunto):
        asunto = None
    kind = asunto.split(':', 1)[0].strip() if asunto and ':' in asunto else None
    zona = m.group('zona') or _SIGLAS.get(m.group('sigla') or '')
    return {'asunto': asunto, 'kind': kind, 'meeting_at': _utc(m.group('fecha'), zona)}


def _utc(fecha, zona):
    local = datetime.strptime(fecha, '%Y/%m/%d %H:%M')
    if not zona:
        return local
    signo = -1 if zona[0] == '-' else 1
    horas, minutos = zona[1:].replace(':', '')[:2], zona[1:].replace(':', '')[2:]
    desfase = timedelta(hours=int(horas), minutes=int(minutos or 0)) * signo
    return local.replace(tzinfo=timezone(desfase)).astimezone(timezone.utc).replace(tzinfo=None)


def evento(texto):
    """(id del evento, calendario abreviado) del link al evento de Calendar, o (None, None)."""
    m = _EID.search(texto or '')
    if not m:
        return None, None
    crudo = unquote(m.group(1)).rstrip('=')
    try:
        decodificado = base64.urlsafe_b64decode(crudo + '=' * (-len(crudo) % 4)).decode('utf-8')
    except (ValueError, UnicodeDecodeError):
        return None, None
    partes = decodificado.split(' ', 1)
    return (partes[0] or None), (partes[1] if len(partes) > 1 else None)


def _seccion_resumen(texto):
    """(inicio del título «Resumen», fin de su cuerpo), o None."""
    titulos = list(_SECCION.finditer(texto))
    for i, t in enumerate(titulos):
        if t.group(1).strip('* ').lower() in _TITULOS_RESUMEN:
            return t, (titulos[i + 1].start() if i + 1 < len(titulos) else len(texto))
    return None


def invitados(texto, propios=()):
    """Emails de la cabecera del Doc (lo que va antes de «Resumen»), sin los que terminan en `propios`."""
    texto = texto or ''
    seccion = _seccion_resumen(texto)
    cabecera = texto[:seccion[0].start()] if seccion else texto[:2000]
    vistos = []
    for email in _EMAIL.findall(cabecera):
        email = email.lower()
        if email not in vistos and not any(email.endswith(p) for p in (*propios, *_NO_PERSONA)):
            vistos.append(email)
    return vistos


def grabacion(texto):
    m = _GRABACION.search(texto or '')
    return m.group(1) if m else None


def serie(asunto, kind):
    """La reunión recurrente a la que pertenece la nota, para categorizar todas juntas: el `kind` («Scale
    Session») o, si no hay, el asunto sin emojis ni signos sueltos («Educational Team»)."""
    base = kind or asunto
    if not base:
        return None
    limpio = re.sub(r'[^\w\s&|\[\]().,/+-]', '', base)
    limpio = re.sub(r'\s+', ' ', limpio).strip(' -|:.,')
    return limpio[:200] or None


def resumen(texto):
    """El cuerpo de la sección «Resumen», sin marcas de markdown, o None."""
    texto = texto or ''
    seccion = _seccion_resumen(texto)
    if not seccion:
        return None
    titulo_resumen, fin = seccion
    cuerpo = re.sub(r'[*_\\]', '', texto[titulo_resumen.end():fin]).strip()
    return re.sub(r'\n\s*\n+', '\n\n', cuerpo) or None


def contenido(texto):
    """El Doc sin el pie de Google (la encuesta y el aviso de revisar las notas)."""
    return _PIE.split(texto or '', maxsplit=1)[0].strip()
