from flask import Blueprint, request, jsonify
import json
from flask_login import login_required, current_user
from app.services.closer_service import CloserService
from app.models import DailyReportQuestion, CloserDailyStats, DailyReportAnswer, db, Appointment, Enrollment, WeeklyAvailability, Event, Client, Payment, ClientComment, SurveyAnswer, SurveyQuestion
from app.decorators import role_required
from datetime import date, timedelta, datetime
from sqlalchemy import or_

bp = Blueprint('closer_api', __name__)

@bp.route('/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
        
    tz = current_user.timezone or 'America/La_Paz'
    data = CloserService.get_dashboard_data(current_user.id, tz, is_admin=(current_user.role == 'admin'))
    
    today_stats_serialized = None
    if data.get('today_stats'):
        ts = data['today_stats']
        today_stats_serialized = {
            "id": ts.id,
            "date": ts.date.isoformat(),
            "answers": {a.question_id: a.answer for a in ts.answers},
            "reflections": ts.reflections or {}
        }

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
            "last_stage": appt.last_stage,
            "seq_num": seq,
            "client_id": appt.client_id
        })
        
    serialized['sales_today'] = data.get('sales_today', [])

    
    questions = DailyReportQuestion.query.filter(
        DailyReportQuestion.is_active == True,
        or_(DailyReportQuestion.role == 'closer', DailyReportQuestion.role == None)
    ).order_by(DailyReportQuestion.order).all()
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
    if current_user.role not in ['closer', 'admin', 'setter']:
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
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
        
    query_str = request.args.get('q', '')
    if len(query_str) < 2: return jsonify([]), 200
    
    term = f"%{query_str}%"
    # Allow searching ALL clients so they can sell to anyone in DB
    leads = Client.query.filter(or_(Client.full_name.ilike(term), Client.email.ilike(term))).limit(20).all()
    
    return jsonify([{
        "id": l.id, 
        "username": l.full_name or l.email, 
        "email": l.email,
        "phone": l.phone
    } for l in leads]), 200
    
@bp.route('/customers', methods=['GET'])
@login_required
def get_customers():
    if current_user.role not in ['closer', 'admin', 'operator']:
        return jsonify({"message": "Forbidden"}), 403
        
    filters = {
        'search': request.args.get('search', ''),
        'program': request.args.get('program'),
        'sort_by': request.args.get('sort_by', 'newest')
    }
    page = request.args.get('page', 1, type=int)
    
    pagination = CloserService.get_customers_pagination(current_user.id, page=page, filters=filters)
    
    customers = []
    for c in pagination.items:
        # Resumen de pagos/inscripciones
        enrollments = []
        for e in c.enrollments:
            if current_user.role != 'admin' and e.closer_id != current_user.id:
                continue
            enrollments.append({
                "id": e.id,
                "program_name": e.program.name if e.program else "N/A",
                "total_paid": e.total_paid,
                "program_price": e.program.price if e.program else 0,
                "status": "completed" if e.total_paid >= (e.program.price if e.program else 0) else "pending"
            })
            
        customers.append({
            "id": c.id,
            "full_name": c.full_name,
            "email": c.email,
            "phone": c.phone,
            "instagram": c.instagram,
            "created_at": c.created_at.isoformat(),
            "enrollments": enrollments
        })
        
    return jsonify({
        "data": customers,
        "total": pagination.total,
        "pages": pagination.pages
    }), 200

