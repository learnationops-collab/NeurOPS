"""Acciones del setter sobre el flujo de una conversación (`acciones.py`), colgadas del blueprint del
Inbox. El setter puede usarlas aunque el resto del Inbox sea de solo lectura para él (`ACCIONES_DEL_SETTER`)."""
from flask import jsonify, request

from app import db
from app.automatizaciones import acciones, bandeja, servicio
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import AutEjecucion, AutFlujo, IgContacto
from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.nucleo import pasos as nucleo_pasos

LARGO_VISTA = 140


def _contacto_o_404(contacto_id):
    contacto = db.session.get(IgContacto, contacto_id)
    if contacto is None:
        return None, (jsonify({'message': 'Not found'}), 404)
    return contacto, None


def _texto(nodo):
    """El primer texto del mensaje, para reconocer el paso en la lista."""
    texto = next((c.get('texto') for c in nodo.get('contenido') or [] if c.get('tipo') == 'texto'), '') or ''
    return texto[:LARGO_VISTA]


@bp.route('/conversaciones/<int:contacto_id>/pasos', methods=['GET'])
def pasos_de_conversacion(contacto_id):
    """Los mensajes de la versión del flujo de su último recorrido, en orden, con su etapa: lo que se
    elige en «Continuar desde…». `actual`: el paso donde está o quedó."""
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    ultima = (AutEjecucion.query.filter_by(contacto_id=contacto.id).order_by(AutEjecucion.id.desc()).first())
    if ultima is None:
        return jsonify({'flujo': None, 'actual': None, 'pasos': []})
    grafo = ultima.version.grafo or {}
    nodos = g.nodos_por_id(grafo)
    etapas = {e.get('id'): e.get('nombre') for e in grafo.get('etapas') or []}
    orden = sorted(nucleo_pasos.orden(grafo).items(), key=lambda par: par[1])
    lista = [{'id': nid, 'numero': numero, 'nombre': nodos[nid].get('nombre'), 'texto': _texto(nodos[nid]),
              'etapa': etapas.get(nodos[nid].get('etapa'))}
             for nid, numero in orden if nodos[nid].get('tipo') == 'mensaje']
    return jsonify({'flujo': ultima.version.flujo.nombre, 'version': ultima.version.numero,
                    'actual': ultima.nodo_actual, 'estado': ultima.estado, 'pasos': lista})


@bp.route('/conversaciones/<int:contacto_id>/flujo', methods=['POST'])
def mover_en_flujo(contacto_id):
    """`accion`: continuar (con `nodo_id`) · reiniciar · cambiar o iniciar (con `flujo_id`)."""
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    datos = request.get_json(silent=True) or {}
    accion = datos.get('accion')
    if accion not in ('continuar', 'reiniciar', 'cambiar', 'iniciar'):
        return jsonify({'message': 'Acción desconocida'}), 400
    flujo = None
    if accion in ('cambiar', 'iniciar'):
        flujo = db.session.get(AutFlujo, datos.get('flujo_id') or 0)
        if flujo is None or flujo.estado != AutFlujo.ACTIVO:
            return jsonify({'message': 'Elegí un flujo activo'}), 400
    try:
        with servicio.con_motor() as motor:
            contacto = db.session.get(IgContacto, contacto_id)
            if accion == 'continuar':
                resultado, ejecucion = acciones.continuar(motor, contacto, str(datos.get('nodo_id') or ''))
            else:
                version = flujo.version_publicada if flujo else acciones.ultima_version(contacto)
                resultado, ejecucion = acciones.nuevo_recorrido(motor, contacto, version)
            respuesta = {'resultado': resultado, 'ejecucion': bandeja.resumen_ejecucion(ejecucion)}
    except acciones.AccionInvalida as e:
        return jsonify({'message': str(e)}), 400
    except servicio.MotorApagado:
        return jsonify({'message': 'El motor está apagado: no se puede mover a nadie'}), 409
    except servicio.MotorOcupado:
        return jsonify({'message': 'El motor está ocupado, probá de nuevo en unos segundos'}), 409
    return jsonify(respuesta)


@bp.route('/conversaciones/<int:contacto_id>/bot', methods=['POST'])
def bot_de_conversacion(contacto_id):
    """`pausado`: true pausa el bot 24 h y corta lo abierto; false lo reanuda (no rearranca el flujo)."""
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    pausado = bool((request.get_json(silent=True) or {}).get('pausado'))
    try:
        with servicio.con_motor() as motor:
            contacto = db.session.get(IgContacto, contacto_id)
            acciones.bot(motor, contacto, pausado)
            hasta = contacto.bot_pausado_hasta
    except servicio.MotorApagado:
        return jsonify({'message': 'El motor está apagado'}), 409
    except servicio.MotorOcupado:
        return jsonify({'message': 'El motor está ocupado, probá de nuevo en unos segundos'}), 409
    return jsonify({'bot_pausado_hasta': hasta.isoformat() + 'Z' if hasta else None})
