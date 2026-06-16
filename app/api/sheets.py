from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.sheets_service import SheetsService
import logging
import os

logger = logging.getLogger(__name__)

bp = Blueprint('sheets', __name__)

@bp.route('/sync', methods=['GET'])
@login_required
def sync_sheets():
    """
    Sincroniza una tabla específica desde Google Sheets. 
    Parámetro: ?tabla=Agendas_DB o ?tabla=Ventas_DB
    """
    tabla = request.args.get('tabla')
    if not tabla:
        return jsonify({"status": "error", "message": "Parámetro 'tabla' es requerido"}), 400
    
    if tabla == 'Llamadas_DB':
        return jsonify({"status": "disabled", "message": "La sincronización de agendas desde Google Sheets ha sido deshabilitada en favor de n8n."}), 200
        
    if tabla not in ('Llamadas_DB', 'Ventas_DB'):
        return jsonify({"status": "error", "message": "Tabla no válida"}), 400

    force = request.args.get('force', 'false').lower() == 'true'
    result = SheetsService.sync_from_sheets(tabla, force=force)
    if result["status"] == "success":
        logger.info(f"[SHEETS] Sync successful for {tabla} (force={force})")
        return jsonify(result), 200
    else:
        logger.error(f"[SHEETS] Sync failed for {tabla}: {result.get('message')}")
        return jsonify(result), 500

@bp.route('/cron-sync', methods=['GET'])
def cron_sync():
    """
    Endpoint para ser llamado por una función serverless (Cron).
    Requiere un token de seguridad en lugar de sesión activa.
    """
    token = request.args.get('token')
    expected_token = os.getenv('CRON_SECRET', 'token-seguro-neur0ps-2026')
    
    if not token or token != expected_token:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    logger.info("[CRON] Iniciando sincronización automática")
    res_ventas = SheetsService.sync_from_sheets('Ventas_DB')
    # res_agendas = SheetsService.sync_from_sheets('Llamadas_DB')
    res_agendas = {"status": "disabled", "message": "Deshabilitado en favor de n8n."}
    
    # Evaluar reglas de alertas después del sync
    try:
        from app.services.alert_service import AlertService
        new_alerts = AlertService.evaluate_rules()
        logger.info(f"[CRON] Evaluación de alertas completada. Se generaron {new_alerts} nuevas alertas.")
    except Exception as e:
        logger.error(f"[CRON] Error al evaluar alertas en cron: {str(e)}")
        new_alerts = 0

    return jsonify({
        "status": "success",
        "message": "Sincronización cron completada",
        "ventas": res_ventas,
        "agendas": res_agendas,
        "alerts_triggered": new_alerts
    }), 200

@bp.route('/push', methods=['POST'])
@login_required
def push_to_sheets():
    """
    Envía datos a Google Sheets y dispara sincronización automática.
    """
    tabla = request.args.get('tabla')
    data = request.json
    
    if not tabla or not data:
        return jsonify({"status": "error", "message": "Tabla y datos son requeridos"}), 400

    result = SheetsService.post_to_sheets(tabla, data)
    if result["status"] == "success":
        return jsonify(result), 200
    else:
        return jsonify(result), 500
