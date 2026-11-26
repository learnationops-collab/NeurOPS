"""«Seguir» de triage (ADR-W241), en el blueprint de seguimientos (/api/closer):

  · GET  /followups/triage               → la bandeja: atrasados, para hoy, esperan fecha y hechos hoy.
  · POST /followups/triage/<appt_id>     → {accion, ...} una acción de la fila o de Reportar › Atrasadas
                                            (ver `triage_seguir_service.accion`). Devuelve lo que había
                                            antes, para «Deshacer».
"""
from flask import jsonify, request
from flask_login import current_user, login_required

from app import db
from app.api.closer_followups import bp
from app.models import Appointment
from app.services import triage_seguir_service as seguir

ROLES = ('triage', 'admin')


@bp.route('/followups/triage', methods=['GET'])
@login_required
def bandeja_triage():
    if current_user.role not in ROLES:
        return jsonify({'message': 'Forbidden'}), 403
    return jsonify(seguir.bandeja(current_user)), 200


@bp.route('/followups/triage/<int:appt_id>', methods=['POST'])
@login_required
def accion_triage(appt_id):
    if current_user.role not in ROLES:
        return jsonify({'message': 'Forbidden'}), 403
    appt = db.session.get(Appointment, appt_id)
    if appt is None:
        return jsonify({'message': 'Agenda no encontrada'}), 404
    try:
        return jsonify(seguir.accion(appt, request.get_json(silent=True) or {}, current_user)), 200
    except seguir.ErrorDeSeguir as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 400
