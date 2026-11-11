"""Las reuniones del equipo del calendario compartido «🎥 Team Meetings», para Leadership (ADR-W134).

Mario arma las reuniones en ese calendario de Google (cada una, una serie que se repite, con Meet e
invitados). Leadership las lleva como rituals de cada invitado: las lee de acá (`series`) y, si alguien
cambia la hora o los días desde Leadership, reescribe la serie acá (`editar`) y les llega a todos.

El calendario es TEAM_MEETINGS_CALENDAR_ID. Se lee y se escribe con la primera cuenta conectada a Work que
pueda (TEAM_MEETINGS_CUENTA primero, si está): no hay una cuenta de servicio aparte.
"""
import logging
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

CAL_DEF = 'c_63f81893cc67b859e4ee28441f617a68af35ee0f0f43a37d97468a70b4b3c333@group.calendar.google.com'
BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']  # 0 = domingo
HORA = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')
VENTANA_DIAS = 21


def calendario():
    return os.environ.get('TEAM_MEETINGS_CALENDAR_ID') or CAL_DEF


def _cuentas():
    """user_id de las cuentas con Google conectado, con TEAM_MEETINGS_CUENTA primero."""
    from sqlalchemy import func

    from app.models import GoogleCalendarToken, User

    ids = [t.user_id for t in GoogleCalendarToken.query.order_by(GoogleCalendarToken.user_id).all()]
    preferida = (os.environ.get('TEAM_MEETINGS_CUENTA') or '').strip().lower()
    if preferida:
        u = User.query.filter(func.lower(User.email) == preferida).first()
        if u and u.id in ids:
            ids = [u.id] + [i for i in ids if i != u.id]
    return ids


def _servicio(escribir=False):
    """(service, user_id) de una cuenta que puede leer (o escribir) el calendario, o (None, None)."""
    from app.services.google_service import GoogleService

    cal = calendario()
    for uid in _cuentas():
        try:
            s = GoogleService.get_service(uid)
            if not s:
                continue
            if escribir:
                rol = s.calendarList().get(calendarId=cal).execute().get('accessRole')
                if rol not in ('owner', 'writer'):
                    continue
            else:
                s.calendars().get(calendarId=cal).execute()
            return s, uid
        except Exception:  # noqa: BLE001  (esta cuenta no puede: se prueba la siguiente)
            continue
    return None, None


