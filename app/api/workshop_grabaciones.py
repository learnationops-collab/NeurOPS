"""Carga masiva de la grabación de Drive de los talleres (ver `workshop_grabaciones_service`)."""
import logging

from flask import jsonify, request

from app.api.workshop import bp
from app.decorators import workshop_required
from app.services import workshop_grabaciones_service as grabaciones

logger = logging.getLogger(__name__)


@bp.route('/events/grabaciones', methods=['POST'])
@workshop_required
def cargar_grabaciones():
    """Body: `csv` (el texto pegado), `simular` (por defecto sí: la vista previa) y `sobrescribir`."""
    data = request.get_json(silent=True) or {}
    try:
        resultado = grabaciones.cargar_csv(data.get('csv'), simular=data.get('simular', True) is not False,
                                           sobrescribir=bool(data.get('sobrescribir')))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(resultado), 200
