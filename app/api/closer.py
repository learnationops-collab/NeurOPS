from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.closer_service import CloserService
from app.models import DailyReportQuestion, CloserDailyStats, DailyReportAnswer, db, Appointment, Enrollment, WeeklyAvailability, Event, Client
from app.decorators import role_required
from datetime import date, timedelta, datetime

bp = Blueprint('closer_api', __name__)

@bp.route('/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    tz = current_user.timezone or 'America/La_Paz'
    data = CloserService.get_dashboard_data(current_user.id, tz)
    
    today_stats_serialized = None
    if data.get('today_stats'):
        ts = data['today_stats']
        today_stats_serialized = {"id": ts.id, "date": ts.date.isoformat(), "answers": {a.question_id: a.answer for a in ts.answers}}

    serialized = {
        "kpis": data['kpis'],
        "commission": data['commission'],
        "rates": data['rates'],
        "progress": data['progress'],
        "today_stats": today_stats_serialized,
        "agendas_today": [],
        "sales_today": []
    }
    
    for appt, seq in data.get('upcoming_agendas', []):
        serialized['agendas_today'].append({
            "id": appt.id,
            "lead_name": appt.client.full_name or appt.client.email if appt.client else "Unknown",
            "phone": appt.client.phone if appt.client else "",
            "start_time": appt.start_time.isoformat(),
            "status": appt.status,
            "type": appt.appointment_type,
            "seq_num": seq
        })
        
    # Sales Today
    sales = Enrollment.query.filter(
        Enrollment.closer_id == current_user.id,
        Enrollment.enrollment_date >= date.today()
    ).all()
    
    for s in sales:
        serialized['sales_today'].append({
            "id": s.id,
            "student_name": s.client.full_name or s.client.email if s.client else "Unknown",
            "program_name": s.program.name if s.program else "Unknown",
            "amount": s.program.price if s.program else 0.0,
            "time": s.enrollment_date.isoformat()
        })
    
    questions = DailyReportQuestion.query.filter_by(is_active=True).order_by(DailyReportQuestion.order).all()
    serialized['report_questions'] = [{"id": q.id, "text": q.text, "type": q.question_type} for q in questions]

    serialized['recent_clients'] = []
    for c in data.get('recent_clients', []):
        serialized['recent_clients'].append({
            "id": c.id,
            "username": c.full_name or c.email
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
        'sort_by': request.args.get('sort_by', 'newest')
    }
    page = request.args.get('page', 1, type=int)
    
    pagination = CloserService.get_leads_pagination(current_user.id, page=page, filters=filters)
    kpis = CloserService.get_leads_kpis(current_user.id, filters=filters)
    
    return jsonify({
        "leads": [{"id": l.id, "username": l.full_name or l.email, "email": l.email, "phone": l.phone} for l in pagination.items],
        "total": pagination.total,
        "kpis": kpis
    }), 200

@bp.route('/daily-report', methods=['POST'])
@login_required
def submit_report():
    data = request.get_json() or {}
    today = date.today()
    stats = CloserDailyStats.query.filter_by(closer_id=current_user.id, date=today).first()
    if not stats:
        stats = CloserDailyStats(closer_id=current_user.id, date=today)
        db.session.add(stats)
        
    answers = data.get('answers', {})
    for q_id, val in answers.items():
        try:
            q_id_int = int(q_id)
            DailyReportAnswer.query.filter_by(daily_stats_id=stats.id, question_id=q_id_int).delete()
            db.session.add(DailyReportAnswer(daily_stats_id=stats.id, question_id=q_id_int, answer=str(val)))
        except ValueError: continue
        
    db.session.commit()
    return jsonify({"message": "Reporte guardado con exito"}), 200

@bp.route('/agendas', methods=['GET'])
@login_required
def get_all_agendas():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    page = request.args.get('page', 1, type=int)
    pagination = Appointment.query.filter_by(closer_id=current_user.id).order_by(Appointment.start_time.desc()).paginate(page=page, per_page=50)
    return jsonify({
        "data": [{"id": a.id, "lead_name": a.client.full_name or a.client.email if a.client else "Unknown", "date": a.start_time.isoformat(), "status": a.status, "type": a.appointment_type} for a in pagination.items],
        "total": pagination.total, "pages": pagination.pages
    }), 200

@bp.route('/sales', methods=['GET'])
@login_required
def get_all_sales():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    page = request.args.get('page', 1, type=int)
    pagination = Enrollment.query.filter_by(closer_id=current_user.id).order_by(Enrollment.enrollment_date.desc()).paginate(page=page, per_page=50)
    return jsonify({
        "data": [{"id": s.id, "student_name": s.client.full_name or s.client.email if s.client else "Unknown", "program_name": s.program.name if s.program else "Unknown", "amount": s.program.price if s.program else 0.0, "date": s.enrollment_date.isoformat()} for s in pagination.items],
        "total": pagination.total, "pages": pagination.pages
    }), 200

@bp.route('/weekly-availability', methods=['GET', 'POST'])
@login_required
def manage_weekly_availability():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    
    if request.method == 'POST':
        data = request.get_json() or {}
        WeeklyAvailability.query.filter_by(closer_id=current_user.id).delete()
        for day_entry in data.get('schedule', []):
            day_of_week = int(day_entry.get('day'))
            for slot in day_entry.get('slots', []):
                db.session.add(WeeklyAvailability(closer_id=current_user.id, day_of_week=day_of_week, start_time=datetime.strptime(slot['start'], '%H:%M').time(), end_time=datetime.strptime(slot['end'], '%H:%M').time()))
        db.session.commit()
        return jsonify({"message": "Horario semanal actualizado"}), 200
        
    schedule = WeeklyAvailability.query.filter_by(closer_id=current_user.id).all()
    result = {}
    for wa in schedule:
        day = str(wa.day_of_week)
        if day not in result: result[day] = []
        result[day].append({"start": wa.start_time.strftime('%H:%M'), "end": wa.end_time.strftime('%H:%M')})
    return jsonify(result), 200

@bp.route('/sale-metadata', methods=['GET'])
@login_required
def get_sale_metadata():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    return jsonify(CloserService.get_sale_metadata(current_user.id)), 200

@bp.route('/sales', methods=['POST'])
@login_required
def register_sale():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    data = request.get_json() or {}
    lead_id = data.get('lead_id')
    if not lead_id: return jsonify({"error": "Lead ID is required"}), 400
    try:
        CloserService.register_sale(current_user.id, lead_id, data)
        return jsonify({"message": "Venta registrada con éxito"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
@bp.route('/appointments/<int:id>', methods=['PATCH'])
@login_required
def update_appointment(id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    
    appt = Appointment.query.get_or_404(id)
    if current_user.role != 'admin' and appt.closer_id != current_user.id:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    if 'start_time' in data:
        try:
            # Format usually comes as ISO from frontend
            appt.start_time = datetime.fromisoformat(data['start_time'].replace('Z', ''))
        except ValueError:
            return jsonify({"error": "Invalid date format"}), 400
            
    db.session.commit()
    return jsonify({"message": "Agenda actualizada con éxito"}), 200

@bp.route('/slots', methods=['GET'])
@login_required
def get_slots():
    slots = CloserService.get_available_slots(current_user.id)
    return jsonify(slots), 200

@bp.route('/appointments/<int:id>/process', methods=['POST'])
@login_required
def process_agenda(id):
    data = request.get_json() or {}
    try:
        CloserService.process_agenda(current_user.id, id, data)
        return jsonify({"message": "Agenda procesada"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
