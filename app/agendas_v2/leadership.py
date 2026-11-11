"""La disponibilidad que manda Leadership (ADR-W133; en Leadership, ADR-040).

Leadership es el dueño de cuándo puede cada persona del equipo: su horario semanal, los días en que no
está y lo que le ocupan sus rituals con hora. Cada vez que algo de eso cambia, Leadership manda la foto
completa de la persona (PUT /api/external/leadership/disponibilidad). Acá se guarda en su perfil de
Thalamus (`sched_perfiles.datos.leadership`) y Thalamus la lee de ahí: no se le pregunta a Leadership en
cada consulta, así las agendas no esperan.

Qué hace la foto, solo si la persona cargó su horario en Leadership (`definida`):
  · Closer (tiene persona de Team): su horario y su zona pasan a su persona, que es lo que usa todo el
    agendamiento. Desde ahí, el horario se edita en Leadership (Configuración lo muestra de solo lectura).
  · Staff de la Academia: /agenda/horarios usa este horario en vez del que manda la Academia.
  · Sus bloqueos y rituals cuentan como ocupado al ofrecer horarios (`franjas`), y se escriben en su
    Google Calendar (el calendario elegido) con la marca `leadership` en extendedProperties: así también
    los ve el chequeo de Google antes de reservar, su agenda de la Academia y su propio calendario.
    LEADERSHIP_GOOGLE_SYNC=0 apaga la escritura en Google.
Si deja de estar definida, no se toca su horario (queda el último) y se borran de Google los eventos que
puso Leadership. Nada más se borra.
"""
import calendar as cal_mod
import hashlib
import json
import logging
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from flask import current_app
from sqlalchemy import func
from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.agendas_v2.modelos import SchedPerfil

logger = logging.getLogger(__name__)

CLAVE = 'leadership'
CLAVE_GOOGLE = 'leadership_google'
HORA = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$|^24:00$')
FECHA = re.compile(r'^\d{4}-\d{2}-\d{2}$')
BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']


# --- Lectura ------------------------------------------------------------------------------------


def foto(user_id):
    """La foto de Leadership de ese usuario si cargó su horario allá; si no, None."""
    fila = db.session.get(SchedPerfil, user_id)
    f = (fila.datos or {}).get(CLAVE) if fila and isinstance(fila.datos, dict) else None
    return f if isinstance(f, dict) and f.get('definida') else None


def franjas(user_id, desde, hasta):
    """[(inicio, fin)] (ms) de lo que le ocupan sus bloqueos y rituals de Leadership entre desde y hasta."""
    f = foto(user_id)
    if not f:
        return []
    out = []
    for r in (f.get('bloqueos') or []) + (f.get('ocupado_rituales') or []):
        a, b = r.get('inicio'), r.get('fin')
        if isinstance(a, int) and isinstance(b, int) and a < hasta and desde < b:
            out.append((a, b))
    return sorted(out)


# --- Recepción ----------------------------------------------------------------------------------


def _horario(h):
    """{0..6 (0 = domingo): [[HH:MM, HH:MM]]} validado, o None."""
    if isinstance(h, list) and len(h) == 7:
        h = dict(enumerate(h))
    if not isinstance(h, dict):
        return None
    out = {}
    for d in range(7):
        lista = h.get(str(d), h.get(d)) or []
        if not isinstance(lista, list) or len(lista) > 12:
            return None
        out[d] = []
        for r in lista:
            if not (isinstance(r, list) and len(r) == 2 and all(isinstance(x, str) and HORA.match(x) for x in r)):
                return None
            if r[0] >= r[1]:
                return None
            out[d].append(r)
    return out


