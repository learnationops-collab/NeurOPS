"""Correcciones a mano de los webhooks de ManyChat: editar, reasignar en lote y limpiar `cuf_` (rutas de `manychat.bp`)."""
from flask import request, jsonify
from app import db
from app.api.manychat import bp, logger


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
