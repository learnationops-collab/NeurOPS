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
    Maneja el Lead (ManychatLead) y su respuesta/interacción (LeadAnswer)
    GET: verificación de URL por ManyChat.
    """
    # Verificación de URL por ManyChat (GET)
    if request.method == 'GET':
        return jsonify({"status": "ok", "message": "Webhook activo"}), 200

    from app.models import ManychatLead, LeadAnswer, Ad

    data = request.get_json(silent=True) or {}
    logger.info(f"[WEBHOOK NUEVO FORMATO] Recibido ({request.method}): {data}")

    manychat_id = data.get('manychat_id')
    
    if not manychat_id:
        return jsonify({"status": "error", "message": "manychat_id es obligatorio"}), 400

    # ----- Datos del LEAD -----
    lead_name = data.get('lead_name', '')
    lead_ig = data.get('lead_ig', '')
    
    # Parse follower boolean
    follower_raw = data.get('follower')
    follower = False
    if str(follower_raw).lower() in ('true', '1', 'si', 'sí', 'yes'):
        follower = True

    # ----- Datos de la RESPUESTA (Answer) -----
    ad_id_raw = data.get('ad_id')
    keyword = data.get('keyword', '')
    fecha = data.get('fecha', '')
    opening = data.get('opening', '')
    variante = data.get('variante', '')
    qualification_raw = data.get('cualificacion')

    # Convertir ad_id a int de forma segura
    ad_id = None
    if ad_id_raw:
        try:
            ad_id = int(ad_id_raw)
        except (ValueError, TypeError):
            ad_id = None
            logger.warning(f"[WEBHOOK] ad_id no es un entero válido: '{ad_id_raw}', se guardará como None")

    # Normalizar cualificación a string limitados (true/false/null)
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
        # 1. UPSERT LEAD
        lead = ManychatLead.query.filter_by(manychat_id=str(manychat_id)).first()
        if lead:
            # Actualizamos datos del usuario
            if lead_name: lead.name = lead_name
            if lead_ig: lead.ig = lead_ig
            lead.follower = follower
            # Actualizamos last_stage si viene en el payload
            raw_last_stage = data.get('last_stage')
            if raw_last_stage is not None:
                try:
                    lead.last_stage = int(raw_last_stage)
                except (ValueError, TypeError):
                    pass
            logger.info(f"[WEBHOOK] ManychatLead actualizado: {manychat_id}")
        else:
            # Lo creamos
            raw_last_stage = data.get('last_stage')
            parsed_last_stage = None
            if raw_last_stage is not None:
                try:
                    parsed_last_stage = int(raw_last_stage)
                except (ValueError, TypeError):
                    pass
            lead = ManychatLead(
                manychat_id=str(manychat_id),
                name=lead_name,
                ig=lead_ig,
                follower=follower,
                last_stage=parsed_last_stage
            )
            db.session.add(lead)
            db.session.flush() # Para obtener lead.id antes del commit
            logger.info(f"[WEBHOOK] ManychatLead creado: {manychat_id} (ID DB: {lead.id})")

        # 2. UPSERT ANSWER
        # Buscamos si ya existe una respuesta de este lead para este anuncio (o keyword)
        answer = None
        if ad_id:
            answer = LeadAnswer.query.filter_by(lead_id=lead.id, ad_id=ad_id).first()
        elif keyword:
            answer = LeadAnswer.query.filter_by(lead_id=lead.id, keyword=keyword).first()

        # Si mandaron a cualificar pero no dijeron qué anuncio, buscamos la última respuesta del Lead
        if not answer and not ad_id and not keyword:
            answer = LeadAnswer.query.filter_by(lead_id=lead.id).order_by(LeadAnswer.created_at.desc()).first()

        if answer:
            # Actualizar respuesta existente
            if qualification_raw is not None: answer.qualification = qualification
            if fecha: answer.fecha_recibida = fecha
            if opening: answer.opening = opening
            if variante: answer.variante = variante
            if keyword: answer.keyword = keyword
            action = 'updated'
            logger.info(f"[WEBHOOK] LeadAnswer actualizado para Manychat_ID: {manychat_id}")
        else:
            # Crear nueva respuesta (Primer contacto con este Anuncio/Variante)
            answer = LeadAnswer(
                lead_id=lead.id,
                ad_id=ad_id,
                keyword=keyword,
                fecha_recibida=fecha,
                opening=opening,
                variante=variante,
                qualification=qualification
            )
            db.session.add(answer)
            action = 'created'
            logger.info(f"[WEBHOOK] LeadAnswer creado para Manychat_ID: {manychat_id}, Ad_ID: {ad_id}")

        db.session.commit()

        return jsonify({
            "status": "success",
            "action": action,
            "lead": {
                "id": lead.id,
                "manychat_id": lead.manychat_id,
                "lead_name": lead.name
            },
            "answer": {
                "id": answer.id,
                "ad_id": answer.ad_id,
                "qualification": answer.qualification
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
    """Retorna las últimas N interacciones recibidas."""
    from app.models import LeadAnswer, ManychatLead, Ad

    limit = int(request.args.get('limit', 10))
    # Traemos las respuestas ordenadas por creación
    answers = LeadAnswer.query.order_by(LeadAnswer.created_at.desc()).limit(limit).all()

    # Cargar nombres de anuncios y leads
    ad_ids = [a.ad_id for a in answers if a.ad_id]
    ads_map = {}
    if ad_ids:
        ads = Ad.query.filter(Ad.id.in_(ad_ids)).all()
        ads_map = {a.id: a for a in ads}

    return jsonify([{
        'id': ans.id,  # ID de la respuesta, usado para editar
        'lead_id': ans.lead.id,
        'manychat_id': ans.lead.manychat_id,
        'lead_name': ans.lead.name,
        'lead_ig': ans.lead.ig,
        'follower': ans.lead.follower,
        'last_stage': ans.lead.last_stage,
        'ad_id': ans.ad_id,
        'ad_name': ads_map[ans.ad_id].name if ans.ad_id and ans.ad_id in ads_map else '—',
        'keyword': ans.keyword,
        'fecha': ans.fecha_recibida,
        'opening': ans.opening,
        'variante': ans.variante,
        'qualification': ans.qualification,
        'created_at': ans.created_at.isoformat() if ans.created_at else None,
        'updated_at': ans.updated_at.isoformat() if ans.updated_at else None
    } for ans in answers]), 200


@bp.route('/manychat-webhook/stats', methods=['GET'])
def get_ad_lead_stats():
    """Retorna leads totales y cualificados por anuncio."""
    from app.models import LeadAnswer
    from sqlalchemy import func

    stats = db.session.query(
        LeadAnswer.ad_id,
        func.count(LeadAnswer.id).label('total_leads'),
        func.sum(
            db.case((LeadAnswer.qualification == 'true', 1), else_=0)
        ).label('qualified_leads')
    ).group_by(LeadAnswer.ad_id).all()

    return jsonify({
        str(s.ad_id): {
            'total_leads': s.total_leads,
            'qualified_leads': int(s.qualified_leads or 0)
        }
        for s in stats if s.ad_id is not None
    }), 200


@bp.route('/manychat-webhook/answer/<int:answer_id>', methods=['PUT'])
def update_ad_lead(answer_id):
    """Permite editar manualmente una respuesta/lead en el monitor."""
    from app.models import LeadAnswer
    
    answer = LeadAnswer.query.get_or_404(answer_id)
    data = request.get_json() or {}

    # Editar datos de la interacción
    if 'qualification' in data: answer.qualification = data.get('qualification')
    if 'ad_id' in data:
        ad_id_raw = data.get('ad_id')
        try:
            answer.ad_id = int(ad_id_raw) if ad_id_raw else None
        except ValueError:
            pass
            
    # Editar datos del usuario vinculado (ManychatLead)
    if 'lead_name' in data: answer.lead.name = data.get('lead_name')
    if 'lead_ig' in data: answer.lead.ig = data.get('lead_ig')
    if 'follower' in data:
        f_raw = data.get('follower')
        answer.lead.follower = True if str(f_raw).lower() in ('true', '1') or f_raw is True else False

    try:
        db.session.commit()
        return jsonify({"status": "success", "message": "Lead actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route('/manychat-webhook/stats/segmentation', methods=['GET'])
def get_ad_segmentation_stats():
    """Retorna leads agrupados por variante y por opening."""
    from app.models import LeadAnswer
    from sqlalchemy import func, not_
    from datetime import datetime

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Filtros base: excluir Nulos/Vacíos y valores basura del webhook cuf_
    base_filters_variante = [
        LeadAnswer.variante != None,
        LeadAnswer.variante != '',
        # Excluir explícitamente valores de webhook no interpretados
        not_(LeadAnswer.variante.like('%cuf_%'))
    ]
    
    base_filters_opening = [
        LeadAnswer.opening != None,
        LeadAnswer.opening != '',
        not_(LeadAnswer.opening.like('%cuf_%'))
    ]

    if start_date:
        try:
            st = datetime.strptime(start_date, '%Y-%m-%d')
            base_filters_variante.append(LeadAnswer.created_at >= st)
            base_filters_opening.append(LeadAnswer.created_at >= st)
        except ValueError:
            pass
            
    if end_date:
        try:
            ed = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            base_filters_variante.append(LeadAnswer.created_at <= ed)
            base_filters_opening.append(LeadAnswer.created_at <= ed)
        except ValueError:
            pass

    # Agrupar por Variante
    stats_variante = db.session.query(
        LeadAnswer.variante,
        func.count(LeadAnswer.id).label('total_leads'),
        func.sum(
            db.case((LeadAnswer.qualification == 'true', 1), else_=0)
        ).label('qualified_leads')
    ).filter(*base_filters_variante).group_by(LeadAnswer.variante).all()

    # Agrupar por Opening
    stats_opening = db.session.query(
        LeadAnswer.opening,
        func.count(LeadAnswer.id).label('total_leads'),
        func.sum(
            db.case((LeadAnswer.qualification == 'true', 1), else_=0)
        ).label('qualified_leads')
    ).filter(*base_filters_opening).group_by(LeadAnswer.opening).all()

    def format_stats(stats_list, key_name):
        res = []
        for s in stats_list:
            total = s.total_leads
            qual = int(s.qualified_leads or 0)
            qual_percent = round((qual / total) * 100, 1) if total > 0 else 0
            val = getattr(s, key_name)
            if not val or '{{' in val: continue # Extra safety
            res.append({
                'name': val,
                'total_leads': total,
                'qualified_leads': qual,
                'qualified_percentage': qual_percent
            })
        res.sort(key=lambda x: x['total_leads'], reverse=True)
        return res

    return jsonify({
        'variantes': format_stats(stats_variante, 'variante'),
        'openings': format_stats(stats_opening, 'opening')
    }), 200



@bp.route('/manychat-webhook/stats/dashboard', methods=['GET'])
def get_ad_dashboard_stats():
    """Retorna leads totales, % cualificados y métricas financieras (Agendas, Ventas, Costos) agrupadas por ad_id."""
    from app.models import LeadAnswer, Ad, AdSet, Campaign, AdPeriodSpend, ManychatLead, FinancialAgenda, FinancialSale
    from sqlalchemy import func
    from datetime import datetime, timedelta

    period = request.args.get('period')
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')
    
    now = datetime.utcnow()

    if start_str and end_str:
        try:
            start_dt = datetime.strptime(start_str, '%Y-%m-%d')
            end_dt = datetime.strptime(end_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            # Fallback
            start_dt = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_dt = now
    elif period == 'yesterday':
        start_dt = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = (now - timedelta(days=1)).replace(hour=23, minute=59, second=59, microsecond=999999)
    elif period == 'last_week':
        start_dt = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
    else: # last_month as default
        start_dt = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now

    # Helper para normalizar IG
    def normalize_ig(ig_str):
        if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
            return None
        return ig_str.strip().lstrip('@').lower()

    # 1. LEADS DEL PERIODO
    stats = db.session.query(
        LeadAnswer.ad_id,
        func.count(LeadAnswer.id).label('total_leads'),
        func.sum(db.case((LeadAnswer.qualification == 'true', 1), else_=0)).label('qualified_leads')
    ).filter(
        LeadAnswer.ad_id != None,
        LeadAnswer.created_at >= start_dt,
        LeadAnswer.created_at <= end_dt
    ).group_by(LeadAnswer.ad_id).all()

    if not stats:
        return jsonify({'ad_stats': [], 'setter_stats': []}), 200

    ad_ids = [s.ad_id for s in stats]
    ads = Ad.query.filter(Ad.id.in_(ad_ids)).all()
    ads_map = {a.id: a for a in ads}
    
    # 2. RESOLVER INVERSIÓN (AdPeriodSpend + fallback total_spend)
    # Gasto directo por Ad en este periodo
    period_spends = AdPeriodSpend.query.filter(
        AdPeriodSpend.start_date <= end_dt.date(),
        AdPeriodSpend.end_date >= start_dt.date()
    ).all()

    spend_by_ad = {}
    adset_spend_map = {}
    campaign_spend_map = {}
    
    for ps in period_spends:
        if ps.ad_id: spend_by_ad[ps.ad_id] = spend_by_ad.get(ps.ad_id, 0) + ps.spend
        if ps.ad_set_id: adset_spend_map[ps.ad_set_id] = adset_spend_map.get(ps.ad_set_id, 0) + ps.spend
        if ps.campaign_id: campaign_spend_map[ps.campaign_id] = campaign_spend_map.get(ps.campaign_id, 0) + ps.spend

    # Mapeos de jerarquía
    adset_ids = [a.ad_set_id for a in ads]
    adsets = AdSet.query.filter(AdSet.id.in_(adset_ids)).all()
    adset_map = {a.id: a for a in adsets}
    
    campaign_ids = [s.campaign_id for s in adsets]
    campaigns = Campaign.query.filter(Campaign.id.in_(campaign_ids)).all()
    campaign_map_by_id = {c.id: c for c in campaigns}

    # Count ads for prorrateo
    ads_per_adset = {}
    for a in Ad.query.filter(Ad.ad_set_id.in_(adset_ids)).all():
        ads_per_adset[a.ad_set_id] = ads_per_adset.get(a.ad_set_id, 0) + 1
        
    ads_per_campaign = {}
    for a_set in AdSet.query.filter(AdSet.campaign_id.in_(campaign_ids)).all():
        count = ads_per_adset.get(a_set.id, 0)
        ads_per_campaign[a_set.campaign_id] = ads_per_campaign.get(a_set.campaign_id, 0) + count

    def resolve_spend(ad_id: int) -> float:
        if spend_by_ad.get(ad_id, 0) > 0: return spend_by_ad[ad_id]
        
        ad = ads_map.get(ad_id)
        if not ad: return 0.0
        
        # Fallback AdSet
        s_id = ad.ad_set_id
        if s_id and adset_spend_map.get(s_id, 0) > 0:
            return round(adset_spend_map[s_id] / ads_per_adset.get(s_id, 1), 2)
            
        # Fallback Campaign
        ad_set = adset_map.get(s_id)
        if ad_set and campaign_spend_map.get(ad_set.campaign_id, 0) > 0:
            return round(campaign_spend_map[ad_set.campaign_id] / ads_per_campaign.get(ad_set.campaign_id, 1), 2)
            
        # Fallback histórico total_spend
        return float(ad.total_spend or 0.0)

    # 3. AGENDAS & VENTAS (Atribución IG)
    ig_by_ad_rows = db.session.query(
        LeadAnswer.ad_id,
        ManychatLead.ig
    ).join(ManychatLead, ManychatLead.id == LeadAnswer.lead_id)\
     .filter(LeadAnswer.ad_id.in_(ad_ids), ManychatLead.ig != None).all()

    igs_per_ad = {}
    for row in ig_by_ad_rows:
        ig_c = normalize_ig(row.ig)
        if ig_c: igs_per_ad.setdefault(row.ad_id, set()).add(ig_c)


    # Agendas
    agendas_all = FinancialAgenda.query.filter(FinancialAgenda.date >= start_dt, FinancialAgenda.date <= end_dt).all()
    agenda_igs_map = {} # IG -> source/setter (lead field)
    for ag in agendas_all:
        ig_val = ag.instagram or (ag.raw_data or {}).get('instagram') or (ag.raw_data or {}).get('ig')
        ig_c = normalize_ig(ig_val)
        if ig_c:
            # Usar 'lead' como la fuente/setter
            source = ag.lead or 'S/F'
            agenda_igs_map.setdefault(ig_c, []).append(source)

    # Ventas
    sales_in_period = FinancialSale.query.filter(FinancialSale.date >= start_dt, FinancialSale.date <= end_dt).all()
    ventas_por_ad = {}
    for sale in sales_in_period:
        ig_val = sale.instagram or (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')
        ig_n = normalize_ig(ig_val)
        if not ig_n: continue
        
        matched_lead = ManychatLead.query.filter(func.lower(func.replace(ManychatLead.ig, '@', '')) == ig_n).first()
        if not matched_lead: continue
        
        closest = LeadAnswer.query.filter(LeadAnswer.lead_id == matched_lead.id, LeadAnswer.ad_id.in_(ad_ids), LeadAnswer.created_at <= sale.date)\
                 .order_by(LeadAnswer.created_at.desc()).first()
        if closest: ventas_por_ad[closest.ad_id] = ventas_por_ad.get(closest.ad_id, 0) + 1

    # 4. RESULTADO
    result = []
    for s in stats:
        ad_id = s.ad_id
        total = s.total_leads
        qual = int(s.qualified_leads or 0)
        
        ad = ads_map.get(ad_id)
        ad_name = ad.name if ad else f"ID: {ad_id}"
        
        spend = resolve_spend(ad_id)
        ad_igs = igs_per_ad.get(ad_id, set())
        
        # Breakdown de Agendas por Setter
        ag_count = 0
        setter_breakdown = {}
        for ig in ad_igs:
            if ig in agenda_igs_map:
                setters = agenda_igs_map[ig]
                ag_count += len(setters)
                for sname in setters:
                    setter_breakdown[sname] = setter_breakdown.get(sname, 0) + 1
        
        v_count = ventas_por_ad.get(ad_id, 0)

        result.append({
            'ad_id': ad_id,
            'ad_name': ad_name,
            'total_leads': total,
            'qualified_leads': qual,
            'qualified_percentage': round((qual / total) * 100, 1) if total > 0 else 0,
            'spend': spend,
            'agendas': ag_count,
            'setter_breakdown': setter_breakdown,
            'ventas': v_count,
            'cpl': round(spend / total, 2) if total > 0 else 0,
            'cpa': round(spend / ag_count, 2) if ag_count > 0 else 0,
            'cpv': round(spend / v_count, 2) if v_count > 0 else 0
        })


    # Global Setter Stats (Agendas + Ventas)
    global_setters = {}
    
    # Agendas por Setter/Fuente
    for ag in agendas_all:
        sname = ag.lead or 'S/F'
        if sname not in global_setters:
            global_setters[sname] = {'agendas': 0, 'ventas': 0}
        global_setters[sname]['agendas'] += 1
        
    # Ventas por Setter
    for sale in sales_in_period:
        sname = sale.setter or 'S/S'
        if sname not in global_setters:
            global_setters[sname] = {'agendas': 0, 'ventas': 0}
        global_setters[sname]['ventas'] += 1
    
    setter_stats = sorted([
        {'name': k, 'agendas': v['agendas'], 'ventas': v['ventas']} 
        for k, v in global_setters.items()
    ], key=lambda x: (x['ventas'], x['agendas']), reverse=True)

    result.sort(key=lambda x: x['total_leads'], reverse=True)
    return jsonify({
        'ad_stats': result,
        'setter_stats': setter_stats
    }), 200

@bp.route('/manychat-webhook/ad-details/<int:ad_id>', methods=['GET'])
def get_ad_details(ad_id):
    """Retorna detalles completos de un anuncio: histórico de leads, evolución y finanzas."""
    from app.models import LeadAnswer, ManychatLead, Ad
    from sqlalchemy import func, cast, Date
    from datetime import datetime, timedelta

    ad = Ad.query.get(ad_id)
    if not ad:
        # Si el ad_id no existe en la tabla ads pero sí en lead_answers
        ad_name = f"Anuncio ID: {ad_id}"
        total_spend = 0
    else:
        ad_name = ad.name
        total_spend = ad.total_spend or 0

    # 1. Stats generales
    leads_query = LeadAnswer.query.filter_by(ad_id=ad_id)
    total_leads = leads_query.count()
    qualified_leads = leads_query.filter_by(qualification='true').count()
    qual_percent = round((qualified_leads / total_leads * 100), 1) if total_leads > 0 else 0
    
    cpl = round(total_spend / total_leads, 2) if total_leads > 0 else 0
    cpql = round(total_spend / qualified_leads, 2) if qualified_leads > 0 else 0

    # 2. Historial de personas (últimos 20)
    recent_leads = db.session.query(
        ManychatLead.name,
        ManychatLead.ig,
        LeadAnswer.qualification,
        LeadAnswer.created_at
    ).join(LeadAnswer, LeadAnswer.lead_id == ManychatLead.id)\
     .filter(LeadAnswer.ad_id == ad_id)\
     .order_by(LeadAnswer.created_at.desc())\
     .limit(20).all()

    leads_list = [{
        'name': l.name,
        'ig': l.ig,
        'qualification': l.qualification,
        'date': l.created_at.isoformat()
    } for l in recent_leads]

    # 3. Evolución (Últimos 30 días)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    evolution_stats = db.session.query(
        func.date(LeadAnswer.created_at).label('date'),
        func.count(LeadAnswer.id).label('count')
    ).filter(
        LeadAnswer.ad_id == ad_id,
        LeadAnswer.created_at >= thirty_days_ago
    ).group_by(func.date(LeadAnswer.created_at))\
     .order_by(func.date(LeadAnswer.created_at).asc()).all()

    # Formatear evolución para Recharts (JSON)
    # Rellenar huecos con 0 si es necesario (opcional en frontend pero mejor aquí)
    evolution_map = {str(s.date): s.count for s in evolution_stats}
    chart_data = []
    
    curr = thirty_days_ago
    end = datetime.utcnow()
    while curr <= end:
        ds = curr.strftime('%Y-%m-%d')
        chart_data.append({
            'date': ds,
            'leads': evolution_map.get(ds, 0)
        })
        curr += timedelta(days=1)


    # 4. Agendas y Ventas (Atribución histórica completa)
    from app.models import FinancialAgenda, FinancialSale
    from sqlalchemy import String
    
    def normalize_ig(ig_str):
        if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
            return None
        return ig_str.strip().lstrip('@').lower()

    # IGs vinculados a este anuncio
    all_lead_igs = db.session.query(ManychatLead.ig).join(LeadAnswer, LeadAnswer.lead_id == ManychatLead.id)\
                   .filter(LeadAnswer.ad_id == ad_id, ManychatLead.ig != None).all()
    
    ad_igs = set()
    for row in all_lead_igs:
        ig_c = normalize_ig(row.ig)
        if ig_c: ad_igs.add(ig_c)

    ag_count = 0
    setter_breakdown = {}
    v_count = 0

    if ad_igs:
        # Una mejor forma es buscar por una lista de posibles valores (con y sin @)
        search_igs = list(ad_igs) + [f"@{ig}" for ig in ad_igs]
        
        # Agendas: Traemos solo las que tengan instagram en nuestra lista o algo en raw_data (si es pocos)
        # Para simplificar y ser seguros, filtramos por instagram en DB y luego refinamos en Python
        relevant_agendas = FinancialAgenda.query.filter(
            (FinancialAgenda.instagram.in_(search_igs)) |
            (FinancialAgenda.instagram != None) # Traemos las que tienen IG para procesar
        ).all()
        
        for ag in relevant_agendas:
            ig_val = ag.instagram or (ag.raw_data or {}).get('instagram') or (ag.raw_data or {}).get('ig')
            if normalize_ig(ig_val) in ad_igs:
                ag_count += 1
                sname = ag.lead or 'S/F'
                setter_breakdown[sname] = setter_breakdown.get(sname, 0) + 1

        # Ventas: Filtro similar
        relevant_sales = FinancialSale.query.filter(
            (FinancialSale.instagram.in_(search_igs)) |
            (FinancialSale.instagram != None)
        ).all()
        
        for sale in relevant_sales:
            ig_val = sale.instagram or (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')
            ig_n = normalize_ig(ig_val)
            if not ig_n or ig_n not in ad_igs: continue
            
            # Verificar si este IG tiene un lead en este anuncio previo a la venta
            matched_lead = ManychatLead.query.filter(func.lower(func.replace(ManychatLead.ig, '@', '')) == ig_n).first()
            if matched_lead:
                has_lead = LeadAnswer.query.filter(LeadAnswer.lead_id == matched_lead.id, LeadAnswer.ad_id == ad_id, LeadAnswer.created_at <= sale.date).first()
                if has_lead:
                    v_count += 1

    return jsonify({
        'ad_id': ad_id,
        'name': ad_name,
        'spend': total_spend,
        'total_leads': total_leads,
        'qualified_leads': qualified_leads,
        'qualified_percentage': qual_percent,
        'agendas': ag_count,
        'setter_breakdown': setter_breakdown,
        'ventas': v_count,
        'cpl': cpl,
        'cpql': cpql,
        'cpa': round(total_spend / ag_count, 2) if ag_count > 0 else 0,
        'cpv': round(total_spend / v_count, 2) if v_count > 0 else 0,
        'recent_leads': leads_list,
        'evolution': chart_data
    }), 200


@bp.route('/manychat-webhook/migrate', methods=['POST'])
def trigger_manychat_migration():
    """Ejecuta el script de migración para pasar la data vieja a las tablas nuevas."""
    from app.models import ManychatAdLead, ManychatLead, LeadAnswer
    
    try:
        old_leads = ManychatAdLead.query.order_by(ManychatAdLead.created_at.asc()).all()
        total_leads = len(old_leads)
        
        logger.info(f"[MIGRATION] Iniciando migración de {total_leads} registros desde ManychatAdLead")
        
        migrated_count = 0
        for i, old in enumerate(old_leads):
            # Buscar si el Lead ya se ha migrado
            lead = ManychatLead.query.filter_by(manychat_id=str(old.manychat_id)).first()
            
            if not lead:
                lead = ManychatLead(
                    manychat_id=str(old.manychat_id),
                    name=old.lead_name,
                    created_at=old.created_at,
                    updated_at=old.updated_at
                )
                db.session.add(lead)
                db.session.flush() # para obtener ID
            elif old.lead_name and not lead.name:
                lead.name = old.lead_name
                
            # Buscar si la Answer de ese evento ya está
            # No hay una FK estricta pero podemos ver si coincide el timestamp aproximado y ad_id
            answer = LeadAnswer.query.filter_by(
                lead_id=lead.id,
                ad_id=old.ad_id,
                created_at=old.created_at
            ).first()
            
            if not answer:
                answer = LeadAnswer(
                    lead_id=lead.id,
                    ad_id=old.ad_id,
                    keyword=old.keyword,
                    qualification=old.qualification,
                    created_at=old.created_at,
                    updated_at=old.updated_at
                )
                db.session.add(answer)
                migrated_count += 1
                
            if i > 0 and i % 50 == 0:
                db.session.commit()
                
        db.session.commit()
        return jsonify({
            "status": "success", 
            "message": f"Migración completada. Procesados {total_leads}. Interacciones insertadas: {migrated_count}."
        }), 200
        
    except Exception as e:
        db.session.rollback()
        error_details = traceback.format_exc()
        logger.error(f"[MIGRATION] ERROR: {str(e)}\n{error_details}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route('/manychat-webhook/cleanup-cuf', methods=['POST'])
def cleanup_cuf_data():
    """Limpia los campos 'variante' y 'opening' que contienen valores basura 'cuf_'."""
    from app.models import LeadAnswer
    
    try:
        # Buscar todos los registros que tengan 'cuf_' en variante u opening
        answers = LeadAnswer.query.filter(
            (LeadAnswer.variante.like('%cuf_%')) | (LeadAnswer.opening.like('%cuf_%'))
        ).all()
        
        count = 0
        for ans in answers:
            modified = False
            if ans.variante and 'cuf_' in ans.variante:
                ans.variante = None
                modified = True
            if ans.opening and 'cuf_' in ans.opening:
                ans.opening = None
                modified = True
                
            if modified:
                count += 1
                
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"Se han limpiado {count} registros con datos basura de ManyChat."
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CLEANUP CUF] ERROR: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
