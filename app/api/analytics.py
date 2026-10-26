from flask import Blueprint, jsonify, request
from flask_login import login_required
from app.decorators import admin_required
from app.services.dashboard_service import DashboardService
from datetime import datetime

bp = Blueprint('analytics', __name__)

@bp.route('/data', methods=['GET'])
@login_required
@admin_required
def get_widget_data():
    """
    Generic endpoint to fetch data for dashboard widgets.
    Query params:
    - metric: 'agendas' | 'sales' | 'cash_collect'
    - period: 'this_month' | 'last_7_days' | etc (from DashboardService)
    - start_date: 'YYYY-MM-DD' (optional for custom)
    - end_date: 'YYYY-MM-DD' (optional for custom)
    """
    metric = request.args.get('metric')
    period = request.args.get('period', 'this_month')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not metric:
        return jsonify({"error": "Metric is required"}), 400

    # Get data from existing DashboardService logic
    # Note: get_dashboard_kpis returns a dictionary with various data points
    kpis = DashboardService.get_dashboard_kpis(
        period=period, 
        start_date_arg=start_date, 
        end_date_arg=end_date
    )

    result = {}
    if metric == 'agendas':
        result = {
            "value": kpis['agendas']['count'],
            "label": "Agendas Totales",
            "unit": ""
        }
    elif metric == 'sales':
        result = {
            "value": kpis['financials']['enrollments_count'],
            "label": "Ventas Realizadas",
            "unit": ""
        }
    elif metric == 'cash_collect':
        result = {
            "value": kpis['financials']['income'],
            "label": "Cash Collect",
            "unit": "$"
        }
    else:
        return jsonify({"error": "Invalid metric requested"}), 400

    return jsonify(result), 200

@bp.route('/config', methods=['GET', 'POST'])
@login_required
@admin_required
def dashboard_config():
    """El layout del dashboard del admin, guardado en su configuración (`user_settings`)."""
    from flask_login import current_user
    from app.services import user_settings_service

    if request.method == 'POST':
        user_settings_service.guardar(current_user.id, 'admin_dashboard', request.json)
        return jsonify({"message": "Configuración guardada"}), 200
    return jsonify(user_settings_service.leer(current_user.id, 'admin_dashboard')), 200

@bp.route('/time-series', methods=['GET'])
@login_required
@admin_required
def get_time_series_data():
    """
    Endpoint for bar chart tiles.
    Returns: { labels: [], values: [] }
    """
    metric = request.args.get('metric')
    period = request.args.get('period', 'this_month')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not metric:
        return jsonify({"error": "Metric is required"}), 400

    charts = DashboardService.get_dashboard_charts(
        period=period,
        start_date_arg=start_date,
        end_date_arg=end_date
    )

    labels = charts['dates_labels']
    values = []

    if metric == 'agendas':
        values = charts['agendas_values']
    elif metric == 'sales':
        values = charts['sales_values']
    elif metric == 'cash_collect':
        values = charts['revenue_values']

    return jsonify({
        "labels": labels,
        "values": values,
        "metric": metric
    }), 200
