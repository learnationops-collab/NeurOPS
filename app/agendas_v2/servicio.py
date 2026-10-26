"""Servicio de Agendas 2.0: documentos de Thalamus, version de cambios y reservas.

Todo documento que entra pasa por el normalizador del nucleo (el mismo esquema que el frontend).
Las reservas se escriben en la operacion (operacion.py) y nunca confian en lo que calculo el
navegador: se revalidan las respuestas contra la version PUBLICADA del evento, se recalcula la
asignacion con las agendas reales y, antes de escribir, se bloquea al closer y se comprueba que
siga libre.
"""

import hashlib
import logging
import re
import time
from datetime import datetime, timedelta, timezone

from app import db
from app.agendas_v2 import avisos_discord, desplazar, operacion, trazabilidad
from app.agendas_v2.modelos import MODELOS, SchedConfig, SchedIntento, SchedPerfil
from app.agendas_v2.nucleo.asignacion import asignacion
from app.agendas_v2.nucleo.catalogos import (
    DURACIONES,
    ESTRATEGIAS,
    HORAS,
    MARGENES,
    PAIS_OTRO,
    PAISES,
    TZ_DEF,
    ZONAS,
    con_opciones,
    zona_por_telefono,
    zona_valida,
)
from app.agendas_v2.nucleo.datos import buscar, nombre_origen, ordenados, rol_closer, sesion_de
from app.agendas_v2.nucleo.disponibilidad import se_solapa
from app.agendas_v2.nucleo.segmento import segmentar
from app.agendas_v2.nucleo.eventos import con_form_al_dia, config_de, link_evento, slug_libre, version_publicada
from app.agendas_v2.nucleo.formulario import grupo_por_reglas, limpiar_respuesta, texto_regla, validar_respuesta
from app.agendas_v2.nucleo.normalizar import (
    COLECCIONES,
    NORM,
    contacto_preguntas,
    foto_ok,
    normal_integ,
    normal_sesiones,
    normal_perfil,
    preguntas_flujo,
)
from app.agendas_v2.nucleo.ocupacion import opciones_de_ocupacion
from app.agendas_v2.nucleo.reserva import armar_reserva, telefono_e164
from app.agendas_v2.nucleo.util import slugify, uid
from app.services.learnation_service import LearnationAPIError, LearnationService

log = logging.getLogger(__name__)

DIA_MS = 86400000
# Las agendas de la operacion (Appointment) no guardan duracion: cada una bloquea 60 minutos.
DURACION_AGENDA_OPERACION_MIN = 60
# Reservas que viajan al panel: las futuras y las de los ultimos 35 dias (Available, KPIs, ocupacion).
VENTANA_ESTADO_DIAS = 35
# Conflictos en Google Calendar: hasta cuántos días se miran y cuánto se guarda lo leído de cada closer.
VENTANA_GOOGLE_DIAS = 60
CACHE_GOOGLE_S = 120
# Una agenda recién tomada puede no estar todavía en lo leído de Google (caché o evento en camino):
# hasta este tiempo después de creada, bloquea aunque Google no la muestre.
GRACIA_GOOGLE = timedelta(minutes=10)
# Stats: cuántos días de leads viajan (el período más largo, 90 días, y el anterior para comparar).
VENTANA_STATS_DIAS = 180
LARGO_MAX_TEXTO = {'texto': 300, 'parrafo': 2000, 'email': 120, 'telefono': 40, 'instagram': 30}


class ReservaRechazadaError(Exception):
    """El horario ya no esta libre (code='ocupado') o los datos no sirven (code='invalido')."""

    def __init__(self, code, errores=None):
        super().__init__(code)
        self.code = code
        self.errores = errores or {}


def ahora_ms():
    return int(time.time() * 1000)


def ms_a_dt(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


def dt_a_ms(dt):
    return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000) if dt else None


# --- Version de cambios -------------------------------------------------------------------------


def version():
    fila = db.session.get(SchedConfig, 'version')
    return int((fila.datos or {}).get('n', 0)) if fila else 0


def _subir_version():
    """Cada escritura sube el contador: el panel lo consulta para traer los cambios de otros."""
    fila = db.session.get(SchedConfig, 'version')
    if not fila:
        fila = SchedConfig(clave='version', datos={'n': 0})
        db.session.add(fila)
    fila.datos = {'n': int((fila.datos or {}).get('n', 0)) + 1}
    return fila.datos['n']


# --- Documentos de Thalamus ---------------------------------------------------------------------


def colecciones():
    """{col: [doc normalizado, ...]} ordenado como lo ordena el frontend."""
    d = {}
    for col in COLECCIONES:
        filas = MODELOS[col].query.all()
        d[col] = [NORM[col](f.id, f.datos or {}) for f in filas]
        d[col].sort(key=lambda x: (x.get('orden') or 0, str(x.get('nombre', ''))))
    return d


def _email_de_cuenta(email):
    """Id del usuario de la app con ese email (para unir una persona de Team con su cuenta)."""
    if not email:
        return None
    from app.models.user import User

    u = User.query.filter(db.func.lower(User.email) == email.lower()).first()
    return u.id if u else None


def zona_para_ver(u):
    """La zona en la que alguien mira la semana del equipo (Available): la del país de su WhatsApp; sin
    número, la que eligió (users.timezone); si no, None y decide su navegador."""
    tz = zona_por_telefono(u.two_chat_number)
    if tz:
        return tz
    return u.timezone if u.timezone and u.timezone != TZ_DEF and zona_valida(u.timezone) else None


def zona_de_usuario(u):
    """La zona horaria de un usuario: la que eligió (users.timezone) si no es la de por defecto; si no,
    la del país de su WhatsApp; si no, la de por defecto."""
    if u.timezone and u.timezone != TZ_DEF and zona_valida(u.timezone):
        return u.timezone
    return zona_por_telefono(u.two_chat_number) or TZ_DEF


def persona_de_usuario(d, user):
    """La persona de Team de ese usuario (por email), o None."""
    email = (user.email or '').strip().lower()
    return next((p for p in d['personas'] if email and (p.get('email') or '').lower() == email), None)


def disponibilidad_de(user):
    """Lo que el closer ve en su Configuración: su horario semanal (el de su persona de Team, el mismo que
    edita la dirección comercial en Agendamiento) y su zona horaria."""
    p = persona_de_usuario(colecciones(), user)
    return {
        'en_team': bool(p),
        'horario': p['horario'] if p else NORM['personas']('x', {'horario': {}})['horario'],
        'tz': p['tz'] if p and p['tz'] != TZ_DEF else zona_de_usuario(user),
        'zonas': [{'tz': z['tz'], 'n': z['n']} for z in ZONAS],
        'horas': HORAS,
    }


def _persona_nueva(d, user, **campos):
    """Crea la persona de Team de un closer que todavía no está (así la dirección comercial lo ve)."""
    pid = uid('d')
    guardar_doc('personas', pid, {
        'nombre': user.username, 'email': (user.email or '').lower(), 'rol': rol_closer(d),
        'orden': max([x.get('orden') or 0 for x in ordenados(d, 'personas')] or [0]) + 1, **campos,
    }, usuario_id=user.id)
    return buscar(colecciones(), 'personas', pid)


def guardar_disponibilidad(user, horario, tz):
    """Guarda el horario y la zona del closer en su persona de Team (si no está en Team, la crea: así la
    dirección comercial lo ve y lo puede sumar a una prioridad). La zona también queda en su cuenta."""
    if not zona_valida(tz):
        raise ValueError('Elegí una zona horaria de la lista.')
    d = colecciones()
    p = persona_de_usuario(d, user)
    if p:
        guardar_doc('personas', p['id'], {'horario': horario, 'tz': tz}, usuario_id=user.id, parcial=True)
    else:
        _persona_nueva(d, user, horario=horario, tz=tz)
    user.timezone = tz
    db.session.commit()
    return disponibilidad_de(user)


# --- Lo propio de cada closer: su foto y sus eventos ------------------------------------------


def foto_de(user):
    """La foto de la cuenta: la de su persona de Team, o la de su perfil de Agendamiento."""
    p = persona_de_usuario(colecciones(), user)
    return (p or {}).get('foto') or perfil_de(user.id).get('foto') or ''


def guardar_foto(user, foto):
    """Guarda la foto (data URL JPG/PNG/WEBP chica, o '' para sacarla) en su persona de Team y en su perfil."""
    f = foto_ok(foto) if foto else ''
    if foto and not f:
        raise ValueError('La foto tiene que ser JPG, PNG o WEBP y pesar menos de 100 KB.')
    p = persona_de_usuario(colecciones(), user)
    if p:
        guardar_doc('personas', p['id'], {'foto': f}, usuario_id=user.id, parcial=True)
    guardar_perfil(user.id, {**perfil_de(user.id), 'foto': f})
    return f


# Lo que el closer puede tocar de sus eventos. La persona (él) y el funnel (ninguno) los pone el servidor.
CAMPOS_EVENTO_CLOSER = (
    'nombre', 'duracion', 'margen', 'formulario', 'activo', 'desc', 'redir', 'indic',
    'reservas', 'antel', 'paso', 'zona',
)


