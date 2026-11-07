"""Embudo de seguimiento de la pestaña Seguir (closer y triage). Ver `embudo_seguimiento_service`."""
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.models import Appointment, get_impersonation_state
from app.services import embudo_seguimiento_service as embudo

bp = Blueprint('closer_embudo_api', __name__)

ROLES = ('closer', 'triage', 'admin', 'director_comercial')


def _rol_original():
    simulando, _, rol = get_impersonation_state()
    return rol if simulando else None


def _closer_id():
    return None if current_user.role in ('admin', 'director_comercial') else current_user.id


def _prohibido():
    return current_user.role not in ROLES


def _cita_propia(appt_id):
    appt = db.session.get(Appointment, appt_id)
    if appt is None:
        return None, (jsonify({'error': 'No existe'}), 404)
    if _closer_id() and appt.closer_id != current_user.id:
        return None, (jsonify({'error': 'Este lead es de otro closer'}), 403)
    return appt, None


@bp.route('/embudo', methods=['GET'])
@login_required
def get_embudo():
    if _prohibido():
        return jsonify({'error': 'Forbidden'}), 403
    datos = embudo.tablero(current_user, _closer_id())
    datos['puede_editar'] = embudo.puede_editar(current_user, _rol_original())
    return jsonify(datos), 200


@bp.route('/embudo/config', methods=['PUT'])
@login_required
def put_embudo_config():
    if not embudo.puede_editar(current_user, _rol_original()):
        return jsonify({'error': 'Solo la dirección cambia los días del embudo'}), 403
    data = request.get_json() or {}
    dias, error = embudo.guardar_config(data.get('dias'), current_user)
    if error:
        return jsonify({'error': error}), 400
    return jsonify({'dias': dias}), 200


@bp.route('/embudo/<int:appt_id>/registrar', methods=['POST'])
@login_required
def post_embudo_registrar(appt_id):
    if _prohibido():
        return jsonify({'error': 'Forbidden'}), 403
    appt, fallo = _cita_propia(appt_id)
    if fallo:
        return fallo
    reg, error = embudo.registrar(appt, current_user, (request.get_json() or {}).get('resultado'))
    if error:
        return jsonify({'error': error}), 400
    return jsonify({'id': reg.id, 'dia': reg.dia, 'resultado': reg.resultado}), 200


@bp.route('/embudo/registros/<int:reg_id>', methods=['DELETE'])
@login_required
def delete_embudo_registro(reg_id):
    if _prohibido():
        return jsonify({'error': 'Forbidden'}), 403
    error = embudo.deshacer(reg_id, current_user)
    if error:
        return jsonify({'error': error}), 400
    return jsonify({'ok': True}), 200
