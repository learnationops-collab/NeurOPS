"""Simulador › Proyección: el resto del mes con modelos entrenados (06/11/2026, ADR-W111).

Ver `proyeccion_tendencia`. Solo la dirección, como la línea base: mezcla cash y gasto en anuncios.
"""
import logging

from flask import jsonify
from flask_login import current_user

from app.api.comercial import _solo_direccion, bp
from app.services import proyeccion_tendencia

logger = logging.getLogger(__name__)


@bp.route('/simulador/tendencia', methods=['GET'])
def simulador_tendencia():
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    try:
        return jsonify(proyeccion_tendencia.proyeccion(clave_cache=current_user.id)), 200
    except Exception as e:
        logger.error(f"proyeccion_tendencia: {e}")
        return jsonify({'message': 'No se pudo calcular la proyección'}), 500
