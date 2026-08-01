from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.closer_dashboard_service import CloserDashboardService

bp = Blueprint('closer_dashboard_api', __name__)


@bp.route('/performance-dashboard', methods=['GET'])
@login_required
def get_performance_dashboard():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    period = request.args.get('period', default='mes', type=str)
    compare = request.args.get('compare', default='prev', type=str)
    closer_id_arg = request.args.get('closer_id', default='', type=str)

    if current_user.role == 'closer':
        closer_id = current_user.id
    elif closer_id_arg and closer_id_arg != 'all':
        try:
            closer_id = int(closer_id_arg)
        except ValueError:
            closer_id = None
    else:
        closer_id = None

    data = CloserDashboardService.get_performance_data(closer_id=closer_id, period=period, compare=compare)
    return jsonify(data), 200
