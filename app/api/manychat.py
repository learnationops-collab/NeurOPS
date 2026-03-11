from flask import Blueprint, request, jsonify
from app import db
import logging
import traceback

logger = logging.getLogger(__name__)

bp = Blueprint('manychat', __name__)


@bp.route('/manychat-webhook', methods=['GET', 'POST'], strict_slashes=False)
def receive_manychat_ad_lead():
    """
    Recibe un lead de ManyChat y lo vincula a un anuncio.
    Siempre responde 200/201, incluso si el anuncio no existe.
    GET: verificación de URL por ManyChat.
    """
    # Verificación de URL por ManyChat (GET)
    if request.method == 'GET':
        return jsonify({"status": "ok", "message": "Webhook activo"}), 200

    from app.models import ManychatAdLead, Ad

    data = request.get_json(silent=True) or {}
    logger.info(f"[WEBHOOK] Recibido ({request.method}): {data}")

    manychat_id = data.get('manychat_id')
    ad_id_raw = data.get('ad_id')
    keyword = data.get('keyword', '')
    qualification_raw = data.get('cualificacion')

    if not manychat_id:
        return jsonify({"status": "error", "message": "manychat_id es obligatorio"}), 400

    # Convertir ad_id a int de forma segura
    ad_id = None
    if ad_id_raw:
        try:
            ad_id = int(ad_id_raw)
        except (ValueError, TypeError):
            ad_id = None
            logger.warning(f"[WEBHOOK] ad_id no es un entero válido: '{ad_id_raw}', se guardará como None")

    # Normalizar cualificación a string
    if qualification_raw is None or str(qualification_raw).lower() in ('null', 'none', ''):
        qualification = 'null'
    elif str(qualification_raw).lower() in ('true', '1', 'si', 'sí', 'yes'):
        qualification = 'true'
    else:
        qualification = 'false'

    # Intentar resolver ad_id por keyword si no viene explícito
    if not ad_id and keyword:
        try:
            ad = Ad.query.filter_by(keyword=keyword, status='active').first()
            if ad:
                ad_id = ad.id
                logger.info(f"[WEBHOOK] ad_id resuelto por keyword '{keyword}': {ad_id}")
        except Exception:
            pass  # Si falla la búsqueda, seguimos sin ad_id

    try:
        lead = ManychatAdLead.query.filter_by(manychat_id=str(manychat_id)).first()

        if lead:
            lead.qualification = qualification
            if keyword:
                lead.keyword = keyword
            action = 'updated'
            logger.info(f"[WEBHOOK] Lead actualizado: manychat_id={manychat_id}, qualification={qualification}")
        else:
            lead = ManychatAdLead(
                manychat_id=str(manychat_id),
                ad_id=ad_id,
                keyword=keyword,
                qualification=qualification
            )
            db.session.add(lead)
            action = 'created'
            logger.info(f"[WEBHOOK] Lead creado: manychat_id={manychat_id}, ad_id={ad_id}, keyword={keyword}")

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
        error_details = traceback.format_exc()
        logger.error(f"[WEBHOOK] ERROR: {str(e)}")
        logger.error(f"[WEBHOOK] Traceback:\n{error_details}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route('/manychat-webhook/log', methods=['GET'])
def get_webhook_log():
    """Retorna los últimos N webhooks recibidos."""
    from app.models import ManychatAdLead, Ad

    limit = int(request.args.get('limit', 10))
    leads = ManychatAdLead.query.order_by(ManychatAdLead.created_at.desc()).limit(limit).all()

    # Cargar nombres de anuncios por ad_id (sin relationship)
    ad_ids = [l.ad_id for l in leads if l.ad_id]
    ads_map = {}
    if ad_ids:
        ads = Ad.query.filter(Ad.id.in_(ad_ids)).all()
        ads_map = {a.id: a for a in ads}

    return jsonify([{
        'id': l.id,
        'manychat_id': l.manychat_id,
        'ad_id': l.ad_id,
        'ad_name': ads_map[l.ad_id].name if l.ad_id and l.ad_id in ads_map else '—',
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
