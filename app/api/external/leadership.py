"""Leadership → Work: la disponibilidad del equipo (ADR-W133, app/agendas_v2/leadership.py).

PUT /api/external/leadership/disponibilidad con la foto de una persona: {email, tz, definida, horario
{0..6 (0 = domingo)}, bloqueos [{id, inicio, fin, motivo}], ocupado_rituales [{habit_id, inicio, fin}],
rituales [{habit_id, titulo, tz, hora, duracion, cadencia, dias, dia_mes, desde}], version}. Token:
LEADERSHIP_INBOUND_API_TOKEN (en Leadership, WORK_SYNC_TOKEN).

GET /eventos?email&desde&hasta (ms, hasta 15 días): los eventos de su Google Calendar para el Calendar de
Leadership, sin los que puso Leadership (sus rituals y bloqueos ya los tiene).
"""
from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.agendas_v2 import leadership
from app.decorators import require_leadership_token

bp = Blueprint('external_leadership_api', __name__)


@bp.route('/disponibilidad', methods=['PUT'])
@require_leadership_token
def disponibilidad():
    cuerpo, codigo = leadership.recibir(request.get_json(silent=True) or {})
    return jsonify(cuerpo), codigo


DIA_MS = 86400000


@bp.route('/eventos', methods=['GET'])
@require_leadership_token
def eventos():
    from app.models import User
    from app.agendas_v2.servicio import ms_a_dt
    from app.services.google_service import GoogleService

    email = (request.args.get('email') or '').strip().lower()
    desde, hasta = request.args.get('desde', type=int), request.args.get('hasta', type=int)
    if not email or desde is None or hasta is None or not 0 < hasta - desde <= 15 * DIA_MS:
        return jsonify({'error': 'Datos inválidos (email, desde, hasta: hasta 15 días)'}), 400
    u = User.query.filter(func.lower(User.email) == email).first()
    if not u:
        return jsonify({'eventos': [], 'estado': 'no_existe'}), 200
    from app.api.external.agenda import _estado
    if not _estado(u)['calendario_elegido']:
        # Sin calendario elegido (o la cuenta compartida team@) vería los de otros: no se muestra nada.
        return jsonify({'eventos': [], 'estado': 'sin_calendario'}), 200
    lista = GoogleService.eventos_de_agenda(u.id, ms_a_dt(desde), ms_a_dt(hasta))
    if lista is None:
        return jsonify({'eventos': [], 'estado': 'sin_google'}), 200
    salida = [{k: e.get(k) for k in ('id', 'serie', 'titulo', 'inicio', 'fin', 'meet')} for e in lista if not e.get('leadership')]
    return jsonify({'eventos': salida, 'estado': 'ok'}), 200