def _evento_de_closer(d, e):
    return {**e, 'link': link_evento(d, e)}


def _eventos_compartidos(d):
    """Los eventos que no son de un closer en particular: en esos cada closer ajusta su sesión."""
    return [e for e in ordenados(d, 'eventos') if not e.get('persona')]


def sesiones_de(user):
    """Lo que el closer ve en «Mis sesiones»: cada evento compartido con la propuesta del director
    (duracion, margen) y lo que él ajustó (propia: {duracion?, margen?}), y su horario (para mostrarle
    cuántas sesiones le entran). Sus eventos propios se ajustan en «Mis eventos»."""
    d = colecciones()
    p = persona_de_usuario(d, user)
    propias = (p or {}).get('sesiones') or {}
    return {
        'en_team': bool(p),
        'horario': p['horario'] if p else None,
        'eventos': [
            {'id': e['id'], 'nombre': e['nombre'], 'activo': e['activo'], 'duracion': e['duracion'],
             'margen': e['margen'], 'propia': propias.get(e['id'], {})}
            for e in _eventos_compartidos(d)
        ],
        'duraciones': DURACIONES,
        'margenes': MARGENES,
    }


def guardar_sesiones(user, sesiones):
    """Guarda lo que el closer ajustó ({evento_id: {duracion?, margen?}}, entero: lo que no viene vuelve a
    la propuesta) en su persona de Team; si no está en Team, la crea."""
    d = colecciones()
    ids = {e['id'] for e in _eventos_compartidos(d)}
    limpias = {k: v for k, v in normal_sesiones(sesiones).items() if k in ids}
    p = persona_de_usuario(d, user)
    if p:
        guardar_doc('personas', p['id'], {'sesiones': limpias}, usuario_id=user.id, parcial=True)
    else:
        _persona_nueva(d, user, sesiones=limpias)
    db.session.commit()
    return sesiones_de(user)


def eventos_de_closer(user):
    """Los eventos propios del closer (persona fija = él) y los formularios que puede usar."""
    d = colecciones()
    p = persona_de_usuario(d, user)
    evs = [_evento_de_closer(d, e) for e in ordenados(d, 'eventos') if p and e.get('persona') == p['id']]
    return {
        'eventos': evs,
        'formularios': [{'id': f['id'], 'nombre': f['nombre']} for f in ordenados(d, 'formularios')],
    }


def guardar_evento_de_closer(user, evento_id, cuerpo):
    """Crea o edita un evento propio del closer y lo publica (no tiene borrador). Lanza PermissionError
    si el evento es de otro y ValueError si el formulario no existe. Sin formulario, pide solo el contacto."""
    d = colecciones()
    p = persona_de_usuario(d, user) or _persona_nueva(d, user)
    d = colecciones()
    previo = buscar(d, 'eventos', evento_id)
    if previo and previo.get('persona') != p['id']:
        raise PermissionError('Ese evento no es tuyo.')
    datos = {k: cuerpo[k] for k in CAMPOS_EVENTO_CLOSER if k in cuerpo}
    if datos.get('formulario') and not buscar(d, 'formularios', datos['formulario']):
        raise ValueError('Ese formulario no existe.')
    base = {**(previo or {}), **datos, 'persona': p['id'], 'funnel': ''}
    if not previo:
        base['orden'] = max([x.get('orden') or 0 for x in d['eventos']] or [0]) + 1
        nombre = str(base.get('nombre') or 'llamada')
        base['slug'] = slug_libre(d, {'id': evento_id, 'funnel': ''}, slugify(p['nombre'] + ' ' + nombre) or evento_id)
    e = NORM['eventos'](evento_id, base)
    form = buscar(d, 'formularios', e['formulario']) if e['formulario'] else None
    e['publicado'] = config_de(e, form)
    guardar_doc('eventos', evento_id, e, usuario_id=user.id)
    d = colecciones()
    return _evento_de_closer(d, buscar(d, 'eventos', evento_id))


def borrar_evento_de_closer(user, evento_id):
    """Borra un evento propio. PermissionError si es de otro; False si ya no estaba."""
    d = colecciones()
    p = persona_de_usuario(d, user)
    e = buscar(d, 'eventos', evento_id)
    if not e:
        return False
    if not p or e.get('persona') != p['id']:
        raise PermissionError('Ese evento no es tuyo.')
    return borrar_doc('eventos', evento_id)


def usuarios_del_equipo(roles):
    """Usuarios activos de la app con esos roles: {id, nombre, email, rol, tz, calendar}. Para sumarlos
    a Team. `calendar`: si conecto su Google Calendar (sin eso un closer no recibe agendas)."""
    from app.models.user import User

    filas = User.query.filter(User.role.in_(roles), User.is_active.is_(True)).order_by(User.username).all()
    con_calendar = _con_calendar({u.id for u in filas})
    con_whatsapp = _con_whatsapp({u.id for u in filas})
    return [
        {
            'id': u.id,
            'nombre': u.username or '',
            'codigo': codigo_setter(u.id),
            'email': (u.email or '').lower(),
            # Una cuenta puede tener varios roles (users.roles_extra): vale el primero de `roles` que tenga.
            'rol': next((r for r in roles if u.tiene_rol(r)), u.role),
            'tz': zona_de_usuario(u),
            'calendar': u.id in con_calendar,
            'whatsapp': u.id in con_whatsapp,
        }
        for u in filas
    ]


def guardar_doc(col, doc_id, datos, usuario_id=None, parcial=False):
    """Crea o reemplaza (parcial=False) o mezcla campos (parcial=True). Devuelve el doc normalizado
    o None si `parcial` y el documento no existe."""
    modelo = MODELOS[col]
    fila = db.session.get(modelo, doc_id)
    if parcial and not fila:
        return None
    base = dict(fila.datos or {}) if (fila and parcial) else {}
    base.update({k: v for k, v in (datos or {}).items() if k != 'id'})
    doc = NORM[col](doc_id, base)
    guardado = {k: v for k, v in doc.items() if k != 'id'}
    if not fila:
        fila = modelo(id=doc_id)
        db.session.add(fila)
    fila.datos = guardado
    fila.orden = doc.get('orden') or 0
    fila.actualizado_por_id = usuario_id
    if col == 'personas':
        fila.email = doc.get('email') or None
        fila.user_id = _email_de_cuenta(fila.email)
    if col == 'formularios':
        republicar_form(doc)
    _subir_version()
    db.session.commit()
    return doc


def republicar_form(form):
    """Los eventos publicados con este formulario pasan a su versión nueva; lo demás del evento queda
    como se publicó. No hace commit."""
    for fila in db.session.query(MODELOS['eventos']).all():
        e = fila.datos or {}
        if e.get('formulario') != form.get('id'):
            continue
        nuevo = con_form_al_dia(e, form)
        if nuevo:
            fila.datos = {**e, 'publicado': nuevo}


def borrar_doc(col, doc_id):
    fila = db.session.get(MODELOS[col], doc_id)
    if not fila:
        return False
    db.session.delete(fila)
    _subir_version()
    db.session.commit()
    return True


def perfil_de(usuario_id):
    fila = db.session.get(SchedPerfil, usuario_id)
    return normal_perfil(fila.datos if fila else None)


def guardar_perfil(usuario_id, datos):
    perfil = normal_perfil(datos)
    fila = db.session.get(SchedPerfil, usuario_id) or SchedPerfil(user_id=usuario_id)
    # `academia`: preferencias que guarda la API de agenda de la Academia (app/api/external/agenda.py).
    academia = (fila.datos or {}).get('academia') if isinstance(fila.datos, dict) else None
    fila.datos = {**perfil, 'academia': academia} if academia else perfil
    db.session.add(fila)
    db.session.commit()
    return perfil


def integraciones():
    fila = db.session.get(SchedConfig, 'integraciones')
    return normal_integ(fila.datos if fila else None)


def guardar_integraciones(datos):
    integ = normal_integ(datos)
    fila = db.session.get(SchedConfig, 'integraciones') or SchedConfig(clave='integraciones')
    fila.datos = integ
    db.session.add(fila)
    _subir_version()
    db.session.commit()
    return integ


# --- Reservas -----------------------------------------------------------------------------------


def _duracion_min(appt):
    """Lo que dura una agenda: la de Agendas 2.0 trae su duracion; las de n8n, 60 minutos."""
    return int((appt.agenda_payload or {}).get('duracion_min') or DURACION_AGENDA_OPERACION_MIN)


def _bloque_min(appt):
    """Lo que una agenda le ocupa al closer: la sesión y el margen que se reservó después."""
    return _duracion_min(appt) + int((appt.agenda_payload or {}).get('margen_min') or 0)


def _vigente(appt):
    return not appt.closer_processed and (appt.result or '') not in operacion.RESULTADOS_NO_VIGENTES


