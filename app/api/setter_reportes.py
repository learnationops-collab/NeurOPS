"""Reportes diarios del setter: resumen de stats, historial propio y borrado.

Se cuelga del blueprint de `setter.py` (se importa al final de ese archivo).
"""
from flask import request, jsonify
from flask_login import current_user
from app import db
from app.models import DailyReportAnswer, SetterDailyStats, ROLE_SETTER
from app.decorators import role_required
from datetime import datetime
from app.api.setter import bp, _get_setter_stages_ordered


@bp.route('/stats/summary', methods=['GET'])
@role_required(ROLE_SETTER)
def get_stats_summary():
    from sqlalchemy import func
    from datetime import date, timedelta

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    # 1. Fetch Fixed Stats
    query_fixed = db.session.query(
        func.sum(SetterDailyStats.not_lead).label('total_not_lead'),
        func.sum(SetterDailyStats.inbox_entrantes).label('total_entrantes'),
        (func.sum(SetterDailyStats.funnel_qualification) - func.sum(SetterDailyStats.not_lead)).label('total_leads'),
        func.sum(SetterDailyStats.funnel_qualification).label('total_qual'),
        func.sum(SetterDailyStats.funnel_pain).label('total_pain'),
        func.sum(SetterDailyStats.funnel_offer).label('total_offer'),
        func.sum(SetterDailyStats.funnel_link).label('total_link'),
        func.sum(SetterDailyStats.funnel_agenda).label('total_agenda'),
        func.sum(SetterDailyStats.q1_useful).label('q1_u'),
        func.sum(SetterDailyStats.q1_unuseful).label('q1_i'),
        func.sum(SetterDailyStats.q2_useful).label('q2_u'),
        func.sum(SetterDailyStats.q2_unuseful).label('q2_i'),
        func.sum(SetterDailyStats.qualification_fu + SetterDailyStats.pain_fu + SetterDailyStats.offer_fu + SetterDailyStats.link_fu + SetterDailyStats.agenda_fu).label('tfu_s'),
        func.sum(SetterDailyStats.qualification_fur + SetterDailyStats.pain_fur + SetterDailyStats.offer_fur + SetterDailyStats.link_fur + SetterDailyStats.agenda_fur).label('tfu_r')
    ).filter_by(setter_id=current_user.id)
    
    if start_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        query_fixed = query_fixed.filter(SetterDailyStats.date >= start_date)
        
    if end_date_str:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        query_fixed = query_fixed.filter(SetterDailyStats.date <= end_date)
        
    fixed_stats = query_fixed.first()
    
    stage_data = []
    if fixed_stats:
        vals = [
            fixed_stats.total_qual,
            fixed_stats.total_pain,
            fixed_stats.total_offer,
            fixed_stats.total_link,
            fixed_stats.total_agenda
        ]
        
        stages_ordered = _get_setter_stages_ordered()
        if stages_ordered and len(stages_ordered) >= 5:
            for i, s in enumerate(stages_ordered[:5]):
                stage_data.append({
                    "id": s.id,
                    "name": s.name,
                    "value": int(vals[i] or 0)
                })
        else:
            # Fallback si no hay Custom Pipeline
            default_labels = ["Cualificación", "Dolor", "Oferta", "Link", "Agenda"]
            for i, label in enumerate(default_labels):
                stage_data.append({
                    "id": f"stage_{i}",
                    "name": label,
                    "value": int(vals[i] or 0)
                })
    
    # Fetch pending agendas (appointments booked by this setter with no result)
    from app.models import Appointment
    from sqlalchemy import or_
    
    pending_agendas = Appointment.query.filter(
        Appointment.setter_id == current_user.id,
        or_(Appointment.result == None, Appointment.result == '')
    ).order_by(Appointment.start_time.desc()).limit(50).all()
    
    return jsonify({
        "total_not_lead": int(fixed_stats.total_not_lead or 0) if fixed_stats else 0,
        "total_leads": int(fixed_stats.total_entrantes or 0) if fixed_stats else 0,
        "no_response": (int(fixed_stats.total_entrantes or 0) - int(fixed_stats.total_qual or 0)) if fixed_stats else 0,
        "stage_metrics": stage_data,
        "pending_agendas": [{
            "id": a.id,
            "lead_name": a.client.full_name or a.client.email if a.client else "Unknown",
            "closer_name": a.closer.username if a.closer else "Unassigned",
            "start_time": a.start_time.isoformat(),
            "origin": a.origin,
            "client_id": a.client_id,
            "person_uuid": a.person_uuid,
            "phone": a.client.phone if a.client else "",
            "last_stage": a.last_stage,
            "type": a.origin or 'Manual'
        } for a in pending_agendas],
        "questions_efficacy": {
            "q1_useful": int(fixed_stats.q1_u or 0) if fixed_stats else 0,
            "q1_unuseful": int(fixed_stats.q1_i or 0) if fixed_stats else 0,
            "q2_useful": int(fixed_stats.q2_u or 0) if fixed_stats else 0,
            "q2_unuseful": int(fixed_stats.q2_i or 0) if fixed_stats else 0
        },
        "total_fu_submitted": int(fixed_stats.tfu_s or 0) if fixed_stats else 0,
        "total_fu_responded": int(fixed_stats.tfu_r or 0) if fixed_stats else 0
    }), 200

