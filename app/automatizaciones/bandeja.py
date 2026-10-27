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
    """[(contacto_id, minutos)]: cada vez que a un mensaje del lead le sigue uno de una persona del
    equipo (no el bot), en las últimas horas."""
    mensajes = (db.session.query(IgMensaje.contacto_id, IgMensaje.origen, IgMensaje.enviado_en)
                .filter(IgMensaje.enviado_en >= ahora - timedelta(hours=horas))
                .order_by(IgMensaje.contacto_id, IgMensaje.enviado_en, IgMensaje.id).all())
    demoras, anterior = [], None
    for m in mensajes:
        if anterior and anterior.contacto_id == m.contacto_id and anterior.origen == IgMensaje.LEAD \
                and m.origen == IgMensaje.OTRO:
            demoras.append((m.contacto_id, (m.enviado_en - anterior.enviado_en).total_seconds() / 60))
        anterior = m
    return demoras


def mediana_respuesta(ahora, horas=24):
    """Minutos que tarda el equipo (no el bot) en contestar el mensaje de un lead, en las últimas horas."""
    demoras = [minutos for _, minutos in _demoras(ahora, horas)]
    return round(median(demoras)) if demoras else None


def medianas_por_setter(ahora, horas=24):
    """[{id, username, mediana, respuestas}] por setter. Meta no dice quién contestó desde Kommo o
    Instagram: la respuesta se le cuenta al setter asignado a la conversación (decidido el 27/10/2026)."""
    demoras = _demoras(ahora, horas)
    asignados = asignaciones(list({cid for cid, _ in demoras}))
    por_setter = {}
    for cid, minutos in demoras:
        setter = asignados.get(cid)
        if setter:
            por_setter.setdefault((setter['id'], setter['username']), []).append(minutos)
    return sorted(({'id': sid, 'username': nombre, 'mediana': round(median(m)), 'respuestas': len(m)}
                   for (sid, nombre), m in por_setter.items()), key=lambda s: s['mediana'])
