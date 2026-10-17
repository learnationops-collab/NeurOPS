"""Lo que la bandeja de conversaciones muestra además del último mensaje: en qué paso del flujo
quedó cada persona, si califica, para qué examen y cuánto tarda el equipo en contestar."""
from datetime import timedelta
from statistics import median

from app import db
from app.automatizaciones.modelos import AutEjecucion, IgMensaje
from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.nucleo import pasos

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


def recorrido(contacto_id):
    """Los flujos por los que pasó, del más nuevo al más viejo."""
    filas = (AutEjecucion.query.filter_by(contacto_id=contacto_id)
             .order_by(AutEjecucion.id.desc()).limit(RECORRIDO).all())
    return [resumen_ejecucion(e) for e in filas]


def mediana_respuesta(ahora, horas=24):
    """Minutos que tarda el equipo (no el bot) en contestar el mensaje de un lead, en las últimas horas.
    Cuenta cada vez que a un mensaje del lead le sigue uno de una persona del equipo."""
    mensajes = (db.session.query(IgMensaje.contacto_id, IgMensaje.origen, IgMensaje.enviado_en)
                .filter(IgMensaje.enviado_en >= ahora - timedelta(hours=horas))
                .order_by(IgMensaje.contacto_id, IgMensaje.enviado_en, IgMensaje.id).all())
    demoras, anterior = [], None
    for m in mensajes:
        if anterior and anterior.contacto_id == m.contacto_id and anterior.origen == IgMensaje.LEAD \
                and m.origen == IgMensaje.OTRO:
            demoras.append((m.enviado_en - anterior.enviado_en).total_seconds() / 60)
        anterior = m
    return round(median(demoras)) if demoras else None
