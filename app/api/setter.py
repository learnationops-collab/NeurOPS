from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import DailyReportQuestion, DailyReportAnswer, SetterDailyStats, ROLE_SETTER
from app.decorators import role_required
from datetime import datetime

bp = Blueprint('setter', __name__)

@bp.route('/questions', methods=['GET'])
@login_required
@role_required(ROLE_SETTER)
def get_setter_questions():
    questions = DailyReportQuestion.query.filter_by(role='setter', is_active=True).order_by(DailyReportQuestion.order).all()
    return jsonify([{"id": q.id, "text": q.text, "type": q.question_type} for q in questions]), 200

@bp.route('/report', methods=['POST'])
@login_required
@role_required(ROLE_SETTER)
def submit_daily_report():
    data = request.get_json() or {}
    
    # Datos fijos obligatorios
    report_date_str = data.get('date')
    if not report_date_str:
        return jsonify({"message": "La fecha es obligatoria"}), 400
    
    report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    
    # Verificar si ya existe un reporte para este setter en esta fecha
    existing = SetterDailyStats.query.filter_by(setter_id=current_user.id, date=report_date).first()
    if existing:
        # En una versión futura podríamos permitir editar, por ahora bloqueamos duplicados
        return jsonify({"message": "Ya has enviado un reporte para esta fecha"}), 400
    
    # Crear estadísticas fijas (Legacy/Fallback)
    stats = SetterDailyStats(
        setter_id=current_user.id,
        date=report_date,
        inbound_leads=data.get('inbound_leads', 0),
        openings=data.get('openings', 0),
        not_lead=data.get('not_lead', 0),
        new_offers=data.get('new_offers', 0),
        links_sent=data.get('links_sent', 0),
        appointments_booked=data.get('appointments_booked', 0),
        follow_ups=data.get('follow_ups', 0)
    )
    
    db.session.add(stats)
    db.session.flush() # Get ID
    
    # Procesar Métricas del Funnel Dinámico
    from app.models import SetterDailyStageMetric
    funnel_metrics = data.get('funnel_metrics', [])
    for metric in funnel_metrics:
        stage_id = metric.get('stage_id')
        value = metric.get('value', 0)
        
        if stage_id:
            m = SetterDailyStageMetric(
                daily_stats_id=stats.id,
                stage_id=stage_id,
                value=int(value)
            )
            db.session.add(m)
    
    # Procesar preguntas dinámicas (Legacy/Extra Questions)
    answers = data.get('answers', [])
    for ans in answers:
        question_id = ans.get('question_id')
        answer_text = str(ans.get('answer', ''))
        
        if question_id:
            answer_obj = DailyReportAnswer(
                setter_stats_id=stats.id,
                question_id=question_id,
                answer=answer_text
            )
            db.session.add(answer_obj)
            
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar el reporte: {str(e)}"}), 500
        
    return jsonify({"message": "Reporte enviado con éxito", "id": stats.id}), 201

