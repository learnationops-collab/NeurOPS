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
    
    # Agendas Today
    serialized['agendas_today'] = []
    for appt, seq in data['upcoming_agendas']:
        serialized['agendas_today'].append({
            "id": appt.id,
            "lead_name": appt.lead.username if appt.lead else "Unknown",
            "start_time": appt.start_time.isoformat(),
            "status": appt.status,
            "type": appt.appointment_type,
            "seq_num": seq
        })
        
    # Sales Today (Detailed)
    serialized['sales_today'] = []
    # We can fetch them here or add to Service. Let's add to Service for cleanliness if possible, 
    # but for speed let's just use the data already in the context if we enhance get_dashboard_data.
    # Actually CloserService already has the logic for new_enrollments today.
    # Let's just fetch them again here or update the service.
    
    from app.models import Enrollment, User
    # Re-using start_utc/end_utc logic from data['dates']
    start_utc = data['dates']['start_utc']
    # end_utc is start_utc + 1 day
    from datetime import timedelta
    end_utc = start_utc + timedelta(days=1)
    
    sales = Enrollment.query.filter(
        Enrollment.closer_id == current_user.id,
        Enrollment.enrollment_date >= start_utc,
        Enrollment.enrollment_date < end_utc
    ).all()
    
    for s in sales:
        serialized['sales_today'].append({
            "id": s.id,
            "student_name": s.student.username,
            "program_name": s.program.name,
            "amount": s.total_agreed,
            "time": s.enrollment_date.isoformat()
        })
    
    # Questions
    questions = DailyReportQuestion.query.filter_by(is_active=True).order_by(DailyReportQuestion.order).all()
    serialized['report_questions'] = [{
        "id": q.id,
        "text": q.text,
        "type": q.question_type
    } for q in questions]

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

@bp.route('/agendas', methods=['GET'])
@login_required
def get_all_agendas():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    page = request.args.get('page', 1, type=int)
    from app.models import Appointment
    pagination = Appointment.query.filter_by(closer_id=current_user.id).order_by(Appointment.start_time.desc()).paginate(page=page, per_page=50)
    
    return jsonify({
        "data": [{
            "id": a.id,
            "lead_name": a.lead.username if a.lead else "Unknown",
            "date": a.start_time.isoformat(),
            "status": a.status,
            "type": a.appointment_type
        } for a in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages
    }), 200

@bp.route('/sales', methods=['GET'])
@login_required
def get_all_sales():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    page = request.args.get('page', 1, type=int)
    from app.models import Enrollment
    pagination = Enrollment.query.filter_by(closer_id=current_user.id).order_by(Enrollment.enrollment_date.desc()).paginate(page=page, per_page=50)
    
    return jsonify({
        "data": [{
            "id": s.id,
            "student_name": s.student.username if s.student else "Unknown",
            "program_name": s.program.name if s.program else "Unknown",
            "amount": s.total_agreed,
            "date": s.enrollment_date.isoformat(),
            "status": s.status
        } for s in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages
    }), 200

@bp.route('/availability', methods=['GET', 'POST'])
@login_required
def manage_availability():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    from app.models import Availability
    from datetime import datetime, time
    
    if request.method == 'POST':
        data = request.get_json() or {}
        # Simple implementation: replace all for a date or similar
        # For now, let's just allow adding one slot or clearing
        action = data.get('action', 'add')
        
        if action == 'add':
            date_str = data.get('date')
            start_str = data.get('start_time')
            end_str = data.get('end_time')
            
            new_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            new_start = datetime.strptime(start_str, '%H:%M').time()
            new_end = datetime.strptime(end_str, '%H:%M').time()
            
            avail = Availability(
                closer_id=current_user.id,
                date=new_date,
                start_time=new_start,
                end_time=new_end
            )
            db.session.add(avail)
        elif action == 'delete':
            avail_id = data.get('id')
            Availability.query.filter_by(id=avail_id, closer_id=current_user.id).delete()
            
        db.session.commit()
        return jsonify({"message": "Disponibilidad actualizada"}), 200
        
    # GET
    availability = Availability.query.filter_by(closer_id=current_user.id).order_by(Availability.date.desc(), Availability.start_time.asc()).all()
    return jsonify([{
        "id": a.id,
        "date": a.date.isoformat(),
        "start_time": a.start_time.strftime('%H:%M'),
        "end_time": a.end_time.strftime('%H:%M')
    } for a in availability]), 200
