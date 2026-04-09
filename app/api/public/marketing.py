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
    """Lista todos los anuncios con spend acumulado y leads, y sus relaciones de campaña."""
    from app.models import Ad, AdPeriodSpend, ManychatAdLead, AdSet, Campaign
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


@bp.route('/public/ads', methods=['POST'])
def create_public_ad():
    """Crea un anuncio. Opcionalmente recibe ad_set_id."""
    import logging
    logger = logging.getLogger(__name__)

    from app.models import Ad, AdSet, Campaign
    import traceback

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    keyword = data.get('keyword', '').strip()
    ad_set_id = data.get('ad_set_id')

    if not name:
        return jsonify({"message": "El nombre del anuncio es obligatorio"}), 400
    if not keyword:
        return jsonify({"message": "La keyword es obligatoria"}), 400

    try:
        # Si NO viene ad_set_id, usar/crear la genérica (comportamiento legacy)
        if not ad_set_id:
            campaign = Campaign.query.filter_by(name='Anuncios Rápidos').first()
            if not campaign:
                campaign = Campaign(name='Anuncios Rápidos', status='active', type='quick', external_id='CAM-QUICK-ADS')
                db.session.add(campaign)
                db.session.flush()

            ad_set = AdSet.query.filter_by(campaign_id=campaign.id, name='Grupo General').first()
            if not ad_set:
                ad_set = AdSet(name='Grupo General', campaign_id=campaign.id, status='active', external_id=f'SET-QUICK-{campaign.id}')
                db.session.add(ad_set)
                db.session.flush()
                
            ad_set_id = ad_set.id
        else:
            # Validar que exista el conjunto
            ad_set = AdSet.query.get(ad_set_id)
            if not ad_set:
                return jsonify({"message": "El Conjunto de Anuncios especificado no existe."}), 404

        import uuid
        unique_ext_id = f"ADS-{keyword}-{uuid.uuid4().hex[:6]}"

        ad = Ad(
            name=name,
            ad_set_id=ad_set_id,
            keyword=keyword,
            status='active',
            total_spend=0.0,
            external_id=unique_ext_id
        )
        db.session.add(ad)
        db.session.commit()

        return jsonify({"message": "Anuncio creado", "id": ad.id, "keyword": ad.keyword}), 201

    except Exception as e:
        db.session.rollback()
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
    if 'ad_set_id' in data: ad.ad_set_id = data['ad_set_id']

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


# ============================================================
# CAMPAIGNS & AD SETS CRUD
# ============================================================

@bp.route('/public/campaigns', methods=['GET'])
def get_public_campaigns():
    """Obtiene el árbol completo de Campañas > AdSets > Ads para armar la UI jerárquica."""
    from app.models import Campaign, AdSet, Ad
    
    # Podríamos usar las relaciones anidadas o construir el árbol de forma manual
    campaigns = Campaign.query.all()
    
    # Para optimizar, vamos a traernos al JSON todos los datos para evitar lazy loading
    result = []
    for c in campaigns:
        c_dict = {
            'id': c.id,
            'name': c.name,
            'status': c.status,
            'ad_sets': []
        }
        for s in c.ad_sets:
            s_dict = {
                'id': s.id,
                'name': s.name,
                'status': s.status,
                'campaign_id': c.id
            }
            # Se omite ads_detail en el árbol para no duplicar data, el frontend re-agrupa usando los `get_public_ads` flat, o se los pasamos:
            # Pasa que `get_public_ads` cruza las ventas/spend, así que es mejor armar jerarquía cruzando frontend
            c_dict['ad_sets'].append(s_dict)
        result.append(c_dict)
        
    return jsonify(result), 200


