"""Lo que la bandeja de conversaciones muestra además del último mensaje: en qué paso del flujo
quedó cada persona, a qué setter le tocó, si califica, para qué examen, qué botón eligió y cuánto
tarda el equipo en contestar."""
from datetime import timedelta
from statistics import median

from app import db
from app.automatizaciones.modelos import AutCampana, AutEjecucion, AutFlujoVersion, IgContacto, IgMensaje
from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.nucleo import mensajes as nucleo_mensajes
from app.automatizaciones.nucleo import pasos
from app.models import User

RECORRIDO = 10


def paso(ejecucion):
    """El nodo donde está (o quedó) la ejecución, con su número de paso y su nombre."""
    if ejecucion is None or not ejecucion.nodo_actual:
        return None
    grafo = ejecucion.version.grafo or {}
    nodo = g.nodos_por_id(grafo).get(ejecucion.nodo_actual) or {}
    return {'id': ejecucion.nodo_actual, 'numero': pasos.orden(grafo).get(ejecucion.nodo_actual),
            'nombre': nodo.get('nombre'), 'tipo': nodo.get('tipo')}


def resumen_ejecucion(ejecucion):
    if ejecucion is None:
        return None
    return {'flujo': ejecucion.version.flujo.nombre, 'estado': ejecucion.estado, 'nodo': ejecucion.nodo_actual,
            'paso': paso(ejecucion), 'detalle': ejecucion.detalle,
            'iniciada_en': ejecucion.iniciada_en.isoformat() + 'Z' if ejecucion.iniciada_en else None}


def ultimas_ejecuciones(contacto_ids):
    """{contacto_id: su ejecución más reciente}, en una sola consulta."""
    if not contacto_ids:
        return {}
    ultima = (db.session.query(db.func.max(AutEjecucion.id))
              .filter(AutEjecucion.contacto_id.in_(contacto_ids)).group_by(AutEjecucion.contacto_id))
    return {e.contacto_id: e for e in AutEjecucion.query.filter(AutEjecucion.id.in_(ultima)).all()}


def asignaciones(contacto_ids):
    """{contacto_id: {id, username, campana}}: el setter de su último recorrido que tenga uno (el que
    le tocó por el reparto de la campaña, `reparto.py`) y esa campaña. Sin setter, no aparece."""
    if not contacto_ids:
        return {}
    ultima = (db.session.query(db.func.max(AutEjecucion.id))
              .filter(AutEjecucion.contacto_id.in_(contacto_ids), AutEjecucion.setter_id.isnot(None))
              .group_by(AutEjecucion.contacto_id))
    filas = (db.session.query(AutEjecucion.contacto_id, User.id, User.username, AutCampana.nombre, AutEjecucion.iniciada_en)
             .join(User, User.id == AutEjecucion.setter_id)
             .outerjoin(AutCampana, AutCampana.id == AutEjecucion.campana_id)
             .filter(AutEjecucion.id.in_(ultima)).all())
    salida = {cid: {'id': uid, 'username': nombre, 'campana': campana, '_en': en} for cid, uid, nombre, campana, en in filas}
    # Asignada a mano: manda, salvo que después haya entrado por una campaña que la repartió de nuevo.
    manuales = (db.session.query(IgContacto.id, User.id, User.username, IgContacto.asignado_en)
                .join(User, User.id == IgContacto.setter_id).filter(IgContacto.id.in_(contacto_ids)).all())
    for cid, uid, nombre, en in manuales:
        previa = salida.get(cid)
        if previa is None or not previa['_en'] or (en and en >= previa['_en']):
            salida[cid] = {'id': uid, 'username': nombre, 'campana': (previa or {}).get('campana'), '_en': en, 'a_mano': True}
    for a in salida.values():
        a.pop('_en', None)
    return salida


def elegidos(mensajes):
    """{id del mensaje del bot: título del botón que tocó el lead}, con los mensajes en orden. Sale del
    payload del botón (guardado en el mensaje entrante, así sirve para la historia) o, si escribió el
    título en lugar de tocarlo, del efecto que anotó el motor."""
    salida, ultimo_por_nodo, versiones = {}, {}, {}
    for m in mensajes:
        if m.origen == IgMensaje.MOTOR and m.nodo_id:
            ultimo_por_nodo[m.nodo_id] = m.id
            continue
        contenido = m.contenido if isinstance(m.contenido, dict) else {}
        if m.origen != IgMensaje.LEAD:
            continue
        efecto = contenido.get('efecto') or {}
        datos = nucleo_mensajes.leer_payload(contenido.get('payload'))
        if datos:
            version_id, nodo_id, boton_id = datos
            if version_id not in versiones:
                version = db.session.get(AutFlujoVersion, version_id)
                versiones[version_id] = g.nodos_por_id(version.grafo) if version else {}
            botones = (versiones[version_id].get(nodo_id) or {}).get('botones') or []
            titulo = next((b.get('titulo') for b in botones if b.get('id') == boton_id), None)
        elif efecto.get('tipo') == 'boton':
            nodo_id, titulo = efecto.get('nodo'), efecto.get('boton')
        else:
            continue
        if titulo and nodo_id in ultimo_por_nodo:
            salida[ultimo_por_nodo[nodo_id]] = titulo
    return salida


