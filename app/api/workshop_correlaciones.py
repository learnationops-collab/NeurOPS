"""Correlaciones entre métricas de los talleres (pestaña «Correlaciones»). Solo lectura."""
from flask import jsonify, request

from app.api.workshop import bp
from app.decorators import workshop_required
from app.services import workshop_correlaciones_service as service


@bp.route('/correlaciones', methods=['GET'])
@workshop_required
def get_workshop_correlaciones():
    """?objetivo=cash_collected&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&ultimos=N"""
    ultimos = request.args.get('ultimos', type=int)
    data = service.armar(
        desde=service.parse_fecha(request.args.get('desde')),
        hasta=service.parse_fecha(request.args.get('hasta')),
        objetivo=request.args.get('objetivo') or service.OBJETIVO_DEFECTO,
        ultimos=ultimos,
    )
    return jsonify(data), 200
