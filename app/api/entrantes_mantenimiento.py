"""Corrección a mano de una interacción desde el monitor de Entrantes (rutas de `entrantes.bp`)."""
from flask import request, jsonify
from app import db
from app.api.entrantes import bp


@bp.route('/respuesta/<int:answer_id>', methods=['PUT'])
def update_ad_lead(answer_id):
    """Permite editar manualmente una respuesta/lead en el monitor."""
    from app.models import LeadAnswer
    
    answer = LeadAnswer.query.get_or_404(answer_id)
    data = request.get_json() or {}

    # Editar datos de la interacción
    if 'qualification' in data: answer.qualification = data.get('qualification')
    if 'keyword' in data:
        keyword_val = data.get('keyword')
        answer.keyword = keyword_val
        # Si se edita la palabra clave, intentar resolver el ad_id correspondiente
        if keyword_val:
            from app.models import Ad
            ad = Ad.query.filter_by(keyword=keyword_val).first()
            if ad:
                answer.ad_id = ad.id
            else:
                answer.ad_id = None
        else:
            answer.ad_id = None

    if 'ad_id' in data:
        ad_id_raw = data.get('ad_id')
        try:
            answer.ad_id = int(ad_id_raw) if ad_id_raw else None
        except ValueError:
            pass
            
    # Editar datos del usuario vinculado (Conversation)
    if 'lead_name' in data: answer.conversation.name = data.get('lead_name')
    if 'lead_ig' in data: answer.conversation.ig = data.get('lead_ig')
    if 'follower' in data:
        f_raw = data.get('follower')
        answer.conversation.follower = True if str(f_raw).lower() in ('true', '1') or f_raw is True else False

    try:
        db.session.commit()
        return jsonify({"status": "success", "message": "Lead actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
