from flask import request, jsonify
from app.models import db, User
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
        # Seguimientos
        'follow_ups_sent': get_int('follow_ups_sent'),
        'follow_ups_replied': get_int('follow_ups_replied'),
        'follow_ups_hot_sent': get_int('follow_ups_hot_sent'),
        'follow_ups_hot_replied': get_int('follow_ups_hot_replied'),
        'follow_ups_cold_sent': get_int('follow_ups_cold_sent'),
        'follow_ups_cold_replied': get_int('follow_ups_cold_replied'),
        # Reflexión
        'reflection_victory': data.get('reflection_victory'),
        'reflection_opportunity': data.get('reflection_opportunity'),
    }

    if report:
        for key, val in field_values.items():
            setattr(report, key, val)
    else:
        report = CloserDailyReport(closer_id=closer_id, date=report_date, **field_values)
        db.session.add(report)

    try:
        db.session.commit()
        # Disparar webhook de Discord después de guardar
        _trigger_closer_report_discord(report)
        return jsonify({"message": "Reporte de closer guardado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def _trigger_closer_report_discord(report):
    """Envía el reporte diario del closer a Discord con un embed formateado y una imagen renderizada."""
    try:
        import requests as req
        import json
        from datetime import datetime
        from app.services.image_service import ImageService

        # Mismo webhook que los setters
        url = "https://discord.com/api/webhooks/1482070325641347288/fFK0OKoDIRngTIzh1kl81_Um8GrtFg62Z3TK4Rq0qgjQtU3jNqlOOLZ4lw1c_0qV0drX"

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
        total_cash = (report.pif_cash_collected or 0) + (report.split_cash_collected or 0) + (report.deposit_cash_collected or 0)

        # Totales de agendas
        total_scheduled = (report.first_call_scheduled or 0) + (report.second_call_scheduled or 0)
        total_attended = (report.first_call_attended or 0) + (report.second_call_attended or 0)
        
        offers_made = report.offers_made or 0
        decision_makers = report.decision_makers or 0
        rescheduled_calls = report.rescheduled_calls or 0

        # Calculations
        show_rate = safe_percent(total_attended, total_scheduled)
        pitch_rate = safe_percent(offers_made, total_attended)
        close_rate = safe_percent(total_sales, total_attended)
        offer_to_sale = safe_percent(total_sales, offers_made)

        # Construct image data
        img_data = {
            "closer_name": closer_name,
            "date_str": date_str,
            "general": {
                "slots": report.slots or 0,
                "offers_made": offers_made,
                "decision_makers": decision_makers,
                "rescheduled_calls": rescheduled_calls
            },
            "rates": {
                "show_rate": show_rate,
                "pitch_rate": pitch_rate,
                "close_rate": close_rate,
                "offer_to_sale": offer_to_sale
            },
            "agendas": {
                "totals": {
                    "scheduled": total_scheduled,
                    "attended": total_attended,
                    "no_show": (report.first_call_no_show or 0) + (report.second_call_no_show or 0),
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
                    "in_call_count": (report.pif_in_call_count or 0) + (report.split_in_call_count or 0) + (report.deposit_in_call_count or 0),
                    "in_call_cash": (report.pif_in_call_cash or 0) + (report.split_in_call_cash or 0) + (report.deposit_in_call_cash or 0),
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
                }
            },
            "follow_up": {
                "hot_sent": report.follow_ups_hot_sent or 0,
                "hot_replied": report.follow_ups_hot_replied or 0,
                "hot_response_pct": safe_percent(report.follow_ups_hot_replied or 0, report.follow_ups_hot_sent or 0),
                "cold_sent": report.follow_ups_cold_sent or 0,
                "cold_replied": report.follow_ups_cold_replied or 0,
                "cold_response_pct": safe_percent(report.follow_ups_cold_replied or 0, report.follow_ups_cold_sent or 0),
                "total_sent": report.follow_ups_sent or 0,
                "total_replied": report.follow_ups_replied or 0,
            },
            "reflections": {
                "victory": report.reflection_victory or "Sin especificar",
                "opportunity": report.reflection_opportunity or "Sin especificar"
            }
        }

        # Generate Image
        img_buffer = ImageService.generate_closer_report_card(img_data)

        # Discord Text & Metadata
        resumen_str = f"{total_attended} Asistencias | {total_sales} Ventas (${total_cash:,.0f})"
        
        has_ref = report.reflection_victory or report.reflection_opportunity
        ref_text = f"\n💡 **Reflexión:**\n- **Victoria:** {report.reflection_victory}\n- **Oportunidad:** {report.reflection_opportunity}" if has_ref else ""
        
        content = (
            f"💰 **REPORTE DIARIO DE CLOSER**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 **Closer:** `{closer_name}`\n"
            f"📅 **Fecha:** `{date_str}`\n"
            f"📊 **Resumen:** `{resumen_str}`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━{ref_text}\n"
            f"@everyone"
        )
        
        json_payload = {
            "content": content,
            "embeds": [{
                "color": 16753920, # #FFB100 Amber color
                "image": {
                    "url": "attachment://closer_report.png"
                },
                "footer": {
                    "text": "NeurOPS Performance System • " + datetime.now().strftime('%H:%M')
                }
            }]
        }
        
        files = {
            'file': ('closer_report.png', img_buffer, 'image/png')
        }
        
        res = req.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=10)
        print(f"[Discord Closer] Status: {res.status_code}")

    except Exception as e:
        print(f"[Discord Closer Error] {e}")
        import traceback
        traceback.print_exc()


@bp.route('/public/closer-stats', methods=['GET'])
def get_public_closer_stats():
    """Retorna estadísticas agregadas de closers con soporte de suma/promedio."""
    from app.services.closer_service import CloserService

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    closer_id = request.args.get('closer_id')
    agg_type = request.args.get('agg_type', 'sum')

    res = CloserService.get_comprehensive_stats(
        closer_id=closer_id,
        start_date=start_date,
        end_date=end_date,
        agg_type=agg_type
    )

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
            "follow_ups_sent": r.follow_ups_sent,
            "follow_ups_replied": r.follow_ups_replied,
            "follow_ups_hot_sent": r.follow_ups_hot_sent,
            "follow_ups_hot_replied": r.follow_ups_hot_replied,
            "follow_ups_cold_sent": r.follow_ups_cold_sent,
            "follow_ups_cold_replied": r.follow_ups_cold_replied
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
        
        stat.follow_ups_sent = get_int('follow_ups_sent', stat.follow_ups_sent)
        stat.follow_ups_replied = get_int('follow_ups_replied', stat.follow_ups_replied)

        stat.follow_ups_hot_sent = get_int('follow_ups_hot_sent', stat.follow_ups_hot_sent)
        stat.follow_ups_hot_replied = get_int('follow_ups_hot_replied', stat.follow_ups_hot_replied)
        stat.follow_ups_cold_sent = get_int('follow_ups_cold_sent', stat.follow_ups_cold_sent)
        stat.follow_ups_cold_replied = get_int('follow_ups_cold_replied', stat.follow_ups_cold_replied)
        
        stat.reflection_victory = data.get('reflection_victory', stat.reflection_victory)
        stat.reflection_opportunity = data.get('reflection_opportunity', stat.reflection_opportunity)

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


