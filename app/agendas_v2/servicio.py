"""Servicio de Agendas 2.0: documentos de Thalamus, version de cambios y reservas.

Todo documento que entra pasa por el normalizador del nucleo (el mismo esquema que el frontend).
Las reservas se escriben en la operacion (operacion.py) y nunca confian en lo que calculo el
navegador: se revalidan las respuestas contra la version PUBLICADA del evento, se recalcula la
asignacion con las agendas reales y, antes de escribir, se bloquea al closer y se comprueba que
siga libre.
"""

import time
from datetime import datetime, timedelta, timezone

from app import db
from app.agendas_v2 import operacion
from app.agendas_v2.modelos import MODELOS, SchedConfig, SchedPerfil
from app.agendas_v2.nucleo.asignacion import asignacion
from app.agendas_v2.nucleo.catalogos import PAISES, TZ_DEF, con_opciones, zona_valida
from app.agendas_v2.nucleo.datos import buscar, nombre_origen
from app.agendas_v2.nucleo.eventos import version_publicada
from app.agendas_v2.nucleo.formulario import limpiar_respuesta, validar_respuesta
from app.agendas_v2.nucleo.normalizar import COLECCIONES, NORM, normal_integ, normal_perfil, preguntas_flujo
from app.agendas_v2.nucleo.ocupacion import opciones_de_ocupacion
from app.agendas_v2.nucleo.reserva import armar_reserva
from app.agendas_v2.nucleo.util import slugify

DIA_MS = 86400000
# Las agendas de la operacion (Appointment) no guardan duracion: cada una bloquea 60 minutos.
DURACION_AGENDA_OPERACION_MIN = 60
# Reservas que viajan al panel: las futuras y las de los ultimos 35 dias (Available, KPIs, ocupacion).
VENTANA_ESTADO_DIAS = 35
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


