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


CLAVE_CAL = 'team_meetings_calendario'
NOMBRE_CAL = '🎥 Team Meetings'
ZONA_CAL = 'America/Argentina/Buenos_Aires'


def calendario():
    """El calendario de las reuniones: el de team@ (`integrations`, lo crea `mudar`) o, antes de mudarlas,
    el viejo de Mario. TEAM_MEETINGS_CALENDAR_ID lo fija a mano."""
    from app.models import Integration

    if os.environ.get('TEAM_MEETINGS_CALENDAR_ID'):
        return os.environ['TEAM_MEETINGS_CALENDAR_ID']
    fila = Integration.query.filter_by(key=CLAVE_CAL).first()
    return ((fila.payload_config or {}) if fila else {}).get('calendar_id') or CAL_DEF


def _cuentas():
    """user_id de las cuentas con Google conectado, con TEAM_MEETINGS_CUENTA primero."""
    from sqlalchemy import func

    from app.models import GoogleCalendarToken, User

    from app.agendas_v2 import organizador

    ids = [t.user_id for t in GoogleCalendarToken.query.order_by(GoogleCalendarToken.user_id).all()]
    # team@ primero: es la que organiza las reuniones.
    team = organizador._titular()
    if team in ids:
        ids = [team] + [i for i in ids if i != team]
    preferida = (os.environ.get('TEAM_MEETINGS_CUENTA') or '').strip().lower()
    if preferida:
        u = User.query.filter(func.lower(User.email) == preferida).first()
        if u and u.id in ids:
            ids = [u.id] + [i for i in ids if i != u.id]
    return ids


def _servicio(escribir=False, cal=None):
    """(service, user_id) de una cuenta que puede leer (o escribir) el calendario, o (None, None)."""
    from app.services.google_service import GoogleService

    cal = cal or calendario()
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


