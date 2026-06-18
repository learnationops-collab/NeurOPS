from flask import Blueprint, request, jsonify
from app import db
from datetime import datetime
from sqlalchemy import func
import logging

bp = Blueprint('triage', __name__)
logger = logging.getLogger(__name__)

# ============================================================
# TRIAGE TRACKER REPORT (36 FIELDS)
# ============================================================

@bp.route('/tracker', methods=['POST'])
def submit_triage_tracker():
    """Recibe y guarda la tabla completa de Triage Tracker."""
    from app.models.triage_tracker import TriageTrackerReport

    data = request.get_json() or {}

    triage_name = data.get('triage_name')
    report_date_str = data.get('date')

    if not triage_name or not report_date_str:
        return jsonify({"message": "Nombre del triage y fecha son obligatorios"}), 400

    try:
        report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400

    report = TriageTrackerReport.query.filter_by(triage_name=triage_name, date=report_date).first()

    def get_int(key):
        return int(data.get(key) or 0)

    field_values = {
        'starting_1st_call_agendas': get_int('starting_1st_call_agendas'),
        'starting_1st_call_confirmando': get_int('starting_1st_call_confirmando'),
        'starting_1st_call_reprogramando': get_int('starting_1st_call_reprogramando'),
        'starting_1st_call_confirmadas': get_int('starting_1st_call_confirmadas'),
        'starting_1st_call_canceladas': get_int('starting_1st_call_canceladas'),

        'starting_2nd_call_agendas': get_int('starting_2nd_call_agendas'),
        'starting_2nd_call_confirmando': get_int('starting_2nd_call_confirmando'),
        'starting_2nd_call_reprogramando': get_int('starting_2nd_call_reprogramando'),
        'starting_2nd_call_confirmadas': get_int('starting_2nd_call_confirmadas'),
        'starting_2nd_call_canceladas': get_int('starting_2nd_call_canceladas'),

        'all_1st_call_agendas': get_int('all_1st_call_agendas'),
        'all_1st_call_confirmando': get_int('all_1st_call_confirmando'),
        'all_1st_call_reprogramando': get_int('all_1st_call_reprogramando'),
        'all_1st_call_confirmadas': get_int('all_1st_call_confirmadas'),
        'all_1st_call_canceladas': get_int('all_1st_call_canceladas'),

        'all_2nd_call_agendas': get_int('all_2nd_call_agendas'),
        'all_2nd_call_confirmando': get_int('all_2nd_call_confirmando'),
        'all_2nd_call_reprogramando': get_int('all_2nd_call_reprogramando'),
        'all_2nd_call_confirmadas': get_int('all_2nd_call_confirmadas'),
        'all_2nd_call_canceladas': get_int('all_2nd_call_canceladas'),

        'post_hoy_confirmadas': get_int('post_hoy_confirmadas'),
        'post_hoy_ppc_completo': get_int('post_hoy_ppc_completo'),
        'post_all_confirmadas': get_int('post_all_confirmadas'),
        'post_all_ppc_completo': get_int('post_all_ppc_completo'),

        'fu_cold_personas_disp_fu': get_int('fu_cold_personas_disp_fu'),
        'fu_cold_mjes_realizados': get_int('fu_cold_mjes_realizados'),
        'fu_cold_personas_realizados': get_int('fu_cold_personas_realizados'),
        'fu_cold_personas_respondidos': get_int('fu_cold_personas_respondidos'),

        'fu_warm_personas_disp_fu': get_int('fu_warm_personas_disp_fu'),
        'fu_warm_mjes_realizados': get_int('fu_warm_mjes_realizados'),
        'fu_warm_personas_realizados': get_int('fu_warm_personas_realizados'),
        'fu_warm_personas_respondidos': get_int('fu_warm_personas_respondidos'),

        'fu_hot_personas_disp_fu': get_int('fu_hot_personas_disp_fu'),
        'fu_hot_mjes_realizados': get_int('fu_hot_mjes_realizados'),
        'fu_hot_personas_realizados': get_int('fu_hot_personas_realizados'),
        'fu_hot_personas_respondidos': get_int('fu_hot_personas_respondidos'),
    }

    if report:
        for key, val in field_values.items():
            setattr(report, key, val)
    else:
        report = TriageTrackerReport(triage_name=triage_name, date=report_date, **field_values)
        db.session.add(report)

    try:
        db.session.commit()

        # ---------------- DISCORD WEBHOOK ----------------
        try:
            from app.services.image_service import ImageService
            import requests

            def safe_pct(val, total):
                return round((val / total) * 100, 1) if total > 0 else 0.0

            st_agendas = report.starting_1st_call_agendas + report.starting_2nd_call_agendas
            all_agendas = report.all_1st_call_agendas + report.all_2nd_call_agendas
            
            fu_disp = report.fu_cold_personas_disp_fu + report.fu_warm_personas_disp_fu + report.fu_hot_personas_disp_fu
            fu_cont = report.fu_cold_personas_realizados + report.fu_warm_personas_realizados + report.fu_hot_personas_realizados
            fu_resp = report.fu_cold_personas_respondidos + report.fu_warm_personas_respondidos + report.fu_hot_personas_respondidos
            fu_mjes = report.fu_cold_mjes_realizados + report.fu_warm_mjes_realizados + report.fu_hot_mjes_realizados

            st_confirmando = report.starting_1st_call_confirmando + report.starting_2nd_call_confirmando
            st_reprogramando = report.starting_1st_call_reprogramando + report.starting_2nd_call_reprogramando
            st_confirmadas = report.starting_1st_call_confirmadas + report.starting_2nd_call_confirmadas
            st_canceladas = report.starting_1st_call_canceladas + report.starting_2nd_call_canceladas
            st_inciertas = st_agendas - (st_confirmando + st_reprogramando + st_confirmadas + st_canceladas)
            
            st_process_base = st_confirmando + st_reprogramando
            st_completos_base = st_confirmadas + st_canceladas + st_inciertas

            all_confirmando = report.all_1st_call_confirmando + report.all_2nd_call_confirmando
            all_reprogramando = report.all_1st_call_reprogramando + report.all_2nd_call_reprogramando
            all_confirmadas = report.all_1st_call_confirmadas + report.all_2nd_call_confirmadas
            all_canceladas = report.all_1st_call_canceladas + report.all_2nd_call_canceladas
            all_inciertas = all_agendas - (all_confirmando + all_reprogramando + all_confirmadas + all_canceladas)
            
            all_process_base = all_confirmando + all_reprogramando
            all_completos_base = all_confirmadas + all_canceladas + all_inciertas

            render_data = {
                "triage_name": report.triage_name,
                "date_str": report.date.strftime("%d/%m/%Y"),
                
                "st_agendas": st_agendas,
                "st_confirmando_val": st_confirmando,
                "st_confirmando_pct": safe_pct(st_confirmando, st_process_base),
                "st_reprogramando_val": st_reprogramando,
                "st_reprogramando_pct": safe_pct(st_reprogramando, st_process_base),
                "st_confirmadas_val": st_confirmadas,
                "st_confirmadas_pct": safe_pct(st_confirmadas, st_completos_base),
                "st_canceladas_val": st_canceladas,
                "st_canceladas_pct": safe_pct(st_canceladas, st_completos_base),
                "st_inciertas_val": st_inciertas,
                "st_inciertas_pct": safe_pct(st_inciertas, st_completos_base),

                "all_agendas": all_agendas,
                "all_confirmando_val": all_confirmando,
                "all_confirmando_pct": safe_pct(all_confirmando, all_process_base),
                "all_reprogramando_val": all_reprogramando,
                "all_reprogramando_pct": safe_pct(all_reprogramando, all_process_base),
                "all_confirmadas_val": all_confirmadas,
                "all_confirmadas_pct": safe_pct(all_confirmadas, all_completos_base),
                "all_canceladas_val": all_canceladas,
                "all_canceladas_pct": safe_pct(all_canceladas, all_completos_base),
                "all_inciertas_val": all_inciertas,
                "all_inciertas_pct": safe_pct(all_inciertas, all_completos_base),

                "fu_disponibles": fu_disp,
                "fu_contactadas": fu_cont,
                "fu_respondidos": fu_resp,
                "fu_contact_pct": safe_pct(fu_cont, fu_disp),
                "fu_resp_pct": safe_pct(fu_resp, fu_cont),
                "avg_mjes": round(fu_mjes / fu_cont, 1) if fu_cont > 0 else 0.0,

                "pop_confirmadas_hoy": report.post_hoy_confirmadas,
                "pop_ppc_hoy": report.post_hoy_ppc_completo,
                "pop_confirmadas_all": report.post_all_confirmadas,
                "pop_ppc_all": report.post_all_ppc_completo,
            }

            img_buf = ImageService.generate_triage_tracker_card(render_data)
            
            webhook_url = "https://discord.com/api/webhooks/1482070325641347288/fFK0OKoDIRngTIzh1kl81_Um8GrtFg62Z3TK4Rq0qgjQtU3jNqlOOLZ4lw1c_0qV0drX"
            payload = {
                "content": f"🎯 **NUEVO REPORTE DE TRIAGE TRACKER**\n**Triage:** {report.triage_name}\n**Fecha:** {render_data['date_str']}",
                "username": "NeurOPS Triage AI",
                "avatar_url": "https://i.imgur.com/4M34hi2.png"
            }
            files = {
                "file": ("triage_tracker.png", img_buf, "image/png")
            }
            res = requests.post(webhook_url, data=payload, files=files)
            print(f"[Discord Triage Tracker] Status: {res.status_code}")
        except Exception as e:
            print(f"[Discord Triage Tracker Error] {e}")
        # -------------------------------------------------

        return jsonify({"message": f"Reporte Tracker de {triage_name} guardado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route('/tracker', methods=['GET'])
def get_triage_tracker():
    """Retorna lista de reportes tracker de triage con filtros."""
    from app.models.triage_tracker import TriageTrackerReport

    triage_name = request.args.get('triage_name')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))

    query = TriageTrackerReport.query

    if triage_name:
        query = query.filter(TriageTrackerReport.triage_name == triage_name)
    if start_date_str:
        query = query.filter(TriageTrackerReport.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(TriageTrackerReport.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())

    pagination = query.order_by(TriageTrackerReport.date.desc()).paginate(page=page, per_page=per_page)

    return jsonify({
        "reports": [r.to_dict() for r in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    }), 200

@bp.route('/tracker/stats', methods=['GET'])
def get_triage_tracker_stats():
    """Retorna las estadisticas agregadas (suma o promedio) de todos los reportes filtrados."""
    from app.models.triage_tracker import TriageTrackerReport

    triage_name = request.args.get('triage_name')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    agg_type = request.args.get('agg_type', 'sum')
    
    # Selecciona funcion de agregacion (suma por defecto)
    agg_func = func.avg if agg_type == 'avg' else func.sum

    query = db.session.query(
        agg_func(TriageTrackerReport.starting_1st_call_agendas).label('starting_1st_call_agendas'),
        agg_func(TriageTrackerReport.starting_1st_call_confirmando).label('starting_1st_call_confirmando'),
        agg_func(TriageTrackerReport.starting_1st_call_reprogramando).label('starting_1st_call_reprogramando'),
        agg_func(TriageTrackerReport.starting_1st_call_confirmadas).label('starting_1st_call_confirmadas'),
        agg_func(TriageTrackerReport.starting_1st_call_canceladas).label('starting_1st_call_canceladas'),

        agg_func(TriageTrackerReport.starting_2nd_call_agendas).label('starting_2nd_call_agendas'),
        agg_func(TriageTrackerReport.starting_2nd_call_confirmando).label('starting_2nd_call_confirmando'),
        agg_func(TriageTrackerReport.starting_2nd_call_reprogramando).label('starting_2nd_call_reprogramando'),
        agg_func(TriageTrackerReport.starting_2nd_call_confirmadas).label('starting_2nd_call_confirmadas'),
        agg_func(TriageTrackerReport.starting_2nd_call_canceladas).label('starting_2nd_call_canceladas'),

        agg_func(TriageTrackerReport.all_1st_call_agendas).label('all_1st_call_agendas'),
        agg_func(TriageTrackerReport.all_1st_call_confirmando).label('all_1st_call_confirmando'),
        agg_func(TriageTrackerReport.all_1st_call_reprogramando).label('all_1st_call_reprogramando'),
        agg_func(TriageTrackerReport.all_1st_call_confirmadas).label('all_1st_call_confirmadas'),
        agg_func(TriageTrackerReport.all_1st_call_canceladas).label('all_1st_call_canceladas'),

        agg_func(TriageTrackerReport.all_2nd_call_agendas).label('all_2nd_call_agendas'),
        agg_func(TriageTrackerReport.all_2nd_call_confirmando).label('all_2nd_call_confirmando'),
        agg_func(TriageTrackerReport.all_2nd_call_reprogramando).label('all_2nd_call_reprogramando'),
        agg_func(TriageTrackerReport.all_2nd_call_confirmadas).label('all_2nd_call_confirmadas'),
        agg_func(TriageTrackerReport.all_2nd_call_canceladas).label('all_2nd_call_canceladas'),

        agg_func(TriageTrackerReport.post_hoy_confirmadas).label('post_hoy_confirmadas'),
        agg_func(TriageTrackerReport.post_hoy_ppc_completo).label('post_hoy_ppc_completo'),
        agg_func(TriageTrackerReport.post_all_confirmadas).label('post_all_confirmadas'),
        agg_func(TriageTrackerReport.post_all_ppc_completo).label('post_all_ppc_completo'),

        agg_func(TriageTrackerReport.fu_cold_personas_disp_fu).label('fu_cold_personas_disp_fu'),
        agg_func(TriageTrackerReport.fu_cold_mjes_realizados).label('fu_cold_mjes_realizados'),
        agg_func(TriageTrackerReport.fu_cold_personas_realizados).label('fu_cold_personas_realizados'),
        agg_func(TriageTrackerReport.fu_cold_personas_respondidos).label('fu_cold_personas_respondidos'),

        agg_func(TriageTrackerReport.fu_warm_personas_disp_fu).label('fu_warm_personas_disp_fu'),
        agg_func(TriageTrackerReport.fu_warm_mjes_realizados).label('fu_warm_mjes_realizados'),
        agg_func(TriageTrackerReport.fu_warm_personas_realizados).label('fu_warm_personas_realizados'),
        agg_func(TriageTrackerReport.fu_warm_personas_respondidos).label('fu_warm_personas_respondidos'),

        agg_func(TriageTrackerReport.fu_hot_personas_disp_fu).label('fu_hot_personas_disp_fu'),
        agg_func(TriageTrackerReport.fu_hot_mjes_realizados).label('fu_hot_mjes_realizados'),
        agg_func(TriageTrackerReport.fu_hot_personas_realizados).label('fu_hot_personas_realizados'),
        agg_func(TriageTrackerReport.fu_hot_personas_respondidos).label('fu_hot_personas_respondidos')
    )

    if triage_name:
        query = query.filter(TriageTrackerReport.triage_name == triage_name)
    if start_date_str:
        query = query.filter(TriageTrackerReport.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(TriageTrackerReport.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())

    result = query.first()

    def val(idx):
        return int(result[idx]) if result and result[idx] is not None else 0

    return jsonify({
        "starting_1st_call_agendas": val(0),
        "starting_1st_call_confirmando": val(1),
        "starting_1st_call_reprogramando": val(2),
        "starting_1st_call_confirmadas": val(3),
        "starting_1st_call_canceladas": val(4),

        "starting_2nd_call_agendas": val(5),
        "starting_2nd_call_confirmando": val(6),
        "starting_2nd_call_reprogramando": val(7),
        "starting_2nd_call_confirmadas": val(8),
        "starting_2nd_call_canceladas": val(9),

        "all_1st_call_agendas": val(10),
        "all_1st_call_confirmando": val(11),
        "all_1st_call_reprogramando": val(12),
        "all_1st_call_confirmadas": val(13),
        "all_1st_call_canceladas": val(14),

        "all_2nd_call_agendas": val(15),
        "all_2nd_call_confirmando": val(16),
        "all_2nd_call_reprogramando": val(17),
        "all_2nd_call_confirmadas": val(18),
        "all_2nd_call_canceladas": val(19),

        "post_hoy_confirmadas": val(20),
        "post_hoy_ppc_completo": val(21),
        "post_all_confirmadas": val(22),
        "post_all_ppc_completo": val(23),

        "fu_cold_personas_disp_fu": val(24),
        "fu_cold_mjes_realizados": val(25),
        "fu_cold_personas_realizados": val(26),
        "fu_cold_personas_respondidos": val(27),

        "fu_warm_personas_disp_fu": val(28),
        "fu_warm_mjes_realizados": val(29),
        "fu_warm_personas_realizados": val(30),
        "fu_warm_personas_respondidos": val(31),

        "fu_hot_personas_disp_fu": val(32),
        "fu_hot_mjes_realizados": val(33),
        "fu_hot_personas_realizados": val(34),
        "fu_hot_personas_respondidos": val(35)
    }), 200

@bp.route('/tracker/<int:report_id>', methods=['DELETE'])
def delete_triage_tracker_report(report_id):
    from app.models.triage_tracker import TriageTrackerReport
    report = TriageTrackerReport.query.get_or_404(report_id)
    try:
        db.session.delete(report)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

from app.api.auth import login_required
from flask_login import current_user
import json

@bp.route('/notifications', methods=['GET'])
@login_required
def get_triage_notifications():
    from app.models import Notification
    
    # Solo roles autorizados en triage (normalmente 'triage' o 'admin')
    if current_user.role not in ['triage', 'admin']:
        return jsonify([]), 403
        
    notifications = Notification.query.order_by(Notification.created_at.desc()).limit(50).all()
    
    relevant = []
    for n in notifications:
        is_target = False
        targets = n.target_users
        
        if targets == 'all': is_target = True
        elif isinstance(targets, str) and targets.startswith("role:") and targets == f"role:{current_user.role}": is_target = True
        elif isinstance(targets, list) and (current_user.id in targets or f"role:{current_user.role}" in targets): is_target = True
        
        if is_target:
            read_by_val = n.read_by or []
            if isinstance(read_by_val, str):
                try: read_by_val = json.loads(read_by_val)
                except: read_by_val = []
                
            is_read = current_user.id in (read_by_val if isinstance(read_by_val, list) else [])
            if is_read:
                continue
                
            relevant.append({
                "id": n.id,
                "subject": n.subject,
                "content": n.content,
                "created_at": n.created_at.isoformat(),
                "is_read": False,
                "associated_id": n.associated_id,
                "associated_type": n.associated_type
            })
            
    return jsonify(relevant), 200

@bp.route('/notifications/<int:id>/read', methods=['POST'])
@login_required
def read_triage_notification(id):
    from app.models import Notification
    n = Notification.query.get_or_404(id)
    
    read_by_val = n.read_by or []
    if isinstance(read_by_val, str):
        try: read_by_val = json.loads(read_by_val)
        except: read_by_val = []
        
    if current_user.id not in read_by_val:
        new_read_by = list(read_by_val)
        new_read_by.append(current_user.id)
        n.read_by = new_read_by
        db.session.commit()
        
    return jsonify({"message": "Marked as read"}), 200
