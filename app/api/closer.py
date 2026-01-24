from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.closer_service import CloserService
from app.models import DailyReportQuestion, CloserDailyStats, DailyReportAnswer, db
from app.decorators import role_required
from datetime import date

bp = Blueprint('closer_api', __name__)

@bp.route('/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    # Only closer or admin
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    tz = current_user.timezone or 'America/La_Paz'
    data = CloserService.get_dashboard_data(current_user.id, tz)
    
    # Process data for JSON serialization
    serialized = {
        "kpis": data['kpis'],
        "commission": data['commission'],
        "rates": data['rates'],
        "progress": data['progress']
    }
    
    # Agendas
    serialized['upcoming_agendas'] = []
    for appt, seq in data['upcoming_agendas']:
        serialized['upcoming_agendas'].append({
            "id": appt.id,
            "lead_name": appt.lead.username if appt.lead else "Unknown",
            "start_time": appt.start_time.isoformat(),
            "status": appt.status,
            "seq_num": seq
        })
        
    # Recent Clients
    serialized['recent_clients'] = []
    for u in data['recent_clients']:
        serialized['recent_clients'].append({
            "id": u.id,
            "username": u.username,
            "status": u.lead_profile.status if u.lead_profile else None,
            "is_pinned": u.lead_profile.is_pinned if u.lead_profile else False
        })
        
    return jsonify(serialized), 200

@bp.route('/leads', methods=['GET'])
@login_required
def get_assigned_leads():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    filters = {
        'search': request.args.get('search', ''),
        'program': request.args.get('program'),
        'status': request.args.get('status'),
        'sort_by': request.args.get('sort_by', 'newest')
    }
    page = request.args.get('page', 1, type=int)
    
    pagination = CloserService.get_leads_pagination(current_user.id, page=page, filters=filters)
    kpis = CloserService.get_leads_kpis(current_user.id, filters=filters)
    
    leads = []
    for l in pagination.items:
        leads.append({
            "id": l.id,
            "username": l.username,
            "email": l.email,
            "status": l.lead_profile.status if l.lead_profile else None,
            "phone": l.lead_profile.phone if l.lead_profile else None
        })
        
    return jsonify({
        "leads": leads,
        "total": pagination.total,
        "kpis": kpis
    }), 200

@bp.route('/questions', methods=['GET'])
@login_required
def get_report_questions():
    questions = DailyReportQuestion.query.filter_by(is_active=True).order_by(DailyReportQuestion.order).all()
    return jsonify([{
        "id": q.id,
        "text": q.text,
        "type": q.question_type
    } for q in questions]), 200

@bp.route('/daily-report', methods=['POST'])
@login_required
def submit_report():
    data = request.get_json() or {}
    today = date.today()
    
    # Simple check or enhancement in Service if needed
    stats = CloserDailyStats.query.filter_by(closer_id=current_user.id, date=today).first()
    if not stats:
        stats = CloserDailyStats(closer_id=current_user.id, date=today)
        db.session.add(stats)
        
    # Save answers
    answers = data.get('answers', {})
    for q_id, val in answers.items():
        # Clear existing
        DailyReportAnswer.query.filter_by(daily_stats_id=stats.id, question_id=q_id).delete()
        ans = DailyReportAnswer(daily_stats_id=stats.id, question_id=q_id, answer=str(val))
        db.session.add(ans)
        
    db.session.commit()
    return jsonify({"message": "Reporte guardado con exito"}), 200
