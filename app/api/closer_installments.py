from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models import Appointment, InstallmentPlan
from app.services.installment_service import InstallmentService

bp = Blueprint('closer_installments_api', __name__)


def _can_access(appt):
    # Cualquier closer puede consultar/editar el plan de cuotas de cualquier cliente (mismo
    # criterio ya aplicado al resto del flujo del closer en esta sesión).
    return current_user.role in ('admin', 'closer')


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

    if not appt.client_id:
        return jsonify({"error": "Esta cita no tiene un cliente asociado"}), 400

    # Fechas de cobro elegidas por el closer para cada cuota (en orden), en vez de aceptar
    # siempre el cálculo automático de +1/+2/+3 meses.
    fechas = data.get('fechas') if isinstance(data.get('fechas'), list) else None
    # Montos elegidos por el closer para cada cuota (en orden) — en vez de forzar siempre el
    # reparto parejo del saldo. La última posición se recalcula igual en el service para que
    # la suma cierre exacto contra el saldo, así que lo que venga acá para esa posición es
    # solo informativo.
    montos = data.get('montos') if isinstance(data.get('montos'), list) else None
    # Programa (AL/RR/SI) al que pertenece este plan — un cliente puede tener planes
    # independientes por programa; sin esto, el plan de un programa distinto (ej. AL) bloqueaba
    # por error la creación del plan de otro (ej. RR) apenas el cliente tuviera CUALQUIER cuota
    # ya pagada en cualquier programa. Bug real reportado por un closer.
    programa_code = (data.get('programa_code') or '').strip().upper() or None

    plans = InstallmentService.create_plan(appt.client_id, appointment_id, total, cobrado_hoy, num_cuotas, fechas=fechas, montos=montos, programa_code=programa_code)
    if plans is None:
        return jsonify({"error": "Este cliente ya tiene un plan de cuotas de este programa con pagos registrados — no se puede recrear desde cero. Marcá la cuota correspondiente como pagada en vez de definir un plan nuevo."}), 409
    return jsonify({"cuotas": [p.to_dict() for p in plans]}), 201


@bp.route('/installments/<int:appointment_id>', methods=['GET'])
@login_required
def get_installment_plan(appointment_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    appt = Appointment.query.get_or_404(appointment_id)
    if not _can_access(appt):
        return jsonify({"message": "Forbidden"}), 403

    # Sin programa_code: cuotas de TODOS los programas del cliente (uso general, ej. pantalla de
    # seguimiento de cobro). Con programa_code: solo las de ese programa (uso específico, ej.
    # elegir qué cuota se está pagando al declarar una venta tipo Cuota para un programa dado).
    programa_code = (request.args.get('programa_code') or '').strip().upper() or None
    plans = InstallmentService.get_plan(appointment_id, programa_code=programa_code)
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


@bp.route('/installments/cuota', methods=['POST'])
@login_required
def create_single_installment():
    """Agrega una cuota suelta a un plan ya existente — para corregir un plan viejo al que
    le falta una cuota, sin recrear el plan entero (ver `create_plan`, bloqueado a propósito
    si ya hay cuotas pagadas)."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    data = request.get_json() or {}
    appointment_id = data.get('appointment_id')
    appt = Appointment.query.get_or_404(appointment_id)
    if not _can_access(appt):
        return jsonify({"message": "Forbidden"}), 403
    if not appt.client_id:
        return jsonify({"error": "Esta cita no tiene un cliente asociado"}), 400

    try:
        monto = float(data.get('monto') or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Monto inválido"}), 400
    fecha_vencimiento = data.get('fecha_vencimiento')
    if monto <= 0 or not fecha_vencimiento:
        return jsonify({"error": "Monto y fecha de vencimiento son obligatorios"}), 400

    programa_code = (data.get('programa_code') or '').strip().upper() or None
    cuota = InstallmentService.add_cuota(appt.client_id, appointment_id, programa_code, monto, fecha_vencimiento)
    return jsonify(cuota.to_dict()), 201


@bp.route('/installments/cuota/<int:cuota_id>', methods=['DELETE'])
@login_required
def delete_installment(cuota_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    cuota = InstallmentPlan.query.get_or_404(cuota_id)
    if not _can_access(cuota.appointment):
        return jsonify({"message": "Forbidden"}), 403

    InstallmentService.delete_cuota(cuota)
    return jsonify({"ok": True}), 200