def reserva_a_dict(appt):
    """Una agenda de Agendas 2.0 en el formato de reserva que usa el frontend (el de adaptadorLocal)."""
    inicio = dt_a_ms(appt.start_time)
    return {
        **(appt.agenda_payload or {}),
        'id': str(appt.id),
        'estado': 'agendada' if _vigente(appt) else 'cancelada',
        # Si dejó de estar agendada porque se canceló o reprogramó (no porque el closer ya la procesó).
        'cancelada': (appt.result or '') in operacion.RESULTADOS_NO_VIGENTES,
        'inicio_ms': inicio,
        'fin_ms': inicio + _duracion_min(appt) * 60000 if inicio is not None else None,
        'creada': appt.created_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
        if appt.created_at
        else None,
    }


def reservas_para_estado(ahora=None):
    """Las agendas tomadas por Agendas 2.0 (las que tienen payload) de los ultimos 35 dias y futuras."""
    from app.models import Appointment

    desde = ms_a_dt((ahora or ahora_ms()) - VENTANA_ESTADO_DIAS * DIA_MS)
    filas = (
        Appointment.query.filter(Appointment.agenda_payload.isnot(None), Appointment.start_time >= desde)
        .order_by(Appointment.created_at)
        .all()
    )
    return [reserva_a_dict(a) for a in filas]


def _usuarios_de_personas(d):
    """{persona_id: user_id} de las personas de Team cuyo email es el de un usuario ACTIVO de la app.
    Se resuelve en cada pedido (no con sched_personas.user_id) para que una cuenta nueva cuente ya."""
    from app.models.user import User

    por_email = {}
    for p in d['personas']:
        if p.get('email'):
            por_email.setdefault(p['email'].lower(), []).append(p['id'])
    if not por_email:
        return {}
    usuarios = User.query.filter(db.func.lower(User.email).in_(list(por_email)), User.is_active.is_(True)).all()
    return {pid: u.id for u in usuarios for pid in por_email.get((u.email or '').lower(), [])}


def _con_calendar(user_ids):
    from app.models.user import GoogleCalendarToken

    if not user_ids:
        return set()
    # Un token que Google rechazó (vencido_en) no cuenta: sin él no hay evento ni Meet.
    filas = GoogleCalendarToken.query.filter(
        GoogleCalendarToken.user_id.in_(list(user_ids)), GoogleCalendarToken.vencido_en.is_(None)
    ).all()
    return {t.user_id for t in filas}


def _con_whatsapp(user_ids):
    """Los que confirmaron su WhatsApp en Configuración: ahí les llega el aviso de cada agenda."""
    from app.models.user import User

    if not user_ids:
        return set()
    filas = User.query.filter(User.id.in_(list(user_ids)), User.whatsapp_confirmado_en.isnot(None),
                              User.two_chat_number.isnot(None), User.two_chat_number != '').all()
    return {u.id for u in filas}


def solo_elegibles(d):
    """Copia de `d` donde una persona sin usuario activo, sin Google Calendar conectado o sin su
    WhatsApp confirmado no tiene horario: no se le ofrece nada y el nucleo la saltea (y desborda) como a un closer sin horas.
    Devuelve (d, {persona_id: user_id} de las elegibles)."""
    usuarios = _usuarios_de_personas(d)
    listos = _con_calendar(set(usuarios.values())) & _con_whatsapp(set(usuarios.values()))
    elegibles = {pid: user_id for pid, user_id in usuarios.items() if user_id in listos}
    personas = [p if p['id'] in elegibles else {**p, 'horario': {}} for p in d['personas']]
    return {**d, 'personas': personas}, elegibles


def sigue_en_google(appt, franjas, ahora=None, leido_desde=None):
    """Si una agenda vigente en NeurOPS sigue ocupando según Google Calendar, que es la certeza: con su
    calendario leído (`franjas`, [(inicio, fin)] ms), solo si a esa hora hay algo ocupado; una agenda
    cuyo evento se canceló, se borró o se marcó «Disponible» ya no bloquea, aunque en NeurOPS siga
    abierta (no se la toca). franjas None: no se sabe y bloquea. Las recién creadas, y las que empiezan
    antes de lo leído (`leido_desde`, ms), bloquean igual."""
    t = dt_a_ms(appt.start_time)
    if franjas is None or (leido_desde is not None and t < leido_desde):
        return True
    ahora = ahora or datetime.utcnow()
    if appt.created_at and appt.created_at >= ahora - GRACIA_GOOGLE:
        return True
    return any(a <= t < b for a, b in franjas)


def _agendas_de_operacion(elegibles, desde, franjas_de=None, leido_desde=None, excluir=()):
    """Agendas vigentes de esos closers (Appointment), como reservas del nucleo. Las de Agendas 2.0
    duran lo que dura su evento; las que entran por n8n, 60 minutos. franjas_de: {user_id: lo leído de
    su Google, o None} desde `leido_desde` (ms); con su calendario leído, solo las que siguen ahí
    (sigue_en_google). excluir: ids que no cuentan (las C/D que puede tomar un lead A/B, desplazar.py)."""
    from app.models import Appointment

    if not elegibles:
        return []
    persona_de = {}
    for pid, user_id in elegibles.items():
        persona_de.setdefault(user_id, []).append(pid)
    filas = Appointment.query.filter(
        Appointment.closer_id.in_(list(persona_de)),
        Appointment.start_time.isnot(None),
        Appointment.start_time >= desde - timedelta(hours=4),
        *operacion.filtro_vigente(),
    ).all()
    franjas_de = franjas_de or {}
    filas = [
        a for a in filas
        if a.id not in excluir and sigue_en_google(a, franjas_de.get(a.closer_id), leido_desde=leido_desde)
    ]
    return [
        {
            'estado': 'agendada',
            'closer_id': pid,
            'inicio_ms': dt_a_ms(a.start_time),
            'fin_ms': dt_a_ms(a.start_time) + _duracion_min(a) * 60000,
            'margen_min': _bloque_min(a) - _duracion_min(a),
        }
        for a in filas
        for pid in persona_de[a.closer_id]
    ]


# {user_id: (vence (monotonic), desde_ms, hasta_ms, [(inicio, fin)])}: lo leído de Google por closer.
_google_cache = {}


def _franjas_google(user_id, desde, hasta):
    """Lo ocupado en los calendarios de conflicto del closer entre desde y hasta (ms), con caché corta
    para no consultar a Google en cada clic del lead. None si Google no respondió (se ofrece igual)."""
    from app.services.google_service import GoogleService

    ahora = time.monotonic()
    guardado = _google_cache.get(user_id)
    if guardado and guardado[0] > ahora and guardado[1] <= desde and guardado[2] >= hasta:
        return guardado[3]
    franjas = GoogleService.franjas_ocupadas(user_id, ms_a_dt(desde), ms_a_dt(hasta))
    if franjas is None:
        return None
    if len(_google_cache) > 500:
        _google_cache.clear()
    _google_cache[user_id] = (ahora + CACHE_GOOGLE_S, desde, hasta, franjas)
    return franjas


def _leido_de_google(elegibles, ahora):
    """{user_id: [(inicio, fin)] o None} de cada closer elegible: lo ocupado en sus calendarios de
    Google desde una hora atrás. None si no conectó su calendario o Google no respondió (no se sabe)."""
    desde, hasta = ahora - 3600000, ahora + VENTANA_GOOGLE_DIAS * DIA_MS
    usuarios = set(elegibles.values())
    con = _con_calendar(usuarios)
    return {u: _franjas_google(u, desde, hasta) if u in con else None for u in usuarios}


def _ocupacion(ahora, elegibles=None, libres=None):
    """Lo que tiene ocupado cada closer: sus agendas vigentes en la operacion y lo que tiene en sus
    calendarios de Google (los de conflicto), en el formato del nucleo. Lo de Google bloquea el horario
    pero no suma a su carga (no son agendas). Google manda: una agenda que ya no está en su calendario
    (cancelada, borrada o marcada «Disponible») no bloquea (sigue_en_google).
    libres: {user_id: [(id, inicio, fin)]} de las agendas C/D que este lead puede tomar (desplazar.py):
    no cuentan, ni ellas ni su evento en Google."""
    elegibles, libres = elegibles or {}, libres or {}
    leido = _leido_de_google(elegibles, ahora)
    leido = {u: desplazar.restar(f, libres.get(u, [])) if f else f for u, f in leido.items()}
    excluir = {i for huecos in libres.values() for i, _, _ in huecos}
    agendas = _agendas_de_operacion(elegibles, ms_a_dt(ahora - DIA_MS), leido, leido_desde=ahora - 3600000, excluir=excluir)
    base = opciones_de_ocupacion(agendas, ahora)
    google = {pid: [{'inicio': a, 'fin': b} for a, b in leido[u]] for pid, u in elegibles.items() if leido.get(u)}
    if not google:
        return base
    ocupado = base['ocupado']
    return {**base, 'ocupado': lambda pid, t, dur: ocupado(pid, t, dur) or se_solapa(google.get(pid, []), t, dur)}


