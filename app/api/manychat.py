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

    # ----- Helper de validación selectiva -----
    def is_valid_value(val):
        if val is None:
            return False
        if isinstance(val, str):
            val_stripped = val.strip()
            # Evita registrar variables sin expandir o strings vacíos
            if val_stripped == "" or val_stripped.lower() in ('null', 'none', 'undefined', 'indeterminado'):
                return False
            if '{{' in val_stripped or '}}' in val_stripped or 'cuf_' in val_stripped:
                return False
        return True

    # ----- Datos del LEAD -----
    lead_name = data.get('lead_name', '')
    lead_ig = data.get('lead_ig', '')
    
    # Parse follower boolean
    follower_raw = data.get('follower')
    follower = False
    if str(follower_raw).lower() in ('true', '1', 'si', 'sí', 'yes'):
        follower = True

    # ----- Datos de la RESPUESTA (Answer) -----
    def clean_cuf(val):
        if val and isinstance(val, str) and ('cuf_' in val or '{{' in val):
            return None
        return val

    ad_id_raw = data.get('ad_id')
    keyword = data.get('keyword', '')
    fecha = clean_cuf(data.get('fecha', ''))
    opening = clean_cuf(data.get('opening', ''))
    variante = clean_cuf(data.get('variante', ''))
    qualification_raw = data.get('cualificacion')
    id_option = clean_cuf(data.get('id_option'))
    id_option_send = clean_cuf(data.get('id_option_send'))
    id_question = clean_cuf(data.get('id_question'))

    # Convertir ad_id a int de forma segura
    ad_id = None
    if ad_id_raw:
        try:
            ad_id = int(ad_id_raw)
        except (ValueError, TypeError):
            ad_id = None
            logger.warning(f"[WEBHOOK] ad_id no es un entero válido: '{ad_id_raw}', se guardará como None")

    # Intentar resolver ad_id por keyword si no viene explícito
    if not ad_id and is_valid_value(keyword):
        try:
            ad = Ad.query.filter_by(keyword=keyword, status='active').first()
            if ad:
                ad_id = ad.id
                logger.info(f"[WEBHOOK] ad_id resuelto por keyword '{keyword}': {ad_id}")
        except Exception:
            pass

    try:
        # 1. UPSERT LEAD
        lead = ManychatLead.query.filter_by(manychat_id=str(manychat_id)).first()
        if lead:
            # Actualiza solo si los valores entrantes son válidos
            if is_valid_value(lead_name): 
                lead.name = lead_name
            if is_valid_value(lead_ig): 
                lead.ig = lead_ig
            if follower_raw is not None: 
                lead.follower = follower
            
            raw_last_stage = data.get('last_stage')
            if raw_last_stage is not None and is_valid_value(raw_last_stage):
                try:
                    lead.last_stage = int(raw_last_stage)
                except (ValueError, TypeError):
                    pass
            logger.info(f"[WEBHOOK] ManychatLead actualizado selectivamente: {manychat_id}")
        else:
            # Crea el lead nuevo
            raw_last_stage = data.get('last_stage')
            parsed_last_stage = None
            if raw_last_stage is not None and is_valid_value(raw_last_stage):
                try:
                    parsed_last_stage = int(raw_last_stage)
                except (ValueError, TypeError):
                    pass
            
            lead = ManychatLead(
                manychat_id=str(manychat_id),
                name=lead_name if is_valid_value(lead_name) else None,
                ig=lead_ig if is_valid_value(lead_ig) else None,
                follower=follower,
                last_stage=parsed_last_stage
            )
            db.session.add(lead)
            db.session.flush()
            logger.info(f"[WEBHOOK] ManychatLead creado: {manychat_id} (ID DB: {lead.id})")

        # 2. DECISIÓN INTELIGENTE DE INSERCIÓN O ACTUALIZACIÓN (Deduplicación y acumulación)
        answer = None
        is_new_interaction = False
        from datetime import datetime

        # Obtiene la última interacción registrada de este lead
        latest_answer = LeadAnswer.query.filter_by(lead_id=lead.id).order_by(LeadAnswer.created_at.desc()).first()

        if latest_answer:
            # Ventana de sesión de 30 minutos
            time_diff = datetime.utcnow() - latest_answer.created_at
            within_window = time_diff.total_seconds() < 1800

            # Evalúa si los IDs son diferentes a la última interacción (sin considerar nulos como diferentes)
            different_send = is_valid_value(id_option_send) and latest_answer.id_option_send and latest_answer.id_option_send != str(id_option_send)
            different_resp = is_valid_value(id_option) and latest_answer.id_option and latest_answer.id_option != str(id_option)

            # Crea nuevo si cambia anuncio, mensajes o expira ventana temporal
            if (ad_id and latest_answer.ad_id != ad_id) or different_send or different_resp or not within_window:
                is_new_interaction = True
            else:
                answer = latest_answer  # Consolida en la misma interacción
        else:
            is_new_interaction = True

        if not is_new_interaction and answer:
            # ACTUALIZAR: Consolida la información en el registro actual
            if ad_id and not answer.ad_id:
                answer.ad_id = ad_id
            
            if is_valid_value(qualification_raw):
                qual_str = str(qualification_raw).lower()
                if qual_str in ('true', '1', 'si', 'sí', 'yes'):
                    answer.qualification = 'true'
                elif qual_str in ('false', '0', 'no'):
                    answer.qualification = 'false'
            
            if is_valid_value(fecha): 
                answer.fecha_recibida = fecha
            if is_valid_value(opening): 
                answer.opening = opening
            if is_valid_value(variante): 
                answer.variante = variante
            if is_valid_value(keyword): 
                answer.keyword = keyword
            if is_valid_value(id_option): 
                answer.id_option = str(id_option)
            if is_valid_value(id_option_send): 
                answer.id_option_send = str(id_option_send)
            if is_valid_value(id_question): 
                answer.id_question = str(id_question)
                
            action = 'updated'
            logger.info(f"[WEBHOOK] LeadAnswer de sesión actualizado selectivamente para Manychat_ID: {manychat_id}")
        else:
            # CREAR: Registra una nueva interacción independiente
            qual = 'null'
            if is_valid_value(qualification_raw):
                qual_str = str(qualification_raw).lower()
                if qual_str in ('true', '1', 'si', 'sí', 'yes'):
                    qual = 'true'
                elif qual_str in ('false', '0', 'no'):
                    qual = 'false'
            
            answer = LeadAnswer(
                lead_id=lead.id,
                ad_id=ad_id,
                keyword=keyword if is_valid_value(keyword) else None,
                fecha_recibida=fecha if is_valid_value(fecha) else None,
                opening=opening if is_valid_value(opening) else None,
                variante=variante if is_valid_value(variante) else None,
                qualification=qual,
                id_option=str(id_option) if is_valid_value(id_option) else None,
                id_option_send=str(id_option_send) if is_valid_value(id_option_send) else None,
                id_question=str(id_question) if is_valid_value(id_question) else None
            )
            db.session.add(answer)
            action = 'created'
            logger.info(f"[WEBHOOK] LeadAnswer nuevo creado (acumulativo) para Manychat_ID: {manychat_id}")

        db.session.commit()

        # Log de mensajes sin ConversationalMessage configurado
        if is_valid_value(id_option_send) or is_valid_value(id_option):
            from app.models import ConversationalMessage
            ids_to_check = []
            if is_valid_value(id_option_send): ids_to_check.append(str(id_option_send))
            if is_valid_value(id_option): ids_to_check.append(str(id_option))
            for mid in ids_to_check:
                exists = ConversationalMessage.query.filter_by(message_id=mid).first()
                if not exists:
                    logger.warning(f"[WEBHOOK] ID de mensaje sin configurar: '{mid}' (lead: {manychat_id}). Regístralo en Mensajes Conversacionales.")

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
        'id_option': ans.id_option,
        'id_option_send': ans.id_option_send,
        'id_question': ans.id_question,
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


