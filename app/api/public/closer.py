from flask import request, jsonify, render_template
from app.models import db, User
from flask_login import current_user
from datetime import datetime
from . import bp

# ============================================================
# CLOSER DAILY REPORT
# ============================================================

@bp.route('/public/active-closers', methods=['GET'])
def get_active_closers():
    """Retorna lista de closers activos (ID y nombre)."""
    try:
        closers = User.query.filter_by(role='closer', is_active=True).all()
        return jsonify([
            {"id": c.id, "name": c.username}
            for c in closers
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/public/closer-report', methods=['POST'])
def submit_public_closer_report():
    """Recibe y guarda el reporte diario de un closer."""
    from app.models import CloserDailyReport

    data = request.get_json() or {}

    closer_id = data.get('closer_id')
    report_date_str = data.get('date')

    if not closer_id or not report_date_str:
        return jsonify({"message": "ID del closer y fecha son obligatorios"}), 400

    try:
        report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400

    # Buscar reporte existente o crear nuevo
    report = CloserDailyReport.query.filter_by(closer_id=closer_id, date=report_date).first()

    # Helper para parsear enteros y floats del payload
    def get_int(key):
        return int(data.get(key) or 0)

    def get_float(key):
        return float(data.get(key) or 0.0)

    field_values = {
        # Generales
        'slots': get_int('slots'),
        'offers_made': get_int('offers_made'),
        # Llamadas
        'decision_makers': get_int('decision_makers'),
        'rescheduled_calls': get_int('rescheduled_calls'),
        # Primera Llamada
        'first_call_scheduled': get_int('first_call_scheduled'),
        'first_call_attended': get_int('first_call_attended'),
        'first_call_no_show': get_int('first_call_no_show'),
        'first_call_rescheduled': get_int('first_call_rescheduled'),
        'first_call_canceled': get_int('first_call_canceled'),
        # Segunda Llamada
        'second_call_scheduled': get_int('second_call_scheduled'),
        'second_call_attended': get_int('second_call_attended'),
        'second_call_no_show': get_int('second_call_no_show'),
        'second_call_rescheduled': get_int('second_call_rescheduled'),
        'second_call_canceled': get_int('second_call_canceled'),
        # Ventas PIF
        'pif_count': get_int('pif_count'),
        'pif_cash_collected': get_float('pif_cash_collected'),
        'pif_in_call_count': get_int('pif_in_call_count'),
        'pif_in_call_cash': get_float('pif_in_call_cash'),
        # Ventas Split Pay
        'split_count': get_int('split_count'),
        'split_cash_collected': get_float('split_cash_collected'),
        'split_in_call_count': get_int('split_in_call_count'),
        'split_in_call_cash': get_float('split_in_call_cash'),
        # Ventas Señas
        'deposit_count': get_int('deposit_count'),
        'deposit_cash_collected': get_float('deposit_cash_collected'),
        'deposit_in_call_count': get_int('deposit_in_call_count'),
        'deposit_in_call_cash': get_float('deposit_in_call_cash'),
        # Ventas Cuotas
        'installment_count': get_int('installment_count'),
        'installment_cash_collected': get_float('installment_cash_collected'),
        'installment_in_call_count': get_int('installment_in_call_count'),
        'installment_in_call_cash': get_float('installment_in_call_cash'),
        # Seguimientos
        'follow_ups_sent': get_int('follow_ups_sent'),
        'follow_ups_replied': get_int('follow_ups_replied'),
        'follow_ups_closed': get_int('follow_ups_closed'),
        # Recuperaciones
        'recoveries_contacted': get_int('recoveries_contacted'),
        'recoveries_replied': get_int('recoveries_replied'),
        'recoveries_scheduled': get_int('recoveries_scheduled'),
        # Referidos
        'referrals_sourced': get_int('referrals_sourced'),
        'referrals_scheduled': get_int('referrals_scheduled'),
        # Reflexión legacy
        'reflection_victory': data.get('reflection_victory'),
        'reflection_opportunity': data.get('reflection_opportunity'),
        # Daily Reflection (5 preguntas como JSON)
        'reflections': data.get('reflections'),
    }

    if report:
        for key, val in field_values.items():
            setattr(report, key, val)
    else:
        report = CloserDailyReport(closer_id=closer_id, date=report_date, **field_values)
        db.session.add(report)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    # Discord separado para no comprometer el guardado si falla
    try:
        _trigger_closer_report_discord(report)
    except Exception as e:
        print(f"[Closer Webhook Error] {e}")
        import traceback
        traceback.print_exc()

    return jsonify({"message": "Reporte de closer guardado exitosamente"}), 201


def _prepare_report_data(report):
    """Calcula y estructura todas las métricas del reporte diario de un closer (KISS & DRY)."""
    closer_name = report.closer.username if report.closer else "Closer"
    date_str = report.date.strftime('%d/%m/%Y')

    def safe_percent(part, total):
        try:
            if total > 0:
                return round((part / total) * 100)
        except:
            pass
        return 0

    # Totales de ventas
    total_sales = (report.pif_count or 0) + (report.split_count or 0) + (report.deposit_count or 0)
    total_cash = (report.pif_cash_collected or 0) + (report.split_cash_collected or 0) + (report.deposit_cash_collected or 0) + (report.installment_cash_collected or 0.0)

    # Totales de agendas
    total_scheduled = (report.first_call_scheduled or 0) + (report.second_call_scheduled or 0)
    total_attended = (report.first_call_attended or 0) + (report.second_call_attended or 0)
    
    offers_made = report.offers_made or 0
    decision_makers = report.decision_makers or 0
    rescheduled_calls = report.rescheduled_calls or 0

    # Cálculos de porcentajes y tasas
    show_rate = safe_percent(total_attended, total_scheduled)
    pitch_rate = safe_percent(offers_made, total_attended)
    # Close rate promesa: incluye señas (compromiso de compra)
    close_rate_promesa = safe_percent(total_sales, total_attended)
    # Close rate operativo: solo PIF + Split (dinero real cerrado en llamada)
    sales_operativo = (report.pif_count or 0) + (report.split_count or 0)
    close_rate_operativo = safe_percent(sales_operativo, total_attended)
    offer_to_sale = safe_percent(total_sales, offers_made)
    total_no_show = (report.first_call_no_show or 0) + (report.second_call_no_show or 0)
    no_show_rate = safe_percent(total_no_show, total_scheduled)
    total_canc_rep = (
        (report.first_call_canceled or 0) + (report.second_call_canceled or 0) +
        (report.first_call_rescheduled or 0) + (report.second_call_rescheduled or 0)
    )
    canc_rep_rate = safe_percent(total_canc_rep, total_scheduled)

    # Slots disponibles y su porcentaje
    slots_totales = report.slots or 0
    slots_disponibles = max(0, slots_totales - total_scheduled)
    slots_available_pct = safe_percent(slots_disponibles, slots_totales)

    return {
        "closer_name": closer_name,
        "date_str": date_str,
        "general": {
            "slots": slots_totales,
            "slots_available_pct": slots_available_pct,
            "offers_made": offers_made,
            "decision_makers": decision_makers,
            "rescheduled_calls": rescheduled_calls
        },
        "rates": {
            "show_rate": show_rate,
            "pitch_rate": pitch_rate,
            "close_rate_promesa": close_rate_promesa,
            "close_rate_operativo": close_rate_operativo,
            "offer_to_sale": offer_to_sale,
            "no_show_rate": no_show_rate,
            "canc_rep_rate": canc_rep_rate
        },
        "agendas": {
            "totals": {
                "scheduled": total_scheduled,
                "attended": total_attended,
                "no_show": total_no_show,
                "canceled": (report.first_call_canceled or 0) + (report.second_call_canceled or 0),
                "rescheduled": (report.first_call_rescheduled or 0) + (report.second_call_rescheduled or 0),
            },
            "first_call": {
                "scheduled": report.first_call_scheduled or 0,
                "attended": report.first_call_attended or 0,
                "no_show": report.first_call_no_show or 0,
                "canceled": report.first_call_canceled or 0,
                "rescheduled": report.first_call_rescheduled or 0,
            },
            "second_call": {
                "scheduled": report.second_call_scheduled or 0,
                "attended": report.second_call_attended or 0,
                "no_show": report.second_call_no_show or 0,
                "canceled": report.second_call_canceled or 0,
                "rescheduled": report.second_call_rescheduled or 0,
            }
        },
        "sales": {
            "totals": {
                "count": total_sales,
                "cash": total_cash,
                "in_call_count": (report.pif_in_call_count or 0) + (report.split_in_call_count or 0) + (report.deposit_in_call_count or 0) + (report.installment_in_call_count or 0),
                "in_call_cash": (report.pif_in_call_cash or 0) + (report.split_in_call_cash or 0) + (report.deposit_in_call_cash or 0) + (report.installment_in_call_cash or 0.0),
                "out_call_count": total_sales - ((report.pif_in_call_count or 0) + (report.split_in_call_count or 0) + (report.deposit_in_call_count or 0) + (report.installment_in_call_count or 0)),
                "out_call_cash": total_cash - ((report.pif_in_call_cash or 0) + (report.split_in_call_cash or 0) + (report.deposit_in_call_cash or 0) + (report.installment_in_call_cash or 0.0)),
            },
            "pif": {
                "count": report.pif_count or 0,
                "cash": report.pif_cash_collected or 0,
                "in_call_count": report.pif_in_call_count or 0,
                "in_call_cash": report.pif_in_call_cash or 0,
            },
            "split": {
                "count": report.split_count or 0,
                "cash": report.split_cash_collected or 0,
                "in_call_count": report.split_in_call_count or 0,
                "in_call_cash": report.split_in_call_cash or 0,
            },
            "deposit": {
                "count": report.deposit_count or 0,
                "cash": report.deposit_cash_collected or 0,
                "in_call_count": report.deposit_in_call_count or 0,
                "in_call_cash": report.deposit_in_call_cash or 0,
            },
            "installment": {
                "count": report.installment_count or 0,
                "cash": report.installment_cash_collected or 0.0,
                "in_call_count": report.installment_in_call_count or 0,
                "in_call_cash": report.installment_in_call_cash or 0.0,
            }
        },
        "follow_up": {
            "total_sent": report.follow_ups_sent or 0,
            "total_replied": report.follow_ups_replied or 0,
            "closed": report.follow_ups_closed or 0,
            "response_pct": safe_percent(report.follow_ups_replied or 0, report.follow_ups_sent or 0),
        },
        "recoveries": {
            "contacted": report.recoveries_contacted or 0,
            "replied": report.recoveries_replied or 0,
            "scheduled": report.recoveries_scheduled or 0,
            "response_pct": safe_percent(report.recoveries_replied or 0, report.recoveries_contacted or 0),
        },
        "referrals": {
            "sourced": report.referrals_sourced or 0,
            "scheduled": report.referrals_scheduled or 0,
        },
        "reflections": {
            "victory": report.reflection_victory or "Sin especificar",
            "opportunity": report.reflection_opportunity or "Sin especificar"
        }
    }


def _trigger_closer_report_discord(report):
    """Envía el reporte diario del closer a Discord con un embed formateado y una imagen renderizada."""
    try:
        import requests as req
        import json
        from datetime import datetime
        from app.services.image_service import ImageService

        import os
        url = os.environ.get('DISCORD_REPORTS_WEBHOOK')
        if not url:
            from app.models import Integration
            integration = Integration.query.filter_by(key='discord_reports').first()
            if integration and integration.payload_config:
                url = integration.payload_config.get('webhook_url')

        if not url:
            print("[Discord Closer] No webhook URL configured in environment or database.")
            return

        closer_name = report.closer.username if report.closer else "Closer"
        date_str = report.date.strftime('%d/%m/%Y')

        # Obtener los datos estructurados del reporte
        img_data = _prepare_report_data(report)

        # Generar Imagen Principal
        img_buffer = ImageService.generate_closer_report_card(img_data)

        # Generar Imagen de Reflexión
        reflection_data = {
            "user_name": closer_name,
            "date": date_str,
            "reflections": report.reflections or {}
        }
        reflection_buffer = ImageService.generate_reflection_card(reflection_data)

        # Payload para Discord
        content = (
            f"🎯 **NUEVO REPORTE DIARIO DE CLOSER**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 **Closer:** `{closer_name}`\n"
            f"📅 **Fecha:** `{date_str}`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"@everyone"
        )

        json_payload = {
            "content": content,
            "embeds": [
                {
                    "color": 9384170, # Violeta
                    "image": {"url": "attachment://closer_report.png"},
                    "footer": {"text": "NeurOPS Performance"}
                },
                {
                    "color": 6502897, # Indigo
                    "image": {"url": "attachment://reflection.png"},
                    "footer": {"text": "Daily Reflection"}
                }
            ]
        }

        files = {
            'file1': ('closer_report.png', img_buffer, 'image/png'),
            'file2': ('reflection.png', reflection_buffer, 'image/png')
        }

        res = req.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=25)
        print(f"[Discord Closer] Status: {res.status_code}")

    except Exception as e:
        print(f"[Discord Closer Error] {e}")
        import traceback
        traceback.print_exc()


def _subtract_one_month(d):
    """Resta exactamente un mes calendario a un objeto date."""
    year = d.year
    month = d.month - 1
    if month == 0:
        month = 12
        year -= 1
    day = d.day
    while True:
        try:
            from datetime import date
            return date(year, month, day)
        except ValueError:
            day -= 1

@bp.route('/public/closer-stats', methods=['GET'])
def get_public_closer_stats():
    """Retorna estadísticas agregadas de closers con soporte de suma/promedio."""
    from app.services.closer_service import CloserService
    from datetime import datetime, timedelta

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    closer_id = request.args.get('closer_id')
    agg_type = request.args.get('agg_type', 'sum')
    compare = request.args.get('compare') == 'true'

    res = CloserService.get_comprehensive_stats(
        closer_id=closer_id,
        start_date=start_date,
        end_date=end_date,
        agg_type=agg_type
    )

    compare_mode = request.args.get('compare_mode', 'month')

    if compare and start_date and end_date:
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            if compare_mode == 'period':
                delta = (end_dt - start_dt) + timedelta(days=1)
                prev_start_date = start_dt - delta
                prev_end_date = end_dt - delta
            else:
                prev_start_date = _subtract_one_month(start_dt)
                prev_end_date = _subtract_one_month(end_dt)

            prev_start_str = prev_start_date.strftime('%Y-%m-%d')
            prev_end_str = prev_end_date.strftime('%Y-%m-%d')

            res['comparison'] = CloserService.get_comprehensive_stats(
                closer_id=closer_id,
                start_date=prev_start_str,
                end_date=prev_end_str,
                agg_type=agg_type
            )
            res['comparison_period'] = {'start': prev_start_str, 'end': prev_end_str}
        except Exception as e:
            pass

    return jsonify(res), 200


@bp.route('/public/closer-reports', methods=['GET'])
def get_public_closer_reports():
    """Retorna lista paginada de reportes de closers con filtros."""
    from app.models import CloserDailyReport, User
    
    closer_id = request.args.get('closer_id')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    
    query = CloserDailyReport.query
    
    if closer_id:
        query = query.filter(CloserDailyReport.closer_id == closer_id)
    if start_date_str:
        query = query.filter(CloserDailyReport.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(CloserDailyReport.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
        
    pagination = query.order_by(CloserDailyReport.date.desc()).paginate(page=page, per_page=per_page)
    
    reports = []
    for r in pagination.items:
        reports.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "closer_id": r.closer_id,
            "closer_name": r.closer.username if r.closer else "Unknown",
            "slots": r.slots,
            "offers_made": r.offers_made,
            "decision_makers": r.decision_makers,
            "rescheduled_calls": r.rescheduled_calls,
            "reflection_victory": r.reflection_victory,
            "reflection_opportunity": r.reflection_opportunity,
            "first_call_scheduled": r.first_call_scheduled,
            "first_call_attended": r.first_call_attended,
            "first_call_no_show": r.first_call_no_show,
            "first_call_rescheduled": r.first_call_rescheduled,
            "first_call_canceled": r.first_call_canceled,
            "second_call_scheduled": r.second_call_scheduled,
            "second_call_attended": r.second_call_attended,
            "second_call_no_show": r.second_call_no_show,
            "second_call_rescheduled": r.second_call_rescheduled,
            "second_call_canceled": r.second_call_canceled,
            "pif_count": r.pif_count,
            "pif_cash_collected": r.pif_cash_collected,
            "pif_in_call_count": r.pif_in_call_count,
            "pif_in_call_cash": r.pif_in_call_cash,
            "split_count": r.split_count,
            "split_cash_collected": r.split_cash_collected,
            "split_in_call_count": r.split_in_call_count,
            "split_in_call_cash": r.split_in_call_cash,
            "deposit_count": r.deposit_count,
            "deposit_cash_collected": r.deposit_cash_collected,
            "deposit_in_call_count": r.deposit_in_call_count,
            "deposit_in_call_cash": r.deposit_in_call_cash,
            "installment_count": r.installment_count,
            "installment_cash_collected": r.installment_cash_collected,
            "installment_in_call_count": r.installment_in_call_count,
            "installment_in_call_cash": r.installment_in_call_cash,
            "follow_ups_sent": r.follow_ups_sent,
            "follow_ups_replied": r.follow_ups_replied,
            "follow_ups_closed": r.follow_ups_closed,
            "recoveries_contacted": r.recoveries_contacted,
            "recoveries_replied": r.recoveries_replied,
            "recoveries_scheduled": r.recoveries_scheduled,
            "referrals_sourced": r.referrals_sourced,
            "referrals_scheduled": r.referrals_scheduled,
            "reflection_victory": r.reflection_victory,
            "reflection_opportunity": r.reflection_opportunity,
            "reflections": r.reflections or {}
        })
        
    return jsonify({
        "reports": reports,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    }), 200

@bp.route('/public/closer-reports/<int:report_id>', methods=['PUT'])
def update_public_closer_report(report_id):
    """Actualiza un reporte existente."""
    from app.models import CloserDailyReport
    
    stat = CloserDailyReport.query.get_or_404(report_id)
    data = request.get_json() or {}
    
    def get_int(key, current):
        val = data.get(key)
        if val is None or val == '': return current
        try: return int(val)
        except (ValueError, TypeError): return current

    def get_float(key, current):
        val = data.get(key)
        if val is None or val == '': return current
        try: return float(val)
        except (ValueError, TypeError): return current
    
    try:
        if 'date' in data and data['date']:
            try:
                stat.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"message": "Formato de fecha inválido. Debe ser YYYY-MM-DD"}), 400
                
        stat.slots = get_int('slots', stat.slots)
        stat.offers_made = get_int('offers_made', stat.offers_made)
        
        stat.first_call_scheduled = get_int('first_call_scheduled', stat.first_call_scheduled)
        stat.first_call_attended = get_int('first_call_attended', stat.first_call_attended)
        stat.first_call_no_show = get_int('first_call_no_show', stat.first_call_no_show)
        stat.first_call_rescheduled = get_int('first_call_rescheduled', stat.first_call_rescheduled)
        stat.first_call_canceled = get_int('first_call_canceled', stat.first_call_canceled)
        
        stat.second_call_scheduled = get_int('second_call_scheduled', stat.second_call_scheduled)
        stat.second_call_attended = get_int('second_call_attended', stat.second_call_attended)
        stat.second_call_no_show = get_int('second_call_no_show', stat.second_call_no_show)
        stat.second_call_rescheduled = get_int('second_call_rescheduled', stat.second_call_rescheduled)
        stat.second_call_canceled = get_int('second_call_canceled', stat.second_call_canceled)
        
        stat.pif_count = get_int('pif_count', stat.pif_count)
        stat.pif_cash_collected = get_float('pif_cash_collected', stat.pif_cash_collected)
        stat.pif_in_call_count = get_int('pif_in_call_count', stat.pif_in_call_count)
        stat.pif_in_call_cash = get_float('pif_in_call_cash', stat.pif_in_call_cash)
        
        stat.split_count = get_int('split_count', stat.split_count)
        stat.split_cash_collected = get_float('split_cash_collected', stat.split_cash_collected)
        stat.split_in_call_count = get_int('split_in_call_count', stat.split_in_call_count)
        stat.split_in_call_cash = get_float('split_in_call_cash', stat.split_in_call_cash)
        
        stat.deposit_count = get_int('deposit_count', stat.deposit_count)
        stat.deposit_cash_collected = get_float('deposit_cash_collected', stat.deposit_cash_collected)
        stat.deposit_in_call_count = get_int('deposit_in_call_count', stat.deposit_in_call_count)
        stat.deposit_in_call_cash = get_float('deposit_in_call_cash', stat.deposit_in_call_cash)
        
        stat.installment_count = get_int('installment_count', stat.installment_count)
        stat.installment_cash_collected = get_float('installment_cash_collected', stat.installment_cash_collected)
        stat.installment_in_call_count = get_int('installment_in_call_count', stat.installment_in_call_count)
        stat.installment_in_call_cash = get_float('installment_in_call_cash', stat.installment_in_call_cash)
        
        stat.follow_ups_sent = get_int('follow_ups_sent', stat.follow_ups_sent)
        stat.follow_ups_replied = get_int('follow_ups_replied', stat.follow_ups_replied)
        stat.follow_ups_closed = get_int('follow_ups_closed', stat.follow_ups_closed)
        
        stat.recoveries_contacted = get_int('recoveries_contacted', stat.recoveries_contacted)
        stat.recoveries_replied = get_int('recoveries_replied', stat.recoveries_replied)
        stat.recoveries_scheduled = get_int('recoveries_scheduled', stat.recoveries_scheduled)
        
        stat.referrals_sourced = get_int('referrals_sourced', stat.referrals_sourced)
        stat.referrals_scheduled = get_int('referrals_scheduled', stat.referrals_scheduled)
        
        stat.reflection_victory = data.get('reflection_victory', stat.reflection_victory)
        stat.reflection_opportunity = data.get('reflection_opportunity', stat.reflection_opportunity)
        if 'reflections' in data:
            stat.reflections = data.get('reflections')

        db.session.commit()
        return jsonify({"message": "Reporte actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@bp.route('/public/closer-reports/<int:report_id>', methods=['DELETE'])
def delete_public_closer_report(report_id):
    """Elimina un reporte."""
    from app.models import CloserDailyReport
    stat = CloserDailyReport.query.get_or_404(report_id)
    try:
        db.session.delete(stat)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@bp.route('/public/closer-reports/<int:report_id>/preview', methods=['GET'])
def preview_closer_report_discord(report_id):
    """Genera una vista previa del reporte de Closer renderizado en HTML para administradores."""
    from app.models import CloserDailyReport, User
    from flask import current_app, render_template_string
    import os

    # Validacion de token robusta si current_user no esta autenticado
    user = None
    if current_user.is_authenticated:
        user = current_user
    else:
        token = request.args.get('token')
        if token:
            user_id = User.verify_auth_token(token)
            if user_id:
                user = User.query.get(user_id)
            
            # Soporte de compatibilidad en desarrollo local (DEBUG) si el ID de admin no existe en SQLite
            if not user and (current_app.config.get('DEBUG') or current_app.debug):
                try:
                    import jwt
                    # Decodificar para asegurar que sea un token firmado con la misma SECRET_KEY
                    jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
                    # En local asignamos el primer administrador disponible de forma transparente
                    user = User.query.filter_by(role='admin').first()
                except Exception as e:
                    print(f"DEBUG PREVIEW BYPASS ERROR: {e}")

    # Validar permisos de administrador
    if not user or user.role != 'admin':
        return jsonify({"error": "No autorizado"}), 403

    report = CloserDailyReport.query.get_or_404(report_id)
    img_data = _prepare_report_data(report)

    # Cargar manualmente el template fisico para evitar TemplateNotFound por template_folder global
    template_path = os.path.join(current_app.root_path, 'templates', 'reports', 'closer_report.html')
    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()

    return render_template_string(template_content, **img_data)


@bp.route('/public/closer-reports/<int:report_id>/resend-discord', methods=['POST'])
def resend_closer_report_discord(report_id):
    """Reenvía un reporte de Closer a Discord."""
    from app.models import CloserDailyReport, User
    from flask_login import current_user
    from app.api.public.closer import _trigger_closer_report_discord

    if not current_user.is_authenticated:
        return jsonify({"error": "No autorizado"}), 401

    if current_user.role not in ['admin', 'closer']:
        return jsonify({"error": "No autorizado"}), 403

    report = CloserDailyReport.query.get_or_404(report_id)

    if current_user.role == 'closer' and report.closer_id != current_user.id:
        return jsonify({"error": "No autorizado"}), 403
    try:
        _trigger_closer_report_discord(report)
        return jsonify({"message": "Reporte reenviado a Discord exitosamente"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/public/closer-report/prefill', methods=['GET'])
def prefill_closer_report():
    """Calcula y retorna los datos automáticos para pre-rellenar el reporte diario de un closer."""
    closer_id_str = request.args.get('closer_id')
    date_str = request.args.get('date')

    if not closer_id_str or not date_str:
        return jsonify({"message": "closer_id y date son obligatorios"}), 400

    try:
        closer_id = int(closer_id_str)
        report_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Parámetros inválidos"}), 400

    user = User.query.get(closer_id)
    if not user:
        return jsonify({"message": "Closer no encontrado"}), 404

    from app.models.booking import Appointment
    from app.models.financial import FinancialSale
    from datetime import datetime as dt_class, time, timedelta
    from sqlalchemy import func

    start_dt = dt_class.combine(report_date, time.min)
    end_dt = dt_class.combine(report_date, time.max)

    # 1. Calcular métricas de agendas (citas del closer para este día)
    day_appointments = Appointment.query.filter(
        Appointment.closer_id == closer_id,
        Appointment.start_time >= start_dt,
        Appointment.start_time <= end_dt
    ).all()

    first_call_scheduled = 0
    first_call_attended = 0
    first_call_no_show = 0
    first_call_rescheduled = 0
    first_call_canceled = 0

    second_call_scheduled = 0
    second_call_attended = 0
    second_call_no_show = 0
    second_call_rescheduled = 0
    second_call_canceled = 0

    decision_makers = 0
    rescheduled_calls = 0

    for appt in day_appointments:
        # Clasificar como Primera vs Segunda llamada basándonos en si tiene citas previas
        prev_count = Appointment.query.filter(
            Appointment.client_id == appt.client_id,
            Appointment.id != appt.id,
            Appointment.start_time < appt.start_time
        ).count()
        is_first = (prev_count == 0)

        if appt.with_decision_maker == True:
            decision_makers += 1

        res = (appt.closer_result or appt.result or '').strip().lower()
        if is_first:
            first_call_scheduled += 1
            if res in ('terminada', 'completada', 'cerrada', 'show up', 'show_up'):
                first_call_attended += 1
            elif res in ('no show', 'no_show'):
                first_call_no_show += 1
            elif res in ('reprogramada', 'reagendada', 'reprogramado', 'reagendado'):
                first_call_rescheduled += 1
                rescheduled_calls += 1
            elif res in ('cancelada', 'cancelado'):
                first_call_canceled += 1
        else:
            second_call_scheduled += 1
            if res in ('terminada', 'completada', 'cerrada', 'show up', 'show_up'):
                second_call_attended += 1
            elif res in ('no show', 'no_show'):
                second_call_no_show += 1
            elif res in ('reprogramada', 'reagendada', 'reprogramado', 'reagendado'):
                second_call_rescheduled += 1
                rescheduled_calls += 1
            elif res in ('cancelada', 'cancelado'):
                second_call_canceled += 1

    # 2. Calcular métricas de ventas
    pif_count = 0
    pif_cash_collected = 0.0
    pif_in_call_count = 0
    pif_in_call_cash = 0.0

    split_count = 0
    split_cash_collected = 0.0
    split_in_call_count = 0
    split_in_call_cash = 0.0

    deposit_count = 0
    deposit_cash_collected = 0.0
    deposit_in_call_count = 0
    deposit_in_call_cash = 0.0

    installment_count = 0
    installment_cash_collected = 0.0
    installment_in_call_count = 0
    installment_in_call_cash = 0.0

    sales_filters = [
        FinancialSale.date >= start_dt,
        FinancialSale.date <= end_dt
    ]
    if user.email:
        sales_filters.append(func.lower(FinancialSale.email_vendedor) == user.email.strip().lower())

    day_sales = FinancialSale.query.filter(*sales_filters).all()

    for sale in day_sales:
        tipo_lower = (sale.tipo_pago or '').lower()
        monto_val = float(sale.monto or 0.0)
        in_call = sale.sold_in_call == True

        if 'upsell' in tipo_lower:
            if 'completo' in tipo_lower or 'unico' in tipo_lower or 'pif' in tipo_lower:
                pif_count += 1
                pif_cash_collected += monto_val
                if in_call:
                    pif_in_call_count += 1
                    pif_in_call_cash += monto_val
            else:
                split_count += 1
                split_cash_collected += monto_val
                if in_call:
                    split_in_call_count += 1
                    split_in_call_cash += monto_val
        elif 'renovacion' in tipo_lower or 'renovación' in tipo_lower:
            if 'completo' in tipo_lower or 'unico' in tipo_lower or 'pif' in tipo_lower:
                pif_count += 1
                pif_cash_collected += monto_val
                if in_call:
                    pif_in_call_count += 1
                    pif_in_call_cash += monto_val
            else:
                split_count += 1
                split_cash_collected += monto_val
                if in_call:
                    split_in_call_count += 1
                    split_in_call_cash += monto_val
        elif 'completo' in tipo_lower or 'unico' in tipo_lower or 'pif' in tipo_lower:
            pif_count += 1
            pif_cash_collected += monto_val
            if in_call:
                pif_in_call_count += 1
                pif_in_call_cash += monto_val
        elif 'seña' in tipo_lower or 'deposito' in tipo_lower or 'deposit' in tipo_lower:
            deposit_count += 1
            deposit_cash_collected += monto_val
            if in_call:
                deposit_in_call_count += 1
                deposit_in_call_cash += monto_val
        elif 'primer pago' in tipo_lower or 'split' in tipo_lower:
            split_count += 1
            split_cash_collected += monto_val
            if in_call:
                split_in_call_count += 1
                split_in_call_cash += monto_val
        elif 'cuota' in tipo_lower or 'installment' in tipo_lower or 'pago 2' in tipo_lower or 'pago 3' in tipo_lower or 'pago 4' in tipo_lower:
            installment_count += 1
            installment_cash_collected += monto_val
            if in_call:
                installment_in_call_count += 1
                installment_in_call_cash += monto_val
        else:
            is_subsequent = False
            import re
            match = re.search(r'pago\s*(\d+)', tipo_lower)
            if match:
                num = int(match.group(1))
                if num > 1:
                    is_subsequent = True
            
            if is_subsequent:
                installment_count += 1
                installment_cash_collected += monto_val
                if in_call:
                    installment_in_call_count += 1
                    installment_in_call_cash += monto_val
            else:
                split_count += 1
                split_cash_collected += monto_val
                if in_call:
                    split_in_call_count += 1
                    split_in_call_cash += monto_val

    return jsonify({
        "slots": 0,
        "offers_made": 0,
        "decision_makers": decision_makers,
        "rescheduled_calls": rescheduled_calls,
        
        "first_call_scheduled": first_call_scheduled,
        "first_call_attended": first_call_attended,
        "first_call_no_show": first_call_no_show,
        "first_call_rescheduled": first_call_rescheduled,
        "first_call_canceled": first_call_canceled,
        
        "second_call_scheduled": second_call_scheduled,
        "second_call_attended": second_call_attended,
        "second_call_no_show": second_call_no_show,
        "second_call_rescheduled": second_call_rescheduled,
        "second_call_canceled": second_call_canceled,
        
        "pif_count": pif_count,
        "pif_cash_collected": pif_cash_collected,
        "pif_in_call_count": pif_in_call_count,
        "pif_in_call_cash": pif_in_call_cash,
        
        "split_count": split_count,
        "split_cash_collected": split_cash_collected,
        "split_in_call_count": split_in_call_count,
        "split_in_call_cash": split_in_call_cash,
        
        "deposit_count": deposit_count,
        "deposit_cash_collected": deposit_cash_collected,
        "deposit_in_call_count": deposit_in_call_count,
        "deposit_in_call_cash": deposit_in_call_cash,
        
        "installment_count": installment_count,
        "installment_cash_collected": installment_cash_collected,
        "installment_in_call_count": installment_in_call_count,
        "installment_in_call_cash": installment_in_call_cash
    }), 200