@bp.route('/stats/summary', methods=['GET'])
@login_required
@role_required(ROLE_SETTER)
def get_stats_summary():
    from sqlalchemy import func
    from datetime import date, timedelta
    
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    query = db.session.query(
        func.sum(SetterDailyStats.appointments_booked).label('total_agendas'),
        func.sum(SetterDailyStats.openings).label('total_openings'),
        func.sum(SetterDailyStats.inbound_leads).label('total_leads')
    ).filter_by(setter_id=current_user.id)
    
    if start_date_str:
        query = query.filter(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
        
    stats = query.first()
    
    # Conversión en el periodo seleccionado o histórica
    conversion = 0
    if stats and stats.total_openings and stats.total_openings > 0:
        conversion = round((stats.total_agendas / stats.total_openings) * 100, 1)
    
    # Fetch pending agendas (appointments booked by this setter with no result)
    from app.models import Appointment
    from sqlalchemy import or_
    
    pending_agendas = Appointment.query.filter(
        Appointment.setter_id == current_user.id,
        or_(Appointment.result == None, Appointment.result == '')
    ).order_by(Appointment.start_time.desc()).limit(50).all()
    
    return jsonify({
        "total_agendas": int(stats.total_agendas or 0),
        "total_openings": int(stats.total_openings or 0),
        "total_leads": int(stats.total_leads or 0),
        "conversion": conversion,
        "new_leads": [], # Deprecated or Empty
        "pending_agendas": [{
            "id": a.id,
            "lead_name": a.client.full_name or a.client.email,
            "closer_name": a.closer.username if a.closer else "Unassigned",
            "start_time": a.start_time.isoformat(),
            "origin": a.origin
        } for a in pending_agendas]
    }), 200

@bp.route('/leads', methods=['GET'])
@login_required
@role_required(ROLE_SETTER)
def get_leads():
    from app.models import Lead, PipelineStage
    
    stage_id = request.args.get('stage_id')
    
    query = Lead.query
    
    if stage_id:
        query = query.filter_by(stage_id=stage_id)
        
    leads = query.order_by(Lead.created_at.desc()).all()
    
    return jsonify([{
        "id": l.id,
        "name": l.name,
        "email": l.email,
        "instagram_username": l.instagram_username,
        "stage_id": l.stage_id,
        "ad_source": l.ad_source,
        "tags": l.tags,
        "notes": l.notes,
        "created_at": l.created_at.isoformat()
    } for l in leads]), 200

@bp.route('/stages', methods=['GET'])
@login_required
@role_required(ROLE_SETTER)
def get_stages():
    from app.models import Pipeline, PipelineStage
    
    # Fetch 'setter_default' pipeline
    pipeline = Pipeline.query.filter_by(name='setter_default').first()
    if not pipeline:
        return jsonify([]), 200
        
    stages = PipelineStage.query.filter_by(pipeline_id=pipeline.id, is_active=True).order_by(PipelineStage.order).all()
    
    return jsonify([{
        "id": s.id, 
        "name": s.name,
        "order": s.order
    } for s in stages]), 200

@bp.route('/links', methods=['GET'])
@login_required
@role_required(ROLE_SETTER)
def get_available_links():
    from app.models import Event, User
    
    events = Event.query.filter_by(is_active=True).all()
    closers = User.query.filter_by(role='closer', is_active=True).all()
    
    return jsonify({
        "events": [{
            "id": e.id,
            "name": e.name,
            "slug": e.utm_source # Using utm_source as slug for now based on public.py logic
        } for e in events],
        "closers": [{
            "id": c.id,
            "username": c.username
        } for c in closers]
    }), 200

@bp.route('/notifications', methods=['GET'])
@login_required
@role_required(ROLE_SETTER)
def get_notifications():
    from app.models import Notification
    
    # Fetch last 50 notifications
    all_notifs = Notification.query.order_by(Notification.created_at.desc()).limit(50).all()
    
    relevant = []
    # Simple Python-side filtering for JSON compatibility
    for n in all_notifs:
        is_target = False
        
        # Check target
        if n.target_users == "all":
            is_target = True
        elif isinstance(n.target_users, str) and (n.target_users == f"role:{ROLE_SETTER}" or n.target_users == "role:setter"):
            is_target = True
        elif isinstance(n.target_users, list) and current_user.id in n.target_users:
            is_target = True
            
        if is_target:
            is_read = current_user.id in (n.read_by or [])
            relevant.append({
                "id": n.id,
                "subject": n.subject,
                "content": n.content,
                "created_at": n.created_at.isoformat(),
                "is_read": is_read
            })
            
    return jsonify(relevant), 200

@bp.route('/notifications/<int:id>/read', methods=['POST'])
@login_required
@role_required(ROLE_SETTER)
def mark_notification_read(id):
    from app.models import Notification
    
    notif = Notification.query.get_or_404(id)
    
    # Initialize read_by if None
    if not notif.read_by:
        notif.read_by = []
        
    # Add user if not present
    if current_user.id not in notif.read_by:
        # Create a new list to ensure SQLAlchemy detects change
        new_list = list(notif.read_by)
        new_list.append(current_user.id)
        notif.read_by = new_list
        db.session.commit()
        
    return jsonify({"message": "Marked as read"}), 200
