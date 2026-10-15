"""Thalamus como servicio de agenda para la Academia (sesiones del programa de su equipo de fulfillment).

La Academia decide todo (quién da la sesión, duración, margen, horario semanal) y lo manda en cada pedido:
acá no se guarda horario, persona de Thalamus ni reserva. Thalamus pone lo suyo: lo ocupado en Google
Calendar, el cálculo de horarios del núcleo (slots_persona), el evento con Meet que invita al alumno y el
WhatsApp a quien da la sesión. Nada de esto toca Appointment, Client, FinancialAgenda ni Discord de ventas.

Las cuentas son usuarios con el rol `fulfillment` que crea la Academia (PUT /agenda/equipo); se buscan por
email. Contrato completo en docs/agendas_v2_api.md («API de agenda para la Academia»).
"""

import re
from datetime import timedelta
from zoneinfo import ZoneInfo

from flask import current_app, jsonify, request
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy import func

from app import db
from app.agendas_v2 import servicio
from app.agendas_v2.modelos import SchedPerfil
from app.agendas_v2.nucleo.disponibilidad import agenda_opt, ahora_ms, se_solapa, slots_persona
from app.api.external import bp
from app.decorators import require_academy_token
from app.models import GoogleCalendarToken, User
from app.models.user import ROLE_FULFILLMENT

DIA_MS = 86400000
HORA = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$|^24:00$')
SAL_WHATSAPP = 'academia-whatsapp'
VIGENCIA_PRUEBA_S = 15 * 60


def _error(mensaje, codigo):
    return jsonify({'error': mensaje}), codigo


def _cuerpo():
    return request.get_json(silent=True) or {}


def _cuenta(email):
    """La cuenta activa con rol fulfillment (principal o adicional) de ese email, o None."""
    email = (email or '').strip().lower()
    if not email:
        return None
    u = User.query.filter(func.lower(User.email) == email).first()
    return u if u and u.is_active and u.tiene_rol(ROLE_FULFILLMENT) else None


def _preferencias(u):
    """Lo que la Academia eligió para esta cuenta, en su perfil de Thalamus (`sched_perfiles.datos.academia`):
    `calendario_elegido`, `cuenta` (la cuenta de Google con la que se eligió) e `invitar_personal`."""
    fila = db.session.get(SchedPerfil, u.id)
    datos = fila.datos if fila and isinstance(fila.datos, dict) else {}
    return dict(datos.get('academia') or {})


def _guardar_preferencias(u, cambios):
    fila = db.session.get(SchedPerfil, u.id) or SchedPerfil(user_id=u.id, datos={})
    datos = dict(fila.datos) if isinstance(fila.datos, dict) else {}
    datos['academia'] = {**(datos.get('academia') or {}), **cambios}
    fila.datos = datos
    db.session.add(fila)


def _estado(u):
    token = GoogleCalendarToken.query.filter_by(user_id=u.id).first()
    calendar = 'no' if token is None else ('vencido' if token.vencido_en else 'conectado')
    whatsapp = 'sin_numero' if not u.two_chat_number else ('confirmado' if u.whatsapp_confirmado_en else 'pendiente')
    pref = _preferencias(u)
    elegido = calendar == 'conectado' and bool(pref.get('calendario_elegido'))
    return {
        'email': u.email,
        'calendar': calendar,
        'calendario_elegido': elegido,
        # Para mostrar sin consultar a Google: la cuenta conectada y el nombre de su calendario.
        'cuenta': pref.get('cuenta') if elegido else None,
        'calendario_nombre': pref.get('calendario_nombre') if elegido else None,
        'whatsapp': whatsapp,
        'numero': u.two_chat_number or None,
        'invitar_personal': bool(pref.get('invitar_personal')),
        # Sin calendario elegido no se agenda: con una cuenta compartida (team@) caería en su calendario
        # principal y las sesiones de uno bloquearían a los demás.
        'lista': elegido and whatsapp == 'confirmado',
    }


def _usuario_libre(nombre, email):
    base = re.sub(r'\s+', ' ', (nombre or '').strip())[:56] or email.split('@')[0][:56]
    candidato, n = base, 2
    while User.query.filter(func.lower(User.username) == candidato.lower()).first():
        candidato, n = f'{base} {n}', n + 1
    return candidato


