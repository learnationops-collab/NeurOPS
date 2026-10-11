from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.decorators import require_cron_secret
from app.services.sheets_service import SheetsService
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('sheets', __name__)

# GET /sync (la sincronización manual de una tabla) se retiró el 10/10/2026 con «Importaciones
# Sheets» (/admin/sheets), su única pantalla: con Ventas_DB respondía 500 «disabled» (la
# sincronización destructiva está apagada) y con Llamadas_DB, «disabled» (las agendas llegan por
# n8n). El cron sigue abajo, con su propio secreto.

@bp.route('/cron-sync', methods=['GET'])
@require_cron_secret
def cron_sync():
    """
    Endpoint para ser llamado por una función serverless (Cron).
    Requiere el secreto CRON_SECRET (header Authorization: Bearer o parámetro ?token=) en lugar de
    sesión activa; sin esa variable configurada responde 503.
    """
    logger.info("[CRON] Iniciando sincronización automática")
    res_ventas = SheetsService.sync_from_sheets('Ventas_DB')
    # res_agendas = SheetsService.sync_from_sheets('Llamadas_DB')
    res_agendas = {"status": "disabled", "message": "Deshabilitado en favor de n8n."}

    # Hasta el 10/10/2026 acá se evaluaban también las reglas de alerta (y se avisaba a Discord). La
    # pantalla de Alertas se retiró junto con la vista Administración y el motor se apagó con ella.
    return jsonify({
        "status": "success",
        "message": "Sincronización cron completada",
        "ventas": res_ventas,
        "agendas": res_agendas,
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