def usuarios_del_equipo(roles):
    """Usuarios activos de la app con esos roles: {id, nombre, email, rol, tz, calendar}. Para sumarlos
    a Team. `calendar`: si conecto su Google Calendar (sin eso un closer no recibe agendas)."""
    from app.models.user import User

    filas = User.query.filter(User.role.in_(roles), User.is_active.is_(True)).order_by(User.username).all()
    con_calendar = _con_calendar({u.id for u in filas})
    return [
        {
            'id': u.id,
            'nombre': u.username or '',
            'email': (u.email or '').lower(),
            # Una cuenta puede tener varios roles (users.roles_extra): vale el primero de `roles` que tenga.
            'rol': next((r for r in roles if u.tiene_rol(r)), u.role),
            'tz': u.timezone or TZ_DEF,
            'calendar': u.id in con_calendar,
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
    _subir_version()
    db.session.commit()
    return doc


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
    fila.datos = perfil
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


def _vigente(appt):
    return not appt.closer_processed and (appt.result or '') not in operacion.RESULTADOS_NO_VIGENTES


def reserva_a_dict(appt):
    """Una agenda de Agendas 2.0 en el formato de reserva que usa el frontend (el de adaptadorLocal)."""
    inicio = dt_a_ms(appt.start_time)
    return {
        **(appt.agenda_payload or {}),
        'id': str(appt.id),
        'estado': 'agendada' if _vigente(appt) else 'cancelada',
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
    filas = GoogleCalendarToken.query.filter(GoogleCalendarToken.user_id.in_(list(user_ids))).all()
    return {t.user_id for t in filas}


def solo_elegibles(d):
    """Copia de `d` donde una persona sin usuario activo o sin Google Calendar conectado no tiene
    horario: no se le ofrece nada y el nucleo la saltea (y desborda) como a un closer sin horas.
    Devuelve (d, {persona_id: user_id} de las elegibles)."""
    usuarios = _usuarios_de_personas(d)
    con_calendar = _con_calendar(set(usuarios.values()))
    elegibles = {pid: user_id for pid, user_id in usuarios.items() if user_id in con_calendar}
    personas = [p if p['id'] in elegibles else {**p, 'horario': {}} for p in d['personas']]
    return {**d, 'personas': personas}, elegibles


def _agendas_de_operacion(elegibles, desde):
    """Agendas vigentes de esos closers (Appointment), como reservas del nucleo. Las de Agendas 2.0
    duran lo que dura su evento; las que entran por n8n, 60 minutos."""
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
    return [
        {
            'estado': 'agendada',
            'closer_id': pid,
            'inicio_ms': dt_a_ms(a.start_time),
            'fin_ms': dt_a_ms(a.start_time) + _duracion_min(a) * 60000,
        }
        for a in filas
        for pid in persona_de[a.closer_id]
    ]


def _ocupacion(ahora, elegibles=None):
    """Lo que tiene ocupado cada closer: sus agendas vigentes en la operacion, en el formato del nucleo."""
    return opciones_de_ocupacion(_agendas_de_operacion(elegibles or {}, ms_a_dt(ahora - DIA_MS)), ahora)


def _choca(user_id, inicio, fin):
    """Si el closer ya tiene una agenda vigente que se cruza con [inicio, fin) (ms)."""
    from app.models import Appointment

    filas = Appointment.query.filter(
        Appointment.closer_id == user_id,
        Appointment.start_time < ms_a_dt(fin),
        Appointment.start_time >= ms_a_dt(inicio) - timedelta(hours=4),
        *operacion.filtro_vigente(),
    ).all()
    return any(dt_a_ms(a.start_time) + _duracion_min(a) * 60000 > inicio for a in filas)


# --- Pagina publica -----------------------------------------------------------------------------

CAMPOS_EVENTO_PUBLICO = ('id', 'nombre', 'slug', 'duracion', 'reservas', 'antel', 'paso', 'zona', 'desc', 'redir')


def _disponible(d, e):
    """(evento publicado, form publicado, funnel) o None. Manda la version PUBLICADA: lo que se
    edita en Thalamus sin publicar (incluido el funnel o el link) no cambia lo que esta en vivo."""
    pub = version_publicada(e)
    if not pub or not pub.get('form') or not pub['evento'].get('activo'):
        return None
    funnel = buscar(d, 'funnels', pub['evento'].get('funnel'))
    if funnel and not funnel.get('activo'):
        return None
    return pub['evento'], pub['form'], funnel


def evento_disponible(d, funnel_slug, evento_slug):
    """El evento de un link /agenda/<funnel>/<evento> (o /agenda/<evento>), si esta disponible:
    publicado, activo, con formulario y con su funnel activo."""
    encontrados = []
    for e in d['eventos']:
        x = _disponible(d, e)
        if not x or x[0]['slug'] != evento_slug:
            continue
        funnel = x[2]
        if funnel_slug is not None and (not funnel or funnel['slug'] != funnel_slug):
            continue
        encontrados.append(x)
    if funnel_slug is None:
        encontrados.sort(key=lambda x: 0 if not x[2] else 1)  # sin funnel primero
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
    asig = asignacion(_contexto(evento, form, limpias), d, {**_ocupacion(ahora, elegibles), 'prueba': False})
    return sorted({s['t'] for s in asig['slots']})


def _setter_de(d, funnel, origen):
    if not funnel or not origen:
        return None
    for o in funnel.get('origenes', []):
        if o.get('setter') and (slugify(nombre_origen(d, o)) or o['id']) == origen:
            return o['setter']
    return None


def _respuesta(appt):
    """Lo que la pagina publica le muestra al lead de su agenda."""
    r = reserva_a_dict(appt)
    return {'id': r['id'], 'inicio': r['inicio_ms'], 'fin': r['fin_ms'], 'duracion': _duracion_min(appt)}


def reservar(d, evento, form, funnel, cuerpo, ahora=None):
    """Toma la agenda y la escribe en la operacion (operacion.py). Devuelve (resultado, creada):
    resultado es {'descalificada': True} o {'id', 'inicio', 'fin', 'duracion'} (ms).
    Lanza ReservaRechazadaError."""
    from app.models import User

    ahora = ahora or ahora_ms()
    preguntas = preguntas_flujo(form)
    limpias, errores, descalifica = _limpiar_respuestas(preguntas, cuerpo.get('resp'))
    pais = cuerpo.get('pais') if any(p['c'] == cuerpo.get('pais') for p in PAISES) else 'BO'
    tz = cuerpo.get('tz') if zona_valida(cuerpo.get('tz')) else (evento['zona']['tz'] or TZ_DEF)
    origen = slugify(str(cuerpo.get('origen') or ''))[:60]
    lead = {'preguntas': preguntas, 'resp': limpias, 'pais': pais, 'tz': tz}
    setter_persona = _setter_de(d, funnel, origen)
    base = {'lead': lead, 'evento': evento, 'funnel': funnel, 'form': form, 'origen': origen, 'setter': setter_persona}

    if descalifica:
        operacion.registrar_descalificado(armar_reserva(**base, asig=None, slot=None))
        return {'descalificada': True}, True
    if errores:
        raise ReservaRechazadaError('invalido', errores)

    try:
        inicio = int(datetime.fromisoformat(str(cuerpo.get('inicio')).replace('Z', '+00:00')).timestamp() * 1000)
    except (TypeError, ValueError):
        raise ReservaRechazadaError('invalido', {'inicio': 'Elegí un horario.'})

    # El mismo lead que confirma dos veces el mismo horario: se devuelve la agenda que ya tiene.
    cliente = operacion.cliente_por_email(limpias.get('c-email'))
    previa = operacion.agenda_de(cliente.id, ms_a_dt(inicio)) if cliente else None
    if previa:
        return _respuesta(previa), False

    usuarios = _usuarios_de_personas(d)
    d, elegibles = solo_elegibles(d)
    asig = asignacion(_contexto(evento, form, limpias), d, {**_ocupacion(ahora, elegibles), 'prueba': False})
    slot = next((s for s in asig['slots'] if s['t'] == inicio), None)
    if not slot or not slot['p'] or slot['p'] not in elegibles:
        raise ReservaRechazadaError('ocupado')

    # Bloqueo del closer: dos leads que eligen el mismo horario a la vez no pueden quedar los dos.
    closer = db.session.query(User).filter_by(id=elegibles[slot['p']]).with_for_update().first()
    fin = inicio + evento['duracion'] * 60000
    if not closer or _choca(closer.id, inicio, fin):
        db.session.rollback()
        raise ReservaRechazadaError('ocupado')

    setter = db.session.get(User, usuarios[setter_persona]) if setter_persona in usuarios else None
    payload = {
        **armar_reserva(**base, asig=asig, slot=slot),
        'evento_nombre': evento['nombre'],
        'prioridad_nombre': asig['grupo']['nombre'] if asig.get('grupo') else None,
        'closer_user_id': closer.id,
        'setter_user_id': setter.id if setter else None,
    }
    appt, evento_viejo = operacion.registrar_agenda(payload, closer, setter, ms_a_dt(inicio), ahora=ms_a_dt(ahora))
    if not appt:
        raise ReservaRechazadaError('ocupado')
    _subir_version()
    db.session.commit()
    operacion.crear_evento(appt, evento['nombre'], evento_a_borrar=evento_viejo)
    return _respuesta(appt), True
