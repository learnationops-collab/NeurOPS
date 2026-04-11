from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Campaign, AdSet, Ad
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
    """
    Cruza leads, agendas y ventas por anuncio para calcular métricas de rendimiento.
    - Leads: via LeadAnswer asociado al anuncio.
    - Agendas: cruzando instagram del lead con FinancialAgenda.instagram.
    - Ventas: cruzando instagram del lead con FinancialSale.instagram.
    """
    from app.models import LeadAnswer, ManychatLead, FinancialAgenda, FinancialSale
    from sqlalchemy import func

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Filtro de fechas opcional
    date_filters = [LeadAnswer.ad_id != None]
    if start_date:
        try:
            from datetime import datetime
            st = datetime.strptime(start_date, '%Y-%m-%d')
            date_filters.append(LeadAnswer.created_at >= st)
        except ValueError:
            pass
    if end_date:
        try:
            from datetime import datetime
            ed = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            date_filters.append(LeadAnswer.created_at <= ed)
        except ValueError:
            pass

    # Agrupamos leads por anuncio
    lead_stats = db.session.query(
        LeadAnswer.ad_id,
        func.count(LeadAnswer.id).label('total_leads')
    ).filter(*date_filters).group_by(LeadAnswer.ad_id).all()

    if not lead_stats:
        return jsonify([]), 200

    # Cargamos todos los anuncios involucrados
    ad_ids = [s.ad_id for s in lead_stats]
    ads_map = {a.id: a for a in Ad.query.filter(Ad.id.in_(ad_ids)).all()}

    # Pre-carga todos los IG de leads por anuncio en una sola query
    ig_by_ad = db.session.query(
        LeadAnswer.ad_id,
        ManychatLead.ig
    ).join(ManychatLead, ManychatLead.id == LeadAnswer.lead_id)\
     .filter(
         LeadAnswer.ad_id.in_(ad_ids),
         ManychatLead.ig != None,
         ManychatLead.ig != ''
     ).all()

    # Construimos diccionario ad_id -> set de igs (normalizados sin @)
    igs_per_ad: dict[int, set] = {}
    for row in ig_by_ad:
        ig_clean = row.ig.strip().lstrip('@').lower()
        if ig_clean:
            igs_per_ad.setdefault(row.ad_id, set()).add(ig_clean)

    # Cargamos todas las agendas y ventas de una sola vez para hacer el cruce en memoria
    all_agendas = FinancialAgenda.query.with_entities(FinancialAgenda.instagram).all()
    all_sales = FinancialSale.query.with_entities(FinancialSale.instagram).all()

    # Normalizamos los instagram de agendas y ventas como conjuntos
    agenda_igs = set()
    for a in all_agendas:
        if a.instagram and a.instagram != 'N/A':
            agenda_igs.add(a.instagram.strip().lstrip('@').lower())

    sale_igs = set()
    for s in all_sales:
        if s.instagram and s.instagram != 'N/A':
            sale_igs.add(s.instagram.strip().lstrip('@').lower())

    result = []
    for stat in lead_stats:
        ad_id = stat.ad_id
        total_leads = stat.total_leads
        ad = ads_map.get(ad_id)
        ad_name = ad.name if ad else f"Anuncio #{ad_id}"
        spend = float(ad.total_spend or 0) if ad else 0.0

        # Cruzamos los IGs del anuncio con agendas y ventas
        ad_igs = igs_per_ad.get(ad_id, set())
        agendas_count = len(ad_igs & agenda_igs)
        ventas_count = len(ad_igs & sale_igs)

        # Costos unitarios
        cpl = round(spend / total_leads, 2) if total_leads > 0 else 0
        cpa = round(spend / agendas_count, 2) if agendas_count > 0 else 0
        cpv = round(spend / ventas_count, 2) if ventas_count > 0 else 0

        result.append({
            'ad_id': ad_id,
            'ad_name': ad_name,
            'spend': spend,
            'leads': total_leads,
            'cpl': cpl,
            'agendas': agendas_count,
            'cpa': cpa,
            'ventas': ventas_count,
            'cpv': cpv
        })

    # Ordenar descendente por cantidad de leads
    result.sort(key=lambda x: x['leads'], reverse=True)
    return jsonify(result), 200