def _franjas_frescas(user_id, inicio, fin):
    """Lo ocupado en el Google Calendar del closer alrededor de [inicio, fin) (ms), leído en el momento
    (sin caché: algo agendado recién también cuenta). None si no se pudo leer.
    Va ANTES de bloquear al closer: leer Google puede renovar su token, eso hace commit y un commit
    suelta el bloqueo (ver _bloquear_y_verificar)."""
    from app.services.google_service import GoogleService

    if not _con_calendar({user_id}):
        return None
    # Desde 4 horas antes: para saber si las agendas que empezaron antes siguen en su calendario.
    return GoogleService.franjas_ocupadas(user_id, ms_a_dt(inicio) - timedelta(hours=4), ms_a_dt(fin))


def _bloquear_y_verificar(user_id, inicio, fin, franjas, libres_ids=()):
    """Bloquea al closer (SELECT … FOR UPDATE sobre su fila de users) y, ya bloqueado, mira en la base si
    tiene otra agenda vigente que se cruce con [inicio, fin) (ms). Dos leads que piden el mismo closer a
    la vez quedan en fila: el segundo espera a que el primero haga commit y recién ahí lee, así que ve
    su agenda. Desde acá hasta el commit que guarda la agenda no puede haber otro commit (lo soltaría):
    por eso Google se lee antes (_franjas_frescas). Se puede volver a llamar después de algo que haya
    hecho commit: vuelve a bloquear y a mirar.
    Devuelve (closer, choca, fuera_de_google): fuera_de_google son los ids de las agendas que se cruzan
    pero ya no están en su calendario (sigue_en_google) o que este lead puede tomar (libres_ids, las C/D
    de desplazar.py; `franjas` ya viene sin su evento): esas no chocan."""
    from app.models import Appointment, User

    closer = db.session.query(User).filter_by(id=user_id).with_for_update().first()
    if not closer:
        return None, True, []
    if franjas and any(a < fin and inicio < b for a, b in franjas):
        return closer, True, []
    filas = Appointment.query.filter(
        Appointment.closer_id == user_id,
        Appointment.start_time < ms_a_dt(fin),
        Appointment.start_time >= ms_a_dt(inicio) - timedelta(hours=4),
        *operacion.filtro_vigente(),
    ).all()
    leido_desde = inicio - 4 * 3600000
    cruzan = [a for a in filas if dt_a_ms(a.start_time) + _bloque_min(a) * 60000 > inicio]
    siguen = [a for a in cruzan if a.id not in libres_ids and sigue_en_google(a, franjas, leido_desde=leido_desde)]
    return closer, bool(siguen), [a.id for a in cruzan if a not in siguen]


# --- Ocupacion en Google para Available ---------------------------------------------------------

# El visor pide la semana que se ve (con un dia de margen a cada lado por las zonas horarias).
RANGO_MAX_OCUPACION_DIAS = 10
# {(user_id, desde_ms, hasta_ms): (vence (monotonic), {franjas, eventos})}. Aparte de _google_cache: lo que
# mira alguien en el visor (cualquier semana, pasada o lejana) no le cambia nada al motor.
_google_semana_cache = {}


def unir_franjas(franjas):
    """[[inicio, fin]] ordenadas y sin superponerse: lo que se pisa o se toca queda en un solo tramo."""
    out = []
    for a, b in sorted(franjas):
        if b <= a:
            continue
        if out and a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def _ocupado_semana(user_id, desde, hasta):
    """{franjas, eventos} de ese closer en Google entre desde y hasta (ms): franjas = lo ocupado, ya
    unido; eventos = cada evento con su título, para mostrarlo. None si Google no respondió."""
    from app.services.google_service import GoogleService

    clave, ahora = (user_id, desde, hasta), time.monotonic()
    guardado = _google_semana_cache.get(clave)
    if guardado and guardado[0] > ahora:
        return guardado[1]
    eventos = GoogleService.eventos_ocupados(user_id, ms_a_dt(desde), ms_a_dt(hasta))
    if eventos is None:
        return None
    leido = {'franjas': unir_franjas([[e['inicio'], e['fin']] for e in eventos]), 'eventos': eventos}
    if len(_google_semana_cache) > 500:
        _google_semana_cache.clear()
    _google_semana_cache[clave] = (ahora + CACHE_GOOGLE_S, leido)
    return leido


# Una agenda de n8n se busca en Google por su inicio, con esta tolerancia.
TOLERANCIA_EVENTO_MS = 60000


def _agendas_operacion(user_ids, desde, hasta):
    """{user_id: [Appointment]} de las agendas de esos closers (las de n8n y las de Agendas 2.0) que
    empiezan entre desde y hasta (ms)."""
    from app.models import Appointment

    if not user_ids:
        return {}
    filas = (
        Appointment.query.filter(
            Appointment.closer_id.in_(user_ids),
            Appointment.start_time >= ms_a_dt(desde),
            Appointment.start_time < ms_a_dt(hasta),
        )
        .order_by(Appointment.start_time)
        .all()
    )
    out = {}
    for a in filas:
        out.setdefault(a.closer_id, []).append(a)
    return out


def agenda_operacion_a_dict(appt, eventos, traza=None):
    """Una agenda de n8n para Available. estado: 'cancelada' (marcada cancelada o reprogramada),
    'sin_evento' (en NeurOPS sigue vigente pero en su Google Calendar ya no ocupa: se canceló, se borró, se
    movió o se marcó «Disponible» sin que NeurOPS se enterara) o 'vigente'. `eventos`: lo leído de su
    Google, None si no se pudo (y entonces no se sabe: queda vigente). `traza`: lo que se sabe de su evento
    vinculado (trazabilidad.py); manda sobre la coincidencia por hora. Dura lo que su evento en Google o, si
    no está, lo de siempre. Solo se muestra: la agenda no se toca."""
    inicio = dt_a_ms(appt.start_time)
    evento = next((e for e in eventos or [] if abs(e['inicio'] - inicio) <= TOLERANCIA_EVENTO_MS), None)
    vinculada = traza and traza['estado'] not in ('sin_vincular', 'sin_dato')
    if (appt.result or '') in operacion.RESULTADOS_NO_VIGENTES:
        estado = 'cancelada'
    elif vinculada:
        estado = 'sin_evento' if traza['estado'] in trazabilidad.NO_OCUPA else 'vigente'
    elif eventos is not None and evento is None:
        estado = 'sin_evento'
    else:
        estado = 'vigente'
    cliente = appt.client
    return {
        'id': str(appt.id),
        'inicio': inicio,
        'fin': evento['fin'] if evento else inicio + _duracion_min(appt) * 60000,
        'nombre': (cliente.full_name if cliente else None) or 'Agenda',
        'estado': estado,
        'resultado': appt.result,
        'calendar': traza,
    }


# {(user_id, desde, hasta): (vence (monotonic), trazas)}: lo leído para seguir las agendas en Calendar.
_traza_cache = {}


def _trazas(user_id, citas, desde, hasta):
    """Las trazas en Calendar de esas agendas de un closer (trazabilidad.trazas), con 2 min de caché."""
    clave, ahora = (user_id, desde, hasta), time.monotonic()
    guardado = _traza_cache.get(clave)
    if guardado and guardado[0] > ahora:
        return guardado[1]
    out = trazabilidad.trazas(user_id, citas, desde, hasta)
    if out is None:
        return None
    if len(_traza_cache) > 500:
        _traza_cache.clear()
    _traza_cache[clave] = (ahora + CACHE_GOOGLE_S, out)
    return out


def ocupacion_google(desde, hasta):
    """{persona_id: {'estado', 'franjas', 'eventos', 'agendas'}} de cada persona de Team entre desde y
    hasta (ms). estado: 'ok' (franjas = lo ocupado en sus calendarios de conflicto, unido; eventos = cada
    uno con su título, None si es privado), 'error' (Google no
    respondió: no se sabe), 'sin_google' (no conectó su calendario) o 'sin_usuario' (su email no es el
    de un usuario activo). A diferencia del motor, acá no saber no se muestra como libre.
    agendas: las de n8n de ese closer, con si siguen en pie (agenda_operacion_a_dict). trazas: {appointment_id:
    traza} de todas sus agendas (las de Agendas 2.0 también): qué pasó con su evento en Calendar."""
    personas = colecciones()['personas']
    usuarios = _usuarios_de_personas({'personas': personas})
    con_calendar = _con_calendar(set(usuarios.values()))
    por_usuario = {u: _ocupado_semana(u, desde, hasta) for u in set(usuarios.values()) & con_calendar}
    agendas = _agendas_operacion(set(usuarios.values()), desde, hasta)
    out = {}
    for p in personas:
        u = usuarios.get(p['id'])
        leido = por_usuario.get(u)
        if u is None:
            out[p['id']] = {'estado': 'sin_usuario', 'franjas': [], 'eventos': []}
        elif u not in con_calendar:
            out[p['id']] = {'estado': 'sin_google', 'franjas': [], 'eventos': []}
        elif leido is None:
            out[p['id']] = {'estado': 'error', 'franjas': [], 'eventos': []}
        else:
            out[p['id']] = {'estado': 'ok', **leido}
        eventos = leido['eventos'] if leido else None
        citas = agendas.get(u, [])
        trazas = (_trazas(u, citas, desde, hasta) if citas else {}) if leido else None
        out[p['id']]['trazas'] = trazas or {}
        out[p['id']]['agendas'] = [
            agenda_operacion_a_dict(a, eventos, (trazas or {}).get(str(a.id))) for a in citas if not a.agenda_payload
        ]
    return out


