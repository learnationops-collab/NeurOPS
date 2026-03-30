from flask import request, jsonify
from app.models import db, User
from datetime import datetime, date, timedelta
from . import bp
import json
import requests

# ============================================================
# ADS MANAGEMENT (Público)
# ============================================================

@bp.route('/public/ads', methods=['GET'])
def get_public_ads():
    """Lista todos los anuncios con spend acumulado y leads."""
    from app.models import Ad, AdPeriodSpend, ManychatAdLead
    from sqlalchemy import func

    ads = Ad.query.order_by(Ad.created_at.desc()).all()

    # Pre-cargar stats de leads por ad_id
    lead_stats = db.session.query(
        ManychatAdLead.ad_id,
        func.count(ManychatAdLead.id).label('total_leads'),
        func.sum(db.case((ManychatAdLead.qualification == 'true', 1), else_=0)).label('qualified_leads')
    ).group_by(ManychatAdLead.ad_id).all()
    lead_map = {s.ad_id: {'total': s.total_leads, 'qualified': int(s.qualified_leads or 0)} for s in lead_stats}

    result = []
    for a in ads:
        total_spend = db.session.query(func.coalesce(func.sum(AdPeriodSpend.spend), 0)).filter(
            AdPeriodSpend.ad_id == a.id
        ).scalar()

        ls = lead_map.get(a.id, {'total': 0, 'qualified': 0})
        cpl = round(float(total_spend) / ls['total'], 2) if ls['total'] > 0 and float(total_spend) > 0 else 0

        result.append({
            'id': a.id,
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


@bp.route('/public/ads', methods=['POST'])
def create_public_ad():
    """Crea un anuncio rápido (auto-genera Campaign y AdSet si no existen)."""
    import logging
    logger = logging.getLogger(__name__)

    from app.models import Ad, AdSet, Campaign
    import traceback

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    keyword = data.get('keyword', '').strip()

    logger.info(f"[ADS] Inicio crear anuncio: name='{name}', keyword='{keyword}'")

    if not name:
        return jsonify({"message": "El nombre del anuncio es obligatorio"}), 400
    if not keyword:
        return jsonify({"message": "La keyword es obligatoria"}), 400

    try:
        # Paso 1: Buscar o crear campaña genérica
        logger.info("[ADS] Paso 1: Buscando campaña 'Anuncios Rápidos'...")
        campaign = Campaign.query.filter_by(name='Anuncios Rápidos').first()
        if campaign:
            logger.info(f"[ADS] Campaña encontrada: id={campaign.id}")
        else:
            logger.info("[ADS] Campaña no encontrada, creando nueva...")
            campaign = Campaign(
                name='Anuncios Rápidos',
                status='active',
                type='quick',
                external_id='CAM-QUICK-ADS'
            )
            db.session.add(campaign)
            db.session.flush()
            logger.info(f"[ADS] Campaña creada: id={campaign.id}")

        # Paso 2: Buscar o crear ad_set genérico
        logger.info(f"[ADS] Paso 2: Buscando AdSet 'Grupo General' para campaign_id={campaign.id}...")
        ad_set = AdSet.query.filter_by(campaign_id=campaign.id, name='Grupo General').first()
        if ad_set:
            logger.info(f"[ADS] AdSet encontrado: id={ad_set.id}")
        else:
            logger.info("[ADS] AdSet no encontrado, creando nuevo...")
            ad_set = AdSet(
                name='Grupo General',
                campaign_id=campaign.id,
                status='active',
                external_id=f'SET-QUICK-{campaign.id}'
            )
            db.session.add(ad_set)
            db.session.flush()
            logger.info(f"[ADS] AdSet creado: id={ad_set.id}")

        # Paso 3: Crear anuncio
        logger.info(f"[ADS] Paso 3: Creando anuncio name='{name}', keyword='{keyword}', ad_set_id={ad_set.id}...")
        import uuid
        unique_ext_id = f"ADS-{keyword}-{uuid.uuid4().hex[:6]}"

        ad = Ad(
            name=name,
            ad_set_id=ad_set.id,
            keyword=keyword,
            status='active',
            total_spend=0.0,
            external_id=unique_ext_id
        )
        db.session.add(ad)
        db.session.commit()
        logger.info(f"[ADS] Anuncio creado exitosamente: id={ad.id}, external_id='{ad.external_id}'")

        return jsonify({"message": "Anuncio creado", "id": ad.id, "keyword": ad.keyword}), 201

    except Exception as e:
        db.session.rollback()
        error_details = traceback.format_exc()
        logger.error(f"[ADS] ERROR al crear anuncio: {str(e)}")
        logger.error(f"[ADS] Traceback completo:\n{error_details}")
        return jsonify({"message": f"Error al crear anuncio: {str(e)}"}), 500


@bp.route('/public/ads/<int:ad_id>', methods=['PUT'])
def update_public_ad(ad_id):
    """Edita nombre, keyword o status de un anuncio."""
    from app.models import Ad

    ad = Ad.query.get_or_404(ad_id)
    data = request.get_json() or {}

    if 'name' in data: ad.name = data['name']
    if 'keyword' in data: ad.keyword = data['keyword']
    if 'status' in data: ad.status = data['status']

    try:
        db.session.commit()
        return jsonify({"message": "Anuncio actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@bp.route('/public/ads/<int:ad_id>', methods=['DELETE'])
def delete_public_ad(ad_id):
    """Elimina un anuncio y sus registros de gasto periodico."""
    from app.models import Ad, AdPeriodSpend

    ad = Ad.query.get_or_404(ad_id)
    try:
        # Eliminar gastos asociados
        AdPeriodSpend.query.filter_by(ad_id=ad.id).delete()
        db.session.delete(ad)
        db.session.commit()
        return jsonify({"message": "Anuncio eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


# --- Daily Spend ---

@bp.route('/public/ads/period-spend', methods=['GET'])
def get_public_period_spend():
    """Lista registros de gasto periódico filtrados por fecha de inicio y fin."""
    from app.models import AdPeriodSpend, Ad

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')

    query = AdPeriodSpend.query

    if start_date_str:
        query = query.filter(AdPeriodSpend.start_date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(AdPeriodSpend.end_date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())

    spends = query.order_by(AdPeriodSpend.start_date.desc()).all()

    return jsonify([{
        'id': s.id,
        'ad_id': s.ad_id,
        'ad_name': s.ad.name if s.ad else 'Unknown',
        'ad_keyword': s.ad.keyword if s.ad else '',
        'start_date': s.start_date.isoformat(),
        'end_date': s.end_date.isoformat(),
        'spend': s.spend,
        'entrantes': s.entrantes or 0,
        'agendas': s.agendas or 0,
        'notes': s.notes,
    } for s in spends]), 200


@bp.route('/public/ads/period-spend', methods=['POST'])
def save_public_period_spend():
    """Guarda o actualiza gasto de un anuncio por periodo (upsert por ad_id + start_date + end_date)."""
    from app.models import AdPeriodSpend

    data = request.get_json() or {}

    # Soporta batch (lista) o individual (objeto)
    entries = data.get('entries', [data]) if 'entries' in data else [data]

    saved = 0
    for entry in entries:
        ad_id = entry.get('ad_id')
        start_date_str = entry.get('start_date')
        end_date_str = entry.get('end_date')
        spend = float(entry.get('spend', 0))
        entrantes = int(entry.get('entrantes', 0) or 0)
        agendas = int(entry.get('agendas', 0) or 0)
        notes = entry.get('notes', '')

        if not ad_id or not start_date_str or not end_date_str:
            continue

        start_tgt = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_tgt = datetime.strptime(end_date_str, '%Y-%m-%d').date()

        # Upsert: buscar existente o crear nuevo
        record = AdPeriodSpend.query.filter_by(ad_id=ad_id, start_date=start_tgt, end_date=end_tgt).first()
        if record:
            record.spend = spend
            record.entrantes = entrantes
            record.agendas = agendas
            record.notes = notes
        else:
            record = AdPeriodSpend(ad_id=ad_id, start_date=start_tgt, end_date=end_tgt, spend=spend, entrantes=entrantes, agendas=agendas, notes=notes)
            db.session.add(record)
        saved += 1

    try:
        db.session.commit()
        return jsonify({"message": f"{saved} registro(s) de gasto guardados"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route('/public/ads/period-spend/<int:spend_id>', methods=['DELETE'])
def delete_public_period_spend(spend_id):
    """Elimina un registro de gasto por periodo."""
    from app.models import AdPeriodSpend

    record = AdPeriodSpend.query.get_or_404(spend_id)
    try:
        db.session.delete(record)
        db.session.commit()
        return jsonify({"message": "Registro eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


