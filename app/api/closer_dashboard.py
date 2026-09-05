from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.closer_dashboard_service import CloserDashboardService
from app.models.user import ROLE_DIRECTOR_COMERCIAL

bp = Blueprint('closer_dashboard_api', __name__)

# Además del propio closer (su bandeja) y admin (todo el equipo), director_comercial
# ve este dashboard como parte de "closing" — llega por defecto al entrar a
# /admin/ventas (ver App.jsx) y antes daba 403 al no estar en esta lista.
ROLES_CON_VISTA_AGREGADA = ['admin', ROLE_DIRECTOR_COMERCIAL]


@bp.route('/performance-dashboard', methods=['GET'])
@login_required
def get_performance_dashboard():
    if current_user.role not in ['closer'] + ROLES_CON_VISTA_AGREGADA:
        return jsonify({"message": "Forbidden"}), 403

    period = request.args.get('period', default='mes', type=str)
    compare = request.args.get('compare', default='prev', type=str)
    closer_id_arg = request.args.get('closer_id', default='', type=str)
    # Rango libre: solo se leen cuando period == 'custom' (el servicio ignora lo que no parsee).
    start_date = request.args.get('start_date', default='', type=str)
    end_date = request.args.get('end_date', default='', type=str)
    # Idem para el rango contra el que se compara, cuando compare == 'custom'.
    compare_start = request.args.get('compare_start', default='', type=str)
    compare_end = request.args.get('compare_end', default='', type=str)

    if current_user.role == 'closer':
        closer_id = current_user.id
    elif closer_id_arg and closer_id_arg != 'all':
        try:
            closer_id = int(closer_id_arg)
        except ValueError:
            closer_id = None
    else:
        closer_id = None

    data = CloserDashboardService.get_performance_data(
        closer_id=closer_id, period=period, compare=compare,
        start_date=start_date, end_date=end_date,
        compare_start=compare_start, compare_end=compare_end)
    return jsonify(data), 200


@bp.route('/pending-summary', methods=['GET'])
@login_required
def get_pending_summary():
    """Resumen de trabajo pendiente «a hoy» (mismo cálculo que la sección "Lo que falta
    completar" del dashboard), pensado para la tira de KPIs del admin en «Historial de
    Reportes» — sin traer todo el payload pesado de /performance-dashboard. Un closer solo ve
    lo suyo; el admin puede pedir un closer puntual o `closer_id=all` para todo el equipo."""
    if current_user.role not in ['closer'] + ROLES_CON_VISTA_AGREGADA:
        return jsonify({"message": "Forbidden"}), 403

    from app.services.closer_pending_service import CloserPendingService

    if current_user.role == 'closer':
        closer_id = current_user.id
    else:
        closer_id_arg = request.args.get('closer_id', default='', type=str)
        closer_id = int(closer_id_arg) if closer_id_arg and closer_id_arg != 'all' else None

    pendientes = CloserPendingService.get_pending_work(closer_id)
    return jsonify(pendientes), 200


@bp.route('/performance-dashboard/slots-pendientes', methods=['GET'])
@login_required
def get_missing_slots():
    """Días del período con agendas pero sin cupos declarados. El dashboard los pide al entrar:
    los cupos son el único dato del embudo que no se puede deducir de la bandeja (ver
    CloserService._stats_from_bandeja)."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.services.closer_service import CloserService
    period = request.args.get('period', default='mes', type=str)
    start, end = CloserDashboardService._range_for_period(
        period,
        request.args.get('start_date', default='', type=str),
        request.args.get('end_date', default='', type=str))
    dias = CloserService.get_missing_slots_days(current_user.id, start, end)
    return jsonify({
        'period': period,
        'start': start.isoformat(),
        'end': end.isoformat(),
        'total': len(dias),
        'dias': dias
    }), 200


@bp.route('/performance-dashboard/slots', methods=['POST'])
@login_required
def save_missing_slots():
    """Guarda los cupos declarados por día ({'2026-08-05': 12, ...}). Rechaza los valores menores
    a las agendas reales de ese día — un cupo agendado sigue siendo un cupo."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.services.closer_service import CloserService
    data = request.get_json() or {}
    dias = data.get('dias')
    if not isinstance(dias, dict) or not dias:
        return jsonify({"error": "Enviá un objeto 'dias' con fecha → cupos"}), 400

    resultado = CloserService.save_slots_for_days(current_user.id, dias)
    return jsonify({
        "message": f"{len(resultado['guardados'])} día(s) guardados",
        **resultado
    }), 200
