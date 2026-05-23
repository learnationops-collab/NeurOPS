from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Campaign, AdSet, Ad, UTMLog
from datetime import datetime

bp = Blueprint('marketing', __name__)

# --- Campaigns ---

@bp.route('/campaigns', methods=['GET'])
@login_required
def get_campaigns():
    campaigns = Campaign.query.all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'external_id': c.external_id,
        'type': c.type,
        'traffic': c.traffic,
        'funnel_type': c.funnel_type,
        'objective': c.objective,
        'status': c.status,
        'details': c.details,
        'created_at': c.created_at.isoformat() if c.created_at else None
    } for c in campaigns]), 200

@bp.route('/campaigns', methods=['POST'])
@login_required
def create_campaign():
    data = request.get_json() or {}
    if 'name' not in data:
        return jsonify({"message": "Name is required"}), 400
    
    campaign = Campaign(
        name=data['name'],
        type=data.get('type'),
        traffic=data.get('traffic'),
        funnel_type=data.get('funnel_type'),
        objective=data.get('objective'),
        status='active',
        details=data.get('details')
    )
    db.session.add(campaign)
    db.session.flush() # Get ID before commit
    campaign.external_id = f"CAM-{campaign.id}"
    db.session.commit()
    return jsonify({"message": "Campaign created", "id": campaign.id}), 201

@bp.route('/campaigns/<int:id>', methods=['PUT'])
@login_required
def update_campaign(id):
    campaign = Campaign.query.get_or_404(id)
    data = request.get_json() or {}
    
    if 'name' in data: campaign.name = data['name']
    if 'type' in data: campaign.type = data['type']
    if 'traffic' in data: campaign.traffic = data['traffic']
    if 'funnel_type' in data: campaign.funnel_type = data['funnel_type']
    if 'objective' in data: campaign.objective = data['objective']
    if 'details' in data: campaign.details = data['details']
    
    db.session.commit()
    return jsonify({"message": "Campaign updated"}), 200

@bp.route('/campaigns/<int:id>', methods=['DELETE'])
@login_required
def delete_campaign(id):
    campaign = Campaign.query.get_or_404(id)
    db.session.delete(campaign)
    db.session.commit()
    return jsonify({"message": "Campaign deleted"}), 200

# --- AdSets ---

@bp.route('/ad-sets', methods=['GET'])
@login_required
def get_ad_sets():
    campaign_id = request.args.get('campaign_id')
    query = AdSet.query
    if campaign_id:
        query = query.filter_by(campaign_id=campaign_id)
    
    ad_sets = query.all()
    return jsonify([{
        'id': a.id,
        'campaign_id': a.campaign_id,
        'name': a.name,
        'external_id': a.external_id,
        'audience': a.audience,
        'conversion_event': a.conversion_event,
        'status': a.status,
        'details': a.details,
        'created_at': a.created_at.isoformat() if a.created_at else None
    } for a in ad_sets]), 200

@bp.route('/ad-sets', methods=['POST'])
@login_required
def create_ad_set():
    data = request.get_json() or {}
    if 'name' not in data or 'campaign_id' not in data:
        return jsonify({"message": "Name and campaign_id are required"}), 400
    
    ad_set = AdSet(
        name=data['name'],
        campaign_id=data['campaign_id'],
        audience=data.get('audience'),
        conversion_event=data.get('conversion_event'),
        status='active',
        details=data.get('details')
    )
    db.session.add(ad_set)
    db.session.flush()
    ad_set.external_id = f"SET-{ad_set.id}"
    db.session.commit()
    return jsonify({"message": "AdSet created", "id": ad_set.id}), 201

@bp.route('/ad-sets/<int:id>', methods=['PUT'])
@login_required
def update_ad_set(id):
    ad_set = AdSet.query.get_or_404(id)
    data = request.get_json() or {}
    
    if 'name' in data: ad_set.name = data['name']
    if 'campaign_id' in data: ad_set.campaign_id = data['campaign_id']
    if 'audience' in data: ad_set.audience = data['audience']
    if 'conversion_event' in data: ad_set.conversion_event = data['conversion_event']
    if 'details' in data: ad_set.details = data['details']
    
    db.session.commit()
    return jsonify({"message": "AdSet updated"}), 200

@bp.route('/ad-sets/<int:id>', methods=['DELETE'])
@login_required
def delete_ad_set(id):
    ad_set = AdSet.query.get_or_404(id)
    db.session.delete(ad_set)
    db.session.commit()
    return jsonify({"message": "AdSet deleted"}), 200

# --- Ads ---

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

@bp.route('/ads', methods=['POST'])
@login_required
def create_ad():
    data = request.get_json() or {}
    if 'name' not in data or 'ad_set_id' not in data:
        return jsonify({"message": "Name and ad_set_id are required"}), 400
    
    ad = Ad(
        name=data['name'],
        ad_set_id=data['ad_set_id'],
        keyword=data.get('keyword'),
        status='active',
        details=data.get('details'),
        total_spend=0.0,
        event_id=data.get('event_id')
    )
    db.session.add(ad)
    db.session.flush()
    ad.external_id = f"ADS-{ad.id}"
    db.session.commit()
    return jsonify({"message": "Ad created", "id": ad.id}), 201

@bp.route('/ads/<int:id>', methods=['PUT'])
@login_required
def update_ad(id):
    ad_record = Ad.query.get_or_404(id)
    data = request.get_json() or {}
    
    if 'name' in data: ad_record.name = data['name']
    if 'ad_set_id' in data: ad_record.ad_set_id = data['ad_set_id']
    if 'keyword' in data: ad_record.keyword = data['keyword']
    if 'details' in data: ad_record.details = data['details']
    if 'event_id' in data: ad_record.event_id = data['event_id']
    
    db.session.commit()
    return jsonify({"message": "Ad updated"}), 200

@bp.route('/ads/<int:id>', methods=['DELETE'])
@login_required
def delete_ad(id):
    ad_record = Ad.query.get_or_404(id)
    db.session.delete(ad_record)
    db.session.commit()
    return jsonify({"message": "Ad deleted"}), 200


# --- Rendimiento por Anuncio ---

@bp.route('/ads/performance', methods=['GET'])
@login_required
def get_ad_performance():
    """Retorna métricas de rendimiento por anuncio para el periodo solicitado."""
    from app.services.marketing_service import MarketingService
    
    period = request.args.get('period')
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')

    result = MarketingService.get_ad_performance_data(period, start_str, end_str)
    return jsonify(result), 200


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
