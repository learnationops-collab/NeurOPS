"""Servicio de Agendas 2.0: documentos de Thalamus, version de cambios y reservas.

Todo documento que entra pasa por el normalizador del nucleo (el mismo esquema que el frontend).
Las reservas nunca confian en lo que calculo el navegador: se revalidan las respuestas contra la
version PUBLICADA del evento, se recalcula la asignacion con las reservas reales y, antes de
insertar, se bloquea la fila del closer y se comprueba que siga libre.
"""

import time
from datetime import datetime, timezone

from app import db
from app.agendas_v2.modelos import MODELOS, SchedConfig, SchedPerfil, SchedPersona, SchedReserva
from app.agendas_v2.nucleo.asignacion import asignacion
from app.agendas_v2.nucleo.catalogos import PAISES, TZ_DEF, con_opciones, zona_valida
from app.agendas_v2.nucleo.datos import buscar, nombre_origen
from app.agendas_v2.nucleo.eventos import version_publicada
from app.agendas_v2.nucleo.formulario import limpiar_respuesta, validar_respuesta
from app.agendas_v2.nucleo.normalizar import COLECCIONES, NORM, normal_integ, normal_perfil, preguntas_flujo
from app.agendas_v2.nucleo.ocupacion import opciones_de_ocupacion
from app.agendas_v2.nucleo.reserva import armar_reserva
from app.agendas_v2.nucleo.util import slugify, uid