# Lo que el Filtro completo de Available lee de cada agenda: lo mismo que filtra la tabla de Agendas de
# Closing. Fuera queda el contacto del lead (nombre, email, instagram, teléfono): el visor ya tiene el
# nombre por su lado, y el setter, que también mira, no lo recibe.
CAMPOS_DE_FICHA = (
    'id', 'fecha', 'fuente', 'closer', 'setter', 'pre_call', 'post_call', 'asistio', 'presento', 'no_cerrada',
    'retraso_dias', 'ya_paso', 'descartada',
)


def fichas_de_agendas(desde, hasta):
    """{appointment_id (str): ficha} de las agendas que empiezan entre desde y hasta (ms), con las filas de
    Closing (ComercialService.agendas): así el calendario filtra por estado, pre call, post call, fuente,
    setter, confirmada, asistió y presentó con los mismos datos que la tabla, y no puede dar otro número."""
    from app.services.comercial_service import ComercialService

    filas = ComercialService.agendas(ms_a_dt(desde).date(), ms_a_dt(hasta).date())
    return {str(f['id']): {k: f.get(k) for k in CAMPOS_DE_FICHA} for f in filas}


# --- Pagina publica -----------------------------------------------------------------------------

CAMPOS_EVENTO_PUBLICO = (
    'id', 'nombre', 'slug', 'duracion', 'reservas', 'antel', 'paso', 'zona', 'desc', 'redir', 'gracias',
)


# El formulario de un evento con persona fija que no eligió uno: solo los datos de contacto.
FORM_SOLO_CONTACTO = {'nombre': 'Datos de contacto', 'contacto': {'nombre': True, 'telefono': True, 'email': True, 'instagram': False}}


def form_solo_contacto():
    return NORM['formularios']('contacto', FORM_SOLO_CONTACTO)


def _disponible(d, e):
    """(evento publicado, form publicado, funnel) o None. Manda la version PUBLICADA: lo que se
    edita en Thalamus sin publicar (incluido el funnel o el link) no cambia lo que esta en vivo.
    Un evento con persona fija sin formulario (los que crea cada closer) pide solo el contacto."""
    pub = version_publicada(e)
    if not pub or not pub['evento'].get('activo'):
        return None
    form = pub.get('form') or (form_solo_contacto() if pub['evento'].get('persona') else None)
    if not form:
        return None
    funnel = buscar(d, 'funnels', pub['evento'].get('funnel'))
    if funnel and not funnel.get('activo'):
        return None
    # La página de gracias no se publica: va la del evento en vivo, si todavía existe.
    gracias = e.get('gracias') if buscar(d, 'gracias', e.get('gracias')) else ''
    return {**pub['evento'], 'gracias': gracias}, form, funnel


def evento_disponible(d, funnel_slug, evento_slug):
    """El evento de un link /agenda/<funnel>/<evento> (o /agenda/<evento>), si esta disponible:
    publicado, activo, con formulario y con su funnel activo."""
    encontrados = []
    for e in d['eventos']:
        x = _disponible(d, e)
        if not x or x[0]['slug'] != evento_slug:
            continue
        funnel = x[2]
        slugs = [funnel['slug'], *funnel.get('slugs_anteriores', [])] if funnel else []
        if funnel_slug is not None and funnel_slug not in slugs:
            continue
        encontrados.append(x)
    if funnel_slug is None:
        encontrados.sort(key=lambda x: 0 if not x[2] else 1)  # sin funnel primero
    else:
        encontrados.sort(key=lambda x: 0 if x[2]['slug'] == funnel_slug else 1)  # el slug actual antes que uno viejo
    return encontrados[0] if encontrados else None


def evento_publico(d, evento_id):
    """Lo mismo, por id (para los POST de la pagina publica)."""
    e = buscar(d, 'eventos', evento_id)
    return _disponible(d, e) if e else None


def vista_publica(evento, form, funnel):
    return {
        'evento': {k: evento.get(k) for k in CAMPOS_EVENTO_PUBLICO},
        'form': form,
        'funnel': {'nombre': funnel['nombre'], 'slug': funnel['slug']} if funnel else None,
    }


# --- Página de gracias --------------------------------------------------------------------------

# Los casos de éxito de la Academia cambian poco y la API tiene un límite compartido (60 por minuto):
# se piden cada CACHE_CASOS_S como mucho. Si la Academia falla, quedan los últimos que se trajeron.
CACHE_CASOS_S = 600
_casos = {'en': 0.0, 'lista': []}


def _caso(c):
    foto, video = c.get('photo_url'), c.get('video_url')
    return {
        'nombre': str(c.get('name') or '')[:120],
        'meta': str(c.get('meta') or '')[:200],
        'resumen': str(c.get('summary') or '')[:300],
        'cita': str(c.get('quote') or '')[:3000],
        'foto': foto if isinstance(foto, str) and foto.startswith('https://') else '',
        'video': video if isinstance(video, str) and video.startswith('https://') else '',
    }


def casos_de_exito(ahora=None):
    ahora = time.monotonic() if ahora is None else ahora
    if _casos['en'] and ahora - _casos['en'] < CACHE_CASOS_S:
        return _casos['lista']
    _casos['en'] = ahora  # aunque falle: no reintentar en cada visita
    try:
        r = LearnationService.get_success_cases()
        _casos['lista'] = [_caso(c) for c in (r.get('cases') or []) if isinstance(c, dict) and c.get('name')]
    except LearnationAPIError as e:
        log.warning('Casos de éxito de la Academia: %s', e)
    return _casos['lista']


def _video_publico(v):
    """{src, tipo}: el archivo del volumen (lo sirve /publico/videos) o el link tal cual; None si no hay."""
    if v.get('archivo'):
        return {'tipo': 'archivo', 'src': '/api/agendas-v2/publico/videos/' + v['archivo']}
    if v.get('url'):
        return {'tipo': 'link', 'src': v['url']}
    return None


def gracias_publica(d, gracias_id):
    """Lo que ve el lead en la página de gracias, o None si no existe."""
    g = buscar(d, 'gracias', gracias_id)
    if not g:
        return None
    return {
        'id': g['id'],
        'video': _video_publico(g['video']),
        'plan': _video_publico(g['plan']),
        'segundos': g['segundos'],
        'casos': casos_de_exito() if g['casos'] else [],
    }


def video_en_uso(d, video_id, salvo=None):
    """¿Alguna página de gracias (fuera de `salvo`) usa este archivo?"""
    return any(g['id'] != salvo and video_id in (g['video']['archivo'], g['plan']['archivo']) for g in d['gracias'])


def _limpiar_respuestas(preguntas, resp):
    """Respuestas validadas en el orden del formulario. Devuelve (resp limpias, errores, descalifica).
    Como en la pagina, una opcion que descalifica corta: lo que sigue no se pide."""
    resp = resp if isinstance(resp, dict) else {}
    limpias, errores = {}, {}
    for q in preguntas:
        crudo = resp.get(q['id'])
        if con_opciones(q['tipo']):
            valor = crudo if isinstance(crudo, str) and any(o['id'] == crudo for o in q['opciones']) else ''
        else:
            valor = limpiar_respuesta(q, crudo if isinstance(crudo, str) else '')[: LARGO_MAX_TEXTO.get(q['tipo'], 300)]
        error = validar_respuesta(q, valor)
        if error:
            errores[q['id']] = error
            continue
        if valor:
            limpias[q['id']] = valor
        if con_opciones(q['tipo']) and any(o['id'] == valor and o.get('descalifica') for o in q['opciones']):
            return limpias, {}, True
    return limpias, errores, False


def _contexto(evento, form, resp):
    return {
        'preguntas': preguntas_flujo(form),
        'resp': resp,
        'dur': evento['duracion'],
        'margen': evento.get('margen') or 0,
        'evento_id': evento['id'],
        'ag': {'reservas': evento['reservas'], 'antel': evento['antel'], 'paso': evento['paso']},
        'reglas': form.get('reglas', []),
        'resto': form.get('resto', ''),
        'persona': evento.get('persona') or None,
    }


def horarios(d, evento, form, resp, ahora=None):
    """Inicios libres (ms) para esas respuestas, sin decir de que closer es cada uno."""
    ahora = ahora or ahora_ms()
    limpias, _, descalifica = _limpiar_respuestas(preguntas_flujo(form), resp)
    if descalifica:
        return []
    d, elegibles = solo_elegibles(d)
    libres = desplazar.libres(elegibles, ahora) if desplazar.desplaza(segmentar(form, limpias)) else {}
    asig = asignacion(_contexto(evento, form, limpias), d, {**_ocupacion(ahora, elegibles, libres), 'prueba': False})
    return sorted({s['t'] for s in asig['slots']})


