from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import AlertRule, Alert, Integration
from app.services.alert_service import AlertService
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('alerts', __name__)

def check_admin():
    if current_user.role != 'admin':
        return jsonify({"message": "Forbidden: Acceso restringido a administradores"}), 403
    return None

# ============================================================
# REGLAS DE ALERTA (CRUD)
# ============================================================

@bp.route('/alerts/rules', methods=['GET'])
@login_required
def get_rules():
    forbidden = check_admin()
    if forbidden: return forbidden

    rules = AlertRule.query.order_by(AlertRule.created_at.desc()).all()
    return jsonify([r.to_dict() for r in rules]), 200

@bp.route('/alerts/rules', methods=['POST'])
@login_required
def create_rule():
    forbidden = check_admin()
    if forbidden: return forbidden

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    metric = data.get('metric', '').strip()
    condition = data.get('condition', '').strip()
    value = data.get('value')
    period = data.get('period', '').strip()
    scope_type = data.get('scope_type', '').strip()
    scope_value = data.get('scope_value', '').strip()
    severity = data.get('severity', '').strip()
    
    if not (name and metric and condition and value is not None and period and scope_type and severity):
        return jsonify({"message": "Faltan campos obligatorios"}), 400

    try:
        rule = AlertRule(
            name=name,
            description=data.get('description'),
            metric=metric,
            condition=condition,
            value=float(value),
            period=period,
            scope_type=scope_type,
            scope_value=scope_value,
            notify_platform=bool(data.get('notify_platform', True)),
            notify_discord=bool(data.get('notify_discord', False)),
            severity=severity,
            is_active=bool(data.get('is_active', True))
        )
        db.session.add(rule)
        db.session.commit()
        return jsonify(rule.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al crear regla de alerta: {str(e)}")
        return jsonify({"message": f"Error al crear regla: {str(e)}"}), 500

@bp.route('/alerts/rules/<int:rule_id>', methods=['PUT'])
@login_required
def update_rule(rule_id):
    forbidden = check_admin()
    if forbidden: return forbidden

    rule = AlertRule.query.get_or_404(rule_id)
    data = request.get_json() or {}

    try:
        if 'name' in data: rule.name = data['name'].strip()
        if 'description' in data: rule.description = data['description']
        if 'metric' in data: rule.metric = data['metric'].strip()
        if 'condition' in data: rule.condition = data['condition'].strip()
        if 'value' in data: rule.value = float(data['value'])
        if 'period' in data: rule.period = data['period'].strip()
        if 'scope_type' in data: rule.scope_type = data['scope_type'].strip()
        if 'scope_value' in data: rule.scope_value = data['scope_value'].strip()
        if 'notify_platform' in data: rule.notify_platform = bool(data['notify_platform'])
        if 'notify_discord' in data: rule.notify_discord = bool(data['notify_discord'])
        if 'severity' in data: rule.severity = data['severity'].strip()
        if 'is_active' in data: rule.is_active = bool(data['is_active'])

        db.session.commit()
        return jsonify(rule.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al actualizar regla de alerta: {str(e)}")
        return jsonify({"message": f"Error al actualizar regla: {str(e)}"}), 500

@bp.route('/alerts/rules/<int:rule_id>', methods=['DELETE'])
@login_required
def delete_rule(rule_id):
    forbidden = check_admin()
    if forbidden: return forbidden

    rule = AlertRule.query.get_or_404(rule_id)
    try:
        db.session.delete(rule)
        db.session.commit()
        return jsonify({"message": "Regla de alerta eliminada con éxito"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al eliminar regla de alerta: {str(e)}")
        return jsonify({"message": f"Error al eliminar regla: {str(e)}"}), 500

# ============================================================
# HISTORIAL DE ALERTAS Y ACCIONES
# ============================================================

@bp.route('/alerts', methods=['GET'])
@login_required
def get_alerts():
    forbidden = check_admin()
    if forbidden: return forbidden

    resolved_filter = request.args.get('resolved')
    severity_filter = request.args.get('severity')
    sort_order = request.args.get('sort', 'newest')

    query = Alert.query

    if resolved_filter is not None:
        is_resolved = resolved_filter.lower() == 'true'
        query = query.filter(Alert.is_resolved == is_resolved)

    if severity_filter:
        query = query.filter(Alert.severity == severity_filter)

    if sort_order == 'oldest':
        query = query.order_by(Alert.created_at.asc())
    else:
        query = query.order_by(Alert.created_at.desc())

    alerts = query.all()
    return jsonify([a.to_dict() for a in alerts]), 200

@bp.route('/alerts/<int:alert_id>/resolve', methods=['POST'])
@login_required
def resolve_alert(alert_id):
    forbidden = check_admin()
    if forbidden: return forbidden

    alert = Alert.query.get_or_404(alert_id)
    try:
        alert.is_resolved = True
        alert.resolved_at = datetime.utcnow()
        db.session.commit()
        return jsonify(alert.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al resolver alerta: {str(e)}")
        return jsonify({"message": f"Error al resolver alerta: {str(e)}"}), 500

@bp.route('/alerts/evaluate', methods=['POST'])
@login_required
def evaluate_alerts():
    forbidden = check_admin()
    if forbidden: return forbidden

    try:
        new_alerts = AlertService.evaluate_rules()
        return jsonify({
            "status": "success",
            "message": f"Evaluación completada. Se generaron {new_alerts} nuevas alertas.",
            "new_alerts": new_alerts
        }), 200
    except Exception as e:
        logger.error(f"Error al forzar evaluación de alertas: {str(e)}")
        return jsonify({"message": f"Error durante la evaluación: {str(e)}"}), 500

@bp.route('/alerts/stats', methods=['GET'])
@login_required
def get_alerts_stats():
    forbidden = check_admin()
    if forbidden: return forbidden

    try:
        # Contadores de alertas activas
        active_critical = Alert.query.filter_by(is_resolved=False, severity='critical').count()
        active_warning = Alert.query.filter_by(is_resolved=False, severity='warning').count()
        active_info = Alert.query.filter_by(is_resolved=False, severity='info').count()
        active_opportunity = Alert.query.filter_by(is_resolved=False, severity='opportunity').count()
        
        # Historial de la última semana
        from datetime import date, timedelta
        one_week_ago = date.today() - timedelta(days=7)
        one_week_ago_dt = datetime.combine(one_week_ago, datetime.min.time())
        total_last_week = Alert.query.filter(Alert.created_at >= one_week_ago_dt).count()
        
        # Contadores de reglas
        rules_critical = AlertRule.query.filter_by(is_active=True, severity='critical').count()
        rules_warning = AlertRule.query.filter_by(is_active=True, severity='warning').count()
        rules_info = AlertRule.query.filter_by(is_active=True, severity='info').count()
        rules_opportunity = AlertRule.query.filter_by(is_active=True, severity='opportunity').count()
        total_rules = AlertRule.query.count()

        return jsonify({
            "alerts": {
                "critical": active_critical,
                "warning": active_warning,
                "info": active_info,
                "opportunity": active_opportunity,
                "total_last_week": total_last_week
            },
            "rules": {
                "critical": rules_critical,
                "warning": rules_warning,
                "info": rules_info,
                "opportunity": rules_opportunity,
                "total": total_rules
            }
        }), 200
    except Exception as e:
        logger.error(f"Error al obtener estadísticas de alertas: {str(e)}")
        return jsonify({"message": f"Error al obtener estadísticas: {str(e)}"}), 500

# ============================================================
# CONFIGURACIÓN DE DISCORD
# ============================================================

@bp.route('/alerts/discord-config', methods=['GET', 'POST'])
@login_required
def handle_discord_config():
    forbidden = check_admin()
    if forbidden: return forbidden

    integration = Integration.query.filter_by(key='discord_alerts').first()

    if request.method == 'POST':
        data = request.get_json() or {}
        webhook_url = data.get('webhook_url', '').strip()

        try:
            if not integration:
                integration = Integration(
                    key='discord_alerts',
                    name='Alertas Críticas Discord',
                    url_dev=webhook_url,
                    url_prod=webhook_url,
                    active_env='prod'
                )
                db.session.add(integration)
            else:
                integration.url_prod = webhook_url
                integration.url_dev = webhook_url

            db.session.commit()
            return jsonify({"status": "success", "message": "Configuración de Discord guardada con éxito"}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"message": f"Error al guardar configuración: {str(e)}"}), 500

    return jsonify({
        "configured": bool(integration and (integration.url_prod or integration.url_dev)),
        "webhook_url": integration.url_prod if integration else ""
    }), 200
