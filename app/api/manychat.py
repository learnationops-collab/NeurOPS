from flask import Blueprint, request, jsonify
from flask_login import current_user
from app import db
from app.decorators import require_manychat_token
from app.services.setter_assignment_service import condicion_leads_visibles
import logging
import traceback

logger = logging.getLogger(__name__)

bp = Blueprint('manychat', __name__)


@bp.route('/manychat-webhook', methods=['GET'], strict_slashes=False)
def verificar_manychat_webhook():
    """Verificación de URL por ManyChat: sigue abierta (no lee ni escribe nada)."""
    return jsonify({"status": "ok", "message": "Webhook activo"}), 200


@bp.route('/manychat-webhook', methods=['POST'], strict_slashes=False)
@require_manychat_token
def receive_manychat_ad_lead():
    """
    Recibe un lead de ManyChat y lo vincula a un anuncio.
    Maneja el Lead (ManychatLead) y su respuesta/interacción (LeadAnswer)
    Exige el header 'X-ManyChat-Token' con el valor de MANYCHAT_WEBHOOK_TOKEN (el mismo secreto que
    /api/webhooks/manychat): desde el 14/10/2026 una palabra clave nueva crea un anuncio. Sin la variable
    responde 503; con INTEGRATIONS_AUTH_MODE=log_only pasa igual y lo registra.
    """
    from app.models import ManychatLead, LeadAnswer

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

    def resolve_qualification(val):
        if not is_valid_value(val):
            return 'null'
        v = str(val).lower().strip()
        # Casos positivos
        if v in ('true', '1', 'si', 'sí', 'yes', 'y', 'qualified', 'cualificado', 'cualificada') or v.startswith('si ') or v.startswith('sí ') or v.startswith('yes '):
            return 'true'
        # Casos negativos
        if v in ('false', '0', 'no', 'n', 'disqualified', 'descalificado', 'descalificada') or v.startswith('no ') or v.startswith('no_') or v.startswith('no-') or v.startswith('descalificado') or v.startswith('descalificada'):
            return 'false'
        return 'null'

    # ----- Datos del LEAD -----
    lead_name = data.get('lead_name', '')
    lead_ig = data.get('lead_ig', '')
    # ManyChat reparte el lead entre los setters: los 2 primeros JSON de la
    # conversación traen esta variable vacía y de ahí en adelante llega el nombre.
    setter_name = data.get('setter')

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

    # Normalizar explícitamente "0" o 0
    if id_option is not None and str(id_option).strip() in ('0', '0.0'):
        id_option = '0'
    if id_option_send is not None and str(id_option_send).strip() in ('0', '0.0'):
        id_option_send = '0'

    # Convertir ad_id a int de forma segura
    ad_id = None
    if ad_id_raw:
        try:
            ad_id = int(ad_id_raw)
        except (ValueError, TypeError):
            ad_id = None
            logger.warning(f"[WEBHOOK] ad_id no es un entero válido: '{ad_id_raw}', se guardará como None")

    try:
        # El anuncio sale de la palabra clave (14/10/2026): ya no se registra antes a mano. Si es nueva,
        # se crea (ver anuncios_service.anuncio_de_keyword). Un ad_id explícito (flujos viejos) manda.
        if not ad_id and is_valid_value(keyword):
            from app.services.anuncios_service import anuncio_de_keyword
            ad = anuncio_de_keyword(keyword)
            if ad:
                ad_id = ad.id

        def calificacion_nueva(actual):
            # Un webhook sin `cualificacion` (o con la variable vacía) no borra la que ya se sabía.
            nueva = resolve_qualification(qualification_raw)
            return actual if nueva == 'null' and actual in ('true', 'false') else nueva

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
            if is_valid_value(setter_name):
                lead.setter = str(setter_name).strip()

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
                last_stage=parsed_last_stage,
                setter=str(setter_name).strip() if is_valid_value(setter_name) else None
            )
            db.session.add(lead)
            db.session.flush()
            logger.info(f"[WEBHOOK] ManychatLead creado: {manychat_id} (ID DB: {lead.id})")

        # 2. DECISIÓN INTELIGENTE DE INSERCIÓN O ACTUALIZACIÓN (Deduplicación y acumulación)
        answer = None
        action = 'created'
        from datetime import datetime

        opt_send_str = str(id_option_send).strip() if id_option_send is not None else ""
        opt_str = str(id_option).strip() if id_option is not None else ""

        is_mc_response = (opt_send_str == '0')
        is_mc_send = (opt_str == '0')

        if is_mc_response:
            # El Lead respondió al mensaje con ID opt_str.
            # Buscamos un envío reciente (en los últimos 30 minutos) que coincida con este mensaje (id_option_send == opt_str)
            # y que todavía no tenga una respuesta registrada (id_option == '0' o similar)
            latest_send = LeadAnswer.query.filter(
                LeadAnswer.lead_id == lead.id,
                LeadAnswer.id_option_send == opt_str,
                (LeadAnswer.id_option == '0') | (LeadAnswer.id_option == None) | (LeadAnswer.id_option == '')
            ).order_by(LeadAnswer.created_at.desc()).first()

            within_window = False
            if latest_send:
                time_diff = datetime.utcnow() - latest_send.created_at
                within_window = time_diff.total_seconds() < 1800
                # La respuesta a un envío de OTRO anuncio no se mezcla con él: es otra conversación
                # (antes le pisaba la palabra clave al envío y el lead quedaba en el anuncio equivocado).
                if ad_id and latest_send.ad_id and latest_send.ad_id != ad_id:
                    within_window = False

            if latest_send and within_window:
                # Consolidamos la respuesta del Lead en el registro de envío existente
                answer = latest_send
                answer.id_option = opt_str

                # Procesar cualificación
                answer.qualification = calificacion_nueva(answer.qualification)

                # Sincronizar otros campos si vienen
                if is_valid_value(fecha): 
                    answer.fecha_recibida = fecha
                if is_valid_value(opening): 
                    answer.opening = opening
                if is_valid_value(variante): 
                    answer.variante = variante
                if is_valid_value(keyword): 
                    answer.keyword = keyword
                if is_valid_value(id_question): 
                    answer.id_question = str(id_question)
                if ad_id and not answer.ad_id:
                    answer.ad_id = ad_id

                action = 'updated'
                logger.info(f"[WEBHOOK] Respuesta de Lead consolidada en envío previo para Manychat_ID: {manychat_id}")
            else:
                # Crear nueva interacción como respuesta aislada
                qual = resolve_qualification(qualification_raw)

                answer = LeadAnswer(
                    lead_id=lead.id,
                    ad_id=ad_id,
                    keyword=keyword if is_valid_value(keyword) else None,
                    fecha_recibida=fecha if is_valid_value(fecha) else None,
                    opening=opening if is_valid_value(opening) else None,
                    variante=variante if is_valid_value(variante) else None,
                    qualification=qual,
                    id_option=opt_str,
                    id_option_send='0',
                    id_question=str(id_question) if is_valid_value(id_question) else None
                )
                db.session.add(answer)
                action = 'created'
                logger.info(f"[WEBHOOK] Respuesta de Lead creada como nuevo registro (sin envío previo encontrado) para Manychat_ID: {manychat_id}")
        
        elif is_mc_send:
            # Es un envío de mensaje. Registramos el envío con qualification='null' (no califica todavía)
            answer = LeadAnswer(
                lead_id=lead.id,
                ad_id=ad_id,
                keyword=keyword if is_valid_value(keyword) else None,
                fecha_recibida=fecha if is_valid_value(fecha) else None,
                opening=opening if is_valid_value(opening) else None,
                variante=variante if is_valid_value(variante) else None,
                qualification='null',
                id_option='0',
                id_option_send=opt_send_str,
                id_question=str(id_question) if is_valid_value(id_question) else None
            )
            db.session.add(answer)
            action = 'created'
            logger.info(f"[WEBHOOK] Envío de mensaje registrado para Manychat_ID: {manychat_id}")

        else:
            # Lógica genérica heredada
            latest_answer = LeadAnswer.query.filter_by(lead_id=lead.id).order_by(LeadAnswer.created_at.desc()).first()
            is_new_interaction = False

            if latest_answer:
                time_diff = datetime.utcnow() - latest_answer.created_at
                within_window = time_diff.total_seconds() < 1800
                different_send = is_valid_value(id_option_send) and latest_answer.id_option_send and latest_answer.id_option_send != str(id_option_send)
                different_resp = is_valid_value(id_option) and latest_answer.id_option and latest_answer.id_option != str(id_option)
                if (ad_id and latest_answer.ad_id != ad_id) or different_send or different_resp or not within_window:
                    is_new_interaction = True
                else:
                    answer = latest_answer
            else:
                is_new_interaction = True

            if not is_new_interaction and answer:
                if ad_id and not answer.ad_id:
                    answer.ad_id = ad_id
                answer.qualification = calificacion_nueva(answer.qualification)
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
            else:
                qual = resolve_qualification(qualification_raw)
                
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

        db.session.commit()

        # Log de mensajes sin ConversationalMessage configurado (ignorando '0' y '0.0' que indican envío/respuesta estándar)
        if is_valid_value(id_option_send) or is_valid_value(id_option):
            from app.models import ConversationalMessage
            ids_to_check = []
            if is_valid_value(id_option_send) and str(id_option_send).strip() not in ('0', '0.0'):
                ids_to_check.append(str(id_option_send).strip())
            if is_valid_value(id_option) and str(id_option).strip() not in ('0', '0.0'):
                ids_to_check.append(str(id_option).strip())
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

    query = LeadAnswer.query
    # Cada setter solo ve los leads que ManyChat le repartió (más los que
    # todavía no tienen asignación).
    condicion = condicion_leads_visibles(current_user)
    if condicion is not None:
        query = query.join(ManychatLead, ManychatLead.id == LeadAnswer.lead_id).filter(condicion)

    # Traemos las respuestas ordenadas por creación
    answers = query.order_by(LeadAnswer.created_at.desc()).limit(limit).all()

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
        'setter': ans.lead.setter,
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


@bp.route('/manychat-webhook/answer/<int:answer_id>', methods=['PUT'])
def update_ad_lead(answer_id):
    """Permite editar manualmente una respuesta/lead en el monitor."""
    from app.models import LeadAnswer
    
    answer = LeadAnswer.query.get_or_404(answer_id)
    data = request.get_json() or {}

    # Editar datos de la interacción
    if 'qualification' in data: answer.qualification = data.get('qualification')
    if 'keyword' in data:
        keyword_val = data.get('keyword')
        answer.keyword = keyword_val
        # Si se edita la palabra clave, intentar resolver el ad_id correspondiente
        if keyword_val:
            from app.models import Ad
            ad = Ad.query.filter_by(keyword=keyword_val).first()
            if ad:
                answer.ad_id = ad.id
            else:
                answer.ad_id = None
        else:
            answer.ad_id = None

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