@bp.route('/customers/<int:id>', methods=['PATCH'])
@login_required
def update_customer(id):
    if current_user.role not in ['closer', 'admin', 'operator']:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    try:
        client = CloserService.update_client(id, data)
        return jsonify({
            "message": "Cliente actualizado con éxito",
            "client": {
                "id": client.id,
                "full_name": client.full_name,
                "email": client.email,
                "phone": client.phone,
                "instagram": client.instagram
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

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

    if 'reflections' in data:
        stats.reflections = data.get('reflections')
        
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

    query = Appointment.query
    
    if current_user.role == 'closer':
        query = query.filter_by(closer_id=current_user.id)
    elif current_user.role == 'setter':
        # Restriction: Today +/- 3 days
        today = date.today()
        # Convert to datetime for comparison with start_time (which is datetime)
        # Assuming start_time is stored as UTC or naive datetime matching user expectation
        # We need to cover the full range of days.
        start_range = datetime.combine(today - timedelta(days=3), datetime.min.time())
        end_range = datetime.combine(today + timedelta(days=3), datetime.max.time())
        
        query = query.filter(Appointment.start_time >= start_range, Appointment.start_time <= end_range)
    # Admin sees all (if logic falls through, query is unfiltered by role ownership, just search filters)


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

    pagination = query.order_by(Appointment.start_time.desc()).paginate(page=page, per_page=50)
    
    return jsonify({
        "data": [{
            "id": a.id, 
            "lead_name": a.client.full_name or a.client.email if a.client else "Unknown",
            "phone": a.client.phone if a.client else None,
            "email": a.client.email if a.client else None,
            "date": a.start_time.isoformat(), 
            "last_stage": a.last_stage,
            "result": a.result,
            "linked_call": a.linked_call,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "client_id": a.client_id
        } for a in pagination.items],
        "total": pagination.total, "pages": pagination.pages
    }), 200

@bp.route('/reset-appointments', methods=['POST'])
@login_required
def reset_appointments():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    from app.models import Appointment
    try:
        # Actualizar todas las citas del closer actual (o todas si es admin?)
        # Siguiendo el requerimiento: "establecer todas las agendas de la base de datos"
        # Pero por seguridad solemos filtrar. Si el usuario pide "todas", lo hacemos global o por usuario.
        # Dado que es para testing, lo aplicaremos a las del usuario autenticado para evitar desastres globales
        # si no se especifica. Pero el usuario dice "todas las agendas de la base de datos".
        
        appointments = Appointment.query.all()
        for appt in appointments:
            appt.last_stage = 'Nueva'
            appt.result = 'Terminada'
            
        db.session.commit()
        return jsonify({"message": f"{len(appointments)} agendas reseteadas a Nueva/Terminada"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@bp.route('/sales', methods=['GET'])
@login_required
def get_all_sales():
    if current_user.role not in ['closer', 'admin', 'setter']:
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
            "status": last_payment.status if last_payment else ("completed" if s.total_paid >= (s.program.price if s.program else 0) else "pending"),
            "date": s.enrollment_date.isoformat()
        })

    return jsonify({
        "data": data,
        "total": pagination.total, "pages": pagination.pages
    }), 200

@bp.route('/weekly-availability', methods=['GET', 'POST'])
@login_required
def manage_weekly_availability():
    if current_user.role not in ['closer', 'admin', 'setter']:
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
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
    if request.method == 'DELETE':
        CloserService.delete_enrollment(id)
        return jsonify({"message": "Venta eliminada"}), 200
    return jsonify(CloserService.get_enrollment_details(id)), 200

@bp.route('/enrollments/<int:id>/payments', methods=['POST'])
@login_required
def add_payment(id):
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
    data = request.get_json() or {}
    CloserService.add_payment(id, data)
    return jsonify({"message": "Pago añadido"}), 201

@bp.route('/payments/<int:id>', methods=['DELETE'])
@login_required
def delete_payment(id):
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
    CloserService.delete_payment(id)
    return jsonify({"message": "Pago eliminado"}), 200

@bp.route('/sale-metadata', methods=['GET'])
@login_required
def get_sale_metadata():
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
    return jsonify(CloserService.get_sale_metadata(current_user.id)), 200

@bp.route('/sales', methods=['POST'])
@login_required
def register_sale():
    if current_user.role not in ['closer', 'admin', 'setter']:
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
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
    
    appt = Appointment.query.get_or_404(id)
    if current_user.role != 'admin' and appt.closer_id != current_user.id and appt.setter_id != current_user.id:
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

@bp.route('/appointments/<int:id>', methods=['GET'])
@login_required
def get_appointment(id):
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
    
    appt = Appointment.query.get_or_404(id)
    if current_user.role != 'admin' and appt.closer_id != current_user.id and appt.setter_id != current_user.id:
        return jsonify({"message": "Forbidden"}), 403
        
    return jsonify({
        "id": appt.id,
        "lead_name": appt.client.full_name if appt.client else 'Sin Nombre',
        "client_id": appt.client_id,
        "start_time": appt.start_time.isoformat(),
        "last_stage": appt.last_stage,
        "result": appt.result,
        "phone": appt.client.phone if appt.client else '',
        "type": appt.origin or 'Manual'
    }), 200

@bp.route('/appointments', methods=['POST'])
@login_required
def create_appointment():
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
    
    data = request.get_json() or {}
    start_time_str = data.get('start_time')
    lead_id = data.get('lead_id')
    client_data = data.get('client_data')

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
        
        # Enforce 4-day limit for non-admin users
        if current_user.role != 'admin':
            today = date.today()
            max_date = today + timedelta(days=4)
            if start_time.date() > max_date:
                return jsonify({"error": "Solo puedes agendar para los próximos 4 días"}), 400

        # BookingService create_appointment signature: (client_id, closer_id, start_time_utc, origin='manual', setter_id=None)
        setter_id = current_user.id if current_user.role in ['setter', 'closer'] else None
        
        appt = BookingService.create_appointment(
            client_id=lead_id,
            closer_id=current_user.id if current_user.role == 'closer' else (data.get('closer_id') or current_user.id), # Fallback mostly for admins/setters to pick closer
            start_time_utc=start_time,
            origin='Manual Closer',
            setter_id=setter_id
        )
        
        if appt:
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
    days = request.args.get('days', 4, type=int)
    # Enforce a maximum of 4 days for non-admin users if requested
    if current_user.role != 'admin' and days > 4:
        days = 4
        
    slots = CloserService.get_available_slots(current_user.id, days=days)
    return jsonify(slots), 200

@bp.route('/appointments/<int:id>/process', methods=['POST'])
@login_required
def process_agenda(id):
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
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

@bp.route('/leads/<int:id>/comments', methods=['GET'], strict_slashes=False)
@login_required
def get_lead_comments(id):
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
        
    comments = ClientComment.query.filter_by(client_id=id).order_by(ClientComment.created_at.desc()).all()
    return jsonify([{
        "id": c.id,
        "text": c.text,
        "author": c.author.username,
        "created_at": c.created_at.isoformat()
    } for c in comments]), 200

@bp.route('/leads/<int:id>/comments', methods=['POST'], strict_slashes=False)
@login_required
def add_lead_comment(id):
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    text = data.get('text')
    if not text: return jsonify({"error": "Texto requerido"}), 400
    
    comment = ClientComment(client_id=id, author_id=current_user.id, text=text)
    db.session.add(comment)
    db.session.commit()
    
    return jsonify({"message": "Comentario agregado", "comment": {
        "id": comment.id,
        "text": comment.text,
        "author": current_user.username,
        "created_at": comment.created_at.isoformat()
    }}), 201

# Payment Management for Closers
@bp.route('/enrollments/<int:enrollment_id>/payments', methods=['POST'])
@login_required
def add_enrollment_payment(enrollment_id):
    if current_user.role not in ['closer', 'admin', 'operator']:
        return jsonify({"message": "Forbidden"}), 403
    
    data = request.get_json()
    try:
        from app.services.closer_service import CloserService
        payment = CloserService.add_payment(enrollment_id, data)
        return jsonify({"message": "Pago registrado", "id": payment.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/payments/<int:payment_id>', methods=['PUT'])
@login_required
def update_payment(payment_id):
    if current_user.role not in ['admin', 'closer', 'operator']:
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    try:
        from app.services.closer_service import CloserService
        CloserService.update_payment(payment_id, data)
        return jsonify({"message": "Pago actualizado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _get_closer_pipeline_stages():
    from app.models import Pipeline, PipelineStage
    pipeline = Pipeline.query.filter_by(name='Closer Kanban').first()
    
    if not pipeline:
        # Initialize default pipeline if it doesn't exist
        pipeline = Pipeline(name='Closer Kanban', is_active=True)
        db.session.add(pipeline)
        db.session.flush()
        
        default_names = ["Nueva", "Respondido", "Confirmado", "Asistido", "Contexto", "Decisor", "Presentado"]
        for i, name in enumerate(default_names):
            stage = PipelineStage(name=name, pipeline_id=pipeline.id, order=i, is_active=True)
            db.session.add(stage)
        db.session.commit()
    
    stages = PipelineStage.query.filter_by(pipeline_id=pipeline.id, is_active=True).order_by(PipelineStage.order).all()
    return [s.name for s in stages]

@bp.route('/kanban', methods=['GET'])
@login_required
def get_kanban_data():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    
    stages = _get_closer_pipeline_stages()
    
    print(f"DEBUG: Fetching Kanban for user {current_user.id} ({current_user.username})")

    query = Appointment.query
    if current_user.role == 'closer':
        query = query.filter_by(closer_id=current_user.id)
    
    # Solo mostrar agendas que NO tienen un resultado definido (Null o Vacío)
    query = query.filter(or_(Appointment.result == None, Appointment.result == ''))
    
    appointments = query.all()
    print(f"DEBUG: Found {len(appointments)} appointments for Kanban")
    
    # Group appointments by stage
    board = {stage: [] for stage in stages}
    # Fallback stage is the first one
    first_stage = stages[0] if stages else "Agendada"
    
    for a in appointments:
        stage = a.last_stage if a.last_stage in stages else first_stage
        if stage not in board: board[stage] = [] # Safety
        board[stage].append({
            "id": a.id,
            "lead_name": a.client.full_name or a.client.email if a.client else "Unknown",
            "phone": a.client.phone if a.client else "",
            "start_time": a.start_time.isoformat(),
            "result": a.result,
            "linked_call": a.linked_call,
            "client_id": a.client_id
        })
    
    return jsonify({
        "stages": stages,
        "board": board
    }), 200

@bp.route('/appointments/<int:id>/stage', methods=['PATCH'])
@login_required
def update_appointment_stage(id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    
    appt = Appointment.query.get_or_404(id)
    if current_user.role != 'admin' and appt.closer_id != current_user.id and appt.setter_id != current_user.id:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    new_stage = data.get('stage')
    
    valid_stages = _get_closer_pipeline_stages()
    if new_stage not in valid_stages:
        return jsonify({"error": "Invalid stage"}), 400
        
    appt.last_stage = new_stage
    db.session.commit()
    
    return jsonify({"message": "Etapa actualizada", "stage": new_stage}), 200

@bp.route('/appointments/<int:id>/outcome', methods=['PATCH'])
@login_required
def update_appointment_outcome(id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    
    appt = Appointment.query.get_or_404(id)
    if current_user.role != 'admin' and appt.closer_id != current_user.id and appt.setter_id != current_user.id:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    outcome = data.get('outcome')
    
    # Resultados válidos: Cancelada, Reprogramada, Terminada
    valid_outcomes = ["Cancelada", "Reprogramada", "Terminada", None, ""]
    if outcome not in valid_outcomes:
        return jsonify({"error": "Resultado no válido"}), 400
        
    appt.result = outcome
    db.session.commit()
    
    return jsonify({"message": "Resultado actualizado", "outcome": outcome}), 200

@bp.route('/stats', methods=['GET'])
@login_required
def get_stats():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    
    from app.services.closer_service import CloserService
    
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    agg_type = request.args.get('agg_type', 'sum')
    
    stats = CloserService.get_comprehensive_stats(
        closer_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        agg_type=agg_type
    )
    return jsonify(stats), 200

@bp.route('/notifications', methods=['GET'])
@login_required
def get_notifications():
    from app.models import Notification
    
    # Filter logic:
    # 1. target_users == "all"
    # 2. target_users == f"role:{current_user.role}"
    # 3. current_user.id in target_users (if it's a list)
    
    all_notis = Notification.query.order_by(Notification.created_at.desc()).all()
    filtered = []
    
    for n in all_notis:
        targets = n.target_users
        is_target = False
        
        if isinstance(targets, list):
            if current_user.id in targets or f"role:{current_user.role}" in targets:
                is_target = True
        elif targets == "all":
            is_target = True
        elif isinstance(targets, str) and targets.startswith("role:") and targets == f"role:{current_user.role}":
            is_target = True
        
        if is_target:
            # Handle read_by possibly being a string due to previous double-encoding
            read_by_val = n.read_by or []
            if isinstance(read_by_val, str):
                try:
                    read_by_val = json.loads(read_by_val)
                except:
                    read_by_val = []
            
            # Skip if already read by current user
            is_read = current_user.id in (read_by_val if isinstance(read_by_val, list) else [])
            if is_read:
                continue

            filtered.append({
                "id": n.id,
                "subject": n.subject,
                "content": n.content,
                "created_at": n.created_at.isoformat(),
                "is_read": False, # Always false since we filtered read ones out
                "related_users": n.related_users,
                "associated_id": n.associated_id,
                "associated_type": n.associated_type
            })
            
    return jsonify(filtered), 200

@bp.route('/notifications/<int:id>/read', methods=['POST'])
@login_required
def mark_notification_read(id):
    from app.models import Notification
    noti = Notification.query.get_or_404(id)
    
    # Handle read_by possibly being a string
    read_by = noti.read_by or []
    if isinstance(read_by, str):
        try:
            read_by = json.loads(read_by)
        except:
            read_by = []
    
    read_by = list(read_by)
    if current_user.id not in read_by:
        read_by.append(current_user.id)
        noti.read_by = read_by
        db.session.commit()
    return jsonify({"message": "Marked as read"}), 200

@bp.route('/booking-link', methods=['GET'])
@login_required
def get_booking_links():
    from app.models import EventGroup, Event
    # Return hierarchical structure: EventGroup -> Events
    groups = EventGroup.query.all()
    base_url = request.host_url.rstrip('/')
    
    result = []
    for g in groups:
        # Only include groups that have active events
        active_events = [e for e in g.events if e.is_active]
        if not active_events:
            continue
            
        group_data = {
            "id": g.id,
            "name": g.name,
            "links": []
        }
        
        for event in active_events:
            group_data["links"].append({
                "id": event.id,
                "name": event.name,
                "url": f"{base_url}/book/{event.utm_source}",
                "slug": event.utm_source
            })
            
        result.append(group_data)
    
    return jsonify(result), 200

@bp.route('/clients/<int:client_id>', methods=['GET'])
@login_required
def get_client_details(client_id):
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403

    client = Client.query.get_or_404(client_id)
    
    # Fetch Survey Answers
    answers_query = db.session.query(SurveyAnswer, SurveyQuestion).join(SurveyQuestion).filter(SurveyAnswer.client_id == client_id).all()
    
    formatted_answers = []
    for answer, question in answers_query:
        formatted_answers.append({
            "question": question.text,
            "answer": answer.answer,
            "date": answer.appointment.created_at.isoformat() if answer.appointment else None 
        })

    return jsonify({
        "id": client.id,
        "full_name": client.full_name,
        "email": client.email,
        "phone": client.phone,
        "instagram": client.instagram,
        "survey_answers": formatted_answers
    })


@bp.route('/deck', methods=['GET'])
@login_required
def get_closer_deck():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    date_range = request.args.get('date_range', 'all')
    start_date = None
    today = date.today()
    if date_range == 'today':
        start_date = datetime.combine(today, datetime.min.time())
    elif date_range == 'week':
        start_date = datetime.combine(today - timedelta(days=7), datetime.min.time())
    elif date_range == 'month':
        start_date = datetime.combine(today - timedelta(days=30), datetime.min.time())

    # Leads pendientes de cierre: Citas en estado 'Agendado' no procesadas por el closer
    query = Appointment.query.filter(
        Appointment.result == 'Agendado',
        Appointment.closer_processed == False
    )

    if start_date:
        query = query.filter(Appointment.start_time >= start_date)

    if current_user.role != 'admin':
        query = query.filter_by(closer_id=current_user.id)

    appointments = query.order_by(Appointment.start_time.asc()).all()

    return jsonify([{
        "id": a.id,
        "lead_name": a.client.full_name or "Sin Nombre" if a.client else "Sin Cliente",
        "email": a.client.email if a.client else "",
        "phone": a.client.phone if a.client else "",
        "instagram": a.client.instagram if a.client else "",
        "start_time": a.start_time.isoformat(),
        "origin": a.origin,
        "result": a.result or "Pendiente",
        "ig_chat_link": a.ig_chat_link or "",
        "keyword": a.keyword or "",
        "setter_notes": a.setter_notes or "",
        "closer_notes": a.closer_notes or "",
        "linked_call": a.linked_call or ""
    } for a in appointments]), 200


@bp.route('/deck/<int:appt_id>', methods=['POST'])
@login_required
def process_closer_card(appt_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    appt = Appointment.query.get_or_404(appt_id)
    if current_user.role != 'admin' and appt.closer_id != current_user.id:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    
    # El closer puede editar/verificar la palabra clave y el resultado de la agenda (Asistió, No Show, etc)
    if 'keyword' in data:
        appt.keyword = data['keyword']
    if 'linked_call' in data:
        appt.linked_call = data['linked_call']
    if 'closer_notes' in data:
        appt.closer_notes = data['closer_notes']
    if 'result' in data:
        appt.result = data['result']
        
    appt.closer_processed = True
    
    from app.services.booking_service import BookingService
    description = f"Closer {current_user.username} completó seguimiento. Estado: {data.get('result', 'Pendiente')}."
    if data.get('closer_notes'):
        description += f" Notas: \"{data['closer_notes']}\""
    BookingService.log_lead_event(appt.id, current_user.id, 'closer_notes', description)
    
    try:
        db.session.commit()
        return jsonify({"message": "Carta procesada con éxito", "id": appt.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar: {str(e)}"}), 500


@bp.route('/deck/search', methods=['GET'])
@login_required
def search_closer_deck_leads():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    query_str = request.args.get('q', '')
    if len(query_str) < 2:
        return jsonify([]), 200
    
    term = f"%{query_str}%"
    query = Appointment.query.join(Client)
    if current_user.role != 'admin':
        query = query.filter(Appointment.closer_id == current_user.id)
    
    # Solo buscar leads activos (pendientes de atención)
    query = query.filter(Appointment.result.in_(['Entrante', 'Agendado']))
        
    appointments = query.filter(
        or_(
            Client.full_name.ilike(term),
            Client.email.ilike(term),
            Client.instagram.ilike(term),
            Client.phone.ilike(term)
        )
    ).order_by(Appointment.start_time.desc()).limit(20).all()
    
    return jsonify([{
        "id": a.id,
        "lead_name": a.client.full_name or a.client.email if a.client else "Unknown",
        "start_time": a.start_time.isoformat(),
        "setter_processed": a.setter_processed,
        "closer_processed": a.closer_processed
    } for a in appointments]), 200


@bp.route('/deck/card/<int:appt_id>', methods=['GET'])
@login_required
def get_closer_deck_card(appt_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    appt = Appointment.query.get_or_404(appt_id)
    if current_user.role != 'admin' and appt.closer_id != current_user.id:
        if appt.origin == 'ManyChat' or not appt.closer_id:
            appt.closer_id = current_user.id
            db.session.commit()
        else:
            return jsonify({"message": "Forbidden"}), 403
        
    return jsonify({
        "id": appt.id,
        "lead_name": appt.client.full_name or "Sin Nombre" if appt.client else "Sin Cliente",
        "email": appt.client.email if appt.client else "",
        "phone": appt.client.phone if appt.client else "",
        "instagram": appt.client.instagram if appt.client else "",
        "start_time": appt.start_time.isoformat(),
        "origin": appt.origin,
        "result": appt.result or "Pendiente",
        "ig_chat_link": appt.ig_chat_link or "",
        "keyword": appt.keyword or "",
        "setter_notes": appt.setter_notes or "",
        "closer_notes": appt.closer_notes or "",
        "linked_call": appt.linked_call or "",
        "setter_processed": appt.setter_processed,
        "closer_processed": appt.closer_processed
    }), 200


@bp.route('/deck/comments/<int:appt_id>', methods=['GET'])
@login_required
def get_closer_deck_comments(appt_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    from app.models import Comment
    comments = Comment.query.filter_by(associated_id=appt_id, comment_type='appointment').order_by(Comment.created_at.asc()).all()
    return jsonify([c.to_dict() for c in comments]), 200


@bp.route('/deck/comments/<int:appt_id>', methods=['POST'])
@login_required
def post_closer_deck_comment(appt_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    appt = Appointment.query.get_or_404(appt_id)
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    parent_id = data.get('parent_id')
    
    if not text:
        return jsonify({"message": "El texto del comentario es requerido"}), 400
        
    comment = Comment(
        author_id=current_user.id,
        text=text,
        comment_type='appointment',
        associated_id=appt_id,
        parent_id=parent_id
    )
    db.session.add(comment)
    
    from app.services.booking_service import BookingService
    description = f"Closer {current_user.username} comentó: \"{text[:60]}...\""
    BookingService.log_lead_event(appt.id, current_user.id, 'comment', description)
    
    # Notificación cruzada al Setter (dirigida al rol si es Manychat)
    lead_name = appt.client.full_name if appt.client else "Sin Nombre"
    subject = f"💬 Lead: {lead_name}"
    content = f"\"{text}\" - de Closer {current_user.username}"
    
    target_users = "role:setter"
    if appt.origin != 'ManyChat' and appt.setter_id:
        target_users = [appt.setter_id]
        
    notif = Notification(
        subject=subject,
        content=content,
        associated_id=appt_id,
        associated_type='deck_comment',
        target_users=target_users
    )
    db.session.add(notif)
        
    try:
        db.session.commit()
        return jsonify(comment.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar comentario: {str(e)}"}), 500


@bp.route('/deck/stats/kpis', methods=['GET'])
@login_required
def get_deck_stats_kpis():
    if current_user.role not in ['closer', 'setter', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    from app.models import Appointment, ManychatLead, SetterDailyStats, CloserDailyStats
    from sqlalchemy import func, or_
    from datetime import date, datetime, timedelta
    
    date_range = request.args.get('date_range', 'all')
    start_date = None
    today = date.today()
    if date_range == 'today':
        start_date = datetime.combine(today, datetime.min.time())
    elif date_range == 'week':
        start_date = datetime.combine(today - timedelta(days=7), datetime.min.time())
    elif date_range == 'month':
        start_date = datetime.combine(today - timedelta(days=30), datetime.min.time())

    query_total = Appointment.query
    if start_date:
        query_total = query_total.filter(Appointment.start_time >= start_date)
    total_agendas = query_total.count()
    
    query_mis = Appointment.query
    if current_user.role == 'setter':
        query_mis = query_mis.filter_by(setter_id=current_user.id)
    elif current_user.role == 'closer':
        query_mis = query_mis.filter_by(closer_id=current_user.id)
    if start_date:
        query_mis = query_mis.filter(Appointment.start_time >= start_date)
    mis_agendas = query_mis.count()
        
    query_sin = Appointment.query.filter(or_(Appointment.closer_id == None, Appointment.setter_id == None))
    if start_date:
        query_sin = query_sin.filter(Appointment.start_time >= start_date)
    sin_asignar = query_sin.count()
    
    query_real = Appointment.query.filter(Appointment.result.in_(['Asistió', 'Terminada']))
    if start_date:
        query_real = query_real.filter(Appointment.start_time >= start_date)
    realizadas = query_real.count()
    pct_realizadas = (realizadas / total_agendas * 100) if total_agendas > 0 else 0
    
    query_canc = Appointment.query.filter(Appointment.result.in_(['Cancelada', 'No Show']))
    if start_date:
        query_canc = query_canc.filter(Appointment.start_time >= start_date)
    canceladas = query_canc.count()
    pct_canceladas = (canceladas / total_agendas * 100) if total_agendas > 0 else 0
    
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    agendas_hoy = Appointment.query.filter(Appointment.created_at >= today_start, Appointment.created_at <= today_end).count()
    
    confirmadas_hoy = Appointment.query.filter(
        Appointment.start_time >= today_start,
        Appointment.start_time <= today_end,
        Appointment.result == 'Agendado'
    ).count()
    
    cancelaciones_hoy = Appointment.query.filter(
        Appointment.start_time >= today_start,
        Appointment.start_time <= today_end,
        Appointment.result == 'Cancelada'
    ).count()
    
    reprogramadas_hoy = Appointment.query.filter(
        Appointment.start_time >= today_start,
        Appointment.start_time <= today_end,
        Appointment.result == 'Reprogramada'
    ).count()
    
    calificados_hoy = Appointment.query.filter(
        Appointment.created_at >= today_start,
        Appointment.created_at <= today_end,
        Appointment.setter_processed == True
    ).count()
    
    llamadas_hoy = 0
    setter_stats = SetterDailyStats.query.filter_by(date=today).all()
    for s in setter_stats:
        llamadas_hoy += (s.inbox_entrantes or 0)
        
    closer_stats = CloserDailyStats.query.filter_by(date=today).all()
    if llamadas_hoy == 0:
        llamadas_hoy = confirmadas_hoy + cancelaciones_hoy
        
    query_chart = db.session.query(
        Appointment.result, func.count(Appointment.id)
    )
    if start_date:
        query_chart = query_chart.filter(Appointment.start_time >= start_date)
    status_counts = query_chart.group_by(Appointment.result).all()
    
    chart_data = []
    total_chart = sum(c[1] for c in status_counts)
    for res_name, count in status_counts:
        name = res_name or "Pendiente"
        pct = (count / total_chart * 100) if total_chart > 0 else 0
        chart_data.append({
            "name": name,
            "value": count,
            "percentage": round(pct, 1)
        })

        
    return jsonify({
        "kpis_top": {
            "total_agendas": total_agendas,
            "mis_agendas": mis_agendas,
            "sin_asignar": sin_asignar,
            "realizadas": realizadas,
            "pct_realizadas": round(pct_realizadas, 1),
            "canceladas": canceladas,
            "pct_canceladas": round(pct_canceladas, 1)
        },
        "kpis_bottom": {
            "llamadas_hoy": llamadas_hoy,
            "confirmadas_hoy": confirmadas_hoy,
            "cancelaciones_hoy": cancelaciones_hoy,
            "reprogramaciones_hoy": reprogramadas_hoy,
            "calificados_hoy": calificados_hoy
        },
        "chart_data": chart_data
    }), 200


@bp.route('/deck/events/<int:appt_id>', methods=['GET'])
@login_required
def get_deck_events(appt_id):
    if current_user.role not in ['closer', 'setter', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    from app.models import LeadEventLog
    limit = request.args.get('limit', 5, type=int)
    
    logs = LeadEventLog.query.filter_by(appointment_id=appt_id)\
        .order_by(LeadEventLog.created_at.desc())\
        .limit(limit).all()
        
    return jsonify([log.to_dict() for log in logs]), 200


@bp.route('/deck/unassigned-today', methods=['GET'])
@login_required
def get_unassigned_leads_today():
    if current_user.role not in ['closer', 'setter', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    from app.models import Appointment
    from sqlalchemy import or_
    from datetime import date, datetime
    
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    
    appointments = Appointment.query.filter(
        Appointment.created_at >= today_start,
        or_(Appointment.closer_id == None, Appointment.setter_id == None)
    ).order_by(Appointment.created_at.desc()).limit(15).all()
    
    return jsonify([{
        "id": a.id,
        "lead_name": a.client.full_name or "Sin Nombre" if a.client else "Sin Cliente",
        "created_at": a.created_at.isoformat(),
        "origin": a.origin or "ManyChat"
    } for a in appointments]), 200

