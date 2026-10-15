from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Ad, UTMLog
from datetime import datetime

bp = Blueprint('marketing', __name__)

# --- Ads ---
# Solo la lectura: la usan las estadísticas conversacionales del setter. El alta, la edición y el borrado
# de campañas, conjuntos y anuncios y el rendimiento por anuncio vivían acá: los llamaba una pantalla de
# Marketing que ninguna ruta de App.jsx mostraba, y se retiraron el 15/10/2026 con la configuración vieja
# de anuncios (la reemplazó /api/marketing/anuncios).

@bp.route('/ads', methods=['GET'])
@login_required
def get_ads():
    ad_set_id = request.args.get('ad_set_id')
    query = Ad.query
    if ad_set_id:
        query = query.filter_by(ad_set_id=ad_set_id)
    
    ads = query.all()
    return jsonify([{
        'id': a.id,
        'ad_set_id': a.ad_set_id,
        'name': a.name,
        'external_id': a.external_id,
        'keyword': a.keyword,
        'stage': a.stage,
        'status': a.status,
        'details': a.details,
        'total_spend': a.total_spend,
        'created_at': a.created_at.isoformat() if a.created_at else None
    } for a in ads]), 200


# --- UTM Logs ---

@bp.route('/utm-logs', methods=['POST'])
@login_required
def log_utm():
    data = request.get_json() or {}
    required = ['base_url', 'final_url', 'utm_source', 'utm_medium']
    if not all(k in data for k in required):
        return jsonify({"message": "Faltan campos obligatorios"}), 400
    
    log = UTMLog(
        user_id=current_user.id,
        base_url=data['base_url'],
        final_url=data['final_url'],
        utm_source=data['utm_source'],
        utm_medium=data['utm_medium'],
        utm_campaign=data.get('utm_campaign'),
        utm_content=data.get('utm_content')
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({"message": "Log registrado", "id": log.id}), 201

@bp.route('/utm-logs', methods=['GET'])
@login_required
def get_utm_logs():
    logs = UTMLog.query.order_by(UTMLog.created_at.desc()).limit(100).all()
    return jsonify([{
        'id': l.id,
        'user': l.user.name if l.user else 'Desconocido',
        'base_url': l.base_url,
        'final_url': l.final_url,
        'utm_source': l.utm_source,
        'utm_medium': l.utm_medium,
        'utm_campaign': l.utm_campaign,
        'utm_content': l.utm_content,
        'created_at': l.created_at.isoformat()
    } for l in logs]), 200
