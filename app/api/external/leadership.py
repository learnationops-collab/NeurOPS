"""Leadership → Work: la disponibilidad del equipo (ADR-W133, app/agendas_v2/leadership.py).

PUT /api/external/leadership/disponibilidad con la foto de una persona: {email, tz, definida, horario
{0..6 (0 = domingo)}, bloqueos [{id, inicio, fin, motivo}], ocupado_rituales [{habit_id, inicio, fin}],
rituales [{habit_id, titulo, tz, hora, duracion, cadencia, dias, dia_mes, desde}], version}. Token:
LEADERSHIP_INBOUND_API_TOKEN (en Leadership, WORK_SYNC_TOKEN).
"""
from flask import Blueprint, jsonify, request

from app.agendas_v2 import leadership
from app.decorators import require_leadership_token

bp = Blueprint('external_leadership_api', __name__)


@bp.route('/disponibilidad', methods=['PUT'])
@require_leadership_token
def disponibilidad():
    cuerpo, codigo = leadership.recibir(request.get_json(silent=True) or {})
    return jsonify(cuerpo), codigo
