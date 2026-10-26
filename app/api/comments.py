from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models import db, User

bp = Blueprint('comments', __name__)

@bp.route('', methods=['GET'], strict_slashes=False)
@login_required
def get_comments():
    comment_type = request.args.get('type')
    associated_id = request.args.get('associated_id')

    if not comment_type or not associated_id:
        return jsonify({"error": "Missing type or associated_id"}), 400

    # Las notas viven en el log de la persona (docs/plan_notas_avisos_settings.md). El único tipo que se
    # pide es 'appointment' (el hilo de una agenda).
    if comment_type != 'appointment':
        return jsonify({"error": "Tipo no soportado"}), 400
    from app.services import lead_log_service
    notas = lead_log_service.notas_de_agenda(int(associated_id))
    return jsonify([lead_log_service.a_dict(e) for e in reversed(notas)]), 200

@bp.route('', methods=['POST'], strict_slashes=False)
@login_required
def add_comment():
    data = request.get_json() or {}
    text = data.get('text')
    comment_type = data.get('type')
    associated_id = data.get('associated_id')

    if not text or not comment_type or not associated_id:
        return jsonify({"error": "Missing required fields"}), 400

    if comment_type != 'appointment':
        return jsonify({"error": "Tipo no soportado"}), 400
    from app.models import Appointment
    from app.services import lead_log_service

    appt = db.session.get(Appointment, int(associated_id))
    if not appt:
        return jsonify({"error": "Agenda no encontrada"}), 404
    try:
        entrada = lead_log_service.nota(text, current_user, appt=appt)
        db.session.commit()
        return jsonify(lead_log_service.a_dict(entrada)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/users', methods=['GET'])
@login_required
def get_operational_users():
    users = User.query.filter(
        User.is_active == True,
        User.role.in_(['setter', 'closer', 'triage']),
        User.id != current_user.id
    ).order_by(User.username.asc()).all()
    
    return jsonify([{
        "id": u.id,
        "username": u.username,
        "role": u.role
    } for u in users]), 200
