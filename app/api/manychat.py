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
            logger.info(f"[WEBHOOK] ManychatLead actualizado: {manychat_id}")
        else:
            # Lo creamos
            lead = ManychatLead(
                manychat_id=str(manychat_id),
                name=lead_name,
                ig=lead_ig,
                follower=follower
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
    """Retorna leads totales, % cualificados y métricas financieras agrupadas por ad_id."""
    from app.models import LeadAnswer, Ad
    from sqlalchemy import func

    # Query principal: Leads
    stats = db.session.query(
        LeadAnswer.ad_id,
        func.count(LeadAnswer.id).label('total_leads'),
        func.sum(
            db.case((LeadAnswer.qualification == 'true', 1), else_=0)
        ).label('qualified_leads')
    ).filter(
        LeadAnswer.ad_id != None
    ).group_by(LeadAnswer.ad_id).all()

    # Cargar datos de anuncios
    ad_ids = [s.ad_id for s in stats]
    ads_map = {}
    if ad_ids:
        ads = Ad.query.filter(Ad.id.in_(ad_ids)).all()
        ads_map = {a.id: a for a in ads}

    result = []
    for s in stats:
        total = s.total_leads
        qual = int(s.qualified_leads or 0)
        qual_percent = round((qual / total) * 100, 1) if total > 0 else 0
        
        ad = ads_map.get(s.ad_id)
        ad_name = ad.name if ad else f"Anuncio Desconocido (#{s.ad_id})"
        spend = ad.total_spend if ad else 0
        
        cpl = round(spend / total, 2) if total > 0 else 0
        cpql = round(spend / qual, 2) if qual > 0 else 0

        result.append({
            'ad_id': s.ad_id,
            'ad_name': ad_name,
            'total_leads': total,
            'qualified_leads': qual,
            'qualified_percentage': qual_percent,
            'spend': spend,
            'cpl': cpl,
            'cpql': cpql
        })

    # Ordenar por volumen de leads (descendente)
    result.sort(key=lambda x: x['total_leads'], reverse=True)

    return jsonify(result), 200

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

    return jsonify({
        'ad_id': ad_id,
        'name': ad_name,
        'spend': total_spend,
        'total_leads': total_leads,
        'qualified_leads': qualified_leads,
        'qualified_percentage': qual_percent,
        'cpl': cpl,
        'cpql': cpql,
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
