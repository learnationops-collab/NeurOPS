"""Comparativas › Close rate real por closer (24/10/2026). Se pide aparte: ver `comercial_close_real`."""
from flask import jsonify

from app.api.comercial import _alcance, _puede_comparar, _rangos, bp
from app.services import comercial_close_real
from app.services.comercial_service import ROL_CLOSERS


@bp.route('/comparativas/reales', methods=['GET'])
def comparativas_reales():
    """El mismo permiso que `/comparativas`; los setters no tienen close rate."""
    if not _puede_comparar():
        return jsonify({'message': 'Forbidden'}), 403
    rol, _, _ = _alcance()
    if rol != ROL_CLOSERS:
        return jsonify({'filas': {}, 'equipo': None}), 200
    start, end, prev_start, prev_end = _rangos()
    return jsonify(comercial_close_real.reales_por_closer(start, end, prev_start, prev_end)), 200
