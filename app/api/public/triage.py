from flask import request, jsonify
from app.models import db, User
from datetime import datetime, date, timedelta
from . import bp
import json
import requests

# ============================================================
# TRIAGE DAILY REPORT
# ============================================================

@bp.route('/public/triage-report', methods=['POST'])
def submit_public_triage_report():
    """Recibe y guarda el reporte diario de un triage."""
    from app.models import TriageDailyReport

    data = request.get_json() or {}

    triage_name = data.get('triage_name')
    report_date_str = data.get('date')

    if not triage_name or not report_date_str:
        return jsonify({"message": "Nombre del triage y fecha son obligatorios"}), 400

    try:
        report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400

    # Buscar reporte existente o crear nuevo
    report = TriageDailyReport.query.filter_by(triage_name=triage_name, date=report_date).first()

    # Helper para parsear enteros del payload
    def get_int(key):
        return int(data.get(key) or 0)

    field_values = {
        'agendas_nuevas': get_int('agendas_nuevas'),
        'agendas_confirmadas': get_int('agendas_confirmadas'),
        'no_contestan': get_int('no_contestan'),
        'cancelaciones': get_int('cancelaciones'),
        'reprogramandos': get_int('reprogramandos'),
        'seguimientos_iniciados': get_int('seguimientos_iniciados'),
        'seguimientos_contestados': get_int('seguimientos_contestados'),
    }

    if report:
        for key, val in field_values.items():
            setattr(report, key, val)
    else:
        report = TriageDailyReport(triage_name=triage_name, date=report_date, **field_values)
        db.session.add(report)

    try:
        db.session.commit()
        # Trigger Webhook
        _trigger_triage_report_webhook(report)
        return jsonify({"message": f"Reporte de {triage_name} guardado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


def _trigger_triage_report_webhook(report):
    """Dispara el webhook de Discord para el reporte de triage."""
    try:
        import requests
        import json
        from app.services.image_service import ImageService
        
        import os
        url = os.environ.get('DISCORD_REPORTS_WEBHOOK')
        if not url:
            from app.models import Integration
            integration = Integration.query.filter_by(key='discord_reports').first()
            if integration and integration.payload_config:
                url = integration.payload_config.get('webhook_url')

        if not url:
            print("[Discord Triage] No webhook URL configured in environment or database.")
            return
        
        # Calcular tasas para la imagen
        nuevas = report.agendas_nuevas or 0
        conf = report.agendas_confirmadas or 0
        seg_ini = report.seguimientos_iniciados or 0
        seg_res = report.seguimientos_contestados or 0
        
        conf_rate = round((conf / nuevas * 100), 1) if nuevas > 0 else 0
        fu_rate = round((seg_res / seg_ini * 100), 1) if seg_ini > 0 else 0
        
        img_data = {
            "triage_name": report.triage_name,
            "date_str": report.date.strftime('%d/%m/%Y'),
            "agendas_nuevas": nuevas,
            "agendas_confirmadas": conf,
            "no_contestan": report.no_contestan or 0,
            "cancelaciones": report.cancelaciones or 0,
            "reprogramandos": report.reprogramandos or 0,
            "seguimientos_iniciados": seg_ini,
            "seguimientos_contestados": seg_res,
            "confirm_rate": conf_rate,
            "follow_up_rate": fu_rate,
            "total_gestiones": nuevas + seg_ini
        }

        # Generar Imagen
        img_buffer = ImageService.generate_triage_report_card(img_data)
        
        # Metadatos Discord
        content = (
            f"🎯 **REPORTE DIARIO DE TRIAGE**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 **Triage:** `{report.triage_name}`\n"
            f"📅 **Fecha:** `{report.date.strftime('%d/%m/%Y')}`\n"
            f"📊 **Resultados:** `{nuevas} En Gestión | {conf} Confirmadas`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"@everyone"
        )
        
        json_payload = {
            "content": content,
            "embeds": [{
                "color": 65280, # Verde
                "image": {
                    "url": "attachment://triage_report.png"
                },
                "footer": {
                    "text": "NeurOPS Triage System • " + datetime.now().strftime('%H:%M')
                }
            }]
        }
        
        files = {
            'file': ('triage_report.png', img_buffer, 'image/png')
        }
        
        res = requests.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=10)
        print(f"[Discord Triage] Status: {res.status_code}")
        
    except Exception as e:
        print(f"[Discord Triage Error] {e}")
        import traceback
        traceback.print_exc()


@bp.route('/public/triage-stats', methods=['GET'])
def get_public_triage_stats():
    """Retorna estadísticas agregadas para triages."""
    from app.models import TriageDailyReport
    from sqlalchemy import func

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    triage_name = request.args.get('triage_name')
    agg_type = request.args.get('agg_type', 'sum')

    query = db.session.query(
        func.sum(TriageDailyReport.agendas_nuevas).label('agendas_nuevas'),
        func.sum(TriageDailyReport.agendas_confirmadas).label('agendas_confirmadas'),
        func.sum(TriageDailyReport.no_contestan).label('no_contestan'),
        func.sum(TriageDailyReport.cancelaciones).label('cancelaciones'),
        func.sum(TriageDailyReport.reprogramandos).label('reprogramandos'),
        func.sum(TriageDailyReport.seguimientos_iniciados).label('seguimientos_iniciados'),
        func.sum(TriageDailyReport.seguimientos_contestados).label('seguimientos_contestados'),
        func.count(TriageDailyReport.id).label('days_count')
    )

    if start_date_str:
        query = query.filter(TriageDailyReport.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(TriageDailyReport.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
    if triage_name:
        query = query.filter(TriageDailyReport.triage_name == triage_name)

    stats = query.one()
    days_count = stats.days_count or 1

    def process_val(v):
        val = float(v or 0)
        if agg_type == 'avg' and days_count > 0:
            return round(val / days_count, 2)
        return val

    return jsonify({
        "metadata": {"days_analyzed": days_count, "agg_type": agg_type},
        "totals": {
            "agendas_nuevas": process_val(stats.agendas_nuevas),
            "agendas_confirmadas": process_val(stats.agendas_confirmadas),
            "no_contestan": process_val(stats.no_contestan),
            "cancelaciones": process_val(stats.cancelaciones),
            "reprogramandos": process_val(stats.reprogramandos),
            "seguimientos_iniciados": process_val(stats.seguimientos_iniciados),
            "seguimientos_contestados": process_val(stats.seguimientos_contestados)
        }
    }), 200


@bp.route('/public/triage-reports', methods=['GET'])
def get_public_triage_reports():
    """Retorna lista de reportes de triage con filtros."""
    from app.models import TriageDailyReport

    triage_name = request.args.get('triage_name')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))

    query = TriageDailyReport.query

    if triage_name:
        query = query.filter(TriageDailyReport.triage_name == triage_name)
    if start_date_str:
        query = query.filter(TriageDailyReport.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(TriageDailyReport.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())

    pagination = query.order_by(TriageDailyReport.date.desc()).paginate(page=page, per_page=per_page)

    return jsonify({
        "reports": [{
            "id": r.id,
            "date": r.date.isoformat(),
            "triage_name": r.triage_name,
            "agendas_nuevas": r.agendas_nuevas,
            "agendas_confirmadas": r.agendas_confirmadas,
            "no_contestan": r.no_contestan,
            "cancelaciones": r.cancelaciones,
            "reprogramandos": r.reprogramandos,
            "seguimientos_iniciados": r.seguimientos_iniciados,
            "seguimientos_contestados": r.seguimientos_contestados
        } for r in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    }), 200


@bp.route('/public/triage-reports/<int:report_id>', methods=['PUT'])
def update_public_triage_report(report_id):
    """Actualiza un reporte de triage existente."""
    from app.models import TriageDailyReport
    report = TriageDailyReport.query.get_or_404(report_id)
    data = request.get_json() or {}

    try:
        report.agendas_nuevas = int(data.get('agendas_nuevas') or report.agendas_nuevas)
        report.agendas_confirmadas = int(data.get('agendas_confirmadas') or report.agendas_confirmadas)
        report.no_contestan = int(data.get('no_contestan') or report.no_contestan)
        report.cancelaciones = int(data.get('cancelaciones') or report.cancelaciones)
        report.reprogramandos = int(data.get('reprogramandos') or report.reprogramandos)
        report.seguimientos_iniciados = int(data.get('seguimientos_iniciados') or report.seguimientos_iniciados)
        report.seguimientos_contestados = int(data.get('seguimientos_contestados') or report.seguimientos_contestados)

        db.session.commit()
        return jsonify({"message": "Reporte actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@bp.route('/public/triage-reports/<int:report_id>', methods=['DELETE'])
def delete_public_triage_report(report_id):
    """Elimina un reporte de triage."""
    from app.models import TriageDailyReport
    report = TriageDailyReport.query.get_or_404(report_id)
    try:
        db.session.delete(report)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

from . import closer
