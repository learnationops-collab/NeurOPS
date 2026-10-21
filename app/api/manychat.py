from flask import Blueprint, request, jsonify
from app import db
from app.decorators import require_manychat_token
import logging
import traceback

logger = logging.getLogger(__name__)

bp = Blueprint('manychat', __name__)

# Los nombres con los que ManyChat puede mandar la calificación (ver `receive_manychat_ad_lead`).
CAMPOS_DE_CALIFICACION = ('cualificacion', 'cualificado', 'calificacion', 'calificado', 'cualificada', 'calificada')


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
    # La calificación de ManyChat: «yes» por la rama de calificado, «no» por la de no calificado (Kerwin,
    # 16/10/2026). El campo se llamó `cualificacion` y en el flujo se lo nombra «cualificado»: se acepta
    # cualquiera de las escrituras, la primera que traiga un valor de verdad.
    qualification_raw = next((data.get(k) for k in CAMPOS_DE_CALIFICACION if is_valid_value(data.get(k))),
                             data.get('cualificacion'))
    # Qué manda ManyChat, sin datos personales: los nombres de los campos y los valores que deciden la
    # calificación y el paso del flujo. Desde el 28/07/2026 casi nadie llega «no» y hay que ver por qué.
    logger.warning('[WEBHOOK CALIFICACION] campos=%s calificacion=%s opcion_enviada=%s opcion_respondida=%s',
                   sorted(data.keys()), {k: data.get(k) for k in CAMPOS_DE_CALIFICACION if k in data},
                   data.get('id_option_send'), data.get('id_option'))
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

        # Sin calificación de ManyChat, la que deja la rama del mensaje enviado («¿Qué quiere mejorar?»
        # es de los descalificados, 18/10/2026).
        if answer is not None:
            from app.services import rama_mensajes
            rama_mensajes.aplicar_a(answer)

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


# Las demás rutas del blueprint (se importan acá, después de definir `bp`).
from app.api import manychat_monitor, manychat_mantenimiento  # noqa: E402,F401