def version_para_prueba(d, e):
    """(evento, form, 'publicada'|'borrador') que se prueba: la publicada si existe (la que ve el lead),
    si no el borrador. Sin mirar si está activo: se puede probar algo pausado."""
    pub = version_publicada(e)
    if pub:
        evento, form, version = pub['evento'], pub.get('form'), 'publicada'
    else:
        evento, form, version = e, buscar(d, 'formularios', e.get('formulario')), 'borrador'
    if not form and evento.get('persona'):
        form = form_solo_contacto()
    return evento, form, version


def horarios_prueba(d, evento_id, grupo, ahora=None):
    """Lo que vería el lead de esa prioridad (grupo): los mismos horarios que la página pública (closers
    elegibles, agendas y Google Calendar), salteando el formulario. Para la dirección: dice de qué
    closer es cada horario. None si el evento no existe."""
    e = buscar(d, 'eventos', evento_id)
    if not e:
        return None
    evento, form, version = version_para_prueba(d, e)
    ahora = ahora or ahora_ms()
    d, elegibles = solo_elegibles(d)
    # Sin reglas y con `resto` = la prioridad elegida: el ruteo cae siempre ahí.
    ctx = {**_contexto(evento, form or {}, {}), 'reglas': [], 'resto': str(grupo or '')}
    asig = asignacion(ctx, d, {**_ocupacion(ahora, elegibles), 'prueba': False})
    return {
        'version': version,
        'slots': sorted(({'t': s['t'], 'p': s['p']} for s in asig['slots']), key=lambda s: s['t']),
        'grupo': asig['grupo']['id'] if asig.get('grupo') else '',
        'regla': asig.get('regla') or '',
        'desborde': bool(asig.get('desborde')),
    }


def setters_activos():
    """Los setters de NeurOPS (rol principal o extra), activos: los que tienen link en un funnel de setting."""
    from app.models.user import ROLE_SETTER, User

    return User.query.filter(User.role.in_([ROLE_SETTER]), User.is_active.is_(True)).order_by(User.username).all()


def setters_del_funnel(funnel, activos=None):
    """Los setters activos que trabajan un funnel de setting: los elegidos, o todos si no eligió ninguno."""
    activos = setters_activos() if activos is None else activos
    elegidos = set(funnel.get('setters') or [])
    return [u for u in activos if not elegidos or u.id in elegidos]


def codigo_setter(user_id):
    """El código del setter en su link (?o=...): fijo, sale del id y no deja ver el nombre. No cambia
    si se le cambia el usuario."""
    n = int.from_bytes(hashlib.sha256(f'agendas-setter-{user_id}'.encode()).digest()[:8], 'big')
    c = ''
    for _ in range(6):
        n, r = divmod(n, 36)
        c += '0123456789abcdefghijklmnopqrstuvwxyz'[r]
    return c


def _setter_de(d, funnel, origen):
    """El usuario setter al que se le atribuye la agenda. En un funnel de setting, el del link
    (?o=<su código>, o su usuario en slug en los links viejos), si sigue activo. En los demás, el de un
    origen viejo con una persona setter de Team (compatibilidad: los setters ya no van en Team)."""
    from app.models.user import User

    if not funnel or not origen:
        return None
    if funnel.get('setting'):
        sts = setters_del_funnel(funnel)
        return (next((u for u in sts if codigo_setter(u.id) == origen), None)
                or next((u for u in sts if slugify(u.username) == origen), None))
    for o in funnel.get('origenes', []):
        if o.get('setter') and (slugify(nombre_origen(d, o)) or o['id']) == origen:
            user_id = _usuarios_de_personas(d).get(o['setter'])
            return db.session.get(User, user_id) if user_id else None
    return None


def links_de_setter(user):
    """Los links de agendamiento de un setter: uno por evento publicado y activo de cada funnel de
    setting activo en el que trabaja. [{funnel, evento, ruta}] con la ruta relativa al sitio."""
    d = colecciones()
    codigo = codigo_setter(user.id)
    links = []
    for f in d['funnels']:
        if not (f.get('setting') and f.get('activo')) or (f.get('setters') and user.id not in f['setters']):
            continue
        for e in d['eventos']:
            if e.get('funnel') == f['id'] and e.get('activo') is not False and version_publicada(e):
                links.append({'funnel': f['nombre'], 'evento': e['nombre'],
                              'ruta': f'/agendas-v2/agenda/{f["slug"]}/{e["slug"]}?o={codigo}'})
    return links


def _segmento(d, form, asig):
    """El segmento del lead con nombres (no solo ids): a qué estrategia lo mandó la segmentación, por
    qué regla y dónde terminó. Queda en la agenda aunque después se borre la estrategia o la regla."""
    g0 = buscar(d, 'grupos', asig.get('grupo_regla'))
    g = asig.get('grupo')
    return {
        'formulario': (form or {}).get('nombre') or '',
        'estrategia': g0['nombre'] if g0 else None,
        'regla': texto_regla(form, asig.get('regla_idx')) if g0 else '',
        'asignada': g['nombre'] if g else None,
        'reparto': ESTRATEGIAS.get(g['estrategia']) if g else None,
        'desborde': bool(asig.get('desborde')),
    }


# --- El lead que vuelve --------------------------------------------------------------------------

CONTACTO_GUARDADO = ('c-telefono', 'c-email', 'c-nombre', 'c-instagram')
# Con lo que se reconoce al lead: si lo escribió de nuevo vale lo que escribió (puede ser un número nuevo).
IDENTIFICA = ('c-telefono', 'c-email')


def cliente_de(resp, pais):
    """El cliente del lead por lo que ya escribió: su correo o, si no, su WhatsApp (con el país elegido)."""
    resp = resp if isinstance(resp, dict) else {}
    email, tel = resp.get('c-email'), resp.get('c-telefono')
    cliente = operacion.cliente_por_email(email) if isinstance(email, str) and '@' in email else None
    if not cliente and isinstance(tel, str) and tel.strip():
        cliente = operacion.cliente_por_telefono(telefono_e164(pais, tel))
    return cliente


def datos_guardados(form, cliente):
    """Lo que ya sabemos del lead, para no volver a pedírselo: (respuestas de contacto válidas,
    completos). `completos` es False si falta (o no sirve) alguno obligatorio."""
    if not cliente:
        return {}, False
    pl = cliente.formulario_payload if isinstance(cliente.formulario_payload, dict) else {}
    lead = pl.get('lead') if isinstance(pl.get('lead'), dict) else {}
    nombre = lead.get('nombre') or cliente.full_name
    email = cliente.email or ''
    crudos = {
        'c-telefono': lead.get('telefono') or cliente.phone,
        # El cliente creado sin correo tiene uno inventado (no-email-…@neurops.com): no sirve.
        'c-email': '' if email.startswith('no-email-') else email,
        'c-nombre': '' if nombre == 'Desconocido' else nombre,
        'c-instagram': lead.get('instagram') or cliente.instagram,
    }
    preguntas = {q['id']: q for q in contacto_preguntas(form)}
    resp, completos = {}, True
    for k, crudo in crudos.items():
        q = preguntas[k]
        v = limpiar_respuesta(q, crudo if isinstance(crudo, str) else '')[: LARGO_MAX_TEXTO.get(q['tipo'], 300)]
        # Sin el +país no se sabe de dónde es el número (los clientes viejos no siempre lo tienen).
        if q['tipo'] == 'telefono' and not v.startswith('+'):
            v = ''
        if v and not validar_respuesta(q, v):
            resp[k] = v
        elif q.get('obligatoria'):
            completos = False
    return resp, completos


def respuestas_guardadas(form, cliente):
    """Las respuestas que el lead ya dio a este mismo formulario (su último envío), para que solo las
    confirme. None si el último fue otro formulario, si este cambió de preguntas o si alguna ya no sirve:
    en esos casos responde de nuevo."""
    pl = cliente.formulario_payload if cliente and isinstance(cliente.formulario_payload, dict) else {}
    qs = (form or {}).get('preguntas') or []
    if not qs or not form.get('id') or pl.get('formulario_id') != form['id']:
        return None
    previas = {r.get('pregunta_id'): r for r in pl.get('respuestas') or [] if isinstance(r, dict)}
    if set(previas) != {q['id'] for q in qs}:
        return None
    resp = {}
    for q in qs:
        r = previas[q['id']]
        if con_opciones(q['tipo']):
            v = r.get('opcion_id') if isinstance(r.get('opcion_id'), str) else ''
            if v and not any(o['id'] == v for o in q['opciones']):
                return None
        else:
            crudo = r.get('respuesta') if isinstance(r.get('respuesta'), str) else ''
            v = limpiar_respuesta(q, crudo)[: LARGO_MAX_TEXTO.get(q['tipo'], 300)]
        if validar_respuesta(q, v):
            return None
        if v:
            resp[q['id']] = v
    return resp