DIA_MS = 86400000
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
    """Usuarios activos de la app con esos roles: {id, nombre, email, rol, tz}. Para sumarlos a Team."""
    from app.models.user import User

    filas = User.query.filter(User.role.in_(roles), User.is_active.is_(True)).order_by(User.username).all()
    return [
        {'id': u.id, 'nombre': u.username or '', 'email': (u.email or '').lower(), 'rol': u.role, 'tz': u.timezone or TZ_DEF}
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


def reserva_a_dict(r):
    """Una reserva en el formato que usa el frontend (el mismo que guarda adaptadorLocal)."""
    return {
        **(r.payload or {}),
        'id': r.id,
        'estado': r.estado,
        'inicio_ms': dt_a_ms(r.inicio),
        'fin_ms': dt_a_ms(r.fin),
        'creada': r.creada_en.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z') if r.creada_en else None,
    }


def reservas_para_estado(ahora=None):
    desde = ms_a_dt((ahora or ahora_ms()) - VENTANA_ESTADO_DIAS * DIA_MS)
    filas = (
        SchedReserva.query.filter(
            db.or_(
                SchedReserva.inicio >= desde, db.and_(SchedReserva.inicio.is_(None), SchedReserva.creada_en >= desde)
            )
        )
        .order_by(SchedReserva.creada_en)
        .all()
    )
    return [reserva_a_dict(r) for r in filas]


def _ocupacion(ahora):
    """Reservas vigentes de todos los closers, en el formato que espera el nucleo."""
    filas = SchedReserva.query.filter(
        SchedReserva.estado == 'agendada',
        SchedReserva.closer_id.isnot(None),
        SchedReserva.fin >= ms_a_dt(ahora - DIA_MS),
    ).all()
    return opciones_de_ocupacion(
        [
            {'estado': r.estado, 'closer_id': r.closer_id, 'inicio_ms': dt_a_ms(r.inicio), 'fin_ms': dt_a_ms(r.fin)}
            for r in filas
        ],
        ahora,
    )


def cancelar_reserva(reserva_id):
    r = db.session.get(SchedReserva, reserva_id)
    if not r:
        return None
    if r.estado != 'cancelada':
        r.estado = 'cancelada'
        r.cancelada_en = ms_a_dt(ahora_ms())
        _subir_version()
        db.session.commit()
    return reserva_a_dict(r)


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
    asig = asignacion(_contexto(evento, form, limpias), d, {**_ocupacion(ahora), 'prueba': False})
    return sorted({s['t'] for s in asig['slots']})


def _setter_de(d, funnel, origen):
    if not funnel or not origen:
        return None
    for o in funnel.get('origenes', []):
        if o.get('setter') and (slugify(nombre_origen(d, o)) or o['id']) == origen:
            return o['setter']
    return None


def reservar(d, evento, form, funnel, cuerpo, ahora=None):
    """Toma la agenda. Devuelve (reserva dict, creada: bool). Lanza ReservaRechazadaError."""
    ahora = ahora or ahora_ms()
    preguntas = preguntas_flujo(form)
    limpias, errores, descalifica = _limpiar_respuestas(preguntas, cuerpo.get('resp'))
    pais = cuerpo.get('pais') if any(p['c'] == cuerpo.get('pais') for p in PAISES) else 'BO'
    tz = cuerpo.get('tz') if zona_valida(cuerpo.get('tz')) else (evento['zona']['tz'] or TZ_DEF)
    origen = slugify(str(cuerpo.get('origen') or ''))[:60]
    lead = {'preguntas': preguntas, 'resp': limpias, 'pais': pais, 'tz': tz}
    base = {
        'lead': lead,
        'evento': evento,
        'funnel': funnel,
        'form': form,
        'origen': origen,
        'setter': _setter_de(d, funnel, origen),
    }

    if descalifica:
        payload = armar_reserva(**base, asig=None, slot=None)
        return _insertar(payload, 'descalificada', None), True
    if errores:
        raise ReservaRechazadaError('invalido', errores)

    try:
        inicio = int(datetime.fromisoformat(str(cuerpo.get('inicio')).replace('Z', '+00:00')).timestamp() * 1000)
    except (TypeError, ValueError):
        raise ReservaRechazadaError('invalido', {'inicio': 'Elegí un horario.'})

    email = (limpias.get('c-email') or '').lower()
    if email:
        previa = SchedReserva.query.filter_by(
            evento_id=evento['id'], lead_email=email, inicio=ms_a_dt(inicio), estado='agendada'
        ).first()
        if previa:  # el mismo lead mando dos veces el mismo horario
            return reserva_a_dict(previa), False

    asig = asignacion(_contexto(evento, form, limpias), d, {**_ocupacion(ahora), 'prueba': False})
    slot = next((s for s in asig['slots'] if s['t'] == inicio), None)
    if not slot or not slot['p']:
        raise ReservaRechazadaError('ocupado')

    # Bloqueo del closer: dos leads que eligen el mismo horario a la vez no pueden quedar los dos.
    db.session.query(SchedPersona).filter_by(id=slot['p']).with_for_update().first()
    fin = inicio + evento['duracion'] * 60000
    choque = SchedReserva.query.filter(
        SchedReserva.closer_id == slot['p'],
        SchedReserva.estado == 'agendada',
        SchedReserva.inicio < ms_a_dt(fin),
        SchedReserva.fin > ms_a_dt(inicio),
    ).first()
    if choque:
        db.session.rollback()
        raise ReservaRechazadaError('ocupado')

    payload = armar_reserva(**base, asig=asig, slot=slot)
    return _insertar(payload, 'agendada', (inicio, fin)), True


def _insertar(payload, estado, rango):
    r = SchedReserva(
        id=uid('rs'),
        evento_id=payload['evento_id'],
        funnel_id=payload.get('funnel_id') or None,
        closer_id=payload.get('closer_id'),
        estado=estado,
        inicio=ms_a_dt(rango[0]) if rango else None,
        fin=ms_a_dt(rango[1]) if rango else None,
        origen=payload.get('origen') or None,
        setter_id=payload.get('setter_id'),
        prioridad_id=payload.get('prioridad_id'),
        nota=payload.get('nota'),
        lead_nombre=(payload['lead'].get('nombre') or '')[:120] or None,
        lead_email=(payload['lead'].get('email') or '')[:120] or None,
        lead_telefono=(payload['lead'].get('telefono') or '')[:40] or None,
        payload=payload,
    )
    db.session.add(r)
    _subir_version()
    db.session.commit()
    return reserva_a_dict(r)
