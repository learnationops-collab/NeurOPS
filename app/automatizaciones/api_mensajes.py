"""Editar solo los textos de los mensajes de un flujo publicado (`nucleo/textos.py`), colgado del blueprint
del Inbox. El setter puede: es lo único de los flujos que cambia (`ACCIONES_DEL_SETTER`)."""
from flask import jsonify, request

from app import db
from app.automatizaciones import servicio
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import AutFlujo
from app.automatizaciones.nucleo import textos


def _publicado_o_error(flujo_id):
    flujo = db.session.get(AutFlujo, flujo_id)
    if flujo is None:
        return None, (jsonify({'message': 'Not found'}), 404)
    if flujo.version_publicada is None:
        return None, (jsonify({'message': 'El flujo todavía no se publicó'}), 409)
    return flujo, None


@bp.route('/flujos/<int:flujo_id>/mensajes', methods=['GET'])
def mensajes_de_flujo(flujo_id):
    """Los pasos de la versión publicada (lo que corre), no del borrador."""
    flujo, error = _publicado_o_error(flujo_id)
    if error:
        return error
    version = flujo.version_publicada
    return jsonify({'id': flujo.id, 'nombre': flujo.nombre, 'version': version.numero, 'pasos': textos.lista(version.grafo)})


@bp.route('/flujos/<int:flujo_id>/mensajes', methods=['PUT'])
def guardar_mensajes(flujo_id):
    """`cambios`: {nodo_id: [textos]}. Publica una versión nueva a partir de la publicada, sin tocar el
    estado del flujo, y copia los mismos textos al borrador para que la próxima publicación no los pise."""
    flujo, error = _publicado_o_error(flujo_id)
    if error:
        return error
    cambios = (request.get_json(silent=True) or {}).get('cambios')
    if not isinstance(cambios, dict) or not cambios:
        return jsonify({'message': 'No hay cambios'}), 400
    try:
        nuevo = textos.aplicar(flujo.version_publicada.grafo, cambios)
    except ValueError as e:
        return jsonify({'message': str(e)}), 400
    borrador = flujo.grafo
    for nodo_id, lista in cambios.items():
        try:
            borrador = textos.aplicar(borrador, {nodo_id: lista})
        except ValueError:
            pass  # la dirección cambió ese paso en el borrador: queda como lo dejó
    flujo.grafo = borrador
    errores = servicio.publicar(flujo, grafo=nuevo, activar=False)
    if errores:
        db.session.rollback()
        return jsonify({'message': 'Los textos tienen errores', 'errores': errores}), 422
    return jsonify({'version': flujo.version_publicada.numero})