def con_guardados(form, cuerpo, resp):
    """Lo que el lead no volvió a escribir porque confirmó lo que ya teníamos: sus datos de contacto
    (`datos_guardados`) y sus respuestas al formulario (`respuestas_guardadas`). Salen de la base,
    nunca del navegador."""
    resp = resp if isinstance(resp, dict) else {}
    datos, respuestas = cuerpo.get('datos_guardados') is True, cuerpo.get('respuestas_guardadas') is True
    if not datos and not respuestas:
        return resp
    cliente = cliente_de(resp, cuerpo.get('pais'))
    if not cliente:
        return resp
    extra = {}
    if datos:
        guardados, _ = datos_guardados(form, cliente)
        extra.update({k: v for k, v in guardados.items() if not (k in IDENTIFICA and resp.get(k))})
    if respuestas:
        extra.update(respuestas_guardadas(form, cliente) or {})
    return {**resp, **extra}


def _tapar(v, ver):
    return v[:ver] + '•••' if v else ''


def _corte(evento, form, resp):
    """Qué pasaría al terminar las preguntas con esas respuestas: no (no califica, por una opción o porque
    la segmentación lo manda a «No califica») o url (una regla lo manda a otra página)."""
    _, _, descalifica = _limpiar_respuestas(preguntas_flujo(form), resp)
    if descalifica:
        return {'no': True, 'url': ''}
    r = {'url': '', 'no': False} if evento.get('persona') else grupo_por_reglas(form, resp)
    return {'no': bool(r.get('no')), 'url': r.get('url') or ''}


def conocido(evento, form, resp, pais, ahora=None):
    """Lo que ve el lead que vuelve (se lo busca por correo o WhatsApp): su nombre (para precargarlo),
    el WhatsApp y el Instagram tapados (nadie saca el contacto de otro), el horario de su próxima
    agenda y, si ya respondió este mismo formulario, cuándo (las respuestas no: solo las confirma)."""
    cliente = cliente_de(resp, pais)
    if not cliente:
        return {'conocido': False}
    guardados, completos = datos_guardados(form, cliente)
    tel = re.sub('[^0-9]', '', guardados.get('c-telefono', ''))
    proxima = operacion.proxima_de(cliente.id, ms_a_dt(ahora or ahora_ms()))
    previas = respuestas_guardadas(form, cliente)
    pl = cliente.formulario_payload if isinstance(cliente.formulario_payload, dict) else {}
    respuestas = None if previas is None else {'enviado': pl.get('enviado') or None, **_corte(evento, form, previas)}
    return {
        'conocido': True,
        'completos': completos,
        'datos': {
            'nombre': (guardados.get('c-nombre') or '').split(' ')[0],
            'nombre_completo': guardados.get('c-nombre') or '',
            'telefono': '+' + tel[:2] + ' ••• ' + tel[-3:] if tel else '',
            'instagram': '@' + _tapar(guardados.get('c-instagram', ''), 2) if guardados.get('c-instagram') else '',
        },
        'proxima': {'inicio': dt_a_ms(proxima.start_time)} if proxima else None,
        'respuestas': respuestas,
    }


# --- Intentos: los que dejaron sus datos y no agendaron (Stats) --------------------------------


def _paso_de(form, resp, en_calendario):
    """Hasta dónde llegó: 1 dejó el contacto, 2+j respondió la pregunta j, n+2 llegó al calendario."""
    qs = form.get('preguntas', [])
    if en_calendario:
        return len(qs) + 2
    ultima = max((j for j, q in enumerate(qs) if resp.get(q['id'])), default=-1)
    return 2 + ultima if ultima >= 0 else 1


def _intento_de(evento_id, email):
    return SchedIntento.query.filter_by(evento_id=evento_id, email=email, estado='incompleta').first()


def registrar_avance(d, evento, form, funnel, cuerpo):
    """El lead del link avanzó un paso: se guardan sus respuestas y hasta dónde llegó. Recién cuenta
    con un email válido (ya dejó sus datos). Un registro por lead y evento; el paso nunca retrocede.
    Devuelve False si no hay email válido."""
    crudas = cuerpo.get('resp') if isinstance(cuerpo.get('resp'), dict) else {}
    crudas = con_guardados(form, cuerpo, crudas)
    resp = {}
    for q in preguntas_flujo(form):
        crudo = crudas.get(q['id'])
        if not isinstance(crudo, str) or not crudo:
            continue
        if con_opciones(q['tipo']):
            if any(o['id'] == crudo for o in q['opciones']):
                resp[q['id']] = crudo
        else:
            v = limpiar_respuesta(q, crudo)[: LARGO_MAX_TEXTO.get(q['tipo'], 300)]
            if v and not validar_respuesta(q, v):
                resp[q['id']] = v
    email = (resp.get('c-email') or '').lower()
    if not email:
        return False
    paso = _paso_de(form, resp, cuerpo.get('en_calendario') is True)
    intento = _intento_de(evento['id'], email)
    if not intento:
        origen = slugify(str(cuerpo.get('origen') or ''))[:60]
        setter = _setter_de(d, funnel, origen)
        intento = SchedIntento(
            evento_id=evento['id'], funnel_id=funnel['id'] if funnel else None, email=email, estado='incompleta',
            paso=paso, resp=resp, origen=origen or None, setter_user_id=setter.id if setter else None,
        )
        db.session.add(intento)
    else:
        intento.paso = max(intento.paso or 0, paso)
        intento.resp = {**(intento.resp or {}), **resp}
    db.session.commit()
    return True


def _cerrar_intento(evento, form, funnel, limpias, origen, setter, descalificada):
    """El lead terminó. Si no calificó, su intento queda como descalificado (con lo que respondió).
    Si agendó, se borran sus intentos incompletos: desde ahí lo cuenta la Appointment."""
    email = (limpias.get('c-email') or '').lower()
    if not email:
        return
    if not descalificada:
        SchedIntento.query.filter_by(email=email, estado='incompleta').delete(synchronize_session=False)
        return
    intento = _intento_de(evento['id'], email)
    if not intento:
        intento = SchedIntento(
            evento_id=evento['id'], funnel_id=funnel['id'] if funnel else None, email=email,
            origen=origen or None, setter_user_id=setter.id if setter else None,
        )
        db.session.add(intento)
    intento.estado = 'descalificada'
    intento.resp = limpias
    intento.paso = _paso_de(form, limpias, False)


def _nombres_de_usuarios(ids):
    from app.models.user import User

    ids = {i for i in ids if isinstance(i, int)}
    return {u.id: u.username for u in User.query.filter(User.id.in_(ids))} if ids else {}


def _leads_de_intentos(desde):
    filas = SchedIntento.query.filter(SchedIntento.creado_en >= desde).all()
    setters = _nombres_de_usuarios(f.setter_user_id for f in filas)
    return [
        {
            't': dt_a_ms(f.creado_en), 'ev': f.evento_id, 'llego': f.paso, 'desc': f.estado == 'descalificada',
            'agenda': False, 'score': None, 'closer': None, 'setter': setters.get(f.setter_user_id),
            'origen': f.origen or '', 'grupo': None, 'inicio': None,
        }
        for f in filas
    ]


def _leads_de_agendas(desde):
    from app.models import Appointment

    filas = Appointment.query.filter(Appointment.agenda_payload.isnot(None), Appointment.created_at >= desde).all()
    setters = _nombres_de_usuarios((a.agenda_payload or {}).get('setter_user_id') for a in filas)
    # Una reagenda (del lead por el link o del equipo) es otra fila del MISMO lead: cuenta la original,
    # con el horario y la vigencia de su última reagenda (reagenda.py, closer_service.process_agenda).
    sucesora = {(a.agenda_payload or {}).get('reagenda_de'): a for a in filas if (a.agenda_payload or {}).get('reagenda_de')}
    leads = []
    for a in filas:
        p = a.agenda_payload or {}
        # Lo que carga el equipo desde NeurOPS (manual.py) tampoco es una conversión del link.
        if p.get('manual') or p.get('reagenda_de'):
            continue
        ultima, vistas = a, {a.id}
        while ultima.id in sucesora and sucesora[ultima.id].id not in vistas:
            ultima = sucesora[ultima.id]
            vistas.add(ultima.id)
        leads.append({
            't': dt_a_ms(a.created_at), 'ev': p.get('evento_id') or '', 'llego': 999, 'desc': False, 'agenda': True,
            'score': p.get('nota'), 'closer': (ultima.agenda_payload or {}).get('closer_id') or p.get('closer_id'),
            'setter': setters.get(p.get('setter_user_id')),
            'origen': p.get('origen') or '', 'grupo': p.get('prioridad_id'), 'inicio': dt_a_ms(ultima.start_time),
            'cancelada': not _vigente(ultima),
        })
    return leads


def estadisticas(ahora=None):
    """Los leads de los últimos 180 días para Stats, en el formato de datosEjemplo.js: los que agendaron
    (Appointment de Agendas 2.0) y los que dejaron sus datos y no (sched_intentos). `t` es cuándo
    entró; `inicio`, el horario de la agenda; `llego` 999 = agendó."""
    desde = ms_a_dt((ahora or ahora_ms()) - VENTANA_STATS_DIAS * DIA_MS)
    return _leads_de_agendas(desde) + _leads_de_intentos(desde)


