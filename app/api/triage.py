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
    """Retorna las estadisticas agregadas (suma) de todos los reportes filtrados."""
    from app.models.triage_tracker import TriageTrackerReport

    triage_name = request.args.get('triage_name')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')

    query = db.session.query(
        func.sum(TriageTrackerReport.starting_1st_call_agendas).label('starting_1st_call_agendas'),
        func.sum(TriageTrackerReport.starting_1st_call_confirmando).label('starting_1st_call_confirmando'),
        func.sum(TriageTrackerReport.starting_1st_call_reprogramando).label('starting_1st_call_reprogramando'),
        func.sum(TriageTrackerReport.starting_1st_call_confirmadas).label('starting_1st_call_confirmadas'),
        func.sum(TriageTrackerReport.starting_1st_call_canceladas).label('starting_1st_call_canceladas'),

        func.sum(TriageTrackerReport.starting_2nd_call_agendas).label('starting_2nd_call_agendas'),
        func.sum(TriageTrackerReport.starting_2nd_call_confirmando).label('starting_2nd_call_confirmando'),
        func.sum(TriageTrackerReport.starting_2nd_call_reprogramando).label('starting_2nd_call_reprogramando'),
        func.sum(TriageTrackerReport.starting_2nd_call_confirmadas).label('starting_2nd_call_confirmadas'),
        func.sum(TriageTrackerReport.starting_2nd_call_canceladas).label('starting_2nd_call_canceladas'),

        func.sum(TriageTrackerReport.all_1st_call_agendas).label('all_1st_call_agendas'),
        func.sum(TriageTrackerReport.all_1st_call_confirmando).label('all_1st_call_confirmando'),
        func.sum(TriageTrackerReport.all_1st_call_reprogramando).label('all_1st_call_reprogramando'),
        func.sum(TriageTrackerReport.all_1st_call_confirmadas).label('all_1st_call_confirmadas'),
        func.sum(TriageTrackerReport.all_1st_call_canceladas).label('all_1st_call_canceladas'),

        func.sum(TriageTrackerReport.all_2nd_call_agendas).label('all_2nd_call_agendas'),
        func.sum(TriageTrackerReport.all_2nd_call_confirmando).label('all_2nd_call_confirmando'),
        func.sum(TriageTrackerReport.all_2nd_call_reprogramando).label('all_2nd_call_reprogramando'),
        func.sum(TriageTrackerReport.all_2nd_call_confirmadas).label('all_2nd_call_confirmadas'),
        func.sum(TriageTrackerReport.all_2nd_call_canceladas).label('all_2nd_call_canceladas'),

        func.sum(TriageTrackerReport.post_hoy_confirmadas).label('post_hoy_confirmadas'),
        func.sum(TriageTrackerReport.post_hoy_ppc_completo).label('post_hoy_ppc_completo'),
        func.sum(TriageTrackerReport.post_all_confirmadas).label('post_all_confirmadas'),
        func.sum(TriageTrackerReport.post_all_ppc_completo).label('post_all_ppc_completo'),

        func.sum(TriageTrackerReport.fu_cold_personas_disp_fu).label('fu_cold_personas_disp_fu'),
        func.sum(TriageTrackerReport.fu_cold_mjes_realizados).label('fu_cold_mjes_realizados'),
        func.sum(TriageTrackerReport.fu_cold_personas_realizados).label('fu_cold_personas_realizados'),
        func.sum(TriageTrackerReport.fu_cold_personas_respondidos).label('fu_cold_personas_respondidos'),

        func.sum(TriageTrackerReport.fu_warm_personas_disp_fu).label('fu_warm_personas_disp_fu'),
        func.sum(TriageTrackerReport.fu_warm_mjes_realizados).label('fu_warm_mjes_realizados'),
        func.sum(TriageTrackerReport.fu_warm_personas_realizados).label('fu_warm_personas_realizados'),
        func.sum(TriageTrackerReport.fu_warm_personas_respondidos).label('fu_warm_personas_respondidos'),

        func.sum(TriageTrackerReport.fu_hot_personas_disp_fu).label('fu_hot_personas_disp_fu'),
        func.sum(TriageTrackerReport.fu_hot_mjes_realizados).label('fu_hot_mjes_realizados'),
        func.sum(TriageTrackerReport.fu_hot_personas_realizados).label('fu_hot_personas_realizados'),
        func.sum(TriageTrackerReport.fu_hot_personas_respondidos).label('fu_hot_personas_respondidos')
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