# --- Equipo -----------------------------------------------------------------------------------


@bp.route('/agenda/equipo', methods=['PUT'])
@require_academy_token
def agenda_alta():
    """Alta o actualización de una persona del equipo: {email, nombre, tz, telefono}. Si el email ya es de
    una cuenta de NeurOPS con otro rol, solo se le suma `fulfillment` y no se le toca nada más (su número
    es el de sus avisos de ventas)."""
    from app.services.whatchimp_service import WhatchimpService

    datos = _cuerpo()
    email = (datos.get('email') or '').strip().lower()
    if not email or '@' not in email:
        return _error('Falta el email', 400)
    u = User.query.filter(func.lower(User.email) == email).first()
    if u is not None and not u.is_active:
        return _error('La cuenta de NeurOPS de ese email está desactivada', 409)
    tz = datos.get('tz')
    try:
        ZoneInfo(tz) if tz else None
    except Exception:  # noqa: BLE001
        tz = None
    if u is None:
        u = User(username=_usuario_libre(datos.get('nombre'), email), email=email, role=ROLE_FULFILLMENT)
        u.set_unusable_password()
        db.session.add(u)
    elif not u.tiene_rol(ROLE_FULFILLMENT):
        u.roles_extra = ','.join([*(r for r in (u.roles_extra or '').split(',') if r.strip()), ROLE_FULFILLMENT])
    if u._role == ROLE_FULFILLMENT:
        if tz:
            u.timezone = tz
        numero = WhatchimpService.normalize_phone(datos.get('telefono'))
        if numero and 8 <= len(numero) <= 15 and numero != (u.two_chat_number or ''):
            u.two_chat_number = numero
            u.whatsapp_confirmado_en = None
    db.session.commit()
    return jsonify(_estado(u)), 200


@bp.route('/agenda/equipo/<path:email>', methods=['GET'])
@require_academy_token
def agenda_estado(email):
    u = _cuenta(email)
    return jsonify(_estado(u)) if u else _error('No existe esa persona del equipo', 404)


@bp.route('/agenda/equipo/<path:email>/google', methods=['POST'])
@require_academy_token
def agenda_link_google(email):
    """{volver}: ruta de la Academia a la que vuelve después de dar el permiso. → {url}."""
    from app.api.google_calendar import link_para_conectar

    u = _cuenta(email)
    if not u:
        return _error('No existe esa persona del equipo', 404)
    return jsonify({'url': link_para_conectar(u.id, _cuerpo().get('volver'))}), 200


def _calendarios(u, token):
    """{cuenta, calendarios: [{id, nombre, principal, escribe}], destino, conflicto, invitar_personal} de la
    cuenta conectada. Si la cuenta de Google cambió desde que se eligió, la elección se descarta."""
    from app.services.google_service import GoogleService

    todos = GoogleService.list_calendars(u.id, todos=True)
    cuenta = next((c['id'] for c in todos if c.get('primary')), None)
    pref = _preferencias(u)
    if pref.get('calendario_elegido') and cuenta and pref.get('cuenta') and pref['cuenta'] != cuenta:
        token.google_calendar_id, token.calendarios_conflicto = 'primary', None
        _guardar_preferencias(u, {'calendario_elegido': False})
        db.session.commit()
        pref = _preferencias(u)
    return {
        'cuenta': cuenta,
        'calendarios': [{'id': c['id'], 'nombre': c['summary'], 'principal': bool(c.get('primary')),
                         'escribe': bool(c.get('escribe'))} for c in todos],
        'destino': token.google_calendar_id if pref.get('calendario_elegido') else None,
        'conflicto': GoogleService.calendarios_de_conflicto(token) if pref.get('calendario_elegido') else [],
        'invitar_personal': bool(pref.get('invitar_personal')),
    }


def _token_conectado(u):
    from app.services.google_service import GoogleService

    return GoogleService.token_vigente(u.id)


