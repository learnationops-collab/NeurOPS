from flask import Blueprint, request, jsonify
from app import db
from app.models import Lead

bp = Blueprint('webhooks', __name__)

@bp.route('/manychat', methods=['POST'])
def receive_manychat_lead():
    """
    Recibe leads desde ManyChat (Instagram).
    Espera un header 'X-ManyChat-Token' para validación simple.
    """
    # 1. Validación de Token (Simple)
    # En producción real, esto debería estar en variables de entorno
    EXPECTED_TOKEN = "neur_ops_manychat_secure_token_2026" 
    
    token = request.headers.get('X-ManyChat-Token')
    if not token or token != EXPECTED_TOKEN:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    # 2. Validación de JSON
    if not request.is_json:
        return jsonify({"status": "error", "message": "Request must be JSON"}), 400

    data = request.get_json()
    
    # 3. Validación de campos requeridos
    manychat_id = data.get('manychat_id')
    name = data.get('name')
    
    if not manychat_id or not name:
        return jsonify({"status": "error", "message": "Missing required fields: manychat_id, name"}), 400

    # 4. Upsert (Crear o Actualizar)
    try:
        lead = Lead.query.filter_by(manychat_id=manychat_id).first()
        
        if lead:
            # Actualizar existente
            lead.name = name
            lead.email = data.get('email', lead.email) # Solo actualiza si viene en el payload
            lead.instagram_username = data.get('instagram_username', lead.instagram_username)
            status_code = 200
            action = "updated"
        else:
            # Crear nuevo
            # Buscar etapa 'Entrante'
            from app.models import PipelineStage
            entrante_stage = PipelineStage.query.filter_by(name='Entrante').first()
            stage_id = entrante_stage.id if entrante_stage else None

            lead = Lead(
                manychat_id=manychat_id,
                name=name,
                email=data.get('email'),
                instagram_username=data.get('instagram_username'),
                stage_id=stage_id
            )
            db.session.add(lead)
            status_code = 201
            action = "created"

        db.session.commit()
        
        return jsonify({
            "status": "success",
            "action": action,
            "lead": {
                "id": lead.id,
                "manychat_id": lead.manychat_id,
                "name": lead.name
            }
        }), status_code

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500