def recorrido(contacto_id):
    """Los flujos por los que pasó, del más nuevo al más viejo."""
    filas = (AutEjecucion.query.filter_by(contacto_id=contacto_id)
             .order_by(AutEjecucion.id.desc()).limit(RECORRIDO).all())
    return [resumen_ejecucion(e) for e in filas]


def _demoras(ahora, horas):
    """[(contacto_id, minutos, cuándo contestó)]: cada vez que a un mensaje del lead le sigue uno de una persona
    del equipo (no el bot), en las últimas horas."""
    mensajes = (db.session.query(IgMensaje.contacto_id, IgMensaje.origen, IgMensaje.enviado_en)
                .filter(IgMensaje.enviado_en >= ahora - timedelta(hours=horas))
                .order_by(IgMensaje.contacto_id, IgMensaje.enviado_en, IgMensaje.id).all())
    demoras, anterior = [], None
    for m in mensajes:
        if anterior and anterior.contacto_id == m.contacto_id and anterior.origen == IgMensaje.LEAD \
                and m.origen == IgMensaje.OTRO:
            demoras.append((m.contacto_id, (m.enviado_en - anterior.enviado_en).total_seconds() / 60, m.enviado_en))
        anterior = m
    return demoras


def mediana_respuesta(ahora, horas=24):
    """Minutos que tarda el equipo (no el bot) en contestar el mensaje de un lead, en las últimas horas."""
    demoras = [minutos for _, minutos, _ in _demoras(ahora, horas)]
    return round(median(demoras)) if demoras else None


def medianas_por_setter(ahora, horas=24):
    """[{id, username, mediana, respuestas, activo, inactivo, segundos_activo}] por setter. Meta no dice quién
    contestó desde Kommo o Instagram: la respuesta se le cuenta al setter asignado a la conversación (decidido
    el 27/10/2026). `activo` / `inactivo`: {mediana, respuestas} según si contestó con «Activo» prendido
    (ADR-W245); None si no hubo respuestas así."""
    from app.automatizaciones import actividad
    demoras = _demoras(ahora, horas)
    asignados = asignaciones(list({cid for cid, _, _ in demoras}))
    por_setter = {}
    for cid, minutos, en in demoras:
        setter = asignados.get(cid)
        if setter:
            por_setter.setdefault((setter['id'], setter['username']), []).append((minutos, en))
    desde = ahora - timedelta(hours=horas)
    rangos = actividad.periodos([sid for sid, _ in por_setter], desde, ahora) if por_setter else {}

    def resumen(valores):
        return {'mediana': round(median(valores)), 'respuestas': len(valores)} if valores else None

    salida = []
    for (sid, nombre), filas in por_setter.items():
        suyos = rangos.get(sid, [])
        activas = [m for m, en in filas if actividad.activo_en(suyos, en)]
        inactivas = [m for m, en in filas if not actividad.activo_en(suyos, en)]
        salida.append({'id': sid, 'username': nombre, 'mediana': round(median([m for m, _ in filas])), 'respuestas': len(filas),
                       'activo': resumen(activas), 'inactivo': resumen(inactivas),
                       'segundos_activo': round(sum((b - a).total_seconds() for a, b in suyos))})
    return sorted(salida, key=lambda s: s['mediana'])


def comentarios(mensajes):
    """{mensaje_id: {'permalink'}} de los que son un comentario (no un DM), para marcarlos en el chat con su
    publicación. El link se le pide a Meta una vez y queda en el mensaje."""
    from sqlalchemy.orm.attributes import flag_modified
    from app.automatizaciones.transporte import TransporteMeta
    salida, transporte = {}, None
    for m in mensajes:
        c = m.contenido if isinstance(m.contenido, dict) else {}
        if m.direccion != IgMensaje.ENTRANTE or not c.get('comentario_id'):
            continue
        if 'permalink' not in c and c.get('publicacion_id'):
            transporte = transporte or TransporteMeta()
            c['permalink'] = transporte.permalink(c['publicacion_id'])
            m.contenido = c
            flag_modified(m, 'contenido')
        salida[m.id] = {'permalink': c.get('permalink')}
    if transporte:
        db.session.commit()
    return salida


def entrada(contacto_id):
    """{clave, campana, anuncio} de su recorrido más nuevo que entró por palabra clave, o None."""
    fila = (db.session.query(AutEjecucion.clave, AutCampana.nombre, AutEjecucion.meta_ad_id)
            .outerjoin(AutCampana, AutCampana.id == AutEjecucion.campana_id)
            .filter(AutEjecucion.contacto_id == contacto_id, AutEjecucion.clave.isnot(None))
            .order_by(AutEjecucion.id.desc()).first())
    return {'clave': fila[0], 'campana': fila[1], 'anuncio': fila[2]} if fila else None