@bp.route('/agenda/equipo/<path:email>/calendarios', methods=['GET'])
@require_academy_token
def agenda_calendarios(email):
    u = _cuenta(email)
    if not u:
        return _error('No existe esa persona del equipo', 404)
    token = _token_conectado(u)
    if not token:
        return _error('Google Calendar no está conectado', 409)
    return jsonify(_calendarios(u, token)), 200


@bp.route('/agenda/equipo/<path:email>/calendarios', methods=['POST'])
@require_academy_token
def agenda_crear_calendario(email):
    """{nombre}: crea un calendario en la cuenta conectada (p. ej. el de cada persona dentro de team@) y lo
    deja como el suyo: ahí se crean sus sesiones y solo ese se revisa para ver lo ocupado."""
    from app.services.google_service import GoogleService

    u = _cuenta(email)
    if not u:
        return _error('No existe esa persona del equipo', 404)
    token = _token_conectado(u)
    if not token:
        return _error('Google Calendar no está conectado', 409)
    nombre = re.sub(r'\s+', ' ', str(_cuerpo().get('nombre') or '')).strip()[:100]
    if not nombre:
        return _error('Falta el nombre del calendario', 400)
    try:
        calendario_id = GoogleService.crear_calendario(u.id, nombre, u.timezone)
    except Exception as e:  # noqa: BLE001
        current_app.logger.warning(f'[AGENDA ACADEMIA] No se pudo crear el calendario de #{u.id}: {e}')
        return _error('google', 502)
    listado = _calendarios(u, token)
    token.google_calendar_id, token.calendarios_conflicto = calendario_id, [calendario_id]
    _guardar_preferencias(u, {'calendario_elegido': True, 'cuenta': listado['cuenta'], 'calendario_nombre': nombre})
    db.session.commit()
    servicio._google_cache.pop(u.id, None)
    return jsonify(_calendarios(u, token)), 200


@bp.route('/agenda/equipo/<path:email>/calendarios', methods=['PUT'])
@require_academy_token
def agenda_elegir_calendario(email):
    """{destino, conflicto: [ids], invitar_personal}: dónde se crean sus sesiones (uno donde puede escribir),
    qué calendarios se revisan para ver lo ocupado (el destino siempre) y si también se invita a su
    calendario personal (su email)."""
    u = _cuenta(email)
    if not u:
        return _error('No existe esa persona del equipo', 404)
    token = _token_conectado(u)
    if not token:
        return _error('Google Calendar no está conectado', 409)
    datos = _cuerpo()
    listado = _calendarios(u, token)
    ids = {c['id'] for c in listado['calendarios']}
    escribibles = {c['id'] for c in listado['calendarios'] if c['escribe']}
    destino = datos.get('destino')
    if destino not in escribibles:
        return _error('Elegí un calendario donde se pueda escribir', 400)
    conflicto = [c for c in (datos.get('conflicto') or []) if isinstance(c, str) and c in ids]
    token.google_calendar_id = destino
    token.calendarios_conflicto = list(dict.fromkeys([destino, *conflicto]))[:20]
    nombre = next((c['nombre'] for c in listado['calendarios'] if c['id'] == destino), None)
    _guardar_preferencias(u, {'calendario_elegido': True, 'cuenta': listado['cuenta'], 'calendario_nombre': nombre,
                              'invitar_personal': bool(datos.get('invitar_personal'))})
    db.session.commit()
    servicio._google_cache.pop(u.id, None)
    return jsonify(_calendarios(u, token)), 200


def _firmador_whatsapp():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SAL_WHATSAPP)


@bp.route('/agenda/equipo/<path:email>/whatsapp/prueba', methods=['POST'])
@require_academy_token
def agenda_whatsapp_prueba(email):
    """Manda el WhatsApp de prueba al número cargado. → {comprobante}, que /confirmar pide de vuelta."""
    from app.services.whatchimp_service import AvisoDeAgenda

    u = _cuenta(email)
    if not u:
        return _error('No existe esa persona del equipo', 404)
    if not u.two_chat_number:
        return _error('Falta el número de WhatsApp', 400)
    try:
        AvisoDeAgenda.prueba(u.two_chat_number, u.username)
    except Exception as e:  # noqa: BLE001  (Whatchimp, red o la clave)
        current_app.logger.warning(f'[AGENDA ACADEMIA] Falló la prueba de WhatsApp de #{u.id}: {e}')
        return _error('No se pudo mandar el mensaje. Revisá el número.', 502)
    return jsonify({'comprobante': _firmador_whatsapp().dumps({'u': u.id, 'n': u.two_chat_number})}), 200