def series(cal=None):
    """Las series vigentes (con alguna fecha en los próximos 21 días): [{id, titulo, descripcion, tz, dias
    [0 = domingo], hora, duracion, invitados [emails], meet, proxima (ms)}]. Días, hora y duración salen de
    sus fechas (lo que de verdad pasa, con las excepciones), no de la regla. None si no se pudo leer."""
    cal = cal or calendario()
    s, _uid = _servicio(cal=cal)
    if not s:
        return None
    ahora = datetime.now(timezone.utc).replace(microsecond=0)
    items, pagina = [], None
    while True:
        r = s.events().list(
            calendarId=cal, timeMin=ahora.isoformat().replace('+00:00', 'Z'),
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
            'proxima_iso': evs[0]['start']['dateTime'],
            # La serie del calendario viejo que reemplaza (mudar): Leadership reengancha el mismo ritual.
            'reemplaza': ((evs[0].get('extendedProperties') or {}).get('private') or {}).get('reemplaza'),
            # Una serie partida en Google («esta y las siguientes») tiene varias series de verdad: id, id_R….
            'ids': sorted({e.get('recurringEventId') or e['id'] for e in evs}),
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


# --- Que team@ sea la dueña del Meet de cada reunión (notas de Gemini, transcripción y grabación) -------
# La reunión de Meet es de la cuenta que la crea. Las series de Team Meetings las arma Mario con su cuenta,
# así que su Meet es de Mario y team@ no lo puede pre-configurar (meet_config.py). team@, con permiso de
# escribir en el calendario, le pide a Calendar un Meet nuevo para la serie (conferenceData.createRequest):
# la reunión pasa a ser de team@, se le prenden los tres artefactos y Gemini deja la nota en el Drive de
# team@, el que Work lee. La serie, el título y los invitados no cambian; a los invitados les llega el link
# nuevo. Queda marcado (extendedProperties.private.meet_team) para no repetirlo.

MARCA_MEET = 'meet_team'


def _codigo(ev):
    from app.services.meet_config import codigo_de

    return codigo_de(ev.get('hangoutLink') or ((ev.get('conferenceData') or {}).get('entryPoints') or [{}])[0].get('uri'))


def asegurar_notas(dry=False):
    """Deja cada serie vigente con un Meet de team@ y sus notas automáticas. → {hechas, ya, errores, falta}."""
    import uuid

    from app.agendas_v2 import organizador
    from app.services.google_service import GoogleService
    from app.services.meet_config import activar_artefactos

    uid = organizador._titular()
    if not uid:
        return {'falta': f'{organizador.cuenta()} no está conectada en Work'}
    s = GoogleService.get_service(uid)
    cal = calendario()
    try:
        rol = s.calendarList().get(calendarId=cal).execute().get('accessRole')
    except Exception:  # noqa: BLE001
        rol = None
    if rol not in ('owner', 'writer'):
        return {'falta': f'{organizador.cuenta()} no puede editar Team Meetings (hay que compartirle el calendario con permiso para hacer cambios)'}

    vigentes = {x['id'] for x in (series() or []) if x.get('recurrente')}
    hechas, ya, errores = [], [], []
    for sid in sorted(vigentes):
        try:
            ev = s.events().get(calendarId=cal, eventId=sid).execute()
        except Exception as e:  # noqa: BLE001
            errores.append(f'{sid}: {str(e)[:120]}')
            continue
        titulo = ev.get('summary') or sid
        marca = ((ev.get('extendedProperties') or {}).get('private') or {}).get(MARCA_MEET)
        if marca and marca == _codigo(ev):
            ya.append(titulo)
            continue
        if dry:
            hechas.append(titulo)
            continue
        try:
            nuevo = s.events().patch(
                calendarId=cal, eventId=sid, conferenceDataVersion=1, sendUpdates='all',
                body={'conferenceData': {'createRequest': {'requestId': uuid.uuid4().hex,
                                                           'conferenceSolutionKey': {'type': 'hangoutsMeet'}}}},
            ).execute()
            codigo = _codigo(nuevo)
            if not codigo:
                errores.append(f'{titulo}: Google no devolvió el Meet nuevo')
                continue
            if not activar_artefactos(nuevo.get('hangoutLink')):
                errores.append(f'{titulo}: Meet nuevo sin notas automáticas (ver logs [MEET])')
                continue
            privadas = {**((nuevo.get('extendedProperties') or {}).get('private') or {}), MARCA_MEET: codigo}
            s.events().patch(calendarId=cal, eventId=sid, sendUpdates='none',
                             body={'extendedProperties': {'private': privadas}}).execute()
            hechas.append(titulo)
        except Exception as e:  # noqa: BLE001
            errores.append(f'{titulo}: {str(e)[:160]}')
    return {'hechas': hechas, 'ya': ya, 'errores': errores}



# --- Mudar las reuniones al calendario de team@ ---------------------------------------------------------
# team@ organiza todo: tiene un calendario «🎥 Team Meetings» propio (se crea una vez y se comparte con quien
# las armaba, para que siga editándolas) e invita al equipo. Cada serie del calendario viejo se crea de nuevo
# ahí, desde su próxima fecha, con su título, descripción, regla e invitados, y un Meet de team@ con notas,
# transcripción y grabación automáticas. La vieja se corta antes de esa fecha (lo pasado queda).


def _calendario_team(dry, compartir_con):
    """(user_id de team@, id de su calendario de reuniones, creado ahora?)."""
    from app import db
    from app.agendas_v2 import organizador
    from app.models import Integration
    from app.services.google_service import GoogleService

    uid = organizador._titular()
    if not uid:
        return None, None, False
    fila = Integration.query.filter_by(key=CLAVE_CAL).first()
    cal = ((fila.payload_config or {}) if fila else {}).get('calendar_id')
    if cal or dry:
        return uid, cal, False
    cal = GoogleService.crear_calendario(uid, NOMBRE_CAL, ZONA_CAL)
    s = GoogleService.get_service(uid)
    for email in compartir_con:
        try:
            s.acl().insert(calendarId=cal, sendNotifications=True,
                           body={'role': 'writer', 'scope': {'type': 'user', 'value': email}}).execute()
        except Exception as e:  # noqa: BLE001
            logger.warning('Team Meetings: no se pudo compartir con %s: %s', email, e)
    if fila is None:
        fila = Integration(key=CLAVE_CAL, name='Calendario de las reuniones del equipo (team@)', payload_config={})
        db.session.add(fila)
    fila.payload_config = {'calendar_id': cal, 'cuenta': organizador.cuenta(), 'desde': CAL_DEF}
    db.session.commit()
    return uid, cal, True


def mudar(dry=False):
    """Pasa las series vigentes del calendario viejo al de team@. → {calendario, creado, series, errores}."""
    import uuid

    from app.services.google_service import GoogleService
    from app.services.meet_config import activar_artefactos

    viejo = CAL_DEF
    lista = series(cal=viejo)
    if lista is None:
        return {'falta': 'No se pudo leer el calendario viejo de Team Meetings'}
    lista = [x for x in lista if x.get('recurrente')]
    sv, _ = _servicio(escribir=True, cal=viejo)
    if not sv:
        return {'falta': 'Ninguna cuenta conectada puede editar el calendario viejo (para cortar sus series)'}

    # Quien armaba las series sigue pudiendo editarlas en el calendario nuevo.
    creadores, masters = set(), {}
    partes = {}
    for x in lista:
        for sid in x.get('ids') or [x['id']]:
            try:
                ev = sv.events().get(calendarId=viejo, eventId=sid).execute()
                partes.setdefault(x['id'], []).append(ev)
                if (ev.get('creator') or {}).get('email'):
                    creadores.add(ev['creator']['email'].lower())
            except Exception as e:  # noqa: BLE001
                logger.warning('Team Meetings: no se pudo leer la serie %s: %s', sid, e)
        # La que rige desde ahora: la que empieza más tarde.
        if partes.get(x['id']):
            masters[x['id']] = max(partes[x['id']], key=lambda e: e['start'].get('dateTime') or '')
    uid, cal, creado = _calendario_team(dry, sorted(creadores))
    if not uid:
        return {'falta': 'team@ no está conectada en Work'}
    st = GoogleService.get_service(uid)

    hechas, errores = [], []
    for x in lista:
        ev = masters.get(x['id'])
        if not ev:
            errores.append(f"{x['titulo']}: no se pudo leer")
            continue
        tz = (ev.get('start') or {}).get('timeZone') or x['tz']
        try:
            zona = ZoneInfo(tz)
        except Exception:  # noqa: BLE001
            zona, tz = ZoneInfo('UTC'), 'UTC'
        inicio = datetime.fromisoformat(x['proxima_iso']).astimezone(zona).replace(tzinfo=None)
        fin = inicio + timedelta(minutes=int(x['duracion']))
        regla = [r for r in (ev.get('recurrence') or []) if r.startswith('RRULE:')]
        invitados = [{'email': e} for e in x['invitados']]
        resumen = f"{x['titulo']} · desde {inicio:%d/%m %H:%M} · {len(invitados)} invitados"
        if dry:
            hechas.append(resumen)
            continue
        try:
            cuerpo = {
                'summary': ev.get('summary') or x['titulo'],
                'description': ev.get('description') or '',
                'start': {'dateTime': inicio.isoformat(), 'timeZone': tz},
                'end': {'dateTime': fin.isoformat(), 'timeZone': tz},
                'recurrence': regla,
                'attendees': invitados,
                'guestsCanModify': bool(ev.get('guestsCanModify')),
                'extendedProperties': {'private': {'reemplaza': x['id']}},
                'conferenceData': {'createRequest': {'requestId': uuid.uuid4().hex,
                                                     'conferenceSolutionKey': {'type': 'hangoutsMeet'}}},
            }
            nuevo = st.events().insert(calendarId=cal, body=cuerpo, conferenceDataVersion=1, sendUpdates='all').execute()
            codigo = _codigo(nuevo)
            notas = bool(codigo) and activar_artefactos(nuevo.get('hangoutLink'))
            if codigo and notas:
                st.events().patch(calendarId=cal, eventId=nuevo['id'], sendUpdates='none', body={
                    'extendedProperties': {'private': {'reemplaza': x['id'], MARCA_MEET: codigo}}}).execute()
            # La vieja termina antes de su próxima fecha (UNTIL en UTC): lo pasado queda.
            hasta = (datetime.fromisoformat(x['proxima_iso']).astimezone(timezone.utc) - timedelta(minutes=1)).strftime('%Y%m%dT%H%M%SZ')
            for parte in partes[x['id']]:
                if datetime.fromisoformat(parte['start']['dateTime']) > datetime.fromisoformat(x['proxima_iso']):
                    # Una parte que empieza después de la próxima fecha es toda futura: la cubre la serie de
                    # team@, así que se borra entera (no tiene nada pasado que conservar).
                    sv.events().delete(calendarId=viejo, eventId=parte['id'], sendUpdates='all').execute()
                    continue
                vieja = []
                for r in parte.get('recurrence') or []:
                    if r.startswith('RRULE:') and 'UNTIL=' in r:
                        # Ya termina: solo se acorta si termina después de la próxima fecha.
                        fin_regla = re.search(r'UNTIL=([0-9TZ]+)', r).group(1)
                        if fin_regla.rstrip('Z') <= hasta.rstrip('Z'):
                            vieja.append(r)
                            continue
                    if r.startswith('RRULE:'):
                        r = re.sub(r';(UNTIL|COUNT)=[^;]+', '', r) + f';UNTIL={hasta}'
                    vieja.append(r)
                if vieja != (parte.get('recurrence') or []):
                    sv.events().patch(calendarId=viejo, eventId=parte['id'], sendUpdates='all', body={'recurrence': vieja}).execute()
            hechas.append(resumen + ('' if notas else ' (sin notas automáticas: ver logs [MEET])'))
        except Exception as e:  # noqa: BLE001
            errores.append(f"{x['titulo']}: {str(e)[:160]}")
    return {'calendario': cal, 'creado': creado, 'compartido_con': sorted(creadores), 'series': hechas, 'errores': errores}
