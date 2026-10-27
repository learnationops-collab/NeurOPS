"""En qué va cada conversación, en tres etapas (decidido con Santi el 27/10/2026):

  · automática: el bot. Pausada no es lo mismo que terminada (antes no se distinguía).
  · manual: el setter. En progreso cuando escribió alguien del equipo; completada cuando pasó a la
    agenda; fallida si el lead no contesta en 48 h al último mensaje del equipo.
  · agendamiento: completada con una agenda (cliente con ese Instagram, creada desde que escribió) o
    con la sub-etapa «Agendó»; en progreso con «Link enviado».

Cada etapa queda en pendiente · progreso · completada · fallida (y pausada, solo la automática).
La sub-etapa del embudo sale de lo mismo, salvo que el equipo la haya movido a una más avanzada.
También: cuándo empezó su última conversación, quién mandó el último mensaje y cuántos sin leer tiene
cada uno. Todo en lote para la lista (una consulta por dato, no por conversación).
"""
from datetime import timedelta

from app import db
from app.automatizaciones import bandeja
from app.automatizaciones.modelos import AutEjecucion, IgMensaje
from app.models import Appointment, Client
from app.models.inbox_work import InboxRead, Task
from app.models.tag import TARGET_IG_CONTACT

PENDIENTE, PROGRESO, COMPLETADA, FALLIDA, PAUSADA = 'pendiente', 'progreso', 'completada', 'fallida', 'pausada'
ETAPAS = ('con_bot', 'conversando', 'link', 'agendo')
SIN_RESPUESTA = timedelta(hours=48)
# Los «sin leer» miran las últimas dos semanas: más atrás, ya no es un mensaje nuevo.
VENTANA_LEIDOS = timedelta(days=14)

_AUTO = {
    AutEjecucion.TERMINADA: COMPLETADA, AutEjecucion.CANCELADA: PAUSADA, AutEjecucion.PENDIENTE: PROGRESO,
    AutEjecucion.ERROR: FALLIDA, AutEjecucion.VENTANA_VENCIDA: FALLIDA,
}


def _auto(ejecucion, pausado):
    if ejecucion is None:
        return FALLIDA  # escribió y ninguna palabra clave arrancó un flujo
    if ejecucion.estado in AutEjecucion.ABIERTOS:
        return PAUSADA if pausado else PROGRESO
    return _AUTO.get(ejecucion.estado, PENDIENTE)


def _usuario_ig(texto):
    """«@Dra.Val», «instagram.com/dra.val/» y «dra.val» son el mismo usuario."""
    t = (texto or '').strip().lower().rstrip('/')
    return t.rsplit('/', 1)[-1].lstrip('@') if t else ''


def agendas(contactos):
    """{contacto_id: inicio de su agenda más reciente}: un cliente con su Instagram y una agenda creada
    desde que la persona escribió por primera vez."""
    por_usuario = {_usuario_ig(c.username): c for c in contactos if c.username}
    if not por_usuario:
        return {}
    usuario = db.func.lower(db.func.replace(Client.instagram, '@', ''))
    filas = (db.session.query(usuario, Appointment.start_time, Appointment.created_at)
             .join(Appointment, Appointment.client_id == Client.id)
             .filter(usuario.in_(list(por_usuario))).all())
    salida = {}
    for nombre, inicio, creada in filas:
        c = por_usuario.get(_usuario_ig(nombre))
        if c and creada and creada >= c.creado_en - timedelta(days=1):
            if c.id not in salida or (inicio and inicio > (salida[c.id] or inicio)):
                salida[c.id] = inicio
    return salida


def _ultimos(ids, direccion):
    """{contacto_id: (momento, origen)} del último mensaje en esa dirección."""
    ultimo = (db.session.query(IgMensaje.contacto_id, db.func.max(IgMensaje.enviado_en).label('en'))
              .filter(IgMensaje.contacto_id.in_(ids), IgMensaje.direccion == direccion)
              .group_by(IgMensaje.contacto_id).subquery())
    filas = (db.session.query(IgMensaje.contacto_id, IgMensaje.enviado_en, IgMensaje.origen)
             .join(ultimo, db.and_(ultimo.c.contacto_id == IgMensaje.contacto_id, ultimo.c.en == IgMensaje.enviado_en,
                                   IgMensaje.direccion == direccion)).all())
    return {cid: (en, origen) for cid, en, origen in filas}


def _del_equipo(ids, desde):
    """{contacto_id: último mensaje del equipo (no el bot)} desde que empezó su último recorrido."""
    filas = (db.session.query(IgMensaje.contacto_id, db.func.max(IgMensaje.enviado_en))
             .filter(IgMensaje.contacto_id.in_(ids), IgMensaje.origen == IgMensaje.OTRO)
             .group_by(IgMensaje.contacto_id).all())
    return {cid: en for cid, en in filas if en and en >= desde.get(cid, en)}


