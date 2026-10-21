import logging

from flask import Blueprint, request, jsonify
from app import db
from app.decorators import require_manychat_token
from app.models import ManychatLead

logger = logging.getLogger(__name__)

bp = Blueprint('webhooks', __name__)


@bp.route('/manychat', methods=['POST'])
@require_manychat_token
def receive_manychat_lead():
    """
    Webhook viejo de ManyChat (Instagram). La tabla `leads` ya no existe (Etapa 2c de docs/plan_personas.md):
    el lead se guarda como `ManychatLead`, y `conversaciones_service` le da su persona y su conversación.
    Exige el header 'X-ManyChat-Token' con el valor de la variable de entorno MANYCHAT_WEBHOOK_TOKEN
    (sin ella configurada responde 503).
    """
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400

    data = request.get_json()
    manychat_id = data.get('manychat_id')
    name = data.get('name')
    if not manychat_id or not name:
        return jsonify({"status": "error", "message": "Missing required fields: manychat_id, name"}), 400

    try:
        lead = ManychatLead.query.filter_by(manychat_id=str(manychat_id)).first()
        creado = lead is None
        if creado:
            lead = ManychatLead(manychat_id=str(manychat_id), follower=False)
            db.session.add(lead)
        lead.name = name
        lead.ig = data.get('instagram_username') or lead.ig
        if data.get('last_stage') is not None:
            lead.last_stage = int(data['last_stage'])
        db.session.flush()  # acá conversaciones_service le pone la persona
        if data.get('email') and lead.person is not None:
            from app.services import person_service
            person_service.anotar(lead.person, person_service.claves(email=data['email']), 'manychat')
        db.session.commit()
        if data.get('keyword'):
            logger.info(f"[WEBHOOK VIEJO] {manychat_id} llegó con la palabra clave {data['keyword']!r}")
        return jsonify({"status": "success", "action": "created" if creado else "updated",
                        "lead": {"id": lead.id, "manychat_id": lead.manychat_id, "name": lead.name}}), 201 if creado else 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"[WEBHOOK VIEJO] {e}")
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500
