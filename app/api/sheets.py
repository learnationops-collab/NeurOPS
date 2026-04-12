from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.sheets_service import SheetsService
import logging

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
    
    if tabla not in ('Agendas_DB', 'Ventas_DB'):
        return jsonify({"status": "error", "message": "Tabla no válida"}), 400

    result = SheetsService.sync_from_sheets(tabla)
    if result["status"] == "success":
        return jsonify(result), 200
    else:
        return jsonify(result), 500

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