def _sin_leer(ids, usuario_id, salientes, ahora):
    """{contacto_id: mensajes del lead después del último del equipo o el bot y de lo que ya leyó}."""
    leidos = dict(db.session.query(InboxRead.contact_id, InboxRead.read_at)
                  .filter(InboxRead.user_id == usuario_id, InboxRead.contact_id.in_(ids)).all())
    filas = (db.session.query(IgMensaje.contacto_id, IgMensaje.enviado_en)
             .filter(IgMensaje.contacto_id.in_(ids), IgMensaje.direccion == IgMensaje.ENTRANTE,
                     IgMensaje.enviado_en >= ahora - VENTANA_LEIDOS).all())
    cuenta = {}
    for cid, en in filas:
        corte = max(filter(None, [leidos.get(cid), (salientes.get(cid) or (None,))[0]]), default=None)
        if corte is None or en > corte:
            cuenta[cid] = cuenta.get(cid, 0) + 1
    return cuenta


def tareas_abiertas(ids):
    """{contacto_id: la tarea abierta que vence primero}."""
    filas = (Task.query.filter(Task.target_type == TARGET_IG_CONTACT, Task.target_id.in_([str(i) for i in ids]),
                               Task.done_at.is_(None))
             .order_by(Task.due_at.is_(None), Task.due_at).all())
    salida = {}
    for t in filas:
        salida.setdefault(int(t.target_id), {'id': t.id, 'titulo': t.title, 'vence': _iso(t.due_at)})
    return salida


def _iso(fecha):
    return fecha.isoformat() + 'Z' if fecha else None


def de_contactos(contactos, ejecuciones, ahora, usuario_id, primeros):
    """{contacto_id: {etapas, etapa, inicio, ultimo_envio, sin_leer, tarea}} para la bandeja.
    `ejecuciones`: la última de cada uno; `primeros`: su primer mensaje."""
    ids = [c.id for c in contactos]
    if not ids:
        return {}
    inicios = {c.id: (ejecuciones[c.id].iniciada_en if c.id in ejecuciones else primeros.get(c.id) or c.creado_en)
               for c in contactos}
    salientes = _ultimos(ids, IgMensaje.SALIENTE)
    entrantes = _ultimos(ids, IgMensaje.ENTRANTE)
    equipo = _del_equipo(ids, inicios)
    agendadas = agendas(contactos)
    sin_leer = _sin_leer(ids, usuario_id, salientes, ahora)
    tareas = tareas_abiertas(ids)
    salida = {}
    for c in contactos:
        pausado = bool(c.bot_pausado_hasta and c.bot_pausado_hasta > ahora)
        auto = _auto(ejecuciones.get(c.id), pausado)
        if c.id in agendadas or c.etapa == 'agendo':
            agenda = COMPLETADA
        elif c.etapa == 'link':
            agenda = PROGRESO
        else:
            agenda = PENDIENTE
        if agenda != PENDIENTE and c.id in equipo:
            manual = COMPLETADA
        elif c.id not in equipo:
            manual = PENDIENTE
        else:
            ultimo_lead = (entrantes.get(c.id) or (None,))[0]
            callado = (ultimo_lead is None or ultimo_lead < equipo[c.id]) and ahora - equipo[c.id] > SIN_RESPUESTA
            manual = FALLIDA if callado else PROGRESO
        sugerida = ('agendo' if agenda == COMPLETADA else 'link' if agenda == PROGRESO
                    else 'conversando' if manual != PENDIENTE else 'con_bot')
        etapa = max(sugerida, c.etapa or sugerida, key=lambda e: ETAPAS.index(e) if e in ETAPAS else 0)
        envio = salientes.get(c.id)
        salida[c.id] = {
            'etapas': {'auto': auto, 'manual': manual, 'agenda': agenda},
            'agenda_en': _iso(agendadas.get(c.id)),
            'etapa': etapa,
            'inicio': _iso(inicios[c.id]),
            'ultimo_envio': {'de': 'bot' if envio[1] == IgMensaje.MOTOR else 'equipo', 'en': _iso(envio[0])} if envio else None,
            'sin_leer': sin_leer.get(c.id, 0),
            'tarea': tareas.get(c.id),
        }
    return salida


def uno(contacto, ahora, usuario_id):
    ejecuciones = bandeja.ultimas_ejecuciones([contacto.id])
    primero = (db.session.query(db.func.min(IgMensaje.enviado_en)).filter(IgMensaje.contacto_id == contacto.id).scalar())
    return de_contactos([contacto], ejecuciones, ahora, usuario_id, {contacto.id: primero}).get(contacto.id)

