from flask import Blueprint, request, jsonify
from app import db
from datetime import datetime
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
