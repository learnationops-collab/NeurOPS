from flask import Blueprint, request, jsonify
from app import db
from app.models.marketing import LandingTracking
from flask_login import login_required
from app.decorators import admin_required
import logging

bp = Blueprint('metrics', __name__)

# Lo que institute-site puede reportar por track-visit. Cualquier otro valor (o
# ninguno) es una visita: asi una landing vieja que no manda `evento` sigue igual.
EVENTO_VISITA = 'visita'
EVENTO_CLIC_WHATSAPP = 'clic_whatsapp'
EVENTOS_VALIDOS = {EVENTO_VISITA, EVENTO_CLIC_WHATSAPP}

@bp.route('/track-visit', methods=['POST'])
def track_visit():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Obtener el path del dato enviado o del referrer
        data_path = data.get('page_path') or data.get('path')
        
        # Priorizar el dato explícito enviado desde el frontend
        if data_path and data_path != '/':
            raw_path = data_path
        else:
            # Solo si no hay path o es '/', intentamos usar el referrer
            raw_path = data_path or request.referrer or '/'
            if request.referrer and (not data_path or data_path == '/'):
                raw_path = request.referrer

        tracking = LandingTracking(
            utm_source=data.get('utm_source'),
            utm_medium=data.get('utm_medium'),
            utm_campaign=data.get('utm_campaign'),
            utm_content=data.get('utm_content'),
            page_path=raw_path,
            referrer=request.referrer,
            evento=data.get('evento') if data.get('evento') in EVENTOS_VALIDOS else EVENTO_VISITA
        )
        db.session.add(tracking)
        db.session.commit()

        logging.info(f"Visita de landing registrada exitosamente: {data.get('page_path')} - Source: {data.get('utm_source')}")
        
        return jsonify({
            "status": "success",
            "message": "Visit tracked successfully", 
            "id": tracking.id
        }), 201

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error al registrar visita de landing: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Internal server error"
        }), 500

@bp.route('/track-visits', methods=['GET'])
@login_required
@admin_required
def get_track_visits():
    try:
        from datetime import datetime, time
        
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        # Solo visitas: los clics al grupo de WhatsApp se cuentan en la pestaña
        # «Tráfico landings» del panel de talleres, no como cargas de pagina.
        query = LandingTracking.query.filter(
            db.or_(LandingTracking.evento.is_(None), LandingTracking.evento == EVENTO_VISITA)
        )
        
        # Filtrar por fecha de inicio si se proporciona (YYYY-MM-DD)
        if start_date_str:
            try:
                start_dt = datetime.strptime(start_date_str, '%Y-%m-%d')
                query = query.filter(LandingTracking.created_at >= datetime.combine(start_dt, time.min))
            except ValueError:
                logging.warning(f"Formato de start_date invalido: {start_date_str}")
        
        # Filtrar por fecha de fin si se proporciona (YYYY-MM-DD)
        if end_date_str:
            try:
                end_dt = datetime.strptime(end_date_str, '%Y-%m-%d')
                query = query.filter(LandingTracking.created_at <= datetime.combine(end_dt, time.max))
            except ValueError:
                logging.warning(f"Formato de end_date invalido: {end_date_str}")
        
        # Limite adaptable para no sobrecargar pero permitir ver mas registros si hay filtro
        limit = 5000 if (start_date_str or end_date_str) else 500
        
        visits = query.order_by(LandingTracking.created_at.desc()).limit(limit).all()
        return jsonify([{
            "id": v.id,
            "utm_source": v.utm_source,
            "utm_medium": v.utm_medium,
            "utm_campaign": v.utm_campaign,
            "utm_content": v.utm_content,
            "page_path": v.page_path,
            "referrer": v.referrer,
            "created_at": v.created_at.isoformat()
        } for v in visits]), 200
    except Exception as e:
        logging.error(f"Error al obtener visitas de landing: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@bp.route('/track-visit/<int:id>', methods=['DELETE'])
@login_required
@admin_required
def delete_track_visit(id):
    try:
        visit = LandingTracking.query.get_or_404(id)
        db.session.delete(visit)
        db.session.commit()
        return jsonify({"status": "success", "message": "Visit deleted"}), 200
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error al eliminar visita de landing: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
