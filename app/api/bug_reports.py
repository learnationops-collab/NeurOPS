from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import BugReport, BugReportMessage, STATUS_VALUES
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('bug_reports', __name__)

MANAGER_ROLES = ('admin', 'operator')


def check_manager():
    if current_user.role not in MANAGER_ROLES:
        return jsonify({"message": "Forbidden: Acceso restringido a administradores y operadores"}), 403
    return None


def get_report_for_participant(report_id):
    """Devuelve (report, error_response). Solo un manager o el propio autor del
    reporte pueden ver/participar en su hilo de mensajes."""
    report = BugReport.query.get_or_404(report_id)
    is_manager = current_user.role in MANAGER_ROLES
    is_owner = report.user_id == current_user.id
    if not is_manager and not is_owner:
        return None, (jsonify({"message": "Forbidden"}), 403)
    return report, None


@bp.route('/bug-reports', methods=['POST'])
@login_required
def create_bug_report():
    data = request.get_json() or {}
    description = (data.get('description') or '').strip()
    problem = (data.get('problem') or '').strip()
    technical_context = data.get('technical_context')
    loom_link = (data.get('loom_link') or '').strip() or None
    # Capturas extra pegadas a mano (Ctrl+B): opcionales, puede venir vacía o ausente. Se filtran
    # strings vacíos/no-string por si el frontend manda basura.
    extra_screenshots = [s for s in (data.get('extra_screenshots') or []) if isinstance(s, str) and s]

    if not description:
        return jsonify({"message": "La descripción es obligatoria"}), 400
    if not technical_context and not problem:
        return jsonify({"message": "Cuéntanos cuál es el problema"}), 400

    try:
        report = BugReport(
            user_id=current_user.id,
            user_role=current_user.role,
            problem=problem or None,
            description=description,
            route=data.get('route'),
            user_agent=data.get('user_agent'),
            technical_context=technical_context,
            screenshot=data.get('screenshot'),
            extra_screenshots=extra_screenshots or None,
            loom_link=loom_link,
        )
        db.session.add(report)
        db.session.commit()
        return jsonify(report.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al crear reporte de bug: {str(e)}")
        return jsonify({"message": f"Error al crear el reporte: {str(e)}"}), 500


@bp.route('/bug-reports/mine', methods=['GET'])
@login_required
def list_my_bug_reports():
    reports = BugReport.query.filter_by(user_id=current_user.id).order_by(BugReport.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reports]), 200


@bp.route('/bug-reports', methods=['GET'])
@login_required
def list_bug_reports():
    forbidden = check_manager()
    if forbidden: return forbidden

    status_filter = request.args.get('status')
    urgency_filter = request.args.get('urgency')
    query = BugReport.query
    if status_filter:
        query = query.filter(BugReport.status == status_filter)
    if urgency_filter:
        query = query.filter(BugReport.urgency == urgency_filter)

    reports = query.order_by(BugReport.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reports]), 200


@bp.route('/bug-reports/<int:report_id>', methods=['GET'])
@login_required
def get_bug_report(report_id):
    forbidden = check_manager()
    if forbidden: return forbidden

    report = BugReport.query.get_or_404(report_id)
    return jsonify(report.to_dict(include_screenshot=True)), 200


@bp.route('/bug-reports/<int:report_id>/status', methods=['PATCH'])
@login_required
def update_bug_report_status(report_id):
    forbidden = check_manager()
    if forbidden: return forbidden

    data = request.get_json() or {}
    status = (data.get('status') or '').strip()
    if status not in STATUS_VALUES:
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


@bp.route('/bug-reports/<int:report_id>/messages', methods=['GET'])
@login_required
def list_bug_report_messages(report_id):
    report, forbidden = get_report_for_participant(report_id)
    if forbidden: return forbidden

    messages = report.messages.all()

    # Abrir el hilo cuenta como "leído" para el lado que lo abre.
    now = datetime.utcnow()
    if current_user.role in MANAGER_ROLES:
        report.manager_last_read_at = now
    if report.user_id == current_user.id:
        report.user_last_read_at = now
    db.session.commit()

    return jsonify({
        "report": report.to_dict(include_screenshot=True),
        "messages": [m.to_dict() for m in messages],
    }), 200


@bp.route('/bug-reports/<int:report_id>/messages', methods=['POST'])
@login_required
def create_bug_report_message(report_id):
    report, forbidden = get_report_for_participant(report_id)
    if forbidden: return forbidden

    data = request.get_json() or {}
    text = (data.get('message') or '').strip()
    if not text:
        return jsonify({"message": "El mensaje no puede estar vacío"}), 400

    try:
        now = datetime.utcnow()
        msg = BugReportMessage(
            bug_report_id=report.id,
            sender_id=current_user.id,
            sender_role=current_user.role,
            message=text,
            created_at=now,
        )
        db.session.add(msg)

        is_manager = current_user.role in MANAGER_ROLES
        if is_manager:
            report.manager_last_read_at = now
            if report.status == 'open':
                report.status = 'reviewed'
        if report.user_id == current_user.id:
            report.user_last_read_at = now

        db.session.commit()
        return jsonify(msg.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al agregar mensaje al reporte {report_id}: {str(e)}")
        return jsonify({"message": f"Error al enviar el mensaje: {str(e)}"}), 500
