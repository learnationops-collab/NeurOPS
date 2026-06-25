from flask import request, jsonify, render_template_string
from app.models import db, User
from datetime import datetime, date, timedelta
from . import bp
import json
import requests

@bp.route('/public/active-setters', methods=['GET'])
def get_active_setters():
    """Retorna lista de setters activos (Nombre e ID)"""
    try:
        setters = User.query.filter_by(role='setter', is_active=True).all()
        return jsonify([
            {"id": s.id, "name": s.username} 
            for s in setters
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/public/setter-questions', methods=['GET'])
def get_public_setter_questions():
    """Retorna las preguntas configuradas para los setters"""
    from app.models import DailyReportQuestion
    try:
        questions = DailyReportQuestion.query.filter_by(role='setter', is_active=True).order_by(DailyReportQuestion.order).all()
        return jsonify([{"id": q.id, "text": q.text, "type": q.question_type} for q in questions]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/public/setter-report', methods=['POST'])
def submit_public_setter_report():
    """Recibe y guarda el reporte diario de un setter, disparando las automatizaciones."""
    from app.models import SetterDailyStats, PipelineStage
    from app.api.setter import _trigger_setter_report_webhook, _get_setter_stages_ordered
    
    data = request.get_json() or {}
    
    setter_id = data.get('setter_id')
    report_date_str = data.get('date')
    
    if not setter_id or not report_date_str:
        return jsonify({"message": "ID del setter y fecha son obligatorios"}), 400
        
    try:
        report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400
        
    # Verificar existencia
    stat = SetterDailyStats.query.filter_by(setter_id=setter_id, date=report_date).first()
    
    if stat:
        stat.not_lead = int(data.get('not_lead') or 0)
        stat.inbox_entrantes = int(data.get('inbox_entrantes') or 0)
        stat.inbox_inabribles = int(data.get('inbox_inabribles') or 0)
        stat.inbox_leads = int(data.get('inbox_leads') or 0)
        
        # Calcular totales de aperturas para legacy/compatibilidad
        q_op_sub = int(data.get('qualification_opening_submitted') or 0)
        p_op_sub = int(data.get('pain_opening_submitted') or 0)
        q_op_res = int(data.get('qualification_opening_responded') or 0)
        p_op_res = int(data.get('pain_opening_responded') or 0)
        
        stat.opening_submitted = q_op_sub + p_op_sub
        stat.opening_responded = q_op_res + p_op_res
        
        stat.funnel_qualification = int(data.get('funnel_qualification') or 0)
        stat.funnel_pain = int(data.get('funnel_pain') or 0)
        stat.funnel_offer = int(data.get('funnel_offer') or 0)
        stat.funnel_link = int(data.get('funnel_link') or 0)
        stat.funnel_agenda = int(data.get('funnel_agenda') or 0)
        stat.qualification_fu = int(data.get('qualification_fu') or 0)
        stat.pain_fu = int(data.get('pain_fu') or 0)
        stat.offer_fu = int(data.get('offer_fu') or 0)
        stat.agenda_fu = int(data.get('agenda_fu') or 0)
        stat.link_fu = int(data.get('link_fu') or 0)
        stat.qualification_fur = int(data.get('qualification_fur') or 0)
        stat.pain_fur = int(data.get('pain_fur') or 0)
        stat.offer_fur = int(data.get('offer_fur') or 0)
        stat.link_fur = int(data.get('link_fur') or 0)
        stat.agenda_fur = int(data.get('agenda_fur') or 0)
        stat.qualification_opening_submitted = int(data.get('qualification_opening_submitted') or 0)
        stat.qualification_opening_responded = int(data.get('qualification_opening_responded') or 0)
        stat.pain_opening_submitted = int(data.get('pain_opening_submitted') or 0)
        stat.pain_opening_responded = int(data.get('pain_opening_responded') or 0)
        stat.q1_useful = int(data.get('q1_useful') or 0)
        stat.q1_unuseful = int(data.get('q1_unuseful') or 0)
        stat.q2_useful = int(data.get('q2_useful') or 0)
        stat.q2_unuseful = int(data.get('q2_unuseful') or 0)
    else:
        stat = SetterDailyStats(
            setter_id=setter_id,
            date=report_date,
            not_lead=int(data.get('not_lead') or 0),
            inbox_entrantes=int(data.get('inbox_entrantes') or 0),
            inbox_inabribles=int(data.get('inbox_inabribles') or 0),
            inbox_leads=int(data.get('inbox_leads') or 0),
            opening_submitted=int(data.get('qualification_opening_submitted') or 0) + int(data.get('pain_opening_submitted') or 0),
            opening_responded=int(data.get('qualification_opening_responded') or 0) + int(data.get('pain_opening_responded') or 0),
            funnel_qualification=int(data.get('funnel_qualification') or 0),
            funnel_pain=int(data.get('funnel_pain') or 0),
            funnel_offer=int(data.get('funnel_offer') or 0),
            funnel_link=int(data.get('funnel_link') or 0),
            funnel_agenda=int(data.get('funnel_agenda') or 0),
            qualification_fu=int(data.get('qualification_fu') or 0),
            pain_fu=int(data.get('pain_fu') or 0),
            offer_fu=int(data.get('offer_fu') or 0),
            agenda_fu=int(data.get('agenda_fu') or 0),
            link_fu=int(data.get('link_fu') or 0),
            qualification_fur=int(data.get('qualification_fur') or 0),
            pain_fur=int(data.get('pain_fur') or 0),
            offer_fur=int(data.get('offer_fur') or 0),
            link_fur=int(data.get('link_fur') or 0),
            agenda_fur=int(data.get('agenda_fur') or 0),
            qualification_opening_submitted=int(data.get('qualification_opening_submitted') or 0),
            qualification_opening_responded=int(data.get('qualification_opening_responded') or 0),
            pain_opening_submitted=int(data.get('pain_opening_submitted') or 0),
            pain_opening_responded=int(data.get('pain_opening_responded') or 0),
            q1_useful=int(data.get('q1_useful') or 0),
            q1_unuseful=int(data.get('q1_unuseful') or 0),
            q2_useful=int(data.get('q2_useful') or 0),
            q2_unuseful=int(data.get('q2_unuseful') or 0)
        )
        db.session.add(stat)
        
    # Procesar Funnel Metrics -> Map to stage_X_value
    funnel_metrics = data.get('funnel_metrics', [])
    stages = _get_setter_stages_ordered()
    stage_id_to_index = {s.id: i for i, s in enumerate(stages)}
    
    stat.stage_1_value = 0
    stat.stage_2_value = 0
    stat.stage_3_value = 0
    stat.stage_4_value = 0
    stat.stage_5_value = 0

    for metric in funnel_metrics:
        stage_id = metric.get('stage_id')
        value = int(metric.get('value', 0))
        
        if stage_id in stage_id_to_index:
            idx = stage_id_to_index[stage_id]
            if idx == 0: stat.stage_1_value = value
            elif idx == 1: stat.stage_2_value = value
            elif idx == 2: stat.stage_3_value = value
            elif idx == 3: stat.stage_4_value = value
            elif idx == 4: stat.stage_5_value = value
            
    # Process dinamic answers
    answers_data = data.get('answers', [])
    answers_json = {}
    for ans in answers_data:
        question_id = str(ans.get('question_id'))
        answer_text = str(ans.get('answer', ''))
        if question_id:
            answers_json[question_id] = answer_text
            
    if 'frequent_questions' in data:
        answers_json['frequent_questions'] = data.get('frequent_questions')
            
    stat.answers = answers_json
    
    # Guardar Daily Reflection si viene en el payload
    reflections_data = data.get('reflections')
    if reflections_data:
        stat.reflections = reflections_data
    
    try:
        db.session.commit()
        # Trigger webhook AFTER successful save (imported directly from setter.py logic)
        _trigger_setter_report_webhook(stat)
        return jsonify({"message": "Reporte guardado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def _compute_setter_stats(start_date_str, end_date_str, setter_id, agg_type):
    from app.models import SetterDailyStats, User
    from sqlalchemy import func

    # Count how many days of reports are in this range to calculate averages correctly
    days_count_query = db.session.query(func.count(SetterDailyStats.id))
    
    query = db.session.query(
        func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
        func.sum(SetterDailyStats.not_lead).label('not_lead'),
        func.sum(SetterDailyStats.inbox_inabribles).label('inabribles'),
        (func.sum(SetterDailyStats.funnel_qualification) - func.sum(SetterDailyStats.not_lead)).label('leads'),
        # Sumamos las aperturas de cualificación y dolor para el total
        func.sum(SetterDailyStats.qualification_opening_submitted + SetterDailyStats.pain_opening_submitted).label('op_sub'),
        func.sum(SetterDailyStats.qualification_opening_responded + SetterDailyStats.pain_opening_responded).label('op_res'),
        func.sum(SetterDailyStats.funnel_qualification).label('fun_qual'),
        func.sum(SetterDailyStats.funnel_pain).label('fun_pain'),
        func.sum(SetterDailyStats.funnel_offer).label('fun_offer'),
        func.sum(SetterDailyStats.funnel_link).label('fun_link'),
        func.sum(SetterDailyStats.funnel_agenda).label('fun_agenda'),
        
        # Follow Ups Sub/Res
        func.sum(SetterDailyStats.qualification_fu).label('fu_q_s'),
        func.sum(SetterDailyStats.qualification_fur).label('fu_q_r'),
        func.sum(SetterDailyStats.pain_fu).label('fu_p_s'),
        func.sum(SetterDailyStats.pain_fur).label('fu_p_r'),
        func.sum(SetterDailyStats.offer_fu).label('fu_o_s'),
        func.sum(SetterDailyStats.offer_fur).label('fu_o_r'),
        func.sum(SetterDailyStats.link_fu).label('fu_l_s'),
        func.sum(SetterDailyStats.link_fur).label('fu_l_r'),
        func.sum(SetterDailyStats.agenda_fu).label('fu_a_s'),
        func.sum(SetterDailyStats.agenda_fur).label('fu_a_r'),
        
        # Total Follow Ups
        (func.sum(SetterDailyStats.qualification_fu) + 
         func.sum(SetterDailyStats.pain_fu) + 
         func.sum(SetterDailyStats.offer_fu) + 
         func.sum(SetterDailyStats.link_fu) + 
         func.sum(SetterDailyStats.agenda_fu)).label('total_fu_s'),
        (func.sum(SetterDailyStats.qualification_fur) + 
         func.sum(SetterDailyStats.pain_fur) + 
         func.sum(SetterDailyStats.offer_fur) + 
         func.sum(SetterDailyStats.link_fur) + 
         func.sum(SetterDailyStats.agenda_fur)).label('total_fu_r'),
        
        # Openings Sub/Res
        func.sum(SetterDailyStats.qualification_opening_submitted).label('q_op_s'),
        func.sum(SetterDailyStats.qualification_opening_responded).label('q_op_r'),
        func.sum(SetterDailyStats.pain_opening_submitted).label('p_op_s'),
        func.sum(SetterDailyStats.pain_opening_responded).label('p_op_r'),
        
        # Question Efficacy
        func.sum(SetterDailyStats.q1_useful).label('q1_u'),
        func.sum(SetterDailyStats.q1_unuseful).label('q1_i'),
        func.sum(SetterDailyStats.q2_useful).label('q2_u'),
        func.sum(SetterDailyStats.q2_unuseful).label('q2_i')
    )
    
    filters = []
    if start_date_str:
        filters.append(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        filters.append(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
    if setter_id:
        filters.append(SetterDailyStats.setter_id == setter_id)
        
    for f in filters:
        query = query.filter(f)
        days_count_query = days_count_query.filter(f)
        
    stats = query.one()
    days_count = days_count_query.scalar() or 1
    
    # helper for safe division and averaging
    def div(n, d):
        return round((n / d) * 100, 2) if d and d > 0 else 0
    
    def process_val(v):
        val = float(v or 0)
        if agg_type == 'avg':
            return round(val / days_count, 2)
        return val

    # Totals/Averages
    entrantes = float(stats.entrantes or 0)
    
    res = {
        "metadata": {
            "days_analyzed": days_count,
            "agg_type": agg_type
        },
        "totals": {
            "entrantes": process_val(stats.entrantes),
            "not_lead": process_val(stats.not_lead),
            "inabribles": process_val(stats.inabribles),
            "leads": process_val(stats.leads),
            "no_response": process_val(stats.entrantes) - process_val(stats.fun_qual),
            "opening_submitted": process_val(stats.op_sub),
            "opening_responded": process_val(stats.op_res),
            "funnel_qualification": process_val(stats.fun_qual),
            "funnel_pain": process_val(stats.fun_pain),
            "funnel_offer": process_val(stats.fun_offer),
            "funnel_link": process_val(stats.fun_link),
            "funnel_agenda": process_val(stats.fun_agenda),
            
            "qualification_fu": process_val(stats.fu_q_s),
            "qualification_fur": process_val(stats.fu_q_r),
            "pain_fu": process_val(stats.fu_p_s),
            "pain_fur": process_val(stats.fu_p_r),
            "offer_fu": process_val(stats.fu_o_s),
            "offer_fur": process_val(stats.fu_o_r),
            "link_fu": process_val(stats.fu_l_s),
            "link_fur": process_val(stats.fu_l_r),
            "agenda_fu": process_val(stats.fu_a_s),
            "agenda_fur": process_val(stats.fu_a_r),
            
            "qualification_opening_submitted": process_val(stats.q_op_s),
            "qualification_opening_responded": process_val(stats.q_op_r),
            "pain_opening_submitted": process_val(stats.p_op_s),
            "pain_opening_responded": process_val(stats.p_op_r),
            
            "q1_useful": process_val(stats.q1_u),
            "q1_unuseful": process_val(stats.q1_i),
            "q2_useful": process_val(stats.q2_u),
            "q2_unuseful": process_val(stats.q2_i)
        },
        "percentages": {
            "questions": {
                "q1_useful": div(float(stats.q1_u or 0), float(stats.q1_u or 0) + float(stats.q1_i or 0)),
                "q2_useful": div(float(stats.q2_u or 0), float(stats.q2_u or 0) + float(stats.q2_i or 0)),
                "q1_total": float(stats.q1_u or 0) + float(stats.q1_i or 0),
                "q2_total": float(stats.q2_u or 0) + float(stats.q2_i or 0)
            },
            "inbox": {
                "leads": div(float(stats.leads or 0), entrantes),
                "not_lead": div(float(stats.not_lead or 0), entrantes),
                "inabribles": div(float(stats.inabribles or 0), entrantes)
            },
            "rates": {
                "opening_response": div(float(stats.op_res or 0), float(stats.op_sub or 0)),
                "opening_rate": div(float(stats.leads or 0), float(stats.entrantes or 0)),
                "qualification_fur": div(float(stats.fu_q_r or 0), float(stats.fu_q_s or 0)),
                "pain_fur": div(float(stats.fu_p_r or 0), float(stats.fu_p_s or 0)),
                "offer_fur": div(float(stats.fu_o_r or 0), float(stats.fu_o_s or 0)),
                "link_fur": div(float(stats.fu_l_r or 0), float(stats.fu_l_s or 0)),
                "agenda_fur": div(float(stats.fu_a_r or 0), float(stats.fu_a_s or 0)),
                "total_fur": div(float(stats.total_fu_r or 0), float(stats.total_fu_s or 0)),
                "qualification_opening_rate": div(float(stats.q_op_r or 0), float(stats.q_op_s or 0)),
                "pain_opening_rate": div(float(stats.p_op_r or 0), float(stats.p_op_s or 0))
            },
            "funnel_evolution": {
                "qual_to_pain": div(float(stats.fun_pain or 0), float(stats.leads or 0)),
                "pain_to_offer": div(float(stats.fun_offer or 0), float(stats.fun_pain or 0)),
                "offer_to_link": div(float(stats.fun_link or 0), float(stats.fun_offer or 0)),
                "link_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_link or 0))
            },
            "conversions_to_agenda": {
                "opening_to_agenda": div(float(stats.fun_agenda or 0), float(stats.op_res or 0)),
                "offer_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_offer or 0)),
                "link_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_link or 0))
            }
        },
        "setters_breakdown": []
    }

    # Breakdown by setter (only if team view)
    if not setter_id:
        breakdown_query = db.session.query(
            User.username.label('setter_name'),
            func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
            func.count(SetterDailyStats.id).label('reports_count')
        ).join(User, SetterDailyStats.setter_id == User.id)

        if start_date_str:
            breakdown_query = breakdown_query.filter(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
        if end_date_str:
            breakdown_query = breakdown_query.filter(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())

        breakdown_query = breakdown_query.group_by(User.id)
        
        total_period_days = days_count
        if start_date_str and end_date_str:
            s_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            e_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            total_period_days = (e_date - s_date).days + 1
        
        for row in breakdown_query.all():
            res["setters_breakdown"].append({
                "setter_name": row.setter_name,
                "entrantes": int(row.entrantes or 0),
                "reports_count": row.reports_count,
                "report_rate": round((row.reports_count / total_period_days) * 100, 2) if total_period_days > 0 else 0
            })

    # Time Series Data (Daily Evolution)
    time_series_query = db.session.query(
        SetterDailyStats.date,
        func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
        func.sum(SetterDailyStats.qualification_opening_submitted + SetterDailyStats.pain_opening_submitted).label('op_sub'),
        func.sum(SetterDailyStats.qualification_opening_responded + SetterDailyStats.pain_opening_responded).label('op_res'),
        func.sum(SetterDailyStats.qualification_fu).label('fu_q'),
        func.sum(SetterDailyStats.qualification_fur).label('fur_q'),
        func.sum(SetterDailyStats.funnel_agenda).label('fun_agenda')
    )
    for f in filters:
        time_series_query = time_series_query.filter(f)
    time_series_query = time_series_query.group_by(SetterDailyStats.date).order_by(SetterDailyStats.date)

    time_series = []
    for row in time_series_query.all():
        time_series.append({
            "date": row.date.isoformat(),
            "entrantes": int(row.entrantes or 0),
            "op_sub": int(row.op_sub or 0),
            "op_res": int(row.op_res or 0),
            "fu_q": int(row.fu_q or 0),
            "fur_q": int(row.fur_q or 0),
            "fun_agenda": int(row.fun_agenda or 0)
        })
    res["time_series"] = time_series
    
    return res


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
            return date(year, month, day)
        except ValueError:
            day -= 1

@bp.route('/public/setter-stats', methods=['GET'])
def get_public_setter_stats():
    """Returns aggregated stats for setters with sum/avg support and comparison."""
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    setter_id = request.args.get('setter_id')
    agg_type = request.args.get('agg_type', 'sum') # 'sum' or 'avg'
    compare = request.args.get('compare') == 'true'

    res = _compute_setter_stats(start_date_str, end_date_str, setter_id, agg_type)

    if compare and start_date_str and end_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            
            prev_start_date = _subtract_one_month(start_date)
            prev_end_date = _subtract_one_month(end_date)
            
            prev_start_str = prev_start_date.strftime('%Y-%m-%d')
            prev_end_str = prev_end_date.strftime('%Y-%m-%d')
            
            res['comparison'] = _compute_setter_stats(prev_start_str, prev_end_str, setter_id, agg_type)
        except Exception as e:
            pass

    return jsonify(res), 200
@bp.route('/public/setter-reports', methods=['GET'])
def get_public_setter_reports():
    """Retorna lista paginada de reportes con filtros."""
    from app.models import SetterDailyStats, User
    
    setter_id = request.args.get('setter_id')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    
    query = SetterDailyStats.query
    
    if setter_id:
        query = query.filter(SetterDailyStats.setter_id == setter_id)
    if start_date_str:
        query = query.filter(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
        
    pagination = query.order_by(SetterDailyStats.date.desc()).paginate(page=page, per_page=per_page)
    
    reports = []
    for r in pagination.items:
        reports.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "setter_id": r.setter_id,
            "setter_name": r.setter.username if r.setter else "Unknown",
            "entrantes": r.inbox_entrantes,
            "not_lead": r.not_lead,
            "inabribles": r.inbox_inabribles,
            "leads": r.inbox_leads,
            "op_sub": r.opening_submitted if r.opening_submitted > 0 else (r.qualification_opening_submitted + r.pain_opening_submitted),
            "op_res": r.opening_responded if r.opening_responded > 0 else (r.qualification_opening_responded + r.pain_opening_responded),
            "fun_qual": r.funnel_qualification,
            "fun_pain": r.funnel_pain,
            "fun_offer": r.funnel_offer,
            "fun_link": r.funnel_link,
            "fun_agenda": r.funnel_agenda,
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
        })
        
    return jsonify({
        "reports": reports,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    }), 200

@bp.route('/public/setter-reports/<int:report_id>', methods=['PUT'])
def update_public_setter_report(report_id):
    """Actualiza un reporte existente."""
    from app.models import SetterDailyStats
    stat = SetterDailyStats.query.get_or_404(report_id)
    data = request.get_json() or {}
    
    try:
        stat.inbox_entrantes = int(data.get('entrantes') or stat.inbox_entrantes)
        stat.not_lead = int(data.get('not_lead') or stat.not_lead)
        stat.inbox_inabribles = int(data.get('inabribles') or stat.inbox_inabribles)
        stat.inbox_leads = int(data.get('leads') or stat.inbox_leads)
        stat.opening_submitted = int(data.get('op_sub') or stat.opening_submitted)
        stat.opening_responded = int(data.get('op_res') or stat.opening_responded)
        stat.funnel_qualification = int(data.get('fun_qual') or stat.funnel_qualification)
        stat.funnel_pain = int(data.get('fun_pain') or stat.funnel_pain)
        stat.funnel_offer = int(data.get('fun_offer') or stat.funnel_offer)
        stat.funnel_link = int(data.get('fun_link') or stat.funnel_link)
        stat.funnel_agenda = int(data.get('fun_agenda') or stat.funnel_agenda)
        stat.qualification_fu = int(data.get('qualification_fu') or stat.qualification_fu)
        stat.pain_fu = int(data.get('pain_fu') or stat.pain_fu)
        stat.offer_fu = int(data.get('offer_fu') or stat.offer_fu)
        stat.agenda_fu = int(data.get('agenda_fu') or stat.agenda_fu)
        stat.qualification_fur = int(data.get('qualification_fur') or stat.qualification_fur)
        stat.pain_fur = int(data.get('pain_fur') or stat.pain_fur)
        stat.offer_fur = int(data.get('offer_fur') or stat.offer_fur)
        stat.agenda_fur = int(data.get('agenda_fur') or stat.agenda_fur)
        stat.q1_useful = int(data.get('q1_useful') or stat.q1_useful)
        stat.q1_unuseful = int(data.get('q1_unuseful') or stat.q1_unuseful)
        stat.q2_useful = int(data.get('q2_useful') or stat.q2_useful)
        stat.q2_unuseful = int(data.get('q2_unuseful') or stat.q2_unuseful)
        
        db.session.commit()
        return jsonify({"message": "Reporte actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@bp.route('/public/setter-reports/<int:report_id>', methods=['DELETE'])
def delete_public_setter_report(report_id):
    """Elimina un reporte."""
    from app.models import SetterDailyStats
    stat = SetterDailyStats.query.get_or_404(report_id)
    try:
        db.session.delete(stat)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


def _prepare_setter_report_data(stat):
    """Calcula y estructura todas las métricas del reporte diario de un setter."""
    setter_name = stat.setter.username if stat.setter else "Setter"
    
    from app.models import DailyReportQuestion
    qualitative_callouts = []
    if stat.answers:
        questions = {q.id: q.text for q in DailyReportQuestion.query.filter_by(role='setter').all()}
        for q_id, answer in stat.answers.items():
            if not str(q_id).isdigit():
                continue
            q_id_int = int(q_id)
            if answer and answer.strip():
                question_text = questions.get(q_id_int, f"Pregunta Cualitativa #{q_id_int}")
                qualitative_callouts.append({
                    "question": question_text,
                    "answer": answer
                })

    def safe_percent(part, total):
        try:
            if total > 0:
                return round((part / total) * 100)
        except:
            pass
        return 0

    inbox_entrantes = stat.inbox_entrantes or 0
    not_lead = stat.not_lead or 0
    inabribles = stat.inbox_inabribles or 0
    opened = stat.opening_submitted or 0
    op_resp = stat.opening_responded or 0
    qual = stat.funnel_qualification or 0
    pain = stat.funnel_pain or 0
    offer = stat.funnel_offer or 0
    link = stat.funnel_link or 0
    agenda = stat.funnel_agenda or 0
    fu_qual = stat.qualification_fu or 0
    fur_qual = stat.qualification_fur or 0
    fu_pain = stat.pain_fu or 0
    fur_pain = stat.pain_fur or 0
    fu_offer = stat.offer_fu or 0
    fur_offer = stat.offer_fur or 0
    fu_link = stat.link_fu or 0
    fur_link = stat.link_fur or 0
    fu_agenda = stat.agenda_fu or 0
    fur_agenda = stat.agenda_fur or 0

    q_op_sub = stat.qualification_opening_submitted or 0
    q_op_res = stat.qualification_opening_responded or 0
    p_op_sub = stat.pain_opening_submitted or 0
    p_op_res = stat.pain_opening_responded or 0

    def generate_sparkline_points(values, width=75, height=25):
        if not values:
            return ""
        vals = [float(v) for v in values]
        min_val = min(vals)
        max_val = max(vals)
        range_val = max_val - min_val
        
        points = []
        n = len(vals)
        for i, val in enumerate(vals):
            x = (i / (n - 1)) * width if n > 1 else 0
            if range_val > 0:
                y = height - ((val - min_val) / range_val) * height
            else:
                y = height / 2
            points.append(f"{x:.1f},{y:.1f}")
        return " ".join(points)

    from app.models import SetterDailyStats
    from datetime import timedelta

    # Calcular las tasas actuales
    openings_actual = (stat.qualification_opening_submitted or 0) + (stat.pain_opening_submitted or 0)
    if openings_actual == 0:
        openings_actual = stat.opening_submitted or 0
    openings_tasa = safe_percent(openings_actual, inbox_entrantes)
    qual_tasa = safe_percent(qual, inbox_entrantes)
    conv_tasa = safe_percent(agenda, qual)

    last_10_reports = SetterDailyStats.query.filter(
        SetterDailyStats.setter_id == stat.setter_id,
        SetterDailyStats.date <= stat.date
    ).order_by(SetterDailyStats.date.desc()).limit(10).all()
    
    last_7_reports = last_10_reports[:7] if len(last_10_reports) >= 7 else last_10_reports

    r10_count = len(last_10_reports)
    if r10_count > 0:
        avg_entrantes_10 = round(sum(r.inbox_entrantes or 0 for r in last_10_reports) / r10_count, 1)
        
        t_entrantes_10 = sum(r.inbox_entrantes or 0 for r in last_10_reports)
        t_openings_10 = sum(
            ((r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0))
            if ((r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0)) > 0
            else (r.opening_submitted or 0)
            for r in last_10_reports
        )
        avg_apertura_10 = safe_percent(t_openings_10, t_entrantes_10)
        
        t_qual_10 = sum(r.funnel_qualification or 0 for r in last_10_reports)
        avg_cual_10 = safe_percent(t_qual_10, t_entrantes_10)
        
        t_agendas_10 = sum(r.funnel_agenda or 0 for r in last_10_reports)
        avg_conv_10 = safe_percent(t_agendas_10, t_qual_10)
    else:
        avg_entrantes_10 = 0
        avg_apertura_10 = 0
        avg_cual_10 = 0
        avg_conv_10 = 0

    r7_count = len(last_7_reports)
    if r7_count > 0:
        avg_agendas_7 = round(sum(r.funnel_agenda or 0 for r in last_7_reports) / r7_count, 1)
    else:
        avg_agendas_7 = 0

    target_date_prev = stat.date - timedelta(days=7)
    stat_prev = SetterDailyStats.query.filter_by(
        setter_id=stat.setter_id,
        date=target_date_prev
    ).first()

    comp_data = {}
    if stat_prev:
        entrantes_prev = stat_prev.inbox_entrantes or 0
        diff_entrantes = inbox_entrantes - entrantes_prev
        pct_entrantes = round((diff_entrantes / entrantes_prev) * 100) if entrantes_prev > 0 else 0

        openings_prev_val = (stat_prev.qualification_opening_submitted or 0) + (stat_prev.pain_opening_submitted or 0)
        if openings_prev_val == 0:
            openings_prev_val = stat_prev.opening_submitted or 0
        tasa_apertura_prev = safe_percent(openings_prev_val, stat_prev.inbox_entrantes or 0)
        diff_tasa_apertura = openings_tasa - tasa_apertura_prev
        pct_tasa_apertura = round((diff_tasa_apertura / tasa_apertura_prev) * 100) if tasa_apertura_prev > 0 else 0

        tasa_cual_prev = safe_percent(stat_prev.funnel_qualification or 0, stat_prev.inbox_entrantes or 0)
        diff_tasa_cual = qual_tasa - tasa_cual_prev
        pct_tasa_cual = round((diff_tasa_cual / tasa_cual_prev) * 100) if tasa_cual_prev > 0 else 0

        tasa_conv_prev = safe_percent(stat_prev.funnel_agenda or 0, stat_prev.funnel_qualification or 0)
        diff_tasa_conv = conv_tasa - tasa_conv_prev
        pct_tasa_conv = round((diff_tasa_conv / tasa_conv_prev) * 100) if tasa_conv_prev > 0 else 0

        agendas_prev = stat_prev.funnel_agenda or 0
        diff_agendas = agenda - agendas_prev
        pct_agendas = round((diff_agendas / agendas_prev) * 100) if agendas_prev > 0 else 0

        comp_data = {
            "entrantes": {"prev": entrantes_prev, "diff": diff_entrantes, "pct": pct_entrantes},
            "apertura": {"prev": tasa_apertura_prev, "diff": diff_tasa_apertura, "pct": pct_tasa_apertura},
            "cualificacion": {"prev": tasa_cual_prev, "diff": diff_tasa_cual, "pct": pct_tasa_cual},
            "conversion_cual": {"prev": tasa_conv_prev, "diff": diff_tasa_conv, "pct": pct_tasa_conv},
            "agendas": {"prev": agendas_prev, "diff": diff_agendas, "pct": pct_agendas}
        }
    else:
        comp_data = {
            "entrantes": None,
            "apertura": None,
            "cualificacion": None,
            "conversion_cual": None,
            "agendas": None
        }

    kpi_metrics = {
        "entrantes": {
            "val": inbox_entrantes,
            "avg_10": avg_entrantes_10,
            "comp": comp_data["entrantes"]
        },
        "apertura": {
            "val": openings_tasa,
            "avg_10": avg_apertura_10,
            "comp": comp_data["apertura"]
        },
        "cualificacion": {
            "val": qual_tasa,
            "avg_10": avg_cual_10,
            "comp": comp_data["cualificacion"]
        },
        "conversion_cual": {
            "val": conv_tasa,
            "avg_10": avg_conv_10,
            "comp": comp_data["conversion_cual"]
        },
        "agendas": {
            "val": agenda,
            "avg_7": avg_agendas_7,
            "comp": comp_data["agendas"]
        }
    }

    # Invertir para sparkline (cronológico ascendente)
    chronological_reports = list(reversed(last_10_reports))
    
    entrantes_vals = []
    apertura_vals = []
    cual_vals = []
    conv_vals = []
    agendas_vals = []
    
    for r in chronological_reports:
        e_val = r.inbox_entrantes or 0
        entrantes_vals.append(e_val)
        
        op_val = (r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0)
        if op_val == 0:
            op_val = r.opening_submitted or 0
        apertura_vals.append(safe_percent(op_val, e_val))
        
        q_val = r.funnel_qualification or 0
        cual_vals.append(safe_percent(q_val, e_val))
        
        a_val = r.funnel_agenda or 0
        conv_vals.append(safe_percent(a_val, q_val))
        agendas_vals.append(a_val)
        
    sparklines = {
        "entrantes": generate_sparkline_points(entrantes_vals),
        "apertura": generate_sparkline_points(apertura_vals),
        "cualificacion": generate_sparkline_points(cual_vals),
        "conversion_cual": generate_sparkline_points(conv_vals),
        "agendas": generate_sparkline_points(agendas_vals[-7:])
    }

    # Obtener los 7 reportes previos (excluyendo el actual)
    prev_7_reports = SetterDailyStats.query.filter(
        SetterDailyStats.setter_id == stat.setter_id,
        SetterDailyStats.date < stat.date
    ).order_by(SetterDailyStats.date.desc()).limit(7).all()

    avg_entrantes_7 = 0
    avg_apertura_7 = 0
    avg_cual_7 = 0
    avg_conv_7 = 0

    p7_count = len(prev_7_reports)
    if p7_count > 0:
        avg_entrantes_7 = sum(r.inbox_entrantes or 0 for r in prev_7_reports) / p7_count
        
        t_entrantes_7 = sum(r.inbox_entrantes or 0 for r in prev_7_reports)
        t_openings_7 = sum(
            ((r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0))
            if ((r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0)) > 0
            else (r.opening_submitted or 0)
            for r in prev_7_reports
        )
        avg_apertura_7 = safe_percent(t_openings_7, t_entrantes_7)
        
        t_qual_7 = sum(r.funnel_qualification or 0 for r in prev_7_reports)
        avg_cual_7 = safe_percent(t_qual_7, t_entrantes_7)
        
        t_agendas_7 = sum(r.funnel_agenda or 0 for r in prev_7_reports)
        avg_conv_7 = safe_percent(t_agendas_7, t_qual_7)

    # Insight 1: Entrantes vs promedio 7 días
    if avg_entrantes_7 > 0:
        diff_entrantes = inbox_entrantes - avg_entrantes_7
        pct_entrantes = round((diff_entrantes / avg_entrantes_7) * 100)
        if pct_entrantes > 0:
            insight_entrantes = {"dir": "up", "title": f"La tasa de entrantes subió {pct_entrantes}%", "subtitle": "vs el promedio de los últimos 7 días."}
        elif pct_entrantes < 0:
            insight_entrantes = {"dir": "down", "title": f"La tasa de entrantes bajó {abs(pct_entrantes)}%", "subtitle": "vs el promedio de los últimos 7 días."}
        else:
            insight_entrantes = {"dir": "neutral", "title": "La tasa de entrantes se mantuvo", "subtitle": "vs el promedio de los últimos 7 días."}
    else:
        insight_entrantes = {"dir": "neutral", "title": "Tasa de entrantes", "subtitle": f"Hoy: {inbox_entrantes} (sin promedio previo)"}

    # Insight 2: Tasa de apertura vs promedio 7 días
    if avg_apertura_7 > 0:
        diff_apertura = openings_tasa - avg_apertura_7
        if diff_apertura > 0:
            insight_apertura = {"dir": "up", "title": f"La tasa de apertura subió {diff_apertura}%", "subtitle": "vs el promedio de los últimos 7 días."}
        elif diff_apertura < 0:
            insight_apertura = {"dir": "down", "title": f"La tasa de apertura bajó {abs(diff_apertura)}%", "subtitle": "vs el promedio de los últimos 7 días."}
        else:
            insight_apertura = {"dir": "neutral", "title": "La tasa de apertura se mantuvo", "subtitle": "vs el promedio de los últimos 7 días."}
    else:
        insight_apertura = {"dir": "neutral", "title": "Tasa de apertura", "subtitle": f"Hoy: {openings_tasa}% (sin promedio previo)"}

    # Insight 3: Tasa de cualificación vs promedio 7 días
    if avg_cual_7 > 0:
        diff_cual = qual_tasa - avg_cual_7
        if diff_cual > 0:
            insight_cual = {"dir": "up", "title": f"La tasa de cualificación subió {diff_cual}%", "subtitle": "vs el promedio de los últimos 7 días."}
        elif diff_cual < 0:
            insight_cual = {"dir": "down", "title": f"La tasa de cualificación bajó {abs(diff_cual)}%", "subtitle": "vs el promedio de los últimos 7 días."}
        else:
            insight_cual = {"dir": "neutral", "title": "La tasa de cualificación se mantuvo", "subtitle": "vs el promedio de los últimos 7 días."}
    else:
        insight_cual = {"dir": "neutral", "title": "Tasa de cualificación", "subtitle": f"Hoy: {qual_tasa}% (sin promedio previo)"}

    # Insight 4: Conversión por lead cualificado vs promedio 7 días
    if avg_conv_7 > 0:
        diff_conv = conv_tasa - avg_conv_7
        if diff_conv > 0:
            insight_conv = {"dir": "up", "title": f"La conversión por lead cualificado subió {diff_conv}%", "subtitle": "vs el promedio de 7 días."}
        elif diff_conv < 0:
            insight_conv = {"dir": "down", "title": f"La conversión por lead cualificado bajó {abs(diff_conv)}%", "subtitle": "vs el promedio de 7 días."}
        else:
            insight_conv = {"dir": "neutral", "title": "La conversión por lead cualificado se mantuvo", "subtitle": "vs el promedio de 7 días."}
    else:
        insight_conv = {"dir": "neutral", "title": "Conversión por cualificado", "subtitle": f"Hoy: {conv_tasa}% (sin promedio previo)"}

    # Insight 5: Agendas vs semana anterior
    if stat_prev:
        agendas_prev = stat_prev.funnel_agenda or 0
        diff_agendas = agenda - agendas_prev
        if diff_agendas > 0:
            insight_agendas = {"dir": "up", "title": "Más agendas que la semana anterior", "subtitle": f"({agenda} vs {agendas_prev})."}
        elif diff_agendas < 0:
            insight_agendas = {"dir": "down", "title": "Menos agendas que la semana anterior", "subtitle": f"({agenda} vs {agendas_prev})."}
        else:
            insight_agendas = {"dir": "neutral", "title": "Mismas agendas que la semana anterior", "subtitle": f"({agenda} vs {agendas_prev})."}
    else:
        insight_agendas = {"dir": "neutral", "title": "Agendas generadas", "subtitle": f"Hoy: {agenda} (sin semana anterior)"}

    insights_rapidos = [insight_entrantes, insight_apertura, insight_cual, insight_conv, insight_agendas]

    avg_metrics = {
        "entrantes": avg_entrantes_10,
        "openings": avg_apertura_10,
        "agendas": avg_agendas_7,
        "conversion": avg_conv_10
    }

    return {
        "setter_name": setter_name,
        "date_str": stat.date.strftime('%d/%m/%Y'),
        "kpi_metrics": kpi_metrics,
        "sparklines": sparklines,
        "insights": insights_rapidos,
        
        "inbox": {
            "entrantes": inbox_entrantes,
            "not_lead": not_lead,
            "inabribles": inabribles,
            "leads": stat.inbox_leads or 0,
            "no_lead_pct": safe_percent(not_lead, inbox_entrantes),
            "inabribles_pct": safe_percent(inabribles, inbox_entrantes)
        },
        
        "openings": {
            "qualification": {"submitted": q_op_sub, "responded": q_op_res, "pct": safe_percent(q_op_res, q_op_sub)},
            "pain": {"submitted": p_op_sub, "responded": p_op_res, "pct": safe_percent(p_op_res, p_op_sub)},
            "legacy": {"submitted": opened, "responded": op_resp, "pct": safe_percent(op_resp, opened)}
        },
        
        "funnel": {
            "qualification": qual,
            "pain": pain,
            "offer": offer,
            "link": link,
            "agenda": agenda,
            "qual_to_pain": safe_percent(pain, qual),
            "pain_to_offer": safe_percent(offer, pain),
            "offer_to_link": safe_percent(link, offer),
            "link_to_agenda": safe_percent(agenda, link),
            "conversion_leads_pct": safe_percent(agenda, stat.inbox_leads or 0)
        },
        
        "follow_up": {
            "qualification": fu_qual,
            "qualification_fur": fur_qual,
            "pain": fu_pain,
            "pain_fur": fur_pain,
            "offer": fu_offer,
            "offer_fur": fur_offer,
            "link": fu_link,
            "link_fur": fur_link,
            "agenda": fu_agenda,
            "agenda_fur": fur_agenda,
            "total_fu": fu_qual + fu_pain + fu_offer + fu_link + fu_agenda,
            "total_fur": fur_qual + fur_pain + fu_offer + fur_link + fur_agenda,
            "response_pct": safe_percent(fur_qual + fur_pain + fur_offer + fur_link + fur_agenda, fu_qual + fu_pain + fu_offer + fu_link + fu_agenda)
        },
        
        "averages": avg_metrics,
        "questions_efficacy": {
            "q1": {
                "useful": stat.q1_useful or 0, 
                "unuseful": stat.q1_unuseful or 0,
                "pct": safe_percent(stat.q1_useful or 0, (stat.q1_useful or 0) + (stat.q1_unuseful or 0))
            },
            "q2": {
                "useful": stat.q2_useful or 0, 
                "unuseful": stat.q2_unuseful or 0,
                "pct": safe_percent(stat.q2_useful or 0, (stat.q2_useful or 0) + (stat.q2_unuseful or 0))
            }
        },
        "qualitative": qualitative_callouts,
        "reflections": stat.reflections or {}
    }


@bp.route('/public/setter-reports/<int:report_id>/preview', methods=['GET'])
def preview_setter_report_discord(report_id):
    """Genera una vista previa del reporte de Setter renderizado en HTML para administradores."""
    from app.models import SetterDailyStats, User
    from flask import current_app
    from flask_login import current_user
    import os
    
    user = None
    if current_user.is_authenticated:
        user = current_user
    else:
        token = request.args.get('token')
        if token:
            user_id = User.verify_auth_token(token)
            if user_id:
                user = User.query.get(user_id)
            
            if not user and (current_app.config.get('DEBUG') or current_app.debug):
                try:
                    import jwt
                    jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
                    user = User.query.filter_by(role='admin').first()
                except Exception as e:
                    print(f"DEBUG PREVIEW BYPASS ERROR: {e}")

    if not user or user.role != 'admin':
        return jsonify({"error": "No autorizado"}), 403

    stat = SetterDailyStats.query.get_or_404(report_id)
    img_data = _prepare_setter_report_data(stat)
    img_data["is_preview"] = True

    template_path = os.path.join(current_app.root_path, 'templates', 'reports', 'setter_report.html')
    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()

    return render_template_string(template_content, **img_data)


# ============================================================
# FINANCIAL ANALYSIS (EXCEL DATA)
# ============================================================

