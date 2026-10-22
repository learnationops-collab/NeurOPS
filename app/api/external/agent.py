"""Agentes pares: la Academia le pide un dato a Work sin conocer su modelo (su ADR-160, LEARNITO_INVESTIGACION §4.4).

POST /api/external/academy/agent/ask, con el token de la Academia (ACADEMY_INBOUND_API_TOKEN). Mismo contrato
que el /api/v1/agent/ask de la Academia:
  - con `plan` (por claves de dato, app/services/tablas/plan.py): lo resuelve el motor de tablas, sin IA;
  - solo con `pregunta`: todavía no (Work no tiene un Learnito que responda texto libre a otro sistema).

Quien pregunta viaja en `quien` ({email, rol}) y queda en el log. Hasta decidir la traducción de roles entre
sistemas, la Academia ve lo de alguien sin rol propio: sin montos y sin nómina ni gastos. Un solo salto: Work
no le pregunta a un tercero para responder.
"""
import logging

from flask import jsonify, request

from app.api.external import bp
from app.decorators import require_academy_token
from app.services.tablas import motor

logger = logging.getLogger(__name__)


class _SistemaExterno:
    """Quien consulta desde otro sistema: sin rol de Work, así que sin montos ni tablas de admin."""
    role = None
    id = None


@bp.route('/agent/ask', methods=['POST'])
@require_academy_token
def agent_ask():
    cuerpo = request.get_json(silent=True) or {}
    logger.info(f"[agent/ask] quien={cuerpo.get('quien')} plan={cuerpo.get('plan')} pregunta={cuerpo.get('pregunta')}")
    if not cuerpo.get('plan'):
        errores = ['Work responde solo planes por ahora (sin `pregunta` con IA).']
        return jsonify({'success': False, 'errores': errores}), 422
    try:
        pagina = int(cuerpo.get('pagina') or 1)
    except (TypeError, ValueError):
        pagina = 1
    try:
        return jsonify(motor.run(_SistemaExterno(), cuerpo['plan'], pagina=pagina))
    except motor.MotorError as e:
        return jsonify({'success': False, 'errores': e.errores}), 422