@bp.route('/agenda/equipo/<path:email>/whatsapp/confirmar', methods=['POST'])
@require_academy_token
def agenda_whatsapp_confirmar(email):
    """«Me llegó»: {comprobante} de la prueba a ESE número, de hace menos de 15 minutos."""
    from datetime import datetime

    u = _cuenta(email)
    if not u:
        return _error('No existe esa persona del equipo', 404)
    try:
        datos = _firmador_whatsapp().loads(_cuerpo().get('comprobante') or '', max_age=VIGENCIA_PRUEBA_S)
    except BadSignature:
        return _error('Primero mandate el mensaje de prueba', 400)
    if datos.get('u') != u.id or datos.get('n') != u.two_chat_number:
        return _error('Primero mandate el mensaje de prueba', 400)
    u.whatsapp_confirmado_en = datetime.utcnow()
    db.session.commit()
    return jsonify(_estado(u)), 200


# --- Horarios y reservas ----------------------------------------------------------------------


def _horario(h):
    """{0..6 (0 = domingo): [[HH:MM, HH:MM], ...]} validado, o None. Acepta cualquier minuto (la Academia
    no está atada a las medias horas del editor de Thalamus)."""
    if isinstance(h, list) and len(h) == 7:  # PHP manda {0..6} como lista
        h = dict(enumerate(h))
    if not isinstance(h, dict):
        return None
    out = {}
    for d in range(7):
        franjas = h.get(str(d), h.get(d)) or []
        if not isinstance(franjas, list) or len(franjas) > 12:
            return None
        out[d] = []
        for r in franjas:
            if not (isinstance(r, list) and len(r) == 2 and all(isinstance(x, str) and HORA.match(x) for x in r)):
                return None
            if r[0] >= r[1]:
                return None
            out[d].append(r)
    return out


def _entero(v, minimo, maximo):
    return v if isinstance(v, int) and not isinstance(v, bool) and minimo <= v <= maximo else None


def _franjas_ocupadas(lista):
    out = []
    for r in lista if isinstance(lista, list) else []:
        if isinstance(r, dict) and isinstance(r.get('inicio'), int) and isinstance(r.get('fin'), int):
            out.append({'inicio': r['inicio'], 'fin': r['fin']})
    return out


@bp.route('/agenda/horarios', methods=['POST'])
@require_academy_token
def agenda_horarios():
    """{email, tz, horario, duracion, margen, antel_min, dias, ocupado: [{inicio, fin}], fresco} → {slots: [ms],
    google: si se pudo leer su calendario}. `ocupado`: lo que la persona ya tiene en la Academia. `fresco`:
    lee Google sin caché (para confirmar un horario justo antes de reservarlo)."""
    from app.services.google_service import GoogleService

    datos = _cuerpo()
    u = _cuenta(datos.get('email'))
    if not u:
        return _error('No existe esa persona del equipo', 404)
    estado = _estado(u)
    if not estado['lista']:
        return jsonify({'error': 'no_lista', **estado}), 409
    tz, horario = datos.get('tz') or u.timezone, _horario(datos.get('horario'))
    try:
        ZoneInfo(tz)
    except Exception:  # noqa: BLE001
        return _error('Zona horaria inválida', 400)
    dur, margen = _entero(datos.get('duracion'), 5, 240), _entero(datos.get('margen', 0), 0, 120)
    antel, dias = _entero(datos.get('antel_min', 0), 0, 30 * 24 * 60), _entero(datos.get('dias', 21), 1, 60)
    if horario is None or None in (dur, margen, antel, dias):
        return _error('Datos inválidos (horario, duracion, margen, antel_min o dias)', 400)

    ahora = ahora_ms()
    desde, hasta = ahora - 3600000, ahora + (dias + 2) * DIA_MS
    if datos.get('fresco'):
        franjas = GoogleService.franjas_ocupadas(u.id, servicio.ms_a_dt(desde), servicio.ms_a_dt(hasta))
    else:
        franjas = servicio._franjas_google(u.id, desde, hasta)
    ocupado = _franjas_ocupadas(datos.get('ocupado')) + [{'inicio': a, 'fin': b} for a, b in franjas or []]
    o = agenda_opt({
        'reservas': {'modo': 'dias', 'n': dias, 'tipo': 'corridos', 'desde': '', 'hasta': ''},
        'antel': {'n': antel, 'u': 'min'},
        'paso': {'n': 30, 'u': 'min'},
    }, dur)
    slots = slots_persona({'id': f'f-{u.id}', 'tz': tz, 'horario': horario}, dur, o, ahora,
                          lambda pid, t, d: se_solapa(ocupado, t, d), margen)
    return jsonify({'slots': slots, 'google': franjas is not None}), 200


