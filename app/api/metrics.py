from flask import Blueprint, request, jsonify
from app import db
from app.models.marketing import LandingTracking
from flask_login import login_required
from app.decorators import admin_required
import logging

bp = Blueprint('metrics', __name__)

@bp.route('/track-visit', methods=['POST'])
def track_visit():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Obtener el path del dato enviado o del referrer
        data_path = data.get('page_path') or data.get('path')
        raw_path = data_path or request.referrer
        
        # Si el path de los datos es solo la raíz '/' o el dominio, y el referrer tiene más información, usar el referrer
        if (not data_path or data_path == '/' or data_path.count('/') <= 3) and request.referrer:
            if len(request.referrer) > len(raw_path) or '/' in request.referrer.replace('https://', '').replace('http://', ''):
                raw_path = request.referrer

        tracking = LandingTracking(
            utm_source=data.get('utm_source'),
            utm_medium=data.get('utm_medium'),
            utm_campaign=data.get('utm_campaign'),
            utm_content=data.get('utm_content'),
            page_path=raw_path,
            referrer=request.referrer
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
        visits = LandingTracking.query.order_by(LandingTracking.created_at.desc()).limit(500).all()
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