@bp.route('/my-reports', methods=['GET'])
@role_required(ROLE_SETTER)
def get_my_reports():
    # Fetch last 30 reports
    reports = SetterDailyStats.query.filter_by(setter_id=current_user.id)\
        .order_by(SetterDailyStats.date.desc())\
        .limit(30).all()
        
    result = []
    
    # Pre-fetch stages to avoid query in loop if possible, but simplest is to reuse helper
    stages = _get_setter_stages_ordered()
    
    for r in reports:
        # Get dynamic metrics for this report
        stage_metrics = {}
        if len(stages) > 0: stage_metrics[stages[0].id] = r.stage_1_value
        if len(stages) > 1: stage_metrics[stages[1].id] = r.stage_2_value
        if len(stages) > 2: stage_metrics[stages[2].id] = r.stage_3_value
        if len(stages) > 3: stage_metrics[stages[3].id] = r.stage_4_value
        if len(stages) > 4: stage_metrics[stages[4].id] = r.stage_5_value
        
        # Get answers from JSON column
        answers = r.answers or {}
        
        result.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "fixed_stats": {
                "not_lead": r.not_lead,
                "qualification_fu": r.qualification_fu,
                "pain_fu": r.pain_fu,
                "offer_fu": r.offer_fu,
                "agenda_fu": r.agenda_fu,
                "link_fu": r.link_fu,
                "link_fur": r.link_fur,
                "qualification_fur": r.qualification_fur,
                "pain_fur": r.pain_fur,
                "offer_fur": r.offer_fur,
                "agenda_fur": r.agenda_fur,
                "qualification_opening_submitted": r.qualification_opening_submitted,
                "qualification_opening_responded": r.qualification_opening_responded,
                "pain_opening_submitted": r.pain_opening_submitted,
                "pain_opening_responded": r.pain_opening_responded,
                "q1_useful": r.q1_useful,
                "q1_unuseful": r.q1_unuseful,
                "q2_useful": r.q2_useful,
                "q2_unuseful": r.q2_unuseful
            },
            "funnel_stats": stage_metrics,
            "answers": answers
        })
        
    return jsonify(result), 200

@bp.route('/daily-report/<int:report_id>', methods=['DELETE'])
@role_required(ROLE_SETTER)
def delete_daily_report(report_id):
    report = SetterDailyStats.query.filter_by(id=report_id, setter_id=current_user.id).first()
    if not report:
        return jsonify({"message": "Reporte no encontrado"}), 404
        
    try:
        # Delete related data first
        DailyReportAnswer.query.filter_by(setter_stats_id=report.id).delete()

        
        # Delete report
        db.session.delete(report)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al eliminar: {str(e)}"}), 500
