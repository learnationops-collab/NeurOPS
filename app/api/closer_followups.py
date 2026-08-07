import os
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Appointment
from app.services.closer_followup_service import CloserFollowUpService, TIPOS_SEGUIMIENTO, PROGRAM_CODE_NAMES

bp = Blueprint('closer_followups_api', __name__)


def _resolve_closer_id():
    return None if current_user.role == 'admin' else current_user.id


@bp.route('/followups/today', methods=['GET'])
@login_required
def get_followups_today():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    selected_date = request.args.get('selected_date') or __import__('datetime').date.today().isoformat()
    grouped = CloserFollowUpService.get_today_grouped(_resolve_closer_id(), selected_date)
    return jsonify({
        "grouped": grouped,
        "tipos": TIPOS_SEGUIMIENTO
    }), 200


@bp.route('/followups/pool', methods=['GET'])
@login_required
def get_followups_pool():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    tipo = request.args.get('tipo')
    sub = request.args.get('sub') or None
    days_since = request.args.get('days_since') or None
    programa = request.args.get('programa') or None
    deuda = request.args.get('deuda') or None
    items = CloserFollowUpService.get_pool(_resolve_closer_id(), tipo=tipo, sub=sub, days_since=days_since, programa=programa, deuda=deuda)
    return jsonify({
        "items": items,
        "programas": PROGRAM_CODE_NAMES
    }), 200


@bp.route('/followups/pool-counts', methods=['GET'])
@login_required
def get_followups_pool_counts():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    return jsonify(CloserFollowUpService.get_pool_counts(_resolve_closer_id())), 200


@bp.route('/followups/goal', methods=['GET'])
@login_required
def get_followups_goal():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    selected_date = request.args.get('selected_date') or __import__('datetime').date.today().isoformat()
    return jsonify(CloserFollowUpService.get_daily_goal_progress(_resolve_closer_id(), selected_date)), 200


@bp.route('/followups/<int:appt_id>/schedule', methods=['POST'])
@login_required
def schedule_followup(appt_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    appt = Appointment.query.get_or_404(appt_id)
    # Cualquier closer puede programar seguimiento sobre cualquier lead (ver process_closer_card
    # para el mismo criterio). Si el dueño quedó inactivo, se reasigna al closer que lo trabaja.
    if current_user.role == 'closer' and appt.closer_id != current_user.id:
        from app.models import User
        owner = User.query.get(appt.closer_id)
        if owner and owner.is_active is False:
            appt.closer_id = current_user.id

    data = request.get_json() or {}
    tipo = data.get('tipo')
    if tipo not in TIPOS_SEGUIMIENTO:
        return jsonify({"error": "tipo inválido"}), 400

    CloserFollowUpService.schedule_followup(
        appt,
        tipo=tipo,
        sub=data.get('sub') or '',
        fecha_seguimiento=data.get('fecha_seguimiento'),
        notes=data.get('notes'),
        intento=data.get('intento')
    )
    db.session.commit()
    return jsonify({"message": "Seguimiento programado", "id": appt.id}), 200


@bp.route('/followups/cron/send-reminders', methods=['GET'])
def cron_send_followup_reminders():
    """Le avisa por WhatsApp (Whatchimp) a cada closer activo los seguimientos que tiene
    pendientes para hoy (vencidos + de hoy) y todavía no le avisamos en el día. Pensado para un
    cron externo (mismo patrón/token que /api/sheets/cron-sync) — llamarlo varias veces al día
    es seguro, no reenvía lo ya avisado hoy."""
    token = request.args.get('token')
    expected_token = os.getenv('CRON_SECRET', 'token-seguro-neur0ps-2026')
    if not token or token != expected_token:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    selected_date = request.args.get('date')
    slot = request.args.get('slot', 'am')
    result = CloserFollowUpService.send_due_reminders(selected_date, slot=slot)
    return jsonify({"status": "success", **result}), 200