@bp.route('/public/campaigns', methods=['POST'])
def create_public_campaign():
    from app.models import Campaign
    try:
        data = request.json
        name = data.get('name', '').strip()
        if not name: return jsonify({"error": "Nombre es requerido"}), 400
        
        import uuid
        external_id = data.get('external_id', f'CAM-{uuid.uuid4().hex[:8]}')
        
        c = Campaign(name=name, status='active', external_id=external_id)
        db.session.add(c)
        db.session.commit()
        return jsonify({"id": c.id, "name": c.name}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/campaigns/<int:campaign_id>', methods=['PUT', 'DELETE'])
def manage_public_campaign(campaign_id):
    from app.models import Campaign
    c = Campaign.query.get_or_404(campaign_id)
    
    if request.method == 'DELETE':
        db.session.delete(c)
        db.session.commit()
        return jsonify({"message": "Campaña y sus dependientes eliminados"}), 200
        
    data = request.json
    if 'name' in data: c.name = data['name']
    if 'status' in data: c.status = data['status']
    db.session.commit()
    return jsonify({"message": "Campaña actualizada"}), 200

@bp.route('/public/adsets', methods=['POST'])
def create_public_adset():
    from app.models import AdSet, Campaign
    try:
        data = request.json
        name = data.get('name', '').strip()
        campaign_id = data.get('campaign_id')
        
        if not name or not campaign_id:
            return jsonify({"error": "Nombre y campaign_id son requeridos"}), 400
            
        import uuid
        external_id = f'SET-{uuid.uuid4().hex[:8]}'
        
        s = AdSet(name=name, campaign_id=campaign_id, status='active', external_id=external_id)
        db.session.add(s)
        db.session.commit()
        return jsonify({"id": s.id, "name": s.name}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/adsets/<int:adset_id>', methods=['PUT', 'DELETE'])
def manage_public_adset(adset_id):
    from app.models import AdSet
    s = AdSet.query.get_or_404(adset_id)
    
    if request.method == 'DELETE':
        db.session.delete(s)
        db.session.commit()
        return jsonify({"message": "Conjunto y sus anuncios eliminados"}), 200
        
    data = request.json
    if 'name' in data: s.name = data['name']
    if 'status' in data: s.status = data['status']
    if 'campaign_id' in data: s.campaign_id = data['campaign_id']
    db.session.commit()
    return jsonify({"message": "Conjunto actualizado"}), 200


# --- Daily Spend ---

@bp.route('/public/ads/period-spend', methods=['GET'])
def get_public_period_spend():
    """Lista registros de gasto periódico filtrados por fecha de inicio y fin."""
    from app.models import AdPeriodSpend, Ad, AdSet, Campaign

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
        'ad_set_id': s.ad_set_id,
        'campaign_id': s.campaign_id,
        'ad_name': s.ad.name if hasattr(s, 'ad') and s.ad else 'Sin Anuncio',
        'ad_keyword': s.ad.keyword if hasattr(s, 'ad') and s.ad else '',
        'ad_set_name': s.ad_set.name if hasattr(s, 'ad_set') and s.ad_set else '',
        'campaign_name': s.campaign.name if hasattr(s, 'campaign') and s.campaign else '',
        'start_date': s.start_date.isoformat(),
        'end_date': s.end_date.isoformat(),
        'spend': s.spend,
        'notes': s.notes,
    } for s in spends]), 200


@bp.route('/public/ads/period-spend', methods=['POST'])
def save_public_period_spend():
    """Guarda o actualiza gasto por periodo para un conjunto de anuncios."""
    from app.models import AdPeriodSpend

    data = request.get_json() or {}

    # Soporta batch (lista) o individual (objeto)
    entries = data.get('entries', [data]) if 'entries' in data else [data]

    saved = 0
    for entry in entries:
        ad_id = entry.get('ad_id')
        ad_set_id = entry.get('ad_set_id')
        campaign_id = entry.get('campaign_id')
        start_date_str = entry.get('start_date')
        end_date_str = entry.get('end_date')
        spend = float(entry.get('spend', 0))
        notes = entry.get('notes', '')

        if not start_date_str or not end_date_str:
            continue
        if not (ad_id or ad_set_id or campaign_id):
            continue

        start_tgt = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_tgt = datetime.strptime(end_date_str, '%Y-%m-%d').date()

        # Upsert logic based on priority (ad_set > campaign > ad) to avoid dupes
        record = None
        if ad_set_id:
            record = AdPeriodSpend.query.filter_by(ad_set_id=ad_set_id, start_date=start_tgt, end_date=end_tgt).first()
        elif campaign_id:
            record = AdPeriodSpend.query.filter_by(campaign_id=campaign_id, start_date=start_tgt, end_date=end_tgt).first()
        elif ad_id:
            record = AdPeriodSpend.query.filter_by(ad_id=ad_id, start_date=start_tgt, end_date=end_tgt).first()

        if record:
            record.spend = spend
            record.notes = notes
            # Actualizamos ids por si mutaron (raro en upsert)
            record.ad_set_id = ad_set_id or record.ad_set_id
            record.campaign_id = campaign_id or record.campaign_id
            record.ad_id = ad_id or record.ad_id
        else:
            record = AdPeriodSpend(ad_id=ad_id, ad_set_id=ad_set_id, campaign_id=campaign_id, start_date=start_tgt, end_date=end_tgt, spend=spend, notes=notes)
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


