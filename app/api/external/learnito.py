"""El conector de Work para el cerebro de Learnito, que vive en la Academia (app/services/learnito_conector.py).

POST /api/external/academy/learnito/connector, con el token de la Academia (ACADEMY_INBOUND_API_TOKEN), el mismo de
agent/ask. Cuerpo `{op, args, quien?}`; responde `{ok: true, valor}` o `{ok: false, error}` (su API.md §2.15).
"""
import logging

from flask import jsonify, request

from app.api.external import bp
from app.decorators import require_academy_token
from app.services import learnito_conector

logger = logging.getLogger(__name__)


@bp.route('/learnito/connector', methods=['POST'])
@require_academy_token
def learnito_connector():
    cuerpo = request.get_json(silent=True) or {}
    op = str(cuerpo.get('op') or '')
    try:
        valor = learnito_conector.handle(op, cuerpo.get('args') or {}, cuerpo.get('quien'))
    except learnito_conector.ConectorError as e:
        return jsonify({'ok': False, 'error': str(e)}), 422
    except Exception as e:
        logger.exception(f'[learnito/connector] {op} falló: {e}')
        return jsonify({'ok': False, 'error': f'Algo falló del lado de Work ({type(e).__name__}).'}), 500
    return jsonify({'ok': True, 'valor': valor})
