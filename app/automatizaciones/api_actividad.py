"""El botón «Activo / Inactivo» del Inbox (ADR-W245). Es de cada uno: el setter lo cambia para sí."""
from flask import jsonify, request
from flask_login import current_user

from app.automatizaciones import actividad
from app.automatizaciones.api import bp


@bp.route('/actividad', methods=['GET'])
def mi_actividad():
    return jsonify(actividad.estado(current_user.id))


@bp.route('/actividad', methods=['PUT'])
def cambiar_actividad():
    datos = request.get_json(silent=True) or {}
    if not isinstance(datos.get('activo'), bool):
        return jsonify({'message': 'activo debe ser true o false'}), 400
    return jsonify(actividad.cambiar(current_user.id, datos['activo']))
