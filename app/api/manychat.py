from flask import Blueprint, request, jsonify
from app import db

bp = Blueprint('manychat', __name__)


@bp.route('/manychat-webhook', methods=['POST'])
def receive_manychat_ad_lead():
    """
    Recibe un lead de ManyChat y lo vincula a un anuncio.
    Lógica upsert: si manychat_id ya existe, actualiza cualificación.
    Si no existe, crea nuevo lead vinculado al ad_id.
    """
    from app.models import ManychatAdLead, Ad

    data = request.get_json(silent=True) or {}

    manychat_id = data.get('manychat_id')
    ad_id = data.get('ad_id')
    keyword = data.get('keyword', '')
    qualification_raw = data.get('cualificacion')

    if not manychat_id:
        return jsonify({"status": "error", "message": "manychat_id es obligatorio"}), 400

    # Normalizar cualificación a string
    if qualification_raw is None or str(qualification_raw).lower() in ('null', 'none', ''):
        qualification = 'null'
    elif str(qualification_raw).lower() in ('true', '1', 'si', 'sí', 'yes'):
        qualification = 'true'
    else:
        qualification = 'false'

    # Resolver ad_id por keyword si no viene explícito
    if not ad_id and keyword:
        ad = Ad.query.filter_by(keyword=keyword, status='active').first()
        if ad:
            ad_id = ad.id

    try:
        lead = ManychatAdLead.query.filter_by(manychat_id=str(manychat_id)).first()

        if lead:
            # Actualizar cualificación, mantener ad_id original
            lead.qualification = qualification
            if keyword:
                lead.keyword = keyword
            action = 'updated'
        else:
            # Crear nuevo registro
            lead = ManychatAdLead(
                manychat_id=str(manychat_id),
                ad_id=ad_id,
                keyword=keyword,
                qualification=qualification
            )
            db.session.add(lead)
            action = 'created'

        db.session.commit()

        return jsonify({
            "status": "success",
            "action": action,
            "lead": {
                "id": lead.id,
                "manychat_id": lead.manychat_id,
                "ad_id": lead.ad_id,
                "qualification": lead.qualification
            }
        }), 201 if action == 'created' else 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route('/manychat-webhook/log', methods=['GET'])
def get_webhook_log():
    """Retorna los últimos N webhooks recibidos."""
    from app.models import ManychatAdLead

    limit = int(request.args.get('limit', 10))
    leads = ManychatAdLead.query.order_by(ManychatAdLead.created_at.desc()).limit(limit).all()

    return jsonify([{
        'id': l.id,
        'manychat_id': l.manychat_id,
        'ad_id': l.ad_id,
        'ad_name': l.ad.name if l.ad else '—',
        'keyword': l.keyword,
        'qualification': l.qualification,
        'created_at': l.created_at.isoformat() if l.created_at else None,
        'updated_at': l.updated_at.isoformat() if l.updated_at else None
    } for l in leads]), 200


@bp.route('/manychat-webhook/stats', methods=['GET'])
def get_ad_lead_stats():
    """Retorna leads totales y cualificados por anuncio."""
    from app.models import ManychatAdLead
    from sqlalchemy import func

    stats = db.session.query(
        ManychatAdLead.ad_id,
        func.count(ManychatAdLead.id).label('total_leads'),
        func.sum(
            db.case((ManychatAdLead.qualification == 'true', 1), else_=0)
        ).label('qualified_leads')
    ).group_by(ManychatAdLead.ad_id).all()

    return jsonify({
        str(s.ad_id): {
            'total_leads': s.total_leads,
            'qualified_leads': int(s.qualified_leads or 0)
        }
        for s in stats if s.ad_id is not None
    }), 200