def _aviso(u, inicio, tz, sesion, alumno):
    """WhatsApp a quien da la sesión, con la plantilla del aviso de agenda. Nunca frena la reserva."""
    from app.agendas_v2.operacion import DIAS
    from app.services.whatchimp_service import AvisoDeAgenda

    try:
        local = servicio.ms_a_dt(inicio).replace(tzinfo=ZoneInfo('UTC')).astimezone(ZoneInfo(tz))
        hora = local.strftime('%I:%M').lstrip('0') + (' am' if local.hour < 12 else ' pm')
        AvisoDeAgenda.enviar(u.two_chat_number, closer=u.username, lead=alumno or 'Alumno', telefono='-', instagram='-',
                             dia=f'{DIAS[local.weekday()]} {local.day}', hora=hora, grupo='Academia', fuente=sesion or '-')
    except Exception as e:  # noqa: BLE001
        current_app.logger.warning(f'[AGENDA ACADEMIA] No se pudo avisar por WhatsApp a #{u.id}: {e}')


@bp.route('/agenda/reservas', methods=['POST'])
@require_academy_token
def agenda_reservar():
    """{email, inicio (ms), duracion, titulo, descripcion, invitado: {nombre, email}, aviso: {sesion, alumno}}
    → {event_id, calendar_id, meet}. No revisa disponibilidad: la Academia ya la confirmó con /horarios
    (fresco) o es una fecha que se acordó por fuera. Crea el evento con Meet y avisa por WhatsApp."""
    from app.services.google_service import GoogleService

    datos = _cuerpo()
    u = _cuenta(datos.get('email'))
    if not u:
        return _error('No existe esa persona del equipo', 404)
    estado = _estado(u)
    if not estado['calendario_elegido']:
        return _error('no_lista', 409)
    inicio, dur = datos.get('inicio'), _entero(datos.get('duracion'), 5, 240)
    if not isinstance(inicio, int) or dur is None:
        return _error('Datos inválidos (inicio o duracion)', 400)
    invitado = datos.get('invitado') or {}
    aviso = datos.get('aviso') or {}
    inicio_dt = servicio.ms_a_dt(inicio)
    calendar_id = GoogleService._calendario(u.id)
    # Su calendario personal (su email), si lo pidió y no es la misma cuenta que la conectada.
    personal = [u.email] if estado['invitar_personal'] and u.email != _preferencias(u).get('cuenta') else []
    try:
        event_id, meet = GoogleService.crear_evento_con_meet(
            u.id, inicio_dt, inicio_dt + timedelta(minutes=dur), str(datos.get('titulo') or 'Sesión')[:200],
            str(datos.get('descripcion') or '')[:4000], invitado_email=(invitado.get('email') or None),
            **({'otros_invitados': personal} if personal else {}))
    except Exception as e:  # noqa: BLE001
        current_app.logger.warning(f'[AGENDA ACADEMIA] No se pudo crear el evento de #{u.id}: {e}')
        return _error('google', 502)
    servicio._google_cache.pop(u.id, None)  # lo recién reservado ya cuenta en la próxima consulta
    _aviso(u, inicio, datos.get('tz') or u.timezone, aviso.get('sesion'), aviso.get('alumno') or invitado.get('nombre'))
    return jsonify({'event_id': event_id, 'calendar_id': calendar_id, 'meet': meet}), 200