def series():
    """Las series vigentes (con alguna fecha en los próximos 21 días): [{id, titulo, descripcion, tz, dias
    [0 = domingo], hora, duracion, invitados [emails], meet, proxima (ms)}]. Días, hora y duración salen de
    sus fechas (lo que de verdad pasa, con las excepciones), no de la regla. None si no se pudo leer."""
    s, _uid = _servicio()
    if not s:
        return None
    ahora = datetime.now(timezone.utc).replace(microsecond=0)
    items, pagina = [], None
    while True:
        r = s.events().list(
            calendarId=calendario(), timeMin=ahora.isoformat().replace('+00:00', 'Z'),
            timeMax=(ahora + timedelta(days=VENTANA_DIAS)).isoformat().replace('+00:00', 'Z'),
            singleEvents=True, orderBy='startTime', maxResults=250, pageToken=pagina,
        ).execute()
        items += r.get('items') or []
        pagina = r.get('nextPageToken')
        if not pagina:
            break

    grupos = defaultdict(list)
    for e in items:
        if e.get('status') == 'cancelled' or 'dateTime' not in (e.get('start') or {}):
            continue
        grupos[(e.get('recurringEventId') or e['id']).split('_R')[0]].append(e)

    out = []
    for sid, evs in grupos.items():
        tz = (evs[0].get('start') or {}).get('timeZone') or 'UTC'
        try:
            zona = ZoneInfo(tz)
        except Exception:  # noqa: BLE001
            zona, tz = ZoneInfo('UTC'), 'UTC'
        dias, horas, durs = set(), Counter(), Counter()
        invitados = set()
        for e in evs:
            a = datetime.fromisoformat(e['start']['dateTime']).astimezone(zona)
            b = datetime.fromisoformat(e['end']['dateTime']).astimezone(zona)
            dias.add((a.weekday() + 1) % 7)
            horas[a.strftime('%H:%M')] += 1
            durs[int((b - a).total_seconds() // 60)] += 1
            invitados |= {(g.get('email') or '').lower() for g in e.get('attendees') or []
                          if g.get('email') and not g['email'].endswith('calendar.google.com')
                          and g.get('responseStatus') != 'declined'}
        ultimo = evs[-1]
        out.append({
            'id': sid,
            'recurrente': bool(evs[0].get('recurringEventId')),
            'titulo': (ultimo.get('summary') or 'Reunión').strip()[:200],
            'descripcion': (ultimo.get('description') or '')[:2000],
            'tz': tz,
            'dias': sorted(dias),
            'hora': horas.most_common(1)[0][0],
            'duracion': durs.most_common(1)[0][0],
            'invitados': sorted(invitados),
            'meet': ultimo.get('hangoutLink') or ultimo.get('conferenceUrl'),
            'proxima': int(datetime.fromisoformat(evs[0]['start']['dateTime']).timestamp() * 1000),
        })
    return sorted(out, key=lambda x: (x['dias'][:1], x['hora']))


def editar(serie_id, hora, duracion, dias, tz):
    """Reescribe la hora, la duración y los días de la serie (las fechas que vienen; Google mueve también
    las que pasaron, como en las reuniones de la Academia). → (ok, error)."""
    if not (isinstance(hora, str) and HORA.match(hora) and isinstance(duracion, int) and 5 <= duracion <= 480
            and isinstance(dias, list) and dias and all(isinstance(d, int) and 0 <= d <= 6 for d in dias)):
        return False, 'Datos inválidos (hora, duracion, dias)'
    try:
        zona = ZoneInfo(tz)
    except Exception:  # noqa: BLE001
        return False, 'Zona horaria inválida'
    s, _uid = _servicio(escribir=True)
    if not s:
        return False, 'Ninguna cuenta conectada puede escribir en Team Meetings'
    cal = calendario()
    try:
        ev = s.events().get(calendarId=cal, eventId=serie_id).execute()
    except Exception as e:  # noqa: BLE001
        return False, f'No se encontró la serie: {e}'
    # La primera fecha de la serie, a la hora nueva, en la zona de la reunión.
    inicio_viejo = datetime.fromisoformat(ev['start']['dateTime']).astimezone(zona)
    h, m = int(hora[:2]), int(hora[3:])
    inicio = inicio_viejo.replace(hour=h, minute=m, second=0, microsecond=0, tzinfo=None)
    fin = inicio + timedelta(minutes=duracion)
    regla_nueva = 'BYDAY=' + ','.join(BYDAY[d] for d in sorted(set(dias)))
    recurrencia = []
    for linea in ev.get('recurrence') or []:
        if linea.startswith('RRULE:'):
            linea = re.sub(r'BYDAY=[A-Z0-9,+-]+', regla_nueva, linea) if 'BYDAY=' in linea else linea + ';' + regla_nueva
        recurrencia.append(linea)
    cuerpo = {
        'start': {'dateTime': inicio.isoformat(), 'timeZone': tz},
        'end': {'dateTime': fin.isoformat(), 'timeZone': tz},
    }
    if recurrencia:
        cuerpo['recurrence'] = recurrencia
    try:
        s.events().patch(calendarId=cal, eventId=serie_id, body=cuerpo, sendUpdates='all').execute()
    except Exception as e:  # noqa: BLE001
        logger.warning('Team Meetings: no se pudo editar %s: %s', serie_id, e)
        return False, str(e)[:300]
    return True, None
