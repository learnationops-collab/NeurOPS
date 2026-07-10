from flask import request, jsonify
from app.models import db, User
from datetime import datetime, date, timedelta
from . import bp
import json
import requests

# ============================================================
# TRIAGE DAILY REPORT
# ============================================================

@bp.route('/public/active-triage', methods=['GET'])
def get_active_triage():
    """Retorna lista de triadores activos (ID y nombre)."""
    try:
        triages = User.query.filter_by(role='triage', is_active=True).all()
        return jsonify([
            {"id": t.id, "name": t.username}
            for t in triages
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/public/triage-report/prefill', methods=['GET'])
def prefill_triage_report():
    """Autollena las métricas de agendas para el triaje en base a la fecha y nombre."""
    triage_name = request.args.get('triage_name')
    report_date_str = request.args.get('date')

    if not triage_name or not report_date_str:
        return jsonify({"message": "Nombre del triage y fecha son obligatorios"}), 400

    try:
        target_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400

    from app.models import FinancialAgenda
    from sqlalchemy import func

    triage_name_clean = triage_name.strip().lower()

    # Traer todas las agendas de este triador de forma insensible a mayúsculas
    all_agendas = FinancialAgenda.query.filter(
        func.lower(FinancialAgenda.encargado_triage) == triage_name_clean
    ).all()

    today_agendas_list = []
    future_agendas_list = []

    for a in all_agendas:
        if not a.date:
            continue
        
        # Extraer fechas puras
        agenda_date = a.date.date() if isinstance(a.date, (datetime, date)) else a.date
        created_date = a.created_at.date() if a.created_at else None

        if agenda_date == target_date:
            today_agendas_list.append(a)
        elif created_date == target_date and agenda_date > target_date:
            future_agendas_list.append(a)

    # Helper robusto para clasificar e identificar estados por palabras clave insensibles a mayúsculas
    def count_status(agendas, keywords):
        count = 0
        for a in agendas:
            if not a.estado:
                continue
            est_clean = str(a.estado).strip().lower()
            if any(kw in est_clean for kw in keywords):
                count += 1
        return count

    # Palabras clave para los estados
    kw_contacted = ['contac']
    kw_confirmed = ['confirm']
    kw_canceled = ['cancel']
    kw_rescheduled = ['reagend', 'reprog']

    # Métricas de hoy
    today_agendas = len(today_agendas_list)
    today_contacted = count_status(today_agendas_list, kw_contacted)
    today_confirmed = count_status(today_agendas_list, kw_confirmed)
    today_canceled = count_status(today_agendas_list, kw_canceled)
    today_rescheduled = count_status(today_agendas_list, kw_rescheduled)

    # Métricas futuras
    future_agendas = len(future_agendas_list)
    future_contacted = count_status(future_agendas_list, kw_contacted)
    future_confirmed = count_status(future_agendas_list, kw_confirmed)
    future_canceled = count_status(future_agendas_list, kw_canceled)
    future_rescheduled = count_status(future_agendas_list, kw_rescheduled)

    return jsonify({
        "today_agendas": today_agendas,
        "today_contacted": today_contacted,
        "today_confirmed": today_confirmed,
        "today_canceled": today_canceled,
        "today_rescheduled": today_rescheduled,
        
        "future_agendas": future_agendas,
        "future_contacted": future_contacted,
        "future_confirmed": future_confirmed,
        "future_canceled": future_canceled,
        "future_rescheduled": future_rescheduled,
        
        "recoveries_contacted": 0,
        "recoveries_replied": 0,
        "recoveries_scheduled": 0
    }), 200


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
        'today_agendas': get_int('today_agendas'),
        'today_contacted': get_int('today_contacted'),
        'today_confirmed': get_int('today_confirmed'),
        'today_canceled': get_int('today_canceled'),
        'today_rescheduled': get_int('today_rescheduled'),
        
        'future_agendas': get_int('future_agendas'),
        'future_contacted': get_int('future_contacted'),
        'future_confirmed': get_int('future_confirmed'),
        'future_canceled': get_int('future_canceled'),
        'future_rescheduled': get_int('future_rescheduled'),
        
        'recoveries_contacted': get_int('recoveries_contacted'),
        'recoveries_replied': get_int('recoveries_replied'),
        'recoveries_scheduled': get_int('recoveries_scheduled'),
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
        
        # Calcular tasas
        today_conf = report.today_confirmed or 0
        today_tot = report.today_agendas or 0
        conf_rate = round((today_conf / today_tot * 100), 1) if today_tot > 0 else 0
        
        img_data = {
            "triage_name": report.triage_name,
            "date_str": report.date.strftime('%d/%m/%Y'),
            "today_agendas": report.today_agendas or 0,
            "today_contacted": report.today_contacted or 0,
            "today_confirmed": report.today_confirmed or 0,
            "today_canceled": report.today_canceled or 0,
            "today_rescheduled": report.today_rescheduled or 0,
            "future_agendas": report.future_agendas or 0,
            "future_contacted": report.future_contacted or 0,
            "future_confirmed": report.future_confirmed or 0,
            "future_canceled": report.future_canceled or 0,
            "future_rescheduled": report.future_rescheduled or 0,
            "recoveries_contacted": report.recoveries_contacted or 0,
            "recoveries_replied": report.recoveries_replied or 0,
            "recoveries_scheduled": report.recoveries_scheduled or 0,
            "confirm_rate": conf_rate
        }

        # Generar Imagen
        img_buffer = ImageService.generate_triage_report_card(img_data)
        
        # Metadatos Discord
        content = (
            f"🎯 **REPORTE DIARIO DE TRIAJE**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 **Triaje:** `{report.triage_name}`\n"
            f"📅 **Fecha:** `{report.date.strftime('%d/%m/%Y')}`\n"
            f"📊 **Resultados Hoy:** `{today_conf}/{today_tot} Confirmadas ({conf_rate}%)`\n"
            f"🔮 **Futuras Confirmadas:** `{report.future_confirmed}/{report.future_agendas}`\n"
            f"🔄 **Recuperaciones:** `{report.recoveries_scheduled} Agendas`\n"
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
                    "text": "NeurOPS Triaje System • " + datetime.now().strftime('%H:%M')
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
        func.sum(TriageDailyReport.today_agendas).label('today_agendas'),
        func.sum(TriageDailyReport.today_contacted).label('today_contacted'),
        func.sum(TriageDailyReport.today_confirmed).label('today_confirmed'),
        func.sum(TriageDailyReport.today_canceled).label('today_canceled'),
        func.sum(TriageDailyReport.today_rescheduled).label('today_rescheduled'),
        func.sum(TriageDailyReport.future_agendas).label('future_agendas'),
        func.sum(TriageDailyReport.future_contacted).label('future_contacted'),
        func.sum(TriageDailyReport.future_confirmed).label('future_confirmed'),
        func.sum(TriageDailyReport.future_canceled).label('future_canceled'),
        func.sum(TriageDailyReport.future_rescheduled).label('future_rescheduled'),
        func.sum(TriageDailyReport.recoveries_contacted).label('recoveries_contacted'),
        func.sum(TriageDailyReport.recoveries_replied).label('recoveries_replied'),
        func.sum(TriageDailyReport.recoveries_scheduled).label('recoveries_scheduled'),
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
            "today_agendas": process_val(stats.today_agendas),
            "today_contacted": process_val(stats.today_contacted),
            "today_confirmed": process_val(stats.today_confirmed),
            "today_canceled": process_val(stats.today_canceled),
            "today_rescheduled": process_val(stats.today_rescheduled),
            "future_agendas": process_val(stats.future_agendas),
            "future_contacted": process_val(stats.future_contacted),
            "future_confirmed": process_val(stats.future_confirmed),
            "future_canceled": process_val(stats.future_canceled),
            "future_rescheduled": process_val(stats.future_rescheduled),
            "recoveries_contacted": process_val(stats.recoveries_contacted),
            "recoveries_replied": process_val(stats.recoveries_replied),
            "recoveries_scheduled": process_val(stats.recoveries_scheduled)
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
        "reports": [r.to_dict() for r in pagination.items],
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
        if 'date' in data and data['date']:
            try:
                report.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"message": "Formato de fecha inválido. Debe ser YYYY-MM-DD"}), 400

        report.today_agendas = int(data.get('today_agendas') or report.today_agendas)
        report.today_contacted = int(data.get('today_contacted') or report.today_contacted)
        report.today_confirmed = int(data.get('today_confirmed') or report.today_confirmed)
        report.today_canceled = int(data.get('today_canceled') or report.today_canceled)
        report.today_rescheduled = int(data.get('today_rescheduled') or report.today_rescheduled)
        
        report.future_agendas = int(data.get('future_agendas') or report.future_agendas)
        report.future_contacted = int(data.get('future_contacted') or report.future_contacted)
        report.future_confirmed = int(data.get('future_confirmed') or report.future_confirmed)
        report.future_canceled = int(data.get('future_canceled') or report.future_canceled)
        report.future_rescheduled = int(data.get('future_rescheduled') or report.future_rescheduled)
        
        report.recoveries_contacted = int(data.get('recoveries_contacted') or report.recoveries_contacted)
        report.recoveries_replied = int(data.get('recoveries_replied') or report.recoveries_replied)
        report.recoveries_scheduled = int(data.get('recoveries_scheduled') or report.recoveries_scheduled)

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
