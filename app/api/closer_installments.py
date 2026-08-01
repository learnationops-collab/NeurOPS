from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models import Appointment, InstallmentPlan
from app.services.installment_service import InstallmentService

bp = Blueprint('closer_installments_api', __name__)


def _can_access(appt):
    return current_user.role == 'admin' or appt.closer_id == current_user.id


@bp.route('/installments', methods=['POST'])
@login_required
def create_installment_plan():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    data = request.get_json() or {}
    appointment_id = data.get('appointment_id')
    appt = Appointment.query.get_or_404(appointment_id)
    if not _can_access(appt):
        return jsonify({"message": "Forbidden"}), 403

    try:
        total = float(data.get('total') or 0)
        cobrado_hoy = float(data.get('cobrado_hoy') or 0)
        num_cuotas = int(data.get('num_cuotas') or 1)
    except (TypeError, ValueError):
        return jsonify({"error": "Datos numéricos inválidos"}), 400

    plans = InstallmentService.create_plan(appointment_id, total, cobrado_hoy, num_cuotas)
    return jsonify({"cuotas": [p.to_dict() for p in plans]}), 201


@bp.route('/installments/<int:appointment_id>', methods=['GET'])
@login_required
def get_installment_plan(appointment_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    appt = Appointment.query.get_or_404(appointment_id)
    if not _can_access(appt):
        return jsonify({"message": "Forbidden"}), 403

    plans = InstallmentService.get_plan(appointment_id)
    return jsonify({"cuotas": [p.to_dict() for p in plans]}), 200


@bp.route('/installments/cuota/<int:cuota_id>', methods=['PATCH'])
@login_required
def update_installment(cuota_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    cuota = InstallmentPlan.query.get_or_404(cuota_id)
    if not _can_access(cuota.appointment):
        return jsonify({"message": "Forbidden"}), 403

    data = request.get_json() or {}
    InstallmentService.update_cuota(
        cuota,
        monto=data.get('monto'),
        fecha_vencimiento=data.get('fecha_vencimiento'),
        estado=data.get('estado')
    )
    return jsonify(cuota.to_dict()), 200
