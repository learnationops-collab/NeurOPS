# pyrefly: ignore [missing-import]
from flask import jsonify
from app.models import db, User
# normalize_ig se importa aca por el contrato de tests/contracts/test_normalize_ig_contract.py.
from app.services.identity_service import normalize_ig  # noqa: F401
from . import bp
import json
import requests

# Re-export: la atribucion manual vive en marketing_attribution.py (regla de las 500 lineas).
from .marketing_attribution import (  # noqa: F401
    force_manual_attribution, get_unattributed_leads, force_manual_attribution_agenda)

# ============================================================
# ADS MANAGEMENT (Público)
# ============================================================

def ensure_inbound_ad_exists():
    """Garantiza la existencia del anuncio ficticio Inbound en la base de datos."""
    from app.models import Campaign, AdSet, Ad
    try:
        # 1. Buscar o crear la campaña Inbound
        campaign = Campaign.query.filter_by(name='Inbound').first()
        if not campaign:
            campaign = Campaign(
                name='Inbound',
                status='active',
                type='organic',
                external_id='CAM-INBOUND'
            )
            db.session.add(campaign)
            db.session.flush()

        # 2. Buscar o crear el AdSet Inbound Grupo
        ad_set = AdSet.query.filter_by(campaign_id=campaign.id, name='Inbound Grupo').first()
        if not ad_set:
            ad_set = AdSet(
                name='Inbound Grupo',
                campaign_id=campaign.id,
                status='active',
                external_id='SET-INBOUND'
            )
            db.session.add(ad_set)
            db.session.flush()

        # 3. Buscar o crear el anuncio Inbound
        ad = Ad.query.filter_by(ad_set_id=ad_set.id, keyword='Inbound').first()
        if not ad:
            ad = Ad(
                name='Inbound',
                ad_set_id=ad_set.id,
                keyword='Inbound',
                status='active',
                total_spend=0.0,
                external_id='ADS-INBOUND'
            )
            db.session.add(ad)
            db.session.commit()
        elif ad.name != 'Inbound':
            ad.name = 'Inbound'
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f"Error al asegurar ad Inbound: {str(e)}")

@bp.route('/public/ads', methods=['GET'])
def get_public_ads():
    """Lista todos los anuncios con spend acumulado y leads, y sus relaciones de campaña."""
    ensure_inbound_ad_exists()
    from app.models import Ad, AdPeriodSpend, ManychatAdLead, AdSet, Campaign
    # pyrefly: ignore [missing-import]
    from sqlalchemy import func

    # Join para traer AdSet y Campaign fácilmente
    ads = db.session.query(Ad, AdSet, Campaign).outerjoin(AdSet, Ad.ad_set_id == AdSet.id).outerjoin(Campaign, AdSet.campaign_id == Campaign.id).order_by(Ad.created_at.desc()).all()

    # Pre-cargar stats de leads por ad_id
    lead_stats = db.session.query(
        ManychatAdLead.ad_id,
        func.count(ManychatAdLead.id).label('total_leads'),
        func.sum(db.case((ManychatAdLead.qualification == 'true', 1), else_=0)).label('qualified_leads')
    ).group_by(ManychatAdLead.ad_id).all()
    lead_map = {s.ad_id: {'total': s.total_leads, 'qualified': int(s.qualified_leads or 0)} for s in lead_stats}

    result = []
    for a, ad_set, campaign in ads:
        total_spend = db.session.query(func.coalesce(func.sum(AdPeriodSpend.spend), 0)).filter(
            AdPeriodSpend.ad_id == a.id
        ).scalar()

        ls = lead_map.get(a.id, {'total': 0, 'qualified': 0})
        cpl = round(float(total_spend) / ls['total'], 2) if ls['total'] > 0 and float(total_spend) > 0 else 0

        result.append({
            'id': a.id,
            'ad_set_id': a.ad_set_id,
            'campaign_id': ad_set.campaign_id if ad_set else None,
            'ad_set_name': ad_set.name if ad_set else 'Sin Conjunto',
            'campaign_name': campaign.name if campaign else 'Sin Campaña',
            'name': a.name,
            'keyword': a.keyword,
            'status': a.status,
            'total_spend': round(float(total_spend), 2),
            'total_leads': ls['total'],
            'qualified_leads': ls['qualified'],
            'cost_per_lead': cpl,
            'created_at': a.created_at.isoformat() if a.created_at else None
        })

    return jsonify(result), 200


# El alta, la edición y el borrado de anuncios, campañas y conjuntos y el gasto por período vivían
# acá: los usaban Estructura e Inversión por período, que se retiraron el 14/10/2026 (los reemplazó
# la tabla por palabra clave de /api/marketing/anuncios). Las tablas siguen: el gasto cargado a mano
# suma en la tabla nueva (`anuncios_service`). El GET de arriba queda para «Sin anuncio».

