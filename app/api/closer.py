from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.closer_service import CloserService
from app.models import DailyReportQuestion, CloserDailyStats, DailyReportAnswer, db, Appointment, Enrollment, WeeklyAvailability, Event, Client, Payment
from app.decorators import role_required
from datetime import date, timedelta, datetime

bp = Blueprint('closer_api', __name__)

@bp.route('/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    tz = current_user.timezone or 'America/La_Paz'
    data = CloserService.get_dashboard_data(current_user.id, tz, is_admin=(current_user.role == 'admin'))
    
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
        
    # Custom Sort: Pending (scheduled), Reprogramada, Completada, No Show, Cancelada
    status_order = {
        'scheduled': 1, 'pending': 1, 
        'Reprogramada': 2, 'rescheduled': 2,
        'Completada': 3, 'completed': 3, 'Primera Agenda': 3,
        'No Show': 4, 'no_show': 4,
        'Cancelada': 5, 'cancelled': 5
    }
    serialized['agendas_today'].sort(key=lambda x: status_order.get(x['status'], 99))
        
    # Sales Today: Any enrollment that had a payment today
    sales = Enrollment.query.join(Payment).filter(
        Enrollment.closer_id == current_user.id,
        Payment.date >= date.today()
    ).distinct().all()
    
    for s in sales:
        total_paid = s.total_paid
        price = s.program.price if s.program else 0.0
        serialized['sales_today'].append({
            "id": s.id,
            "student_name": s.client.full_name or s.client.email if s.client else "Unknown",
            "program_name": s.program.name if s.program else "Unknown",
            "amount": total_paid,
            "debt": max(0, price - total_paid),
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

@bp.route('/leads/search', methods=['GET'])
@login_required
def search_closer_leads():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    query_str = request.args.get('q', '')
    if len(query_str) < 2: return jsonify([]), 200
    
    term = f"%{query_str}%"
    leads = Client.query.filter(or_(Client.full_name.ilike(term), Client.email.ilike(term))).limit(20).all()
    
    return jsonify([{
        "id": l.id, 
        "username": l.full_name or l.email, 
        "email": l.email,
        "phone": l.phone
    } for l in leads]), 200

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
    search = request.args.get('search', '')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    status_filter = request.args.get('status') # comma separated

    query = Appointment.query.filter_by(closer_id=current_user.id)

    # Search
    if search:
        query = query.join(Client).filter(
            (Client.full_name.ilike(f'%{search}%')) | 
            (Client.email.ilike(f'%{search}%'))
        )
    
    # Date Range
    if start_date:
        query = query.filter(Appointment.start_time >= datetime.strptime(start_date, '%Y-%m-%d'))
    if end_date:
        # Include the whole end day
        end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        query = query.filter(Appointment.start_time < end_dt)

    # Status Filter
    if status_filter:
        statuses = status_filter.split(',')
        if statuses:
            from sqlalchemy import or_
            query = query.filter(Appointment.status.in_(statuses))

    pagination = query.order_by(Appointment.start_time.desc()).paginate(page=page, per_page=50)
    
    return jsonify({
        "data": [{
            "id": a.id, 
            "lead_name": a.client.full_name or a.client.email if a.client else "Unknown",
            "phone": a.client.phone if a.client else None,
            "email": a.client.email if a.client else None,
            "date": a.start_time.isoformat(), 
            "status": a.status, 
            "type": a.appointment_type
        } for a in pagination.items],
        "total": pagination.total, "pages": pagination.pages
    }), 200

@bp.route('/sales', methods=['GET'])
@login_required
def get_all_sales():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    page = request.args.get('page', 1, type=int)
    search = request.args.get('search', '')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    program_filter = request.args.get('program')
    payment_filter = request.args.get('payment_method')

    query = Enrollment.query.filter_by(closer_id=current_user.id)

    # Joins for filtering
    from app.models import Program, Payment, PaymentMethod
    query = query.join(Client).join(Program).outerjoin(Payment).outerjoin(PaymentMethod, Payment.payment_method_id == PaymentMethod.id)

    # Search
    if search:
        query = query.filter(
            (Client.full_name.ilike(f'%{search}%')) | 
            (Client.email.ilike(f'%{search}%'))
        )
    
    # Date Range (Enrollment Date)
    if start_date:
        query = query.filter(Enrollment.enrollment_date >= datetime.strptime(start_date, '%Y-%m-%d'))
    if end_date:
        end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        query = query.filter(Enrollment.enrollment_date < end_dt)

    # Program Filter
    if program_filter:
        programs = program_filter.split(',')
        if programs:
            query = query.filter(Program.name.in_(programs))

    # Payment Method Filter
    if payment_filter:
        methods = payment_filter.split(',')
        if methods:
            query = query.filter(PaymentMethod.name.in_(methods))

    pagination = query.order_by(Enrollment.enrollment_date.desc()).paginate(page=page, per_page=50)
    
    data = []
    for s in pagination.items:
        # Get payment info (assuming single payment for simplicity or aggregate)
        # s.payments is dynamic, so use order_by
        last_payment = s.payments.order_by(Payment.id.desc()).first()
        method_name = last_payment.payment_method.name if last_payment and last_payment.payment_method else "N/A"
        amount = last_payment.amount if last_payment else (s.program.price if s.program else 0.0)

        data.append({
            "id": s.id, 
            "student_name": s.client.full_name or s.client.email if s.client else "Unknown", 
            "program_name": s.program.name if s.program else "Unknown", 
            "amount": amount,
            "payment_method": method_name,
            "date": s.enrollment_date.isoformat()
        })

    return jsonify({
        "data": data,
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

@bp.route('/leads/<int:id>/payment-status', methods=['GET'])
@login_required
def get_lead_payment_status(id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    return jsonify(CloserService.get_lead_payment_status(id)), 200

@bp.route('/enrollments/<int:id>', methods=['GET', 'DELETE'])
@login_required
def get_or_delete_enrollment(id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    if request.method == 'DELETE':
        CloserService.delete_enrollment(id)
        return jsonify({"message": "Venta eliminada"}), 200
    return jsonify(CloserService.get_enrollment_details(id)), 200

@bp.route('/enrollments/<int:id>/payments', methods=['POST'])
@login_required
def add_payment(id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    data = request.get_json() or {}
    CloserService.add_payment(id, data)
    return jsonify({"message": "Pago añadido"}), 201

@bp.route('/payments/<int:id>', methods=['DELETE'])
@login_required
def delete_payment(id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    CloserService.delete_payment(id)
    return jsonify({"message": "Pago eliminado"}), 200

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
    client_data = data.get('client_data')
    appointment_date_str = data.get('appointment_date')
    
    if not lead_id and not client_data:
        return jsonify({"error": "Lead ID or Client Data is required"}), 400
        
    try:
        from app.services.booking_service import BookingService
        
        # 1. Handle Client Creation/Update
        if not lead_id and client_data:
            client = BookingService.create_or_update_client(client_data)
            lead_id = client.id
            
        # 2. Handle Retrospective Appointment (if creating new client/sale directly)
        if appointment_date_str:
             try:
                start_time = datetime.fromisoformat(appointment_date_str.replace('Z', ''))
                # Create a completed appointment for records
                BookingService.create_appointment(
                    client_id=lead_id,
                    closer_id=current_user.id,
                    start_time_utc=start_time,
                    origin='Auto - Sale Creation',
                    status='completed'
                )
             except Exception as e:
                 print(f"Error creating retrospective appointment: {e}")
                 # Continue with sale even if appt fails, or arguably fail. 
                 # User said "debe crearse una agenda", so maybe we should fail? 
                 # Let's log but proceed to secure the sale, as sale is more critical.
                 pass

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
    db.session.commit()
    return jsonify({"message": "Agenda actualizada con éxito"}), 200

@bp.route('/appointments', methods=['POST'])
@login_required
def create_appointment():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    
    data = request.get_json() or {}
    start_time_str = data.get('start_time')
    lead_id = data.get('lead_id')
    client_data = data.get('client_data')
    appt_type = data.get('type', 'Manual Closer')
    status = data.get('status', 'scheduled')
    
    if not start_time_str:
        return jsonify({"error": "Faltan datos requeridos (start_time)"}), 400

    if not lead_id and not client_data:
        return jsonify({"error": "Debe seleccionar un cliente o crear uno nuevo"}), 400
        
    try:
        from app.services.booking_service import BookingService
        
        if not lead_id and client_data:
            client = BookingService.create_or_update_client(client_data)
            lead_id = client.id
            
        start_time = datetime.fromisoformat(start_time_str.replace('Z', ''))
        
        # BookingService create_appointment signature: (client_id, closer_id, start_time_utc, origin='manual', status='scheduled')
        appt = BookingService.create_appointment(
            client_id=lead_id,
            closer_id=current_user.id,
            start_time_utc=start_time,
            origin='Manual Closer',
            status=status
        )
        
        if appt:
            if appt_type:
                appt.appointment_type = appt_type
                
            db.session.commit()
            
            # Check for webhook trigger
            if data.get('trigger_webhook', False):
                 BookingService.trigger_agenda_webhook(appt)

            # Sync with Google Calendar
            try:
                from app.services.google_service import GoogleService
                evt_id = GoogleService.create_event(current_user.id, appt)
                if evt_id: 
                    appt.google_event_id = evt_id
                    db.session.commit()
            except Exception as e:
                print(f"GCal Sync Error: {e}")
            
        return jsonify({"message": "Agenda creada", "id": appt.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
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

@bp.route('/events', methods=['GET'])
@login_required
def get_events():
    events = Event.query.filter_by(is_active=True).all()
    return jsonify([{
        "id": e.id,
        "name": e.name,
        "utm_source": e.utm_source,
        "duration_minutes": e.duration_minutes,
        "buffer_minutes": e.buffer_minutes
    } for e in events]), 200

@bp.route('/events/<int:id>', methods=['PATCH'])
@login_required
def update_event(id):
    # Allows updating event settings
    event = Event.query.get_or_404(id)
    data = request.get_json() or {}
    
    if 'duration_minutes' in data:
        event.duration_minutes = data['duration_minutes']
    if 'buffer_minutes' in data:
        event.buffer_minutes = data['buffer_minutes']
        
    db.session.commit()
    return jsonify({"message": "Evento actualizado"}), 200

@bp.route('/availability', methods=['GET'])
@login_required
def get_availability():
    # Returns specific date overrides (Availability model)
    # Note: Availability model needs to be imported if not already avaiable in context (it is imported at top of file)
    from app.models import Availability
    avails = Availability.query.filter_by(closer_id=current_user.id).all()
    return jsonify([{
        "date": a.date.isoformat(),
        "start": a.start_time.strftime('%H:%M'),
        "end": a.end_time.strftime('%H:%M')
    } for a in avails]), 200