def _consultor(d, closer):
    """Lo que el lead ve de su closer: el nombre que tiene en Team y su color. Nada de contacto."""
    email = (closer.email or '').lower()
    per = next((p for p in d['personas'] if email and p.get('email') == email), None)
    return {'nombre': per['nombre'] if per else (closer.username or ''), 'color': per['color'] if per else 'azul'}


def _respuesta(appt):
    """Lo que la pagina publica le muestra al lead de su agenda."""
    r = reserva_a_dict(appt)
    return {'id': r['id'], 'inicio': r['inicio_ms'], 'fin': r['fin_ms'], 'duracion': _duracion_min(appt)}


def reservar(d, evento, form, funnel, cuerpo, ahora=None):
    """Toma la agenda y la escribe en la operacion (operacion.py). Devuelve (resultado, creada):
    resultado es {'descalificada': True}, {'descalificada': True, 'redirigir': url} (una regla lo manda a
    otra página) o {'id', 'inicio', 'fin', 'duracion'} (ms).
    Lanza ReservaRechazadaError."""
    from app.models import User

    ahora = ahora or ahora_ms()
    preguntas = preguntas_flujo(form)
    resp = cuerpo.get('resp') if isinstance(cuerpo.get('resp'), dict) else {}
    # El lead que vuelve y confirmó sus datos o sus respuestas no los escribe de nuevo: salen de lo que ya tenemos.
    resp = con_guardados(form, cuerpo, resp)
    limpias, errores, descalifica = _limpiar_respuestas(preguntas, resp)
    pais = cuerpo.get('pais') if any(p['c'] == cuerpo.get('pais') for p in [*PAISES, PAIS_OTRO]) else 'BO'
    tz = cuerpo.get('tz') if zona_valida(cuerpo.get('tz')) else (evento['zona']['tz'] or TZ_DEF)
    origen = slugify(str(cuerpo.get('origen') or ''))[:60]
    lead = {'preguntas': preguntas, 'resp': limpias, 'pais': pais, 'tz': tz}
    setter = _setter_de(d, funnel, origen)
    base = {'lead': lead, 'evento': evento, 'funnel': funnel, 'form': form, 'origen': origen, 'setter': None}

    if descalifica:
        _cerrar_intento(evento, form, funnel, limpias, origen, setter, True)
        payload = armar_reserva(**base, asig=None, slot=None)
        operacion.registrar_descalificado(payload)
        avisos_discord.avisar_no_califica(payload, setter, evento['nombre'], 'respuesta')
        return {'descalificada': True}, True
    if errores:
        raise ReservaRechazadaError('invalido', errores)
    # Una regla que manda a otra página: no agenda, queda como los que no califican.
    ruteo = {'url': '', 'no': False} if evento.get('persona') else grupo_por_reglas(form, limpias)
    if ruteo['no']:
        # La segmentación lo manda a «No califica».
        _cerrar_intento(evento, form, funnel, limpias, origen, setter, True)
        payload = {**armar_reserva(**base, asig=None, slot=None), 'descalificada': True}
        operacion.registrar_descalificado(payload)
        avisos_discord.avisar_no_califica(payload, setter, evento['nombre'], 'segmentacion')
        return {'descalificada': True}, True
    url = ruteo['url']
    if url:
        _cerrar_intento(evento, form, funnel, limpias, origen, setter, True)
        payload = armar_reserva(**base, asig=None, slot=None)
        operacion.registrar_descalificado({**payload, 'descalificada': True, 'redirigir': url})
        avisos_discord.avisar_no_califica(payload, setter, evento['nombre'], 'redirigido')
        return {'descalificada': True, 'redirigir': url}, True

    try:
        inicio = int(datetime.fromisoformat(str(cuerpo.get('inicio')).replace('Z', '+00:00')).timestamp() * 1000)
    except (TypeError, ValueError):
        raise ReservaRechazadaError('invalido', {'inicio': 'Elegí un horario.'})

    # El mismo lead que confirma dos veces el mismo horario: se devuelve la agenda que ya tiene.
    cliente = operacion.cliente_por_email(limpias.get('c-email'))
    previa = operacion.agenda_de(cliente.id, ms_a_dt(inicio)) if cliente else None
    if previa:
        invitacion = limpias.get('c-email') if previa.google_event_id else None
        return {**_respuesta(previa), 'consultor': _consultor(d, db.session.get(User, previa.closer_id)),
                'invitacion': invitacion}, False

    # Ya tiene otra agenda próxima: antes de tocar nada se le pregunta si quiere cambiarla de fecha o
    # sumar una sesión. La página repite el pedido con `si_ya_tiene`.
    decision = cuerpo.get('si_ya_tiene') if cuerpo.get('si_ya_tiene') in ('reprogramar', 'adicional') else None
    proxima = operacion.proxima_de(cliente.id, ms_a_dt(ahora)) if cliente else None
    if proxima and not decision:
        raise ReservaRechazadaError('ya_tiene', {'inicio': dt_a_ms(proxima.start_time)})

    d, elegibles = solo_elegibles(d)
    # Un lead A/B puede tomar el horario de una agenda C/D (desplazar.py).
    libres = desplazar.libres(elegibles, ahora) if desplazar.desplaza(segmentar(form, limpias)) else {}
    asig = asignacion(_contexto(evento, form, limpias), d, {**_ocupacion(ahora, elegibles, libres), 'prueba': False})
    slot = next((s for s in asig['slots'] if s['t'] == inicio), None)
    if not slot or not slot['p'] or slot['p'] not in elegibles:
        raise ReservaRechazadaError('ocupado')

    user_id = elegibles[slot['p']]
    # La sesión de ese closer en este evento (lo que ajustó o la propuesta) y su margen: los dos bloquean.
    dur, margen = sesion_de(buscar(d, 'personas', slot['p']), evento['id'], evento['duracion'], evento.get('margen'))
    fin = inicio + (dur + margen) * 60000
    huecos = libres.get(user_id, [])
    desplazadas = desplazar.que_pisa(huecos, inicio, fin)
    # Google primero, sin bloqueo: renovar el token hace commit y soltaría el bloqueo.
    franjas = _franjas_frescas(user_id, inicio, fin)
    if franjas:
        franjas = desplazar.restar(franjas, huecos)
    # Bloqueo del closer: dos leads que eligen el mismo horario a la vez no pueden quedar los dos.
    closer, choca, fuera_de_google = _bloquear_y_verificar(user_id, inicio, fin, franjas, desplazadas)
    if choca:
        db.session.rollback()
        # El mismo lead que confirmó dos veces a la vez: el primer pedido ya le tomó la agenda.
        cliente = operacion.cliente_por_email(limpias.get('c-email'))
        previa = operacion.agenda_de(cliente.id, ms_a_dt(inicio)) if cliente else None
        if previa:
            invitacion = limpias.get('c-email') if previa.google_event_id else None
            return {**_respuesta(previa), 'consultor': _consultor(d, db.session.get(User, previa.closer_id)),
                    'invitacion': invitacion}, False
        raise ReservaRechazadaError('ocupado')

    def asegurar():
        """Lo que llama registrar_agenda justo antes de escribir: buscar la agenda previa del lead lee su
        Google Calendar y puede haber hecho commit (soltando el bloqueo). Vuelve a bloquear y a mirar."""
        return _bloquear_y_verificar(user_id, inicio, fin, franjas, desplazadas)[1:]

    payload = {
        **armar_reserva(**base, asig=asig, slot={**slot, 'dur': dur, 'margen': margen}),
        'evento_nombre': evento['nombre'],
        'indicaciones': evento.get('indic') or '',
        'prioridad_nombre': asig['grupo']['nombre'] if asig.get('grupo') else None,
        'segmento': _segmento(d, form, asig),
        'closer_user_id': closer.id,
        'setter_user_id': setter.id if setter else None,
    }
    appt, evento_viejo = operacion.registrar_agenda(
        payload, closer, setter, ms_a_dt(inicio), ahora=ms_a_dt(ahora), decision=decision, ignorar_ids=fuera_de_google,
        asegurar=asegurar,
    )
    if not appt:
        raise ReservaRechazadaError('ocupado')
    if desplazadas:
        desplazar.marcar(appt, desplazadas)
    _cerrar_intento(evento, form, funnel, limpias, origen, setter, False)
    _subir_version()
    db.session.commit()
    # Con correo, el evento de Calendar le manda la invitación al lead: la página se lo dice solo si salió.
    con_evento = operacion.crear_evento(appt, evento['nombre'], evento_a_borrar=evento_viejo)
    avisos_discord.avisar_agenda(appt)
    operacion.avisar_whatsapp(appt)
    invitacion = limpias.get('c-email') if con_evento else None
    return {**_respuesta(appt), 'consultor': _consultor(d, closer), 'invitacion': invitacion}, True
