"""Los mails de la Academia salen por Work, con la cuenta de Gmail conectada (app/services/correo.py, ADR-W123).

POST /api/external/academy/correo (token ACADEMY_INBOUND_API_TOKEN) {raw: el mensaje MIME en base64}
  → 200 {id} | 400 sin mensaje | 503 sin cuenta conectada | 502 si Gmail lo rechazó.
GET /api/external/academy/correo/estado → {conectada, email, ...}.
"""
import base64
import binascii

from flask import current_app, jsonify, request

from app.api.external import bp
from app.decorators import require_academy_token
from app.services import correo


@bp.route('/correo/estado', methods=['GET'])
@require_academy_token
def correo_estado():
    return jsonify(correo.estado()), 200


@bp.route('/correo', methods=['POST'])
@require_academy_token
def correo_enviar():
    raw = (request.get_json(silent=True) or {}).get('raw') or ''
    try:
        mime = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        return jsonify({'error': 'raw tiene que ser el mensaje MIME en base64'}), 400
    try:
        return jsonify({'id': correo.enviar_mime(mime)}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except correo.SinCorreo as e:
        return jsonify({'error': 'sin_cuenta', 'detalle': str(e)}), 503
    except Exception as e:  # noqa: BLE001  (Gmail rechazó el mensaje)
        current_app.logger.error(f'[CORREO] Gmail no aceptó el mensaje: {e}')
        return jsonify({'error': 'gmail', 'detalle': str(e)[:300]}), 502
