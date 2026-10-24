"""Las agendas de un taller (o de varios), para el modal que se abre al tocar «N agendas».

Solo lectura, mismo permiso que el resto del panel de Workshop (admin, operador y director de
marketing). Las filas son las de Revisar › Agendas (ver `workshop_agendas_service`).
"""
import logging

from flask import jsonify, request
from flask_login import current_user

from app.api.workshop import bp
from app.decorators import workshop_required
from app.services import workshop_agendas_service as servicio

logger = logging.getLogger(__name__)


def _ids_pedidos():
    """`?ids=3,5,8` -> [3, 5, 8]. None si algo no es un número."""
    try:
        return [int(x) for x in request.args.get('ids', '').split(',') if x.strip()]
    except ValueError:
        return None


@bp.route('/agendas', methods=['GET'])
@workshop_required
def agendas_de_talleres():
    ids = _ids_pedidos()
    if not ids:
        return jsonify({'error': 'ids es obligatorio: los talleres separados por coma'}), 400
    if len(ids) > servicio.MAX_TALLERES:
        return jsonify({'error': f'Máximo {servicio.MAX_TALLERES} talleres por pedido'}), 400

    talleres = servicio.talleres_por_ids(ids)
    if not talleres:
        return jsonify({'error': 'Taller no encontrado'}), 404
    tz = getattr(current_user, 'timezone', None) or 'America/La_Paz'
    try:
        return jsonify(servicio.agendas_de_talleres(talleres, tz)), 200
    except Exception as e:
        logger.exception('No se pudieron armar las agendas de los talleres %s', ids)
        return jsonify({'error': f'No se pudieron cargar las agendas: {e}'}), 500
