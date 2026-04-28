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
    Retorna métricas de rendimiento por anuncio para el periodo solicitado.

    Inversión: Suma de AdPeriodSpend filtrado por el periodo.
      - Primero busca registros a nivel ad_id.
      - Si no hay, usa los de ad_set_id prorrateados entre los ads del conjunto.
      - Si tampoco, usa los de campaign_id prorrateados.

    Leads: LeadAnswer agrupados por ad_id en el periodo.

    Agendas: FinancialAgenda cuyo instagram coincide con algún ManychatLead
      que interactuó con ese anuncio (via LeadAnswer).

    Ventas: FinancialSale atribuidas al anuncio usando la lógica de atribución
      correcta — para cada venta con instagram, se busca el LeadAnswer más
      reciente ANTERIOR a la fecha de la venta, y ese anuncio se lleva el crédito.
    """
    from app.models import (
        LeadAnswer, ManychatLead, FinancialAgenda, FinancialSale,
        AdSet, Campaign, AdPeriodSpend
    )
    from sqlalchemy import func
    from datetime import datetime, timedelta, date

    period = request.args.get('period') # last_month | last_week | yesterday | custom
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')

    today = date.today()

    if start_str and end_str:
        try:
            start_dt = datetime.combine(datetime.strptime(start_str, '%Y-%m-%d').date(), datetime.min.time())
            end_dt   = datetime.combine(datetime.strptime(end_str, '%Y-%m-%d').date(), datetime.max.time())
        except ValueError:
            # Fallback if invalid format
            start_dt = datetime.combine(today - timedelta(days=30), datetime.min.time())
            end_dt   = datetime.combine(today, datetime.max.time())
    elif period == 'yesterday':
        start_dt = datetime.combine(today - timedelta(days=1), datetime.min.time())
        end_dt   = datetime.combine(today - timedelta(days=1), datetime.max.time())
    elif period == 'last_week':
        start_dt = datetime.combine(today - timedelta(days=7), datetime.min.time())
        end_dt   = datetime.combine(today, datetime.max.time())
    else:  # last_month (default)
        start_dt = datetime.combine(today - timedelta(days=30), datetime.min.time())
        end_dt   = datetime.combine(today, datetime.max.time())

    start_date_only = start_dt.date()
    end_date_only   = end_dt.date()

    # -------------------------------------------------------------------------
    # 1. LEADS por anuncio en el periodo
    # -------------------------------------------------------------------------
    lead_stats = db.session.query(
        LeadAnswer.ad_id,
        func.count(LeadAnswer.id).label('total_leads')
    ).filter(
        LeadAnswer.ad_id != None,
        LeadAnswer.created_at >= start_dt,
        LeadAnswer.created_at <= end_dt
    ).group_by(LeadAnswer.ad_id).all()

    if not lead_stats:
        return jsonify([]), 200

    ad_ids = [s.ad_id for s in lead_stats]

    # Mapa de anuncios con su AdSet y Campaign
    ads_raw = db.session.query(Ad, AdSet, Campaign)\
        .outerjoin(AdSet, Ad.ad_set_id == AdSet.id)\
        .outerjoin(Campaign, AdSet.campaign_id == Campaign.id)\
        .filter(Ad.id.in_(ad_ids)).all()

    ads_map     = {a.id: a   for a, _, _ in ads_raw}
    adset_map   = {a.id: s   for a, s, _ in ads_raw}
    campaign_map = {a.id: c  for a, _, c in ads_raw}

    # -------------------------------------------------------------------------
    # 2. INVERSIÓN por anuncio en el periodo (AdPeriodSpend)
    #    Prioridad: ad_id > ad_set_id prorrateado > campaign_id prorrateado
    # -------------------------------------------------------------------------
    # a) Gasto directo por ad_id
    ad_spends_direct = db.session.query(
        AdPeriodSpend.ad_id,
        func.sum(AdPeriodSpend.spend).label('total')
    ).filter(
        AdPeriodSpend.ad_id.in_(ad_ids),
        AdPeriodSpend.start_date >= start_date_only,
        AdPeriodSpend.end_date   <= end_date_only
    ).group_by(AdPeriodSpend.ad_id).all()
    spend_by_ad = {r.ad_id: float(r.total or 0) for r in ad_spends_direct}

    # b) Gasto por ad_set (para los que no tienen directo)
    adset_ids = list({adset_map[aid].id for aid in ad_ids if adset_map.get(aid)})
    if adset_ids:
        adset_spends = db.session.query(
            AdPeriodSpend.ad_set_id,
            func.sum(AdPeriodSpend.spend).label('total')
        ).filter(
            AdPeriodSpend.ad_set_id.in_(adset_ids),
            AdPeriodSpend.start_date >= start_date_only,
            AdPeriodSpend.end_date   <= end_date_only
        ).group_by(AdPeriodSpend.ad_set_id).all()
        adset_spend_map = {r.ad_set_id: float(r.total or 0) for r in adset_spends}

        # Contamos cuántos ads por adset están en nuestra lista
        ads_per_adset: dict[int, int] = {}
        for aid in ad_ids:
            s = adset_map.get(aid)
            if s:
                ads_per_adset[s.id] = ads_per_adset.get(s.id, 0) + 1
    else:
        adset_spend_map = {}
        ads_per_adset = {}

    # c) Gasto por campaign (para los que no tienen ni directo ni adset)
    campaign_ids = list({campaign_map[aid].id for aid in ad_ids if campaign_map.get(aid)})
    if campaign_ids:
        campaign_spends = db.session.query(
            AdPeriodSpend.campaign_id,
            func.sum(AdPeriodSpend.spend).label('total')
        ).filter(
            AdPeriodSpend.campaign_id.in_(campaign_ids),
            AdPeriodSpend.start_date >= start_date_only,
            AdPeriodSpend.end_date   <= end_date_only
        ).group_by(AdPeriodSpend.campaign_id).all()
        campaign_spend_map = {r.campaign_id: float(r.total or 0) for r in campaign_spends}

        ads_per_campaign: dict[int, int] = {}
        for aid in ad_ids:
            c = campaign_map.get(aid)
            if c:
                ads_per_campaign[c.id] = ads_per_campaign.get(c.id, 0) + 1
    else:
        campaign_spend_map = {}
        ads_per_campaign = {}


    def normalize_ig(ig_str):
        if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
            return None
        return ig_str.strip().lstrip('@').lower()

    def resolve_spend(ad_id: int) -> float:
        """Determina la inversión del anuncio con fallback a adset, campaign y total_spend."""
        # 1. Directo por Periodo
        if spend_by_ad.get(ad_id, 0) > 0:
            return spend_by_ad[ad_id]
        
        # 2. Via AdSet prorrateado
        s = adset_map.get(ad_id)
        if s and adset_spend_map.get(s.id, 0) > 0:
            count = ads_per_adset.get(s.id, 1)
            return round(adset_spend_map[s.id] / count, 2)
            
        # 3. Via Campaign prorrateado
        c = campaign_map.get(ad_id)
        if c and campaign_spend_map.get(c.id, 0) > 0:
            count = ads_per_campaign.get(c.id, 1)
            return round(campaign_spend_map[c.id] / count, 2)
            
        # 4. Fallback a total_spend histórico (el campo "declarado" en la tabla de anuncios)
        ad = ads_map.get(ad_id)
        return float(ad.total_spend or 0) if ad else 0.0

    # -------------------------------------------------------------------------
    # 3. AGENDAS — cruzar IGs del anuncio con FinancialAgenda.instagram
    # -------------------------------------------------------------------------
    ig_by_ad_rows = db.session.query(
        LeadAnswer.ad_id,
        ManychatLead.ig
    ).join(ManychatLead, ManychatLead.id == LeadAnswer.lead_id)\
     .filter(
         LeadAnswer.ad_id.in_(ad_ids),
         LeadAnswer.created_at >= start_dt,
         LeadAnswer.created_at <= end_dt,
         ManychatLead.ig != None,
         ManychatLead.ig != ''
     ).all()

    igs_per_ad: dict[int, set] = {}
    for row in ig_by_ad_rows:
        ig_clean = normalize_ig(row.ig)
        if ig_clean:
            igs_per_ad.setdefault(row.ad_id, set()).add(ig_clean)

    # Cargamos todas las agendas del periodo
    agendas_all = FinancialAgenda.query.filter(
        FinancialAgenda.date >= start_dt,
        FinancialAgenda.date <= end_dt
    ).with_entities(FinancialAgenda.instagram, FinancialAgenda.raw_data).all()

    agenda_igs: set = set()
    for a in agendas_all:
        ig_val = a.instagram or (a.raw_data or {}).get('instagram') or (a.raw_data or {}).get('ig')
        ig_clean = normalize_ig(ig_val)
        if ig_clean:
            agenda_igs.add(ig_clean)

    # -------------------------------------------------------------------------
    # 4. VENTAS — atribución por modelo correcto
    # -------------------------------------------------------------------------
    sales_in_period = FinancialSale.query.filter(
        FinancialSale.date >= start_dt,
        FinancialSale.date <= end_dt
    ).all()

    ventas_por_ad: dict[int, int] = {}
    for sale in sales_in_period:
        ig_val = sale.instagram or (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')
        ig_norm = normalize_ig(ig_val)
        
        if not ig_norm:
            continue

        # Buscar el ManychatLead cuyo ig coincida
        matched_lead = ManychatLead.query.filter(
            db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_norm
        ).first()

        if not matched_lead:
            continue

        # Buscar el LeadAnswer más reciente ANTES de la venta (sin límite de fecha inicial para encontrar el origen aunque sea antiguo)
        closest = LeadAnswer.query.filter(
            LeadAnswer.lead_id == matched_lead.id,
            LeadAnswer.ad_id.in_(ad_ids),
            LeadAnswer.created_at <= sale.date
        ).order_by(LeadAnswer.created_at.desc()).first()

        if closest and closest.ad_id:
            ventas_por_ad[closest.ad_id] = ventas_por_ad.get(closest.ad_id, 0) + 1

    # -------------------------------------------------------------------------
    # 5. CONSTRUCCIÓN DEL RESULTADO
    # -------------------------------------------------------------------------
    result = []
    for stat in lead_stats:
        ad_id = stat.ad_id
        total_leads = stat.total_leads
        ad = ads_map.get(ad_id)
        adset = adset_map.get(ad_id)
        campaign = campaign_map.get(ad_id)

        ad_name = ad.name if ad else f"Anuncio #{ad_id}"
        adset_name = adset.name if adset else '—'
        campaign_name = campaign.name if campaign else '—'

        spend = resolve_spend(ad_id)
        ad_igs = igs_per_ad.get(ad_id, set())
        agendas_count = len(ad_igs & agenda_igs)
        ventas_count = ventas_por_ad.get(ad_id, 0)

        cpl = round(spend / total_leads, 2) if total_leads > 0 and spend > 0 else 0
        cpa = round(spend / agendas_count, 2) if agendas_count > 0 and spend > 0 else 0
        cpv = round(spend / ventas_count, 2) if ventas_count > 0 and spend > 0 else 0

        result.append({
            'ad_id': ad_id,
            'ad_name': ad_name,
            'adset_name': adset_name,
            'campaign_name': campaign_name,
            'spend': spend,
            'leads': total_leads,
            'cpl': cpl,
            'agendas': agendas_count,
            'cpa': cpa,
            'ventas': ventas_count,
            'cpv': cpv
        })

    result.sort(key=lambda x: x['leads'], reverse=True)
    return jsonify(result), 200