# ============================================================
# REPORTE DE ATRIBUCIÓN: Ventas → Anuncios por Instagram
# ============================================================

@bp.route('/public/reports/sales-attribution', methods=['GET'])
def get_sales_attribution_report():
    """
    Genera un reporte que cruza ventas externas (FinancialSale) con
    registros de webhooks de anuncios (ManychatLead/LeadAnswer) usando
    el campo 'instagram' como llave de unión.

    Para cada venta, busca el LeadAnswer más reciente ANTERIOR a la fecha 
    de la venta. Si no existe ninguno, el origen queda como 'indeterminado'.

    Parámetros GET:
        - start_date (str): Fecha inicio YYYY-MM-DD
        - end_date   (str): Fecha fin YYYY-MM-DD
    """
    from app.models import FinancialSale, ManychatLead, LeadAnswer, Ad
    from datetime import datetime

    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')

    if not start_str or not end_str:
        return jsonify({"error": "Se requieren start_date y end_date"}), 400

    try:
        start_dt = datetime.strptime(start_str, '%Y-%m-%d')
        end_dt = datetime.strptime(end_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
    except ValueError:
        return jsonify({"error": "Formato de fecha inválido, usar YYYY-MM-DD"}), 400

    # 1. Obtener ventas del periodo que tengan instagram definido
    sales = FinancialSale.query.filter(
        FinancialSale.date >= start_dt,
        FinancialSale.date <= end_dt
    ).order_by(FinancialSale.date.asc()).all()

    # 2. Pre-cargar mapa de anuncios para evitar N+1 queries
    all_ads = Ad.query.all()
    ads_map = {a.id: a for a in all_ads}

    report_rows = []

    for sale in sales:
        row = {
            "sale_id": sale.id,
            "fecha_venta": sale.date.isoformat() if sale.date else None,
            "cliente": (sale.raw_data or {}).get('cliente') or (sale.raw_data or {}).get('nombre') or 'Desconocido',
            "setter": sale.setter_name,
            "closer": (sale.raw_data or {}).get('vendedor') or (sale.raw_data or {}).get('closer') or 'Sin asignar',
            "producto": sale.product or 'N/A',
            "monto": sale.amount,
            "instagram": sale.instagram,
            # Datos de atribución (se rellena abajo)
            "ad_id": None,
            "ad_name": None,
            "ad_keyword": None,
            "fecha_primer_contacto": None,
            "dias_hasta_venta": None,
            "atribucion": "indeterminado"
        }

        # 3. Buscar match por instagram (normalizado, sin @)
        if sale.instagram and sale.instagram.strip() and sale.instagram != 'N/A':
            ig_normalizado = sale.instagram.strip().lstrip('@').lower()

            # Buscar el ManychatLead cuyo campo 'ig' coincida (case-insensitive, sin @)
            # SQLite/Postgres: usamos ilike o similar
            matched_lead = ManychatLead.query.filter(
                db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_normalizado
            ).first()

            if matched_lead:
                # 4. Buscar el LeadAnswer más reciente ANTERIOR a la fecha de la venta
                closest_answer = LeadAnswer.query.filter(
                    LeadAnswer.lead_id == matched_lead.id,
                    LeadAnswer.ad_id != None,
                    LeadAnswer.created_at <= sale.date
                ).order_by(LeadAnswer.created_at.desc()).first()

                if closest_answer:
                    ad = ads_map.get(closest_answer.ad_id)
                    delta = sale.date - closest_answer.created_at

                    row["ad_id"] = closest_answer.ad_id
                    row["ad_name"] = ad.name if ad else f"Anuncio #{closest_answer.ad_id}"
                    row["ad_keyword"] = ad.keyword if ad else closest_answer.keyword
                    row["fecha_primer_contacto"] = closest_answer.created_at.isoformat()
                    row["dias_hasta_venta"] = delta.days
                    row["atribucion"] = "encontrado"

        report_rows.append(row)

    # 5. Calcular métricas de resumen
    total_ventas = len(report_rows)
    atribuidas = sum(1 for r in report_rows if r["atribucion"] == "encontrado")
    sin_instagram = sum(1 for r in report_rows if not r["instagram"] or r["instagram"] == 'N/A')
    indeterminadas = total_ventas - atribuidas

    # Agrupar monto por anuncio
    revenue_by_ad = {}
    for r in report_rows:
        if r["atribucion"] == "encontrado" and r["ad_id"]:
            key = r["ad_id"]
            if key not in revenue_by_ad:
                revenue_by_ad[key] = {
                    "ad_id": r["ad_id"],
                    "ad_name": r["ad_name"],
                    "ad_keyword": r["ad_keyword"],
                    "ventas": 0,
                    "monto_total": 0
                }
            revenue_by_ad[key]["ventas"] += 1
            revenue_by_ad[key]["monto_total"] += r["monto"]

    return jsonify({
        "summary": {
            "total_ventas": total_ventas,
            "atribuidas": atribuidas,
            "indeterminadas": indeterminadas,
            "sin_instagram": sin_instagram,
            "porcentaje_atribucion": round((atribuidas / total_ventas * 100), 1) if total_ventas > 0 else 0
        },
        "revenue_by_ad": sorted(revenue_by_ad.values(), key=lambda x: x["monto_total"], reverse=True),
        "rows": report_rows
    }), 200

@bp.route('/public/marketing/manual-attribution', methods=['POST'])
def force_manual_attribution():
    """
    Fuerza la atribución de una venta inyectando un usuario y una interacción virtual.
    """
    from app.models import FinancialSale, ManychatLead, LeadAnswer
    from datetime import timedelta
    import uuid

    data = request.json or {}
    sale_id = data.get('sale_id')
    ad_id = data.get('ad_id')
    instagram_input = data.get('instagram')

    if not sale_id or not ad_id or not instagram_input:
        return jsonify({"error": "Faltan parámetros requeridos (sale_id, ad_id, instagram)"}), 400

    sale = FinancialSale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "No se encontró la venta"}), 404

    # 1. Normalizar IG y guardarlo en la venta si es diferente/nuevo
    ig_normalizado = instagram_input.strip().lstrip('@').lower()
    sale.instagram = f"@{ig_normalizado}"
    
    # 2. Buscar o crear ManychatLead
    matched_lead = ManychatLead.query.filter(
        db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_normalizado
    ).first()

    if not matched_lead:
        # Generar un ID único basado en la venta para evitar colisiones
        cliente_nombre = (sale.raw_data or {}).get('cliente') or (sale.raw_data or {}).get('nombre') or 'Desconocido'
        matched_lead = ManychatLead(
            manychat_id=f"manual_{sale.id}_{uuid.uuid4().hex[:6]}",
            name=cliente_nombre,
            ig=f"@{ig_normalizado}",
            follower=False
        )
        db.session.add(matched_lead)
        db.session.flush()

    # 3. Crear LeadAnswer (interacción de webhook falsa) un minuto antes de la venta
    # Para asegurar que la próxima vez que el reporte corra, la empareje orgánicamente.
    fake_time = sale.date - timedelta(minutes=1) if sale.date else db.func.now()
    
    answer = LeadAnswer(
        lead_id=matched_lead.id,
        ad_id=ad_id,
        keyword="manual_attribution",
        qualification="true", # asumimos calificado ya que compró
        created_at=fake_time,
        updated_at=fake_time
    )
    
    # Modificamos la hora de creación insertada en la base de datos (pues db.func.now sobreescribe el default en SQLAlchemy pero podemos forzar)
    # Algunas DBS respetan asignarlo directo al modelo si no hay trigger de BD
    db.session.add(answer)
    
    try:
        db.session.commit()
        
        # Opcional: forzar timestamps post-commit por si SQLAlchemy los sobreescribe
        answer.created_at = fake_time
        answer.updated_at = fake_time
        db.session.commit()

        return jsonify({
            "message": "Atribución forzada con éxito.",
            "sale_id": sale.id,
            "lead_id": matched_lead.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

