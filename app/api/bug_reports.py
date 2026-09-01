from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import BugReport, URGENCY_LEVELS
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('bug_reports', __name__)


@bp.route('/bug-reports', methods=['POST'])
@login_required
def create_bug_report():
    data = request.get_json() or {}
    description = (data.get('description') or '').strip()
    urgency = (data.get('urgency') or '').strip()

    if not description:
        return jsonify({"message": "La descripción es obligatoria"}), 400
    if urgency not in URGENCY_LEVELS:
        return jsonify({"message": "Urgencia inválida"}), 400

    try:
        report = BugReport(
            user_id=current_user.id,
            user_role=current_user.role,
            description=description,
            urgency=urgency,
            route=data.get('route'),
            user_agent=data.get('user_agent'),
            technical_context=data.get('technical_context'),
            screenshot=data.get('screenshot'),
        )
        db.session.add(report)
        db.session.commit()
        return jsonify(report.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al crear reporte de bug: {str(e)}")
        return jsonify({"message": f"Error al crear el reporte: {str(e)}"}), 500


@bp.route('/bug-reports', methods=['GET'])
@login_required
def list_bug_reports():
    if current_user.role != 'admin':
        return jsonify({"message": "Forbidden: Acceso restringido a administradores"}), 403

    status_filter = request.args.get('status')
    query = BugReport.query
    if status_filter:
        query = query.filter(BugReport.status == status_filter)

    reports = query.order_by(BugReport.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reports]), 200


@bp.route('/bug-reports/<int:report_id>', methods=['GET'])
@login_required
def get_bug_report(report_id):
    if current_user.role != 'admin':
        return jsonify({"message": "Forbidden: Acceso restringido a administradores"}), 403

    report = BugReport.query.get_or_404(report_id)
    return jsonify(report.to_dict(include_screenshot=True)), 200


@bp.route('/bug-reports/<int:report_id>/status', methods=['PATCH'])
@login_required
def update_bug_report_status(report_id):
    if current_user.role != 'admin':
        return jsonify({"message": "Forbidden: Acceso restringido a administradores"}), 403

    data = request.get_json() or {}
    status = (data.get('status') or '').strip()
    if status not in ('open', 'reviewed', 'resolved'):
        return jsonify({"message": "Estado inválido"}), 400

    report = BugReport.query.get_or_404(report_id)
    try:
        report.status = status
        db.session.commit()
        return jsonify(report.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al actualizar estado del reporte {report_id}: {str(e)}")
        return jsonify({"message": f"Error al actualizar: {str(e)}"}), 500