@bp.route('/agenda/reservas/<event_id>', methods=['PATCH'])
@require_academy_token
def agenda_mover(event_id):
    """{email, calendar_id, inicio (ms), duracion}: mueve el evento; Google avisa al alumno."""
    from app.services.google_service import GoogleService

    datos = _cuerpo()
    u = _cuenta(datos.get('email'))
    if not u:
        return _error('No existe esa persona del equipo', 404)
    inicio, dur = datos.get('inicio'), _entero(datos.get('duracion'), 5, 240)
    if not isinstance(inicio, int) or dur is None:
        return _error('Datos inválidos (inicio o duracion)', 400)
    inicio_dt = servicio.ms_a_dt(inicio)
    try:
        GoogleService.mover_evento(u.id, event_id, inicio_dt, inicio_dt + timedelta(minutes=dur),
                                   calendar_id=datos.get('calendar_id'))
    except Exception as e:  # noqa: BLE001
        current_app.logger.warning(f'[AGENDA ACADEMIA] No se pudo mover el evento {event_id} de #{u.id}: {e}')
        return _error('google', 502)
    servicio._google_cache.pop(u.id, None)
    return jsonify({'ok': True}), 200


@bp.route('/agenda/reservas/<event_id>', methods=['DELETE'])
@require_academy_token
def agenda_cancelar(event_id):
    """{email, calendar_id}: borra el evento; Google le avisa la cancelación al alumno."""
    from app.services.google_service import GoogleService

    datos = {**request.args.to_dict(), **_cuerpo()}
    u = _cuenta(datos.get('email'))
    if not u:
        return _error('No existe esa persona del equipo', 404)
    ok = GoogleService.delete_event(u.id, event_id, calendar_id=datos.get('calendar_id'), avisar=True)
    servicio._google_cache.pop(u.id, None)
    return jsonify({'ok': ok}), 200


# --- Reuniones de equipo ----------------------------------------------------------------------
# Reuniones que se repiten (las de equipo y las 1:1 diarias): la Academia las declara y acá se crea un solo
# evento de Google que se repite, en el calendario elegido de quien la organiza, con Meet, invitando al email
# de la cuenta de cada participante. Como el resto de la agenda, acá no se guarda nada.

FECHA = re.compile(r'^\d{4}-\d{2}-\d{2}$')
BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']  # 0 = domingo, como la Academia
EMAIL = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _reunion(datos):
    """Valida el cuerpo de una reunión. → (inicio_local, fin_local, tz, recurrencia, invitados) o un error 400."""
    from datetime import datetime

    tz, fecha, hora = datos.get('tz'), datos.get('fecha'), datos.get('hora')
    try:
        zona = ZoneInfo(tz)
    except Exception:  # noqa: BLE001
        return None, _error('Zona horaria inválida', 400)
    dur = _entero(datos.get('duracion'), 5, 480)
    dias = datos.get('dias')
    if not (isinstance(fecha, str) and FECHA.match(fecha)
            and isinstance(hora, str) and HORA.match(hora) and hora != '24:00'
            and dur is not None and isinstance(dias, list) and dias
            and all(isinstance(d, int) and not isinstance(d, bool) and 0 <= d <= 6 for d in dias)):
        return None, _error('Datos inválidos (fecha, hora, duracion o dias)', 400)
    inicio = datetime.strptime(f'{fecha} {hora}', '%Y-%m-%d %H:%M')
    regla = 'RRULE:FREQ=WEEKLY;BYDAY=' + ','.join(BYDAY[d] for d in sorted(set(dias)))
    hasta = datos.get('hasta')
    if hasta:
        if not (isinstance(hasta, str) and FECHA.match(hasta)):
            return None, _error('Datos inválidos (hasta)', 400)
        # Con inicio en una zona, UNTIL va en UTC: el final de ese día en la zona de la reunión.
        fin_dia = datetime.strptime(hasta, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=zona)
        regla += ';UNTIL=' + fin_dia.astimezone(ZoneInfo('UTC')).strftime('%Y%m%dT%H%M%SZ')
    recurrencia = [regla]
    saltear = [f for f in (datos.get('saltear') or []) if isinstance(f, str) and FECHA.match(f)]
    if saltear:
        hhmm = hora.replace(':', '') + '00'
        fechas = ','.join(f.replace('-', '') + 'T' + hhmm for f in sorted(set(saltear)))
        recurrencia.append(f'EXDATE;TZID={tz}:{fechas}')
    invitados = [e.strip().lower() for e in (datos.get('invitados') or [])
                 if isinstance(e, str) and EMAIL.match(e.strip())]
    return (inicio, inicio + timedelta(minutes=dur), tz, recurrencia, invitados), None