def _a_media_hora(h):
    """El editor de Thalamus va de a media hora: el inicio sube a la próxima y el fin baja a la anterior
    (nunca se ofrece de más). Una franja que queda vacía se saca."""
    def minutos(x):
        return int(x[:2]) * 60 + int(x[3:])

    def texto(m):
        return f'{m // 60:02d}:{m % 60:02d}'

    out = {}
    for d, lista in h.items():
        out[d] = []
        for a, b in lista:
            ma = -(-minutos(a) // 30) * 30
            mb = minutos(b) // 30 * 30
            if ma < mb:
                out[d].append([texto(ma), texto(mb)])
        out[d] = out[d][:6]
    return out


def _lista_ms(lista, campos):
    out = []
    for r in lista if isinstance(lista, list) else []:
        if isinstance(r, dict) and isinstance(r.get('inicio'), int) and isinstance(r.get('fin'), int) and r['inicio'] < r['fin']:
            out.append({k: r.get(k) for k in campos})
    return out[:2000]


def recibir(datos):
    """Guarda la foto que manda Leadership. → (cuerpo, código HTTP)."""
    from app.agendas_v2 import servicio
    from app.models import User

    email = (datos.get('email') or '').strip().lower() if isinstance(datos, dict) else ''
    version = datos.get('version') if isinstance(datos, dict) else None
    if not email or not isinstance(version, str):
        return {'error': 'Faltan email o version'}, 400
    tz = datos.get('tz')
    try:
        ZoneInfo(tz)
    except Exception:  # noqa: BLE001
        return {'error': 'Zona horaria inválida'}, 400
    horario = _horario(datos.get('horario'))
    if horario is None:
        return {'error': 'Horario inválido'}, 400

    user = User.query.filter(func.lower(User.email) == email).first()
    if not user:
        # No es de Work (todavía): Leadership lo vuelve a mandar en el repaso.
        return {'ok': True, 'guardada': False, 'motivo': 'no_existe'}, 200

    fila = db.session.get(SchedPerfil, user.id) or SchedPerfil(user_id=user.id, datos={})
    previa = (fila.datos or {}).get(CLAVE) or {}
    if previa.get('version') == version:
        return {'ok': True, 'guardada': True, 'cambio': False}, 200

    nueva = {
        'version': version,
        'definida': bool(datos.get('definida')),
        'tz': tz,
        'horario': horario,
        'bloqueos': _lista_ms(datos.get('bloqueos'), ('id', 'inicio', 'fin', 'motivo')),
        'ocupado_rituales': _lista_ms(datos.get('ocupado_rituales'), ('habit_id', 'inicio', 'fin')),
        'rituales': [r for r in (datos.get('rituales') or []) if isinstance(r, dict)][:200],
        'recibido_en': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    }
    fila.datos = {**(fila.datos or {}), CLAVE: nueva}
    flag_modified(fila, 'datos')
    db.session.add(fila)

    # Un closer: su horario pasa a su persona de Team (lo que usa todo el agendamiento).
    if nueva['definida']:
        p = servicio.persona_de_usuario(servicio.colecciones(), user)
        if p:
            servicio.guardar_doc('personas', p['id'], {'horario': _a_media_hora(horario), 'tz': tz},
                                 usuario_id=user.id, parcial=True)
            user.timezone = tz
    db.session.commit()
    servicio._google_cache.pop(user.id, None)

    sincronizar_en_segundo_plano(current_app._get_current_object(), user.id)
    return {'ok': True, 'guardada': True, 'cambio': True}, 200


# --- Google Calendar ------------------------------------------------------------------------------


def _primera_fecha(r, hoy):
    """La primera fecha (desde hoy o su `desde`) en que toca el ritual, o None si no toca en 62 días."""
    desde = hoy
    if isinstance(r.get('desde'), str) and FECHA.match(r['desde']):
        desde = max(hoy, datetime.strptime(r['desde'], '%Y-%m-%d').date())
    dias = {d for d in r.get('dias') or [] if isinstance(d, int) and 0 <= d <= 6}
    n = r.get('dia_mes') if isinstance(r.get('dia_mes'), int) else 0
    for i in range(62):
        f = desde + timedelta(days=i)
        if r.get('cadencia') == 'mes':
            if 1 <= n <= 31 and f.day == min(n, cal_mod.monthrange(f.year, f.month)[1]):
                return f
        elif (f.weekday() + 1) % 7 in dias:
            return f
    return None


def _regla(r):
    if r.get('cadencia') == 'mes':
        n = r.get('dia_mes')
        if not isinstance(n, int) or not 1 <= n <= 31:
            return None
        if n <= 28:
            return f'RRULE:FREQ=MONTHLY;BYMONTHDAY={n}'
        # Como en Leadership: el día n o, si el mes no lo tiene, el último.
        return 'RRULE:FREQ=MONTHLY;BYMONTHDAY=' + ','.join(str(d) for d in range(28, n + 1)) + ';BYSETPOS=-1'
    dias = sorted({d for d in r.get('dias') or [] if isinstance(d, int) and 0 <= d <= 6})
    return 'RRULE:FREQ=WEEKLY;BYDAY=' + ','.join(BYDAY[d] for d in dias) if dias else None


def _marca(clave):
    return {'private': {CLAVE: clave}}


def _deseados(f):
    """{clave: cuerpo del evento} de lo que Leadership quiere en su Google."""
    out = {}
    for r in f.get('rituales') or []:
        tz, hora, dur = r.get('tz'), r.get('hora'), r.get('duracion')
        try:
            ZoneInfo(tz)
        except Exception:  # noqa: BLE001
            continue
        if not (isinstance(hora, str) and HORA.match(hora) and hora != '24:00' and isinstance(dur, int) and 5 <= dur <= 480):
            continue
        regla = _regla(r)
        primera = _primera_fecha(r, datetime.now(ZoneInfo(tz)).date())
        if not regla or not primera:
            continue
        inicio = datetime.strptime(f'{primera.isoformat()} {hora}', '%Y-%m-%d %H:%M')
        clave = f"ritual:{r.get('habit_id')}"
        out[clave] = {
            'summary': str(r.get('titulo') or 'Ritual')[:200],
            'description': 'Ritual de Leadership. Se cambia en Leadership: lo que cambies acá se pisa.',
            'start': {'dateTime': inicio.isoformat(), 'timeZone': tz},
            'end': {'dateTime': (inicio + timedelta(minutes=dur)).isoformat(), 'timeZone': tz},
            'recurrence': [regla],
            'transparency': 'opaque',
            'reminders': {'useDefault': False},
            'extendedProperties': _marca(clave),
        }
    for b in f.get('bloqueos') or []:
        clave = f"bloqueo:{b.get('id')}"
        motivo = (b.get('motivo') or '').strip()
        out[clave] = {
            'summary': 'No disponible' + (f' · {motivo}' if motivo and motivo != 'No disponible' else ''),
            'description': 'Bloqueo de Leadership (Disponibilidad). Se cambia en Leadership.',
            'start': {'dateTime': datetime.fromtimestamp(b['inicio'] / 1000, timezone.utc).isoformat()},
            'end': {'dateTime': datetime.fromtimestamp(b['fin'] / 1000, timezone.utc).isoformat()},
            'transparency': 'opaque',
            'reminders': {'useDefault': False},
            'extendedProperties': _marca(clave),
        }
    return out


def _huella(cuerpo):
    return hashlib.sha1(json.dumps(cuerpo, sort_keys=True).encode()).hexdigest()[:16]


def sincronizar_google(user_id):
    """Deja en su Google exactamente los rituals y bloqueos de su foto (crea, cambia, borra los suyos)."""
    from app.agendas_v2 import servicio
    from app.services.google_service import GoogleService

    if os.environ.get('LEADERSHIP_GOOGLE_SYNC', '1') == '0':
        return 'apagado'
    fila = db.session.get(SchedPerfil, user_id)
    if not fila:
        return 'sin_perfil'
    datos = dict(fila.datos or {})
    previos = dict(datos.get(CLAVE_GOOGLE) or {}).get('eventos') or {}
    f = foto(user_id)
    deseados = _deseados(f) if f else {}
    if not deseados and not previos:
        return 'nada'

    service = GoogleService.get_service(user_id)
    if not service:
        datos[CLAVE_GOOGLE] = {'eventos': previos, 'estado': 'sin_google'}
        fila.datos = datos
        flag_modified(fila, 'datos')
        db.session.commit()
        return 'sin_google'
    destino = GoogleService._calendario(user_id)

    def borrar(ev):
        try:
            service.events().delete(calendarId=ev.get('cal') or destino, eventId=ev['id'], sendUpdates='none').execute()
        except Exception as e:  # noqa: BLE001
            if getattr(getattr(e, 'resp', None), 'status', None) not in (404, 410):
                raise

    nuevos, errores = {}, []
    for clave, cuerpo in deseados.items():
        h, ev = _huella(cuerpo), previos.get(clave)
        try:
            if ev and ev.get('h') == h and (ev.get('cal') or destino) == destino:
                nuevos[clave] = ev
                continue
            if ev and (ev.get('cal') or destino) == destino:
                try:
                    hecho = service.events().update(calendarId=destino, eventId=ev['id'], body=cuerpo, sendUpdates='none').execute()
                except Exception as e:  # noqa: BLE001
                    if getattr(getattr(e, 'resp', None), 'status', None) not in (404, 410):
                        raise
                    hecho = service.events().insert(calendarId=destino, body=cuerpo, sendUpdates='none').execute()
            else:
                if ev:
                    borrar(ev)
                hecho = service.events().insert(calendarId=destino, body=cuerpo, sendUpdates='none').execute()
            nuevos[clave] = {'id': hecho.get('id'), 'h': h, 'cal': destino}
        except Exception as e:  # noqa: BLE001
            errores.append(f'{clave}: {e}')
            if ev:
                nuevos[clave] = ev
    for clave, ev in previos.items():
        if clave not in deseados:
            try:
                borrar(ev)
            except Exception as e:  # noqa: BLE001
                errores.append(f'{clave}: {e}')
                nuevos[clave] = ev

    fila = db.session.get(SchedPerfil, user_id)
    datos = dict(fila.datos or {})
    datos[CLAVE_GOOGLE] = {
        'eventos': nuevos, 'estado': 'error' if errores else 'ok', 'errores': errores[:5],
        'en': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    }
    fila.datos = datos
    flag_modified(fila, 'datos')
    db.session.commit()
    servicio._google_cache.pop(user_id, None)
    if errores:
        logger.warning('Leadership → Google #%s: %s', user_id, '; '.join(errores[:3]))
    return 'error' if errores else 'ok'


def sincronizar_en_segundo_plano(app, user_id):
    """Lo llama la recepción de la foto: Google nunca demora ni rompe la respuesta a Leadership."""
    def correr():
        with app.app_context():
            try:
                sincronizar_google(user_id)
            except Exception:  # noqa: BLE001
                logger.exception('Falló pasar a Google la disponibilidad de Leadership (#%s)', user_id)

    threading.Thread(target=correr, daemon=True, name='leadership-disponibilidad').start()