@bp.route('/manychat-webhook/bulk-reassign/preview', methods=['POST'])
def preview_bulk_reassign():
    """Muestra cuántos leads coinciden con los filtros antes de moverlos."""
    from app.models import LeadAnswer
    from datetime import datetime
    
    data = request.get_json() or {}
    from_ad_id = data.get('from_ad_id')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if from_ad_id is None:
        return jsonify({"status": "error", "message": "from_ad_id es requerido"}), 400

    from_ad_id_val = int(from_ad_id) if str(from_ad_id).isdigit() else None
    if str(from_ad_id) == 'null' or str(from_ad_id) == '':
        query = LeadAnswer.query.filter(LeadAnswer.ad_id == None)
    else:
        query = LeadAnswer.query.filter(LeadAnswer.ad_id == from_ad_id_val)
    
    if start_date:
        try:
            st = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(LeadAnswer.created_at >= st)
        except ValueError:
            pass
            
    if end_date:
        try:
            ed = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            query = query.filter(LeadAnswer.created_at <= ed)
        except ValueError:
            pass
            
    count = query.count()
    return jsonify({"status": "success", "count": count}), 200


@bp.route('/manychat-webhook/bulk-reassign', methods=['POST'])
def execute_bulk_reassign():
    """Ejecuta la reasignación masiva de leads de un anuncio a otro."""
    from app.models import LeadAnswer
    from datetime import datetime
    
    data = request.get_json() or {}
    from_ad_id = data.get('from_ad_id')
    to_ad_id = data.get('to_ad_id')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if from_ad_id is None or to_ad_id is None:
        return jsonify({"status": "error", "message": "Faltan IDs de origen o destino"}), 400

    to_ad_id_val = int(to_ad_id) if str(to_ad_id).isdigit() else None
    from_ad_id_val = int(from_ad_id) if str(from_ad_id).isdigit() else None

    if str(from_ad_id) == 'null' or str(from_ad_id) == '':
        query = LeadAnswer.query.filter(LeadAnswer.ad_id == None)
    else:
        query = LeadAnswer.query.filter(LeadAnswer.ad_id == from_ad_id_val)
    
    limit_count = data.get('limit')
    
    if start_date:
        try:
            st = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(LeadAnswer.created_at >= st)
        except ValueError:
            pass
            
    if end_date:
        try:
            ed = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            query = query.filter(LeadAnswer.created_at <= ed)
        except ValueError:
            pass
            
    try:
        if limit_count and int(limit_count) > 0:
            limit_val = int(limit_count)
            # Fetch the specific IDs to update to support limit safely across DB dialects
            leads_to_update = query.order_by(LeadAnswer.created_at.desc()).limit(limit_val).all()
            ids_to_update = [l.id for l in leads_to_update]
            if not ids_to_update:
                return jsonify({"status": "error", "message": "No se encontraron leads para reasignar"}), 404
                
            updated_count = LeadAnswer.query.filter(LeadAnswer.id.in_(ids_to_update)).update({'ad_id': to_ad_id_val}, synchronize_session=False)
        else:
            updated_count = query.update({'ad_id': to_ad_id_val}, synchronize_session=False)
            
        db.session.commit()
        return jsonify({"status": "success", "message": f"{updated_count} leads reasignados con éxito."}), 200
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
    
    base_filters_options = [
        LeadAnswer.id_option != None,
        LeadAnswer.id_option != '',
        not_(LeadAnswer.id_option.like('%cuf_%'))
    ]

    base_filters_options_send = [
        LeadAnswer.id_option_send != None,
        LeadAnswer.id_option_send != '',
        not_(LeadAnswer.id_option_send.like('%cuf_%'))
    ]

    base_filters_questions = [
        LeadAnswer.id_question != None,
        LeadAnswer.id_question != '',
        not_(LeadAnswer.id_question.like('%cuf_%'))
    ]

    if start_date:
        try:
            st = datetime.strptime(start_date, '%Y-%m-%d')
            base_filters_variante.append(LeadAnswer.created_at >= st)
            base_filters_opening.append(LeadAnswer.created_at >= st)
            base_filters_options.append(LeadAnswer.created_at >= st)
            base_filters_options_send.append(LeadAnswer.created_at >= st)
            base_filters_questions.append(LeadAnswer.created_at >= st)
        except ValueError:
            pass
            
    if end_date:
        try:
            ed = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            base_filters_variante.append(LeadAnswer.created_at <= ed)
            base_filters_opening.append(LeadAnswer.created_at <= ed)
            base_filters_options.append(LeadAnswer.created_at <= ed)
            base_filters_options_send.append(LeadAnswer.created_at <= ed)
            base_filters_questions.append(LeadAnswer.created_at <= ed)
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

    # Agrupar por Opción
    stats_options = db.session.query(
        LeadAnswer.id_option,
        func.count(LeadAnswer.id).label('total_leads'),
        func.sum(
            db.case((LeadAnswer.qualification == 'true', 1), else_=0)
        ).label('qualified_leads')
    ).filter(*base_filters_options).group_by(LeadAnswer.id_option).all()

    # Agrupar por Opción Enviada (Performance de envío)
    stats_options_send = db.session.query(
        LeadAnswer.id_option_send,
        func.count(LeadAnswer.id).label('total_sends'),
        func.sum(
            db.case((LeadAnswer.id_option != None, 1), else_=0)
        ).label('total_responses'),
        func.sum(
            db.case((LeadAnswer.qualification == 'true', 1), else_=0)
        ).label('qualified_leads')
    ).filter(*base_filters_options_send).group_by(LeadAnswer.id_option_send).all()

    # Agrupar por Seguimiento
    stats_questions = db.session.query(
        LeadAnswer.id_question,
        func.count(LeadAnswer.id).label('total_leads'),
        func.sum(
            db.case((LeadAnswer.qualification == 'true', 1), else_=0)
        ).label('qualified_leads')
    ).filter(*base_filters_questions).group_by(LeadAnswer.id_question).all()

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

    def format_options_send_stats(stats_list):
        res = []
        for s in stats_list:
            total_s = s.total_sends
            total_r = int(s.total_responses or 0)
            qual = int(s.qualified_leads or 0)
            
            response_percent = round((total_r / total_s) * 100, 1) if total_s > 0 else 0
            qual_percent = round((qual / total_r) * 100, 1) if total_r > 0 else 0
            
            val = s.id_option_send
            if not val or '{{' in val: continue
            res.append({
                'name': val,
                'total_sends': total_s,
                'total_responses': total_r,
                'response_percentage': response_percent,
                'qualified_leads': qual,
                'qualified_percentage': qual_percent
            })
        res.sort(key=lambda x: x['total_sends'], reverse=True)
        return res

    return jsonify({
        'variantes': format_stats(stats_variante, 'variante'),
        'openings': format_stats(stats_opening, 'opening'),
        'options': format_stats(stats_options, 'id_option'),
        'options_send': format_options_send_stats(stats_options_send),
        'questions': format_stats(stats_questions, 'id_question')
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
    elif period == 'this_month':
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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
            # Usar 'lead' como la fuente/setter (es el tipo de llamada/evento en la DB real del usuario)
            source = ag.lead or 'S/F'
            agenda_igs_map.setdefault(ig_c, []).append(source)

    # Ventas
    sales_in_period = FinancialSale.query.filter(FinancialSale.date >= start_dt, FinancialSale.date <= end_dt).all()
    ventas_por_ad = {}
    cash_collect_data = {}
    ventas_sin_asignar = 0
    monto_sin_asignar = 0.0
    
    for sale in sales_in_period:
        ig_val = sale.instagram or (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')
        ig_n = normalize_ig(ig_val)
        
        matched_lead = None
        if ig_n:
            matched_lead = ManychatLead.query.filter(func.lower(func.replace(ManychatLead.ig, '@', '')) == ig_n).first()
        
        if not matched_lead:
            nombre_norm = (sale.nombre_cliente or '').strip().lower()
            if nombre_norm:
                matched_lead = ManychatLead.query.filter(
                    db.func.lower(ManychatLead.name) == nombre_norm
                ).first()
                
        if not matched_lead:
            ventas_sin_asignar += 1
            monto_sin_asignar += float(sale.monto or 0.0)
            continue
        
        # LeadAnswer más reciente ANTERIOR a la venta (Atribución global, no limitada a ad_ids del periodo)
        closest = LeadAnswer.query.filter(LeadAnswer.lead_id == matched_lead.id, LeadAnswer.ad_id != None, LeadAnswer.created_at <= sale.date)\
                 .order_by(LeadAnswer.created_at.desc()).first()
        if closest and closest.ad_id: 
            ventas_por_ad[closest.ad_id] = ventas_por_ad.get(closest.ad_id, 0) + 1
            
            # Cash Collect: Suma de todos los pagos atribuidos en el periodo
            if sale.monto and float(sale.monto) > 0:
                if closest.ad_id not in cash_collect_data:
                    cash_collect_data[closest.ad_id] = 0
                cash_collect_data[closest.ad_id] += float(sale.monto)
        else:
            ventas_sin_asignar += 1
            monto_sin_asignar += float(sale.monto or 0.0)

    # Agendas sin asignar
    agendas_sin_asignar = 0
    for ag in agendas_all:
        ig_val = ag.instagram or (ag.raw_data or {}).get('instagram') or (ag.raw_data or {}).get('ig')
        ig_norm = normalize_ig(ig_val)
        
        matched_lead = None
        if ig_norm:
            matched_lead = ManychatLead.query.filter(
                db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_norm
            ).first()
            
        if not matched_lead:
            nombre_norm = (ag.nombre or '').strip().lower()
            if nombre_norm:
                matched_lead = ManychatLead.query.filter(
                    db.func.lower(ManychatLead.name) == nombre_norm
                ).first()
                
        if not matched_lead:
            agendas_sin_asignar += 1
            continue
            
        closest = LeadAnswer.query.filter(
            LeadAnswer.lead_id == matched_lead.id,
            LeadAnswer.ad_id != None,
            LeadAnswer.created_at <= ag.date
        ).order_by(LeadAnswer.created_at.desc()).first()
        
        if not closest or not closest.ad_id:
            agendas_sin_asignar += 1

    # 4. CONSOLIDAR TODOS LOS ANUNCIOS (con leads o con ventas)
    all_active_ad_ids = set(ad_ids) | set(ventas_por_ad.keys())
    
    # Asegurar que tenemos todos los modelos de anuncios necesarios
    missing_ad_ids = [aid for aid in all_active_ad_ids if aid not in ads_map]
    if missing_ad_ids:
        missing_ads = Ad.query.filter(Ad.id.in_(missing_ad_ids)).all()
        for a in missing_ads:
            ads_map[a.id] = a
            # Actualizar también mapas de jerarquía si es necesario
            if a.ad_set_id not in adset_map:
                s = AdSet.query.get(a.ad_set_id)
                if s: 
                    adset_map[s.id] = s
                    if s.campaign_id not in campaign_map_by_id:
                        c = Campaign.query.get(s.campaign_id)
                        if c: campaign_map_by_id[c.id] = c

    # Mapeo de leads para facilitar el loop
    lead_stats_map = {s.ad_id: s for s in stats}

    result = []
    for ad_id in all_active_ad_ids:
        s_data = lead_stats_map.get(ad_id)
        total = s_data.total_leads if s_data else 0
        qual = int(s_data.qualified_leads or 0) if s_data else 0
        
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
        
        # Total Cash Collect
        cash_collect = round(cash_collect_data.get(ad_id, 0), 2)
        
        # CPV
        cpv = round(spend / v_count, 2) if v_count > 0 else 0
        
        # ROAS (Cash Collect / Inversión)
        roas = round(cash_collect / spend, 2) if spend > 0 else 0

        # Obtener nombres de campaña y conjunto de anuncios
        ad_set_name = None
        campaign_name = None
        if ad and ad.ad_set_id:
            ad_set = adset_map.get(ad.ad_set_id)
            if ad_set:
                ad_set_name = ad_set.name
                campaign = campaign_map_by_id.get(ad_set.campaign_id)
                if campaign:
                    campaign_name = campaign.name

        result.append({
            'ad_id': ad_id,
            'ad_name': ad_name,
            'ad_set_name': ad_set_name,
            'campaign_name': campaign_name,
            'total_leads': total,
            'qualified_leads': qual,
            'qualified_percentage': round((qual / total) * 100, 1) if total > 0 else 0,
            'spend': spend,
            'agendas': ag_count,
            'setter_breakdown': setter_breakdown,
            'ventas': v_count,
            'cpl': round(spend / total, 2) if total > 0 else 0,
            'cpql': round(spend / qual, 2) if qual > 0 else 0,
            'cpa': round(spend / ag_count, 2) if ag_count > 0 else 0,
            'cpv': cpv,
            'cash_collect': cash_collect,
            'roas': roas
        })

    # Fila especial "Ventas desatribuidas"
    if agendas_sin_asignar > 0 or ventas_sin_asignar > 0 or monto_sin_asignar > 0:
        result.append({
            'ad_id': 0,
            'ad_name': 'Ventas desatribuidas',
            'ad_set_name': None,
            'campaign_name': None,
            'total_leads': 0,
            'qualified_leads': 0,
            'qualified_percentage': 0.0,
            'spend': 0.0,
            'agendas': agendas_sin_asignar,
            'setter_breakdown': {},
            'ventas': ventas_sin_asignar,
            'cpl': 0.0,
            'cpql': 0.0,
            'cpa': 0.0,
            'cpv': 0.0,
            'cash_collect': round(monto_sin_asignar, 2),
            'roas': 0.0
        })


    # Global Setter Stats (Agendas + Ventas)
    global_setters = {}
    
    # Construir mapa completo de Instagram normalizado -> Setter/Fuente de la Agenda
    all_agendas_db = FinancialAgenda.query.all()
    agenda_setter_map = {}
    for ag in all_agendas_db:
        ig_val = ag.instagram or (ag.raw_data or {}).get('instagram') or (ag.raw_data or {}).get('ig')
        ig_c = normalize_ig(ig_val)
        if ig_c:
            # Validar si el lead de la agenda es una fuente/setter de marketing válida
            is_valid_lead_source = (
                ag.lead and 
                ag.lead.strip() and 
                ag.lead.lower() not in ('s/f', 'n/a', '') and 
                'entrevista' not in ag.lead.lower() and 
                'diagnostica' not in ag.lead.lower() and
                'diagnóstica' not in ag.lead.lower()
            )
            if is_valid_lead_source:
                if ig_c not in agenda_setter_map or (ag.date and agenda_setter_map[ig_c].date and ag.date > agenda_setter_map[ig_c].date):
                    agenda_setter_map[ig_c] = ag.lead
    
    # Agendas por Setter/Fuente
    for ag in agendas_all:
        sname = ag.lead or 'S/F'
        if sname not in global_setters:
            global_setters[sname] = {'agendas': 0, 'ventas': 0}
        global_setters[sname]['agendas'] += 1
        
    # Ventas por Setter resuelto
    for sale in sales_in_period:
        ig_val = sale.instagram or (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')
        ig_n = normalize_ig(ig_val)
        
        resolved_setter = None
        if ig_n and ig_n in agenda_setter_map:
            resolved_setter = agenda_setter_map[ig_n]
            
        if not resolved_setter:
            s_setter = sale.setter
            if s_setter and s_setter.strip() and s_setter != 'Sin Setter' and s_setter != 'Confirmada':
                resolved_setter = s_setter
                
        sname = resolved_setter or 'Sin Setter'
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
    cash_collect = 0

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
                    if sale.monto:
                        cash_collect += float(sale.monto)

    # Analysis of Conversational Options & Questions
    options_query = db.session.query(LeadAnswer.id_option, func.count(LeadAnswer.id)).filter(
        LeadAnswer.ad_id == ad_id, LeadAnswer.id_option != None
    ).group_by(LeadAnswer.id_option).all()
    
    option_breakdown = {"Opción 1": 0, "Opción 2": 0, "Opción 3": 0}
    for opt, count in options_query:
        if not opt: continue
        opt_str = str(opt).strip()
        if opt_str == '1': option_breakdown["Opción 1"] += count
        elif opt_str == '2': option_breakdown["Opción 2"] += count
        elif opt_str == '3': option_breakdown["Opción 3"] += count
        else:
            key = f"Opción {opt_str}"
            option_breakdown[key] = option_breakdown.get(key, 0) + count

    questions_query = db.session.query(LeadAnswer.id_question, func.count(LeadAnswer.id)).filter(
        LeadAnswer.ad_id == ad_id, LeadAnswer.id_question != None
    ).group_by(LeadAnswer.id_question).all()
    
    question_breakdown = {"Seguimiento 1": 0, "Seguimiento 2": 0, "Seguimiento 3": 0}
    for q, count in questions_query:
        if not q: continue
        q_str = str(q).strip()
        if q_str == '1': question_breakdown["Seguimiento 1"] += count
        elif q_str == '2': question_breakdown["Seguimiento 2"] += count
        elif q_str == '3': question_breakdown["Seguimiento 3"] += count
        else:
            key = f"Seguimiento {q_str}"
            question_breakdown[key] = question_breakdown.get(key, 0) + count

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
        'cash_collect': round(cash_collect, 2),
        'roas': round(cash_collect / total_spend, 2) if total_spend > 0 else 0,
        'option_breakdown': option_breakdown,
        'question_breakdown': question_breakdown,
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
        # Buscar todos los registros que tengan 'cuf_' en cualquier campo de texto del webhook
        answers = LeadAnswer.query.filter(
            (LeadAnswer.variante.like('%cuf_%')) | 
            (LeadAnswer.opening.like('%cuf_%')) |
            (LeadAnswer.id_option.like('%cuf_%')) |
            (LeadAnswer.id_question.like('%cuf_%')) |
            (LeadAnswer.fecha_recibida.like('%cuf_%'))
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
            if ans.id_option and 'cuf_' in ans.id_option:
                ans.id_option = None
                modified = True
            if ans.id_question and 'cuf_' in ans.id_question:
                ans.id_question = None
                modified = True
            if ans.fecha_recibida and 'cuf_' in ans.fecha_recibida:
                ans.fecha_recibida = None
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


@bp.route('/manychat-webhook/cleanup-duplicates', methods=['POST'])
def cleanup_duplicates():
    """Busca leads con múltiples interacciones en <24h, los fusiona y elimina los sobrantes."""
    from app.models import LeadAnswer
    from datetime import timedelta
    
    try:
        answers = LeadAnswer.query.order_by(LeadAnswer.lead_id, LeadAnswer.created_at.asc()).all()
        
        to_delete = []
        merged_count = 0
        last_lead_id = None
        last_ans = None
        
        for ans in answers:
            if ans.lead_id != last_lead_id:
                last_lead_id = ans.lead_id
                last_ans = ans
                continue
                
            # Es el mismo lead. Verificamos si la diferencia de tiempo es menor a 24 horas.
            # (Asumimos que created_at siempre existe, pero por si acaso lo validamos)
            if ans.created_at and last_ans.created_at and (ans.created_at - last_ans.created_at) < timedelta(hours=24):
                # Es un duplicado. Fusionamos la data útil hacia el "last_ans"
                if not last_ans.ad_id and ans.ad_id: last_ans.ad_id = ans.ad_id
                if last_ans.qualification in ('null', None) and ans.qualification not in ('null', None): 
                    last_ans.qualification = ans.qualification
                if not last_ans.variante and ans.variante: last_ans.variante = ans.variante
                if not last_ans.opening and ans.opening: last_ans.opening = ans.opening
                if not last_ans.keyword and ans.keyword: last_ans.keyword = ans.keyword
                
                # Marcamos el actual (más reciente) para borrar
                to_delete.append(ans)
                merged_count += 1
            else:
                # Es un lead legítimo en una nueva fecha (más de 24h después)
                last_ans = ans
                
        for ans in to_delete:
            db.session.delete(ans)
            
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"Limpieza completada. Se fusionaron y eliminaron {merged_count} registros duplicados."
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CLEANUP DUPLICATES] ERROR: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def check_and_replace_momentary_leads():
    """Busca leads en la bolsa de reasignación y reemplaza leads momentáneos con ellos."""
    from app.models import LeadAnswer, ManychatLead
    
    # Encontrar leads en la bolsa (ad_id = None) que NO sean momentáneos
    bolsa_answers = LeadAnswer.query.join(ManychatLead).filter(
        LeadAnswer.ad_id == None,
        ~ManychatLead.manychat_id.like('MOMENTARY-%')
    ).order_by(LeadAnswer.created_at.asc()).all()

    if not bolsa_answers:
        return 0
        
    # Encontrar leads momentáneos que estén ocupando un lugar en algún anuncio
    momentary_answers = LeadAnswer.query.join(ManychatLead).filter(
        ManychatLead.manychat_id.like('MOMENTARY-%')
    ).order_by(LeadAnswer.created_at.asc()).all()
    
    if not momentary_answers:
        return 0
        
    replaced_count = 0
    
    for m_ans in momentary_answers:
        if not bolsa_answers:
            break
            
        real_ans = bolsa_answers.pop(0)
        
        # Le pasamos el ad_id del momentáneo al lead real
        real_ans.ad_id = m_ans.ad_id
        # Modificamos la fecha del lead real para que cuadre en el día donde hacía falta
        real_ans.created_at = m_ans.created_at
        
        # Eliminamos el momentáneo
        m_lead = m_ans.lead
        db.session.delete(m_ans)
        db.session.delete(m_lead)
        
        replaced_count += 1
        
    return replaced_count


@bp.route('/marketing/ads/<int:ad_id>/adjust-leads', methods=['POST'])
def adjust_daily_leads(ad_id):
    """
    Ajusta la cantidad de leads de un anuncio en una fecha específica.
    Usa la bolsa de reasignación y leads momentáneos para balancear.
    """
    from app.models import LeadAnswer, ManychatLead
    from datetime import datetime
    import uuid
    
    data = request.get_json() or {}
    target_date_str = data.get('date')
    target_count = data.get('target_count')
    
    if not target_date_str or target_count is None:
        return jsonify({"status": "error", "message": "Faltan datos (date, target_count)"}), 400
        
    try:
        target_count = int(target_count)
        if target_count < 0:
            raise ValueError
    except ValueError:
        return jsonify({"status": "error", "message": "target_count debe ser un número entero positivo"}), 400
        
    try:
        st = datetime.strptime(target_date_str, '%Y-%m-%d')
        ed = st.replace(hour=23, minute=59, second=59)
    except ValueError:
        return jsonify({"status": "error", "message": "Formato de fecha inválido (YYYY-MM-DD)"}), 400
        
    try:
        # Obtener leads actuales de este anuncio en este día
        current_answers = LeadAnswer.query.filter(
            LeadAnswer.ad_id == ad_id,
            LeadAnswer.created_at >= st,
            LeadAnswer.created_at <= ed
        ).order_by(LeadAnswer.created_at.desc()).all()
        
        current_count = len(current_answers)
        diff = target_count - current_count
        
        actions_taken = []
        
        if diff == 0:
            return jsonify({"status": "success", "message": "La cantidad de leads ya es la deseada."}), 200
            
        if diff < 0:
            # Sobran leads. Mover los excesos a la bolsa de reasignación.
            excess = abs(diff)
            to_remove = current_answers[:excess] # Tomamos los últimos N
            for ans in to_remove:
                ans.ad_id = None # A la bolsa
            
            actions_taken.append(f"Se movieron {excess} leads a la bolsa de reasignación.")
            
            # Al mover a la bolsa, puede que haya momentáneos esperando en otros lados
            db.session.flush() # Flush para que check_and_replace los vea
            replaced = check_and_replace_momentary_leads()
            if replaced > 0:
                actions_taken.append(f"Se usaron {replaced} de esos leads para rellenar comodines previos.")
                
        elif diff > 0:
            # Faltan leads. Buscar en la bolsa primero.
            bolsa_answers = LeadAnswer.query.join(ManychatLead).filter(
                LeadAnswer.ad_id == None,
                ~ManychatLead.manychat_id.like('MOMENTARY-%')
            ).order_by(LeadAnswer.created_at.asc()).limit(diff).all()
            
            used_from_bolsa = len(bolsa_answers)
            for ans in bolsa_answers:
                ans.ad_id = ad_id
                ans.created_at = st.replace(hour=12) # Ajustar la fecha al día que faltan
                
            if used_from_bolsa > 0:
                actions_taken.append(f"Se tomaron {used_from_bolsa} leads de la bolsa de reasignación.")
                
            remaining = diff - used_from_bolsa
            if remaining > 0:
                # Faltan crear momentáneos
                for _ in range(remaining):
                    momentary_lead = ManychatLead(
                        manychat_id=f"MOMENTARY-{uuid.uuid4().hex[:8]}",
                        name="[REASIGNACION]",
                        ig="N/A",
                        follower=False
                    )
                    db.session.add(momentary_lead)
                    db.session.flush()
                    
                    momentary_ans = LeadAnswer(
                        lead_id=momentary_lead.id,
                        ad_id=ad_id,
                        qualification='null',
                        created_at=st.replace(hour=12)
                    )
                    db.session.add(momentary_ans)
                    
                actions_taken.append(f"Se crearon {remaining} comodines momentáneos.")
                
        db.session.commit()
        return jsonify({
            "status": "success", 
            "message": " ".join(actions_taken)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        logger.error(f"[ADJUST LEADS] ERROR: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": str(e)}), 500