def _textos(datos):
    """(titulo, descripcion) de la reunión, recortados a lo que acepta Google."""
    return str(datos.get('titulo') or 'Reunión')[:200], str(datos.get('descripcion') or '')[:4000]


@bp.route('/agenda/reuniones', methods=['POST'])
@require_academy_token
def agenda_reunion_crear():
    """{email (quien organiza), tz, fecha (la primera), hora, duracion, dias [0 = domingo], titulo, descripcion,
    invitados [emails], saltear [fechas], hasta?} → {event_id, calendar_id, meet}. Solo pide su calendario elegido
    (no el WhatsApp: acá no se avisa por WhatsApp)."""
    from app.services.google_service import GoogleService

    datos = _cuerpo()
    u = _cuenta(datos.get('email'))
    if not u:
        return _error('No existe esa persona del equipo', 404)
    if not _estado(u)['calendario_elegido']:
        return _error('no_lista', 409)
    r, error = _reunion(datos)
    if error:
        return error
    inicio, fin, tz, recurrencia, invitados = r
    calendar_id = GoogleService._calendario(u.id)
    try:
        event_id, meet = GoogleService.crear_reunion(
            u.id, inicio, fin, tz, *_textos(datos), recurrencia, invitados)
    except Exception as e:  # noqa: BLE001
        current_app.logger.warning(f'[AGENDA ACADEMIA] No se pudo crear la reunión de #{u.id}: {e}')
        return _error('google', 502)
    servicio._google_cache.pop(u.id, None)
    return jsonify({'event_id': event_id, 'calendar_id': calendar_id, 'meet': meet}), 200


@bp.route('/agenda/reuniones/<event_id>', methods=['PATCH'])
@require_academy_token
def agenda_reunion_editar(event_id):
    """Lo mismo que al crear, más calendar_id (donde se creó): reescribe la serie y Google avisa a los invitados.
    Para terminarla sin borrar lo que ya pasó, se manda `hasta`."""
    from app.services.google_service import GoogleService

    datos = _cuerpo()
    u = _cuenta(datos.get('email'))
    if not u:
        return _error('No existe esa persona del equipo', 404)
    r, error = _reunion(datos)
    if error:
        return error
    inicio, fin, tz, recurrencia, invitados = r
    try:
        GoogleService.editar_reunion(u.id, event_id, datos.get('calendar_id'), inicio, fin, tz, *_textos(datos),
                                     recurrencia, invitados)
    except Exception as e:  # noqa: BLE001
        current_app.logger.warning(f'[AGENDA ACADEMIA] No se pudo editar la reunión {event_id} de #{u.id}: {e}')
        return _error('google', 502)
    servicio._google_cache.pop(u.id, None)
    return jsonify({'ok': True}), 200


@bp.route('/agenda/reuniones/<event_id>', methods=['DELETE'])
@require_academy_token
def agenda_reunion_borrar(event_id):
    """{email, calendar_id}: borra la serie entera; Google les avisa a los invitados."""
    from app.services.google_service import GoogleService

    datos = {**request.args.to_dict(), **_cuerpo()}
    u = _cuenta(datos.get('email'))
    if not u:
        return _error('No existe esa persona del equipo', 404)
    ok = GoogleService.delete_event(u.id, event_id, calendar_id=datos.get('calendar_id'), avisar=True)
    servicio._google_cache.pop(u.id, None)
    return jsonify({'ok': ok}), 200
