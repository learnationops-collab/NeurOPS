from flask import Blueprint, request, jsonify
from app import db
from app.models.marketing import LandingTracking
import logging

bp = Blueprint('metrics', __name__)

@bp.route('/track-visit', methods=['POST'])
def track_visit():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        tracking = LandingTracking(
            utm_source=data.get('utm_source'),
            utm_medium=data.get('utm_medium'),
            utm_campaign=data.get('utm_campaign'),
            utm_content=data.get('utm_content'),
            page_path=data.get('page_path'),
            referrer=data.get('referrer')
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
