from flask import Blueprint, request, jsonify
import json
import pytz
from flask_login import login_required, current_user
from app.services.closer_service import CloserService
from app.models import DailyReportQuestion, CloserDailyStats, DailyReportAnswer, db, Appointment, Enrollment, WeeklyAvailability, Event, Client, Payment, ClientComment, SurveyAnswer, SurveyQuestion, CommentNotification, FeatureToggle
from app.decorators import role_required
from datetime import date, timedelta, datetime
from sqlalchemy import or_

bp = Blueprint('closer_api', __name__)

# Barrido automático del backlog de confirmaciones nunca atendidas (ver
# CloserService.archive_stale_backlog y bitácora del 4 de agosto de 2026).
# No hay scheduler/cron en este proyecto, así que se dispara oportunistamente
# desde el endpoint más frecuentado del mazo del closer (/deck/counts), con un
# límite de una vez cada 6h por proceso para no ejecutar el barrido en cada
# petición (en el caso normal, sin nada que archivar, es una consulta barata).
_LAST_BACKLOG_SWEEP_TS = [0.0]
_BACKLOG_SWEEP_INTERVAL_SECONDS = 6 * 3600
_BACKLOG_SWEEP_DAYS = 30

# Toggle del bloqueo de envío del reporte diario cuando el closer arrastra trabajo de días
# anteriores (confirmaciones sin gestionar, llamadas sin registrar, seguimientos sin hacer).
# Se maneja como FeatureToggle en vez de constante en código para poder suspenderlo y
# reactivarlo desde Operaciones → Configuración sin un deploy — que es justo el caso de uso:
# se suspende mientras el equipo se pone al día y se vuelve a activar después.
# SIN FILA EN LA TABLA = SUSPENDIDO (mismo criterio que el resto de los toggles del proyecto:
# `bool(toggle and toggle.is_active)`), así que el bloqueo arranca apagado.
REPORT_BACKLOG_BLOCK_TOGGLE_KEY = 'bloqueo_reporte_backlog'


def _backlog_block_enabled():
    toggle = FeatureToggle.query.filter_by(key=REPORT_BACKLOG_BLOCK_TOGGLE_KEY).first()
    return bool(toggle and toggle.is_active)

def _maybe_auto_archive_backlog():
    import time
    now = time.time()
    if now - _LAST_BACKLOG_SWEEP_TS[0] < _BACKLOG_SWEEP_INTERVAL_SECONDS:
        return
    _LAST_BACKLOG_SWEEP_TS[0] = now
    try:
        result = CloserService.archive_stale_backlog(days=_BACKLOG_SWEEP_DAYS)
        if result['count']:
            print(f"[Auto Backlog Cleanup] {result['count']} citas archivadas como Lead Perdido (>{_BACKLOG_SWEEP_DAYS} días sin confirmar)")
    except Exception as e:
        print(f"[Auto Backlog Cleanup Error] {e}")


def _user_day_bounds_utc(user, day):
    """Convierte el rango [00:00, 23:59:59.999999] del día calendario `day` en la
    zona horaria del usuario a límites UTC naive reales, para filtrar Appointment.start_time."""
    from datetime import time as time_cls
    try:
        tz = pytz.timezone(user.timezone or 'America/La_Paz')
    except Exception:
        tz = pytz.timezone('America/La_Paz')
    start_utc = tz.localize(datetime.combine(day, time_cls.min)).astimezone(pytz.UTC).replace(tzinfo=None)
    end_utc = tz.localize(datetime.combine(day, time_cls.max)).astimezone(pytz.UTC).replace(tzinfo=None)
    return start_utc, end_utc

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
            "client_id": appt.client_id,
            "sales_count": appt.client.enrollments.count() if appt.client else 0,
            "has_sale": (appt.client.enrollments.count() > 0) if appt.client else False,
            "result": appt.result if (appt.result and appt.result.strip().lower() not in ('show up', 'no show', 'cerrada', 'cerrado', '2th call', '2da call', 'follow up', 'show_up', 'no_show', 'cerrado/a')) else "Pendiente",
            "closer_result": appt.closer_result or "Pendiente",
            "is_rescheduled": appt.is_rescheduled
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
    if current_user.role not in ['closer', 'admin', 'setter', 'triage']:
        return jsonify({"message": "Forbidden"}), 403
        
    query_str = request.args.get('q', '')
    if len(query_str) < 2: return jsonify([]), 200
    
    term = f"%{query_str}%"
    # Buscar clientes por nombre completo, email, instagram o teléfono
    leads = Client.query.filter(or_(
        Client.full_name.ilike(term), 
        Client.email.ilike(term),
        Client.instagram.ilike(term),
        Client.phone.ilike(term)
    )).limit(20).all()
    
    results = []
    seen_emails = set()
    seen_instagrams = set()
    seen_phones = set()

    for l in leads:
        # Deduplicar contra otras filas Client duplicadas para la misma persona real (la
        # deduplicación automática de clientes no atrapa el 100% de los casos — ver
        # ClientDedupService) — de lo contrario el mismo cliente aparece varias veces en la
        # búsqueda, uno por cada fila duplicada.
        email_norm = l.email.strip().lower() if l.email else None
        ig_norm = l.instagram.strip().replace('@', '').lower() if l.instagram else None
        phone_norm = l.phone.strip()[-8:] if l.phone and len(l.phone.strip()) >= 8 else None
        if (email_norm and email_norm in seen_emails) or (ig_norm and ig_norm in seen_instagrams) or (phone_norm and phone_norm in seen_phones):
            continue
        if email_norm:
            seen_emails.add(email_norm)
        if ig_norm:
            seen_instagrams.add(ig_norm)
        if phone_norm:
            seen_phones.add(phone_norm)

        # Buscar cita más reciente en Appointment local
        appt = Appointment.query.filter_by(client_id=l.id).order_by(Appointment.start_time.desc()).first()
        appt_data = None
        if appt:
            setter_name = ""
            if appt.setter:
                setter_name = appt.setter.username or appt.setter.name or ""
            appt_data = {
                "id": appt.id,
                "start_time": appt.start_time.isoformat(),
                "setter_name": setter_name,
                "examen": appt.examen or "",
                "result": appt.result or "",
                "closer_result": appt.closer_result or ""
            }
        else:
            # Buscar en agendas de Google Sheets (FinancialAgenda) por instagram o email
            from app.models.financial import FinancialAgenda
            ig_clean = l.instagram.strip().replace('@', '').lower() if l.instagram else None
            
            fin_filters = []
            if ig_clean:
                fin_filters.append(db.func.lower(db.func.replace(FinancialAgenda.instagram, '@', '')) == ig_clean)
            if l.email:
                fin_filters.append(db.func.lower(FinancialAgenda.mail) == l.email.strip().lower())
                
            if fin_filters:
                fin_agenda = FinancialAgenda.query.filter(or_(*fin_filters)).order_by(FinancialAgenda.date.desc()).first()
                if fin_agenda:
                    appt_data = {
                        "start_time": fin_agenda.date.isoformat() if fin_agenda.date else None,
                        "setter_name": fin_agenda.nombre or "",
                        "examen": ""
                    }
                    
        results.append({
            "id": l.id,
            "username": l.full_name or l.email,
            "email": l.email,
            "phone": l.phone,
            "instagram": l.instagram,
            "grupo": l.grupo or "Grupo sin asignar",
            "appointment": appt_data
        })
        
    # Buscar en agendas de Google Sheets (FinancialAgenda) por coincidencia de nombre, email, instagram o teléfono
    from app.models.financial import FinancialAgenda
    fin_leads = FinancialAgenda.query.filter(or_(
        FinancialAgenda.lead.ilike(term),
        FinancialAgenda.mail.ilike(term),
        FinancialAgenda.instagram.ilike(term),
        FinancialAgenda.whatsapp.ilike(term)
    )).order_by(FinancialAgenda.date.desc()).limit(20).all()
    
    for fa in fin_leads:
        fa_email = fa.mail.strip().lower() if fa.mail else None
        fa_ig = fa.instagram.strip().replace('@', '').lower() if fa.instagram else None
        
        # Omitir duplicados ya listados como Client
        if (fa_email and fa_email in seen_emails) or (fa_ig and fa_ig in seen_instagrams):
            continue
            
        if fa_email:
            seen_emails.add(fa_email)
        if fa_ig:
            seen_instagrams.add(fa_ig)
            
        results.append({
            "id": None,
            "username": fa.lead,
            "email": fa.mail,
            "phone": fa.whatsapp,
            "instagram": fa.instagram,
            "appointment": {
                "start_time": fa.date.isoformat() if fa.date else None,
                "setter_name": fa.nombre or "",
                "examen": ""
            }
        })
        
    return jsonify(results), 200


@bp.route('/leads/<int:client_id>/stage', methods=['GET'])
@login_required
def get_lead_stage(client_id):
    """Clasifica en qué etapa está un cliente (confirmación pendiente, llamada por reportar,
    seguimiento en curso o llamada cerrada/cobranza) para que el buscador global abra el modal
    correspondiente en vez del resumen genérico. Ver CloserFollowUpService.get_client_lead_stage."""
    if current_user.role not in ['closer', 'admin', 'setter', 'triage']:
        return jsonify({"message": "Forbidden"}), 403

    from app.services.closer_followup_service import CloserFollowUpService
    result = CloserFollowUpService.get_client_lead_stage(client_id)
    if result is None:
        return jsonify({"message": "Cliente no encontrado"}), 404
    return jsonify(result), 200


@bp.route('/appointments/by-instagram', methods=['GET'])
@login_required
def get_appointment_by_instagram():
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403
        
    instagram = request.args.get('instagram', '').strip().replace('@', '')
    if not instagram:
        return jsonify({"error": "Instagram es requerido"}), 400
        
    # 1. Buscar en la base de datos de clientes (Client) local
    client = Client.query.filter(db.func.lower(Client.instagram) == instagram.lower()).first()
    
    appointment_data = None
    if client:
        # Buscar la cita más reciente (Appointment)
        appt = Appointment.query.filter_by(client_id=client.id).order_by(Appointment.start_time.desc()).first()
        if appt:
            # Obtener nombre del setter
            setter_name = ""
            if appt.setter:
                setter_name = appt.setter.username or appt.setter.name or ""
            appointment_data = {
                "id": appt.id,
                "start_time": appt.start_time.isoformat(),
                "setter_name": setter_name,
                "client": {
                    "id": client.id,
                    "username": client.full_name or client.email,
                    "email": client.email,
                    "phone": client.phone,
                    "instagram": client.instagram
                }
            }
            
    # 2. Si no se encontró en las citas locales, buscar en la base de datos de agendas de Google Sheets (FinancialAgenda)
    if not appointment_data:
        from app.models.financial import FinancialAgenda
        fin_agenda = FinancialAgenda.query.filter(
            db.func.lower(db.func.replace(FinancialAgenda.instagram, '@', '')) == instagram.lower()
        ).order_by(FinancialAgenda.date.desc()).first()
        
        if fin_agenda:
            # nombre es el setter, lead es el cliente
            appointment_data = {
                "id": f"financial-{fin_agenda.id}",
                "start_time": fin_agenda.date.isoformat() if fin_agenda.date else None,
                "setter_name": fin_agenda.nombre or "",
                "client": {
                    "id": None, # No tiene ID de Client local aún
                    "username": fin_agenda.lead or "",
                    "email": fin_agenda.mail or "",
                    "phone": fin_agenda.whatsapp or "",
                    "instagram": fin_agenda.instagram
                }
            }
            
    if appointment_data:
        return jsonify(appointment_data), 200
    else:
        return jsonify({"error": "No se encontró ninguna agenda para este usuario de Instagram"}), 404

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
            "client_id": a.client_id,
            "sales_count": a.client.enrollments.count() if a.client else 0,
            "has_sale": (a.client.enrollments.count() > 0) if a.client else False
        } for a in pagination.items],
        "total": pagination.total, "pages": pagination.pages
    }), 200

@bp.route('/reset-appointments', methods=['POST'])
@login_required
def reset_appointments():
    # Endpoint destructivo global (resetea TODAS las citas de TODOS los closers a
    # Nueva/Terminada, sin excepción). Restringido a admin: estaba accesible para
    # el rol 'closer' pese a no tener ningún filtro por closer_id pese a lo que
    # decía el comentario original, permitiendo que cualquier closer borrara el
    # estado del pipeline completo del sistema con una sola petición.
    if current_user.role != 'admin':
        return jsonify({"message": "Forbidden"}), 403

    from app.models import Appointment
    try:
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
    # Cualquier closer puede configurar cualquier lead, no solo el suyo asignado (decisión del
    # usuario: bloquear por dueño solo generaba fricción sin necesidad real de aislamiento entre
    # closers). Los setters siguen limitados a lo que ellos mismos agendaron.
    if current_user.role not in ('admin', 'closer') and appt.setter_id != current_user.id:
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

@bp.route('/appointments/<int:id>/reassign', methods=['PATCH'])
@login_required
def reassign_appointment(id):
    """Cambia el closer responsable de un lead. Cualquier closer puede reasignar cualquier
    lead a cualquier otro closer activo (mismo criterio permisivo que el resto del flujo:
    "cualquier closer puede editar cualquier lead", ver update_appointment/process_agenda) —
    pensado para pases de mano rápidos entre compañeros, no requiere ser dueño ni admin."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    appt = Appointment.query.get_or_404(id)
    data = request.get_json() or {}
    new_closer_id = data.get('closer_id')
    if not new_closer_id:
        return jsonify({"error": "closer_id es requerido"}), 400

    from app.models import User
    new_closer = User.query.filter_by(id=new_closer_id, role='closer').first()
    if not new_closer or new_closer.is_active is False:
        return jsonify({"error": "El closer seleccionado no existe o no está activo"}), 400

    if appt.closer_id == new_closer.id:
        return jsonify({"error": "Este lead ya pertenece a ese closer"}), 400

    old_closer_name = appt.closer.username if appt.closer else 'sin asignar'
    appt.closer_id = new_closer.id

    if appt.client_id:
        db.session.add(ClientComment(
            client_id=appt.client_id,
            author_id=current_user.id,
            text=f"Lead reasignado de {old_closer_name} a {new_closer.username} (por {current_user.username})."
        ))

    db.session.commit()
    return jsonify({
        "message": "Lead reasignado con éxito",
        "closer_id": new_closer.id,
        "closer_name": new_closer.username
    }), 200

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
        "closer_result": appt.closer_result,
        "is_rescheduled": appt.is_rescheduled,
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
            
        start_time = None
        try:
            start_time = datetime.fromisoformat(start_time_str.replace('Z', ''))
        except Exception:
            for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
                try:
                    start_time = datetime.strptime(start_time_str.split('.')[0].replace('Z', ''), fmt)
                    break
                except Exception:
                    pass

        if not start_time:
            return jsonify({"error": "Formato de fecha inválido (start_time)"}), 400

        if not Client.query.get(lead_id):
            return jsonify({"error": "No se encontró el cliente indicado para esta agenda."}), 400

        # BookingService create_appointment signature: (client_id, closer_id, start_time_utc, origin='manual', setter_id=None)
        setter_id = current_user.id if current_user.role in ['setter', 'closer'] else None
        target_closer_id = current_user.id if current_user.role == 'closer' else (data.get('closer_id') or current_user.id) # Fallback mostly for admins/setters to pick closer

        # Chequeo de conflicto de horario ANTES de crear, con el mismo criterio que usa
        # BookingService.create_appointment internamente (closer_processed == False y result no
        # cancelado/reprogramado) — así el mensaje puede decir exactamente CUÁL es la cita que
        # choca (con quién y a qué hora) en vez del genérico "ya existe una cita o no se pudo
        # crear la agenda" que no distinguía esto de cualquier otro fallo (reportado por un
        # closer real: el error no explicaba la causa).
        conflicting = Appointment.query.filter_by(closer_id=target_closer_id, start_time=start_time).filter(
            Appointment.closer_processed == False,
            or_(Appointment.result == None, Appointment.result == '', Appointment.result.notin_(['Cancelada', 'Reprogramada']))
        ).first()
        if conflicting:
            conflicting_name = conflicting.client.full_name if conflicting.client else 'otro lead'
            return jsonify({
                "error": f"Ya tenés una agenda con {conflicting_name} a esa misma hora ({start_time.strftime('%d/%m/%Y %H:%M')}) — elegí otro horario.",
                "conflicting_appointment_id": conflicting.id
            }), 409

        appt = BookingService.create_appointment(
            client_id=lead_id,
            closer_id=target_closer_id,
            start_time_utc=start_time,
            origin=data.get('origin') or 'Manual Closer',
            setter_id=setter_id
        )

        if not appt:
            return jsonify({"error": "No se pudo crear la agenda por un motivo inesperado — probá de nuevo o avisá a soporte si se repite."}), 400

        db.session.commit()
        
        # Sincronizar con agenda financiera
        try:
            BookingService.sync_appointment_to_financial_agenda(appt)
            db.session.commit()
        except Exception as f_err:
            print(f"[FinancialAgenda Sync Error] {f_err}")

        # Webhook trigger
        if data.get('trigger_webhook', False):
             BookingService.trigger_agenda_webhook(appt)

        # Sync con Google Calendar
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
    if current_user.role not in ['closer', 'admin', 'setter', 'call_confirmer', 'triage', 'financial']:
        return jsonify({"message": "Forbidden"}), 403
    data = request.get_json() or {}
    if 'role' not in data:
        data['role'] = 'closer' if current_user.role == 'closer' else 'setter'
    try:
        CloserService.process_agenda(current_user.id, id, data, is_admin=(current_user.role == 'admin'))
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
    # Configura duración/buffer de un evento de agendamiento compartido por todo el
    # equipo. No tenía ningún chequeo de rol (solo login), así que cualquier usuario
    # autenticado (setter, triage, call_confirmer, etc.) podía modificarlo.
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

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
    if current_user.role not in ['closer', 'admin', 'setter', 'triage']:
        return jsonify({"message": "Forbidden"}), 403
        
    from flask import current_app
    from app.models import CommentNotification, Comment, Client, ClientComment
    from datetime import datetime

    def _format_date(dt):
        if not dt:
            return datetime.utcnow().isoformat()
        if isinstance(dt, str):
            return dt
        if hasattr(dt, 'isoformat'):
            return dt.isoformat()
        return str(dt)

    try:
        # Marcar notificaciones de este cliente para el usuario actual como leídas
        try:
            CommentNotification.query.filter_by(
                client_id=id,
                user_id=current_user.id,
                is_read=False
            ).update({"is_read": True})
            db.session.commit()
        except Exception as notif_err:
            db.session.rollback()
            current_app.logger.error(f"[NOTIF READ ERROR]: {notif_err}")

        comments = ClientComment.query.filter_by(client_id=id).all()
        old_comments = Comment.query.filter_by(comment_type='client', associated_id=id).all()
        client = Client.query.get(id)
        
        combined = []
        seen_texts = set()

        # 1. Observaciones, dolores y objeciones históricas registradas en la ficha del lead
        if client:
            obs_val = getattr(client, 'observaciones', None)
            if obs_val and str(obs_val).strip():
                txt = f"[Observación Call Confirmer Histórica]: {str(obs_val).strip()}"
                combined.append({
                    "id": f"obs_{client.id}",
                    "text": txt,
                    "author": "Call Confirmer",
                    "created_at": _format_date(client.created_at)
                })
                seen_texts.add(txt.lower())

            dol_val = getattr(client, 'dolores', None)
            if dol_val and str(dol_val).strip():
                txt = f"[Dolores Registrados]: {str(dol_val).strip()}"
                if txt.lower() not in seen_texts:
                    combined.append({
                        "id": f"dol_{client.id}",
                        "text": txt,
                        "author": "Sistema",
                        "created_at": _format_date(client.created_at)
                    })
                    seen_texts.add(txt.lower())

            obj_val = getattr(client, 'objeciones', None)
            if obj_val and str(obj_val).strip():
                txt = f"[Objeciones Registradas]: {str(obj_val).strip()}"
                if txt.lower() not in seen_texts:
                    combined.append({
                        "id": f"obj_{client.id}",
                        "text": txt,
                        "author": "Sistema",
                        "created_at": _format_date(client.created_at)
                    })
                    seen_texts.add(txt.lower())

        # 2. Comentarios de la tabla genérica Comment
        for c in old_comments:
            c_text = getattr(c, 'text', None) or getattr(c, 'content', None) or ""
            if c_text and c_text.strip().lower() not in seen_texts:
                author_name = "Call Confirmer"
                if hasattr(c, 'user') and c.user:
                    author_name = c.user.username
                combined.append({
                    "id": f"old_{c.id}",
                    "text": c_text.strip(),
                    "author": author_name,
                    "created_at": _format_date(c.created_at)
                })
                seen_texts.add(c_text.strip().lower())

        # 3. Comentarios de ClientComment
        for c in comments:
            if c.text and c.text.strip().lower() not in seen_texts:
                combined.append({
                    "id": c.id,
                    "text": c.text.strip(),
                    "author": c.author_rel.username if c.author_rel else "Call Confirmer",
                    "created_at": _format_date(c.created_at)
                })
                seen_texts.add(c.text.strip().lower())

        # Ordenar cronológicamente descendente
        combined.sort(key=lambda x: str(x["created_at"]), reverse=True)
        return jsonify(combined), 200

    except Exception as err:
        current_app.logger.error(f"[GET LEAD COMMENTS ERROR]: {err}")
        return jsonify([]), 200

@bp.route('/leads/<int:id>/comments', methods=['POST'], strict_slashes=False)
@login_required
def add_lead_comment(id):
    if current_user.role not in ['closer', 'admin', 'setter', 'triage']:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    text = data.get('text')
    if not text: return jsonify({"error": "Texto requerido"}), 400
    
    comment = ClientComment(client_id=id, author_id=current_user.id, text=text)
    db.session.add(comment)
    db.session.flush()
    
    # Procesar destinatarios
    target_user_ids = data.get('target_user_ids', [])
    
    from app.models import Notification, Client, CommentNotification
    client = Client.query.get(id)
    if client:
        # 1. Notificaciones dirigidas/personalizadas
        if target_user_ids:
            for uid in target_user_ids:
                notif = CommentNotification(
                    client_id=client.id,
                    user_id=int(uid),
                    comment_id=comment.id,
                    sender_id=current_user.id,
                    is_read=False
                )
                db.session.add(notif)
        else:
            # 2. Notificación automática al responder
            # Buscar última notificación recibida por el usuario actual sobre este lead
            last_notif = CommentNotification.query.filter_by(
                client_id=client.id,
                user_id=current_user.id
            ).order_by(CommentNotification.created_at.desc()).first()
            
            if last_notif and last_notif.sender_id != current_user.id:
                notif = CommentNotification(
                    client_id=client.id,
                    user_id=last_notif.sender_id,
                    comment_id=comment.id,
                    sender_id=current_user.id,
                    is_read=False
                )
                db.session.add(notif)
            else:
                # Si no hay notificación directa pero hay comentarios previos, podemos notificar al autor del último comentario
                # que sea distinto al usuario actual
                last_comment = ClientComment.query.filter(
                    ClientComment.client_id == client.id,
                    ClientComment.author_id != current_user.id
                ).order_by(ClientComment.created_at.desc()).first()
                if last_comment:
                    notif = CommentNotification(
                        client_id=client.id,
                        user_id=last_comment.author_id,
                        comment_id=comment.id,
                        sender_id=current_user.id,
                        is_read=False
                    )
                    db.session.add(notif)

        # 3. Mantener notificación general por compatibilidad
        notif_global = Notification(
            subject=f"Nueva nota interna en el lead: {client.full_name or client.instagram or 'Desconocido'}",
            content=f"{current_user.username} agregó una nota:\n\n{text}",
            target_users=["all"],
            associated_id=client.id,
            associated_type="lead"
        )
        db.session.add(notif_global)
        
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
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
            "client_id": a.client_id,
            "sales_count": a.client.enrollments.count() if a.client else 0,
            "has_sale": (a.client.enrollments.count() > 0) if a.client else False
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


def _latest_enrollment_date(client_id):
    """Fecha de ingreso real al programa (Enrollment más reciente) de un cliente, o None."""
    if not client_id:
        return None
    enrollment = Enrollment.query.filter_by(client_id=client_id).order_by(Enrollment.enrollment_date.desc()).first()
    return enrollment.enrollment_date.isoformat() if enrollment and enrollment.enrollment_date else None


def _normalize_phone_digits(phone):
    # Últimos 8 dígitos (suficiente para no confundir dos números distintos, pero tolera que un
    # lado tenga el código de país y el otro no, o distinto formato de espacios/guiones/'+').
    import re
    if not phone:
        return None
    digits = re.sub(r'\D', '', str(phone))
    return digits[-8:] if len(digits) >= 8 else None

def _normalize_instagram_handle(ig):
    if not ig or not isinstance(ig, str):
        return None
    v = ig.strip().lstrip('@').lower()
    return v or None

def _form_data_has_useful_answers(fd):
    # Client.form_data casi siempre existe como columna (server_default), pero para la mayoría
    # de los leads guarda solo el literal `null` o metadatos de contacto sin ninguna respuesta
    # real de calificación — sin esto, cualquier fd no-vacío se mostraba como "completado".
    if not isinstance(fd, dict):
        return False
    ignore = {'nombre', 'telefono', 'instagram', 'fuente_form', 'submitted_at'}
    return any(k not in ignore and fd.get(k) not in (None, '', 'n/a') for k in fd)

def _recover_form_data_by_contact(client):
    # El formulario de calificación de n8n (Client.form_data) a veces queda en un Client distinto
    # del que terminó vinculado a la Appointment real (ej. el matching por instagram/teléfono al
    # momento de la sumisión no encontró al cliente porque todavía no existía, o el formato del
    # teléfono no coincidía exactamente) — acá se reintenta el cruce en el momento de mostrar el
    # modal, tolerando formatos de teléfono distintos (comparando solo los últimos 8 dígitos).
    if not client:
        return None
    email = (client.email or '').strip().lower() or None
    ig = _normalize_instagram_handle(client.instagram)
    phone_digits = _normalize_phone_digits(client.phone)
    if not email and not ig and not phone_digits:
        return None

    from app.models import Client
    from sqlalchemy import func, or_

    filters = []
    if email:
        filters.append(func.lower(Client.email) == email)
    if ig:
        filters.append(func.lower(Client.instagram) == ig)
    if phone_digits:
        filters.append(Client.phone.like(f"%{phone_digits}%"))
    if not filters:
        return None

    candidates = Client.query.filter(Client.id != client.id, Client.form_data.isnot(None), or_(*filters)).all()

    best_fd, best_submitted = None, ''
    for cand in candidates:
        fd = cand.form_data if isinstance(cand.form_data, dict) else None
        if not _form_data_has_useful_answers(fd):
            continue
        submitted = fd.get('submitted_at') or ''
        if best_fd is None or submitted > best_submitted:
            best_fd, best_submitted = fd, submitted
    return best_fd

def _format_appointment_for_deck(a, recover_form=False):
    # Formatear cita para el mazo Closer con datos de contacto y triage
    from app.models import SurveyAnswer, SurveyQuestion
    survey_answers = []
    if a.client_id:
        answers_query = db.session.query(SurveyAnswer, SurveyQuestion).join(SurveyQuestion).filter(SurveyAnswer.client_id == a.client_id).all()
        for answer, question in answers_query:
            survey_answers.append({
                "question": question.text,
                "answer": answer.answer
            })

    # Respuestas del formulario de calificación que llega por n8n. Viven en Client.form_data (JSON
    # suelto, ver POST /public/financial-agendas/form), NO en SurveyAnswer — esa tabla es la
    # encuesta propia de la página de reserva, otro origen distinto. La pestaña "Formulario" del
    # modal solo leía survey_answers, así que un lead que sí había respondido el formulario de n8n
    # aparecía como si no hubiera respondido nada.
    form_data = a.client.form_data if (a.client and isinstance(a.client.form_data, dict)) else {}
    # Si el cliente vinculado a esta cita no tiene respuestas útiles, se intenta recuperar el
    # formulario real desde otro Client con el mismo teléfono/correo/instagram (ver
    # _recover_form_data_by_contact). Solo se activa cuando `recover_form=True` (vista de un lead
    # puntual en el modal) — evitar esta búsqueda extra por cada tarjeta del mazo cuando se listan
    # muchas citas a la vez (GET /deck), donde sería un N+1 innecesario.
    form_data_recovered = False
    if recover_form and a.client and not _form_data_has_useful_answers(form_data):
        recovered = _recover_form_data_by_contact(a.client)
        if recovered:
            form_data = recovered
            form_data_recovered = True
    # Resolver dinámicamente el resultado real del confirmer sin depender de campos corrompidos históricos
    from app.models.financial import FinancialAgenda
    from sqlalchemy import or_
    from datetime import timedelta

    # Etapas del pipeline propio de confirmaciones del Closer (ovLead / step('confirm')).
    # Una vez que el Closer tomó acción sobre el lead acá, ese estado es autoritativo y
    # no debe ser pisado por el estado (potencialmente desactualizado) de FinancialAgenda.
    CLOSER_CONFIRM_STAGES = ('por_confirmar', 'conversando', 'confirmado')

    a_result_lower = a.result.strip().lower() if a.result else ''
    confirmer_result = "Pendiente"
    if a.result and a_result_lower not in ('show up', 'no show', 'cerrada', 'cerrado', '2th call', '2da call', 'follow up', 'show_up', 'no_show', 'cerrado/a'):
        confirmer_result = a.result
    if a.client and a.start_time and a_result_lower not in CLOSER_CONFIRM_STAGES:
        client = a.client
        start_search = a.start_time - timedelta(hours=12)
        end_search = a.start_time + timedelta(hours=12)
        
        from sqlalchemy import func
        ig_clean = client.instagram.strip().replace('@', '').lower() if client.instagram and client.instagram.lower() not in ('n/a', '') else None
        mail_clean = client.email.strip().lower() if client.email and client.email.lower() not in ('n/a', '') else None
        
        filters = []
        if mail_clean:
            filters.append(func.lower(FinancialAgenda.mail) == mail_clean)
        if ig_clean:
            filters.append(func.lower(func.replace(FinancialAgenda.instagram, '@', '')) == ig_clean)
            
        agenda = None
        if filters:
            agenda = FinancialAgenda.query.filter(
                or_(*filters),
                FinancialAgenda.date >= start_search,
                FinancialAgenda.date <= end_search
            ).first()
            
        if agenda:
            estado_clean = str(agenda.estado).strip().lower() if agenda.estado else ""
            if estado_clean in ('pendiente', '', 'agendado', 'confirmado', 'sin respuesta', 'contactado', 'cancelada', 'reagendada'):
                if estado_clean in ('pendiente', ''):
                    confirmer_result = 'Pendiente'
                elif estado_clean == 'agendado':
                    confirmer_result = 'Agendado'
                elif estado_clean == 'confirmado':
                    confirmer_result = 'Confirmado'
                elif estado_clean == 'sin respuesta':
                    confirmer_result = 'Sin respuesta'
                elif estado_clean == 'contactado':
                    confirmer_result = 'Contactado'
                elif estado_clean == 'cancelada':
                    confirmer_result = 'Cancelada'
                elif estado_clean == 'reagendada':
                    confirmer_result = 'Reagendada'
                else:
                    confirmer_result = agenda.estado
            else:
                # Si el estado de la agenda es de Closer (ej. No Show), y a.result no es de Closer, lo usamos
                if a.result and a.result.strip().lower() not in ('show up', 'no show', 'cerrada', 'cerrado', '2th call', '2da call'):
                    confirmer_result = a.result
            
    return {
        "id": a.id,
        "client_id": a.client_id,
        "lead_name": a.client.full_name or "Sin Nombre" if a.client else "Sin Cliente",
        "email": a.client.email if a.client else "",
        "phone": a.client.phone if a.client else "",
        "instagram": a.client.instagram if a.client else "",
        "grupo": (a.client.grupo if a.client else None) or "Grupo sin asignar",
        "start_time": a.start_time.isoformat() if a.start_time else None,
        "origin": a.origin,
        "result": confirmer_result,
        "closer_result": a.closer_result or "Pendiente",
        "is_rescheduled": a.is_rescheduled,
        "ig_chat_link": a.ig_chat_link or "",
        "keyword": a.keyword or "",
        "setter_notes": a.setter_notes or "",
        "closer_notes": a.closer_notes or "",
        "linked_call": a.linked_call or "",
        "setter_id": a.setter_id,
        "setter_name": a.setter.username if a.setter else "Sin Setter",
        "survey_answers": survey_answers,
        "form_data": form_data,
        "form_data_recovered": form_data_recovered,
        "setter_processed": a.setter_processed,
        "closer_processed": a.closer_processed,
        "fecha_seguimiento": getattr(a, 'fecha_seguimiento', None),
        "fecha_seguimiento_cobro": getattr(a, 'fecha_seguimiento_cobro', None),
        "seguimiento_realizado": bool(getattr(a, 'seguimiento_realizado', False)) if getattr(a, 'seguimiento_realizado', None) is not None else False,
        "seguimiento_tipo": getattr(a, 'seguimiento_tipo', None),
        "seguimiento_sub": getattr(a, 'seguimiento_sub', None),
        "seguimiento_intento": getattr(a, 'seguimiento_intento', None) or 1,
        "pre_call_reminder_at": a.pre_call_reminder_at.isoformat() if getattr(a, 'pre_call_reminder_at', None) else None,
        "examen": a.examen or "",
        # Fecha de ingreso real al programa (Enrollment más reciente) — distinta de start_time
        # (que es la fecha de la cita/agenda). Solo existe si el cliente ya se inscribió.
        "enrollment_date": _latest_enrollment_date(a.client_id),
        # Closer dueño actual del lead, para el selector de "Reasignar a otro closer" en el modal.
        "closer_id": a.closer_id,
        "closer_name": a.closer.username if a.closer else None
    }

@bp.route('/deck', methods=['GET'])
@login_required
def get_closer_deck():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    date_range = request.args.get('date_range', 'all')
    step = request.args.get('step')
    start_date = None
    today = date.today()
    if date_range == 'today':
        start_date = datetime.combine(today, datetime.min.time())
    elif date_range == 'week':
        start_date = datetime.combine(today - timedelta(days=7), datetime.min.time())
    elif date_range == 'month':
        start_date = datetime.combine(today - timedelta(days=30), datetime.min.time())
    
    from sqlalchemy import or_
    
    selected_date_str = request.args.get('selected_date') or today.isoformat()

    if step == 'confirmations':
        # Pipeline de confirmación: citas sin procesar por el closer, desde hoy en adelante
        # (sin límite superior) — pre-contacto para llamadas que todavía no ocurrieron. Las
        # vencidas (de días anteriores) NO deben aparecer acá: eso es intencional, confirmado
        # por el usuario. Antes (4 de agosto) esta vista también absorbía el backlog de vencidas
        # con una ventana de 30 días, porque en ese momento "Llamadas" las excluía por completo
        # y quedaban huérfanas. Ya no es necesario: "Llamadas" ahora incluye todo lo vencido sin
        # procesar sin importar el estado de confirmación en que haya quedado (ver bitácora), así
        # que el backlog vive únicamente ahí — evita que la misma cita aparezca duplicada en las
        # dos pestañas.
        try:
            today_local = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        except ValueError:
            today_local = date.today()
        start_utc, _ = _user_day_bounds_utc(current_user, today_local)
        query = Appointment.query.filter(
            Appointment.start_time >= start_utc,
            Appointment.closer_processed == False,
            or_(Appointment.closer_result == 'Pendiente', Appointment.closer_result == None, Appointment.closer_result == '')
        )
    elif step == 'calls':
        # Llamadas cuyo horario ya llegó (o es de hoy) y el closer nunca reportó qué pasó
        # realmente (Show up / No Show / Canceló), de la fecha seleccionada hacia atrás.
        # Antes exigía `result` ya en 'Confirmado'/2da call explícito, lo que dejaba afuera
        # para siempre cualquier cita atascada en un estado intermedio de confirmación
        # (Contactado, conversando, o directamente nunca tocada) apenas pasaba su horario —
        # aunque la llamada ya hubiera ocurrido (o no) y siguiera sin closer_result terminal.
        # Esto también dejaba esas citas fuera del pool de Seguimientos (CloserFollowUpService.
        # _base_query exige un closer_result ya terminal para poder derivar el tipo), así que
        # este mismo cambio destraba ambas pestañas. Se excluyen Cancelada/Reagendada, que
        # pertenecen a la pestaña "Reagendar".
        try:
            today_local = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        except ValueError:
            today_local = date.today()

        _, end_utc = _user_day_bounds_utc(current_user, today_local)

        query = Appointment.query.filter(
            Appointment.start_time <= end_utc,
            Appointment.closer_processed == False,
            or_(
                Appointment.closer_result == 'Pendiente',
                Appointment.closer_result == None,
                Appointment.closer_result == '',
                Appointment.closer_result == '2da call'
            ),
            or_(
                Appointment.result.notin_(['Cancelado', 'Cancelada', 'Reagendado', 'Reagendada']),
                Appointment.result == None,
                Appointment.result == ''
            )
        )
    elif step == 'agendas':
        # Mantener compatibilidad con agendas anteriores
        try:
            today_local = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        except ValueError:
            today_local = date.today()

        start_utc, end_utc = _user_day_bounds_utc(current_user, today_local)

        query = Appointment.query.filter(
            Appointment.start_time >= start_utc,
            Appointment.start_time <= end_utc
        )
    elif step == 'seguimientos':
        query = Appointment.query.filter(
            or_(
                Appointment.fecha_seguimiento.like(f"{selected_date_str}%"),
                Appointment.fecha_seguimiento_cobro.like(f"{selected_date_str}%")
            ),
            or_(Appointment.seguimiento_realizado == False, Appointment.seguimiento_realizado == None)
        )
    elif step == 'reagendar':
        query = Appointment.query.filter(
            or_(Appointment.closer_result.in_(['Reagendado', 'Cancelado', 'Reagendada', 'Cancelada']), Appointment.is_rescheduled == True)
        )
    else:
        # Cola por defecto de leads pendientes (excluye canceladas/reagendadas por confirmer)
        query = Appointment.query.filter(
            or_(Appointment.closer_result == 'Pendiente', Appointment.closer_result == None, Appointment.closer_result == ''),
            Appointment.closer_processed == False,
            or_(Appointment.result.notin_(['Cancelado', 'Cancelada', 'Reagendado', 'Reagendada']), Appointment.result == None, Appointment.result == '')
        )
        if start_date:
            query = query.filter(Appointment.start_time >= start_date)

    if current_user.role != 'admin':
        query = query.filter_by(closer_id=current_user.id)

    appointments = query.order_by(Appointment.start_time.asc()).all()

    # No local import needed as they are imported globally
    unread_client_ids = {n.client_id for n in CommentNotification.query.filter_by(user_id=current_user.id, is_read=False).all()}
    
    formatted_appointments = []
    for a in appointments:
        formatted = _format_appointment_for_deck(a)
        formatted["unread_comment"] = a.client_id in unread_client_ids if a.client_id else False
        formatted_appointments.append(formatted)
        
    formatted_appointments.sort(key=lambda x: 0 if x.get('unread_comment', False) else 1)

    return jsonify(formatted_appointments), 200


@bp.route('/deck/counts', methods=['GET'])
@login_required
def get_closer_deck_counts():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    _maybe_auto_archive_backlog()

    selected_date_str = request.args.get('selected_date')
    today = date.today()
    if not selected_date_str:
        selected_date_str = today.isoformat()
        
    try:
        today_local = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
    except ValueError:
        today_local = date.today()

    start_utc, end_utc_calls = _user_day_bounds_utc(current_user, today_local)

    query_confirmations = Appointment.query.filter(
        Appointment.start_time >= start_utc,
        Appointment.closer_processed == False,
        or_(Appointment.closer_result == 'Pendiente', Appointment.closer_result == None, Appointment.closer_result == '')
    )
    
    query_calls = Appointment.query.filter(
        Appointment.start_time <= end_utc_calls,
        Appointment.closer_processed == False,
        or_(
            Appointment.closer_result == 'Pendiente',
            Appointment.closer_result == None,
            Appointment.closer_result == '',
            Appointment.closer_result == '2da call'
        ),
        or_(
            Appointment.result.notin_(['Cancelado', 'Cancelada', 'Reagendado', 'Reagendada']),
            Appointment.result == None,
            Appointment.result == ''
        )
    )
    
    if current_user.role != 'admin':
        query_confirmations = query_confirmations.filter_by(closer_id=current_user.id)
        query_calls = query_calls.filter_by(closer_id=current_user.id)

    # "Seguimientos a hacer hoy" tiene que ser la misma cuenta que ve el closer al abrir la
    # pestaña ③ Seguimientos (CloserFollowUpService.get_today_grouped): vencidos + de hoy, con
    # el tipo efectivo derivado cuando el closer nunca etiquetó explícitamente la cita. La
    # query anterior (fecha_seguimiento LIKE 'hoy%') solo contaba seguimientos con fecha EXACTA
    # de hoy — cualquier backlog atrasado (la inmensa mayoría en la práctica) quedaba afuera,
    # por eso el contador casi siempre marcaba 0 pese a haber trabajo real pendiente.
    from app.services.closer_followup_service import CloserFollowUpService
    seg_closer_id = current_user.id if current_user.role != 'admin' else None
    seg_grouped = CloserFollowUpService.get_today_grouped(seg_closer_id, selected_date_str)
    seguimientos_count = sum(len(v) for v in seg_grouped.values())

    return jsonify({
        "confirmations": query_confirmations.count(),
        "calls": query_calls.count(),
        "seguimientos": seguimientos_count
    }), 200


def _resolve_report_date(current_user, date_str):
    """Resuelve la fecha calendario (zona horaria del closer) para la que se arma/consulta el
    reporte diario. Acepta 'YYYY-MM-DD' explícito (para reportar días anteriores); si no viene,
    o es inválido, cae a "hoy" en la zona horaria del closer. Nunca permite una fecha futura —
    no hay datos que reportar todavía."""
    today_local = datetime.now(pytz.timezone(current_user.timezone or 'America/La_Paz')).date()
    if not date_str:
        return today_local
    try:
        parsed = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return today_local
    return min(parsed, today_local)


@bp.route('/deck/daily-report', methods=['GET'])
@login_required
def get_daily_report_status():
    """Consulta si ya existe un reporte guardado para el closer autenticado en una fecha dada
    (por defecto hoy) — permite que el frontend sepa, al elegir un día anterior, si ya se
    reportó o si todavía falta, y precargar lo que ya se había escrito (referidos/reflexión)."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    day_local = _resolve_report_date(current_user, request.args.get('date'))

    from app.models import CloserDailyReport
    report = CloserDailyReport.query.filter_by(closer_id=current_user.id, date=day_local).first()

    try:
        activity = CloserService.get_daily_activity_summary(current_user.id, day_local)
    except Exception as e:
        activity = None
        print(f"[Daily Report Activity Error] {e}")

    try:
        pending_previous_days = CloserService.get_previous_days_pending(current_user.id, day_local)
    except Exception as e:
        pending_previous_days = None
        print(f"[Daily Report Pending Backlog Error] {e}")

    # Valor de slots del reporte MÁS RECIENTE anterior a este (de cualquier día previo, no solo
    # ayer) — para prellenar el input cuando este día todavía no tiene reporte propio, así el
    # closer no tiene que volver a escribir la misma cifra de siempre (pedido del usuario).
    last_report_with_slots = CloserDailyReport.query.filter(
        CloserDailyReport.closer_id == current_user.id,
        CloserDailyReport.date < day_local,
        CloserDailyReport.slots.isnot(None)
    ).order_by(CloserDailyReport.date.desc()).first()

    return jsonify({
        "date": day_local.isoformat(),
        "sent": bool(report),
        "sent_at": report.created_at.isoformat() if report and getattr(report, 'created_at', None) else None,
        "referrals_sourced": report.referrals_sourced if report else 0,
        "referrals_scheduled": report.referrals_scheduled if report else 0,
        "reflection_victory": report.reflection_victory if report else "",
        "reflection_opportunity": report.reflection_opportunity if report else "",
        # Único campo que el sistema no puede calcular solo (no hay ninguna señal persistida de
        # "slots disponibles configurados" — ver CloserService.compute_daily_report_fields): se
        # precarga lo que ya se había guardado para este día, si lo hay.
        "slots": report.slots if report else None,
        "slots_last_value": last_report_with_slots.slots if last_report_with_slots else None,
        "activity": activity,
        "pending_previous_days": pending_previous_days,
        # Si el atraso de días anteriores traba el envío o solo se avisa. El frontend lo necesita
        # para saber si deshabilitar el botón: el atraso se sigue mostrando en los dos casos.
        "backlog_blocks_report": _backlog_block_enabled()
    }), 200


@bp.route('/deck/daily-report', methods=['POST'])
@login_required
def send_daily_report():
    """Arma, guarda y envía a Discord el reporte diario del closer autenticado, calculado a
    partir de sus agendas/ventas reales del día (ver CloserService.compute_daily_report_fields).
    Reemplaza al botón "Enviar reporte al sistema" del mazo, que hasta ahora no llamaba a ningún
    endpoint (ver bitácora). Los referidos ya no se piden manualmente (antes 2 inputs numéricos
    en el frontend): se cuentan solos a partir de los referidos con datos reales que ya quedaron
    registrados en el sistema ese día (ver CloserService.get_daily_activity_summary). Lo único
    que el sistema no puede saber por sí solo es la reflexión diaria. Acepta `date` opcional
    ('YYYY-MM-DD') para reportar un día anterior en vez de hoy — reenviar el mismo día actualiza
    el reporte existente en vez de duplicarlo (y reenvía a Discord)."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    data = request.get_json() or {}
    day_local = _resolve_report_date(current_user, data.get('date'))

    # Bloqueo de envío si queda trabajo atrasado de días ANTERIORES sin resolver (pedido del
    # usuario) — el admin queda exento (puede reportar en nombre de un closer para destrabar una
    # situación puntual). El bloqueo solo aplica si el toggle está encendido: mientras está
    # apagado el atraso se sigue calculando y mostrando, pero como aviso, no como traba.
    if _backlog_block_enabled() and current_user.role != 'admin':
        try:
            pending = CloserService.get_previous_days_pending(current_user.id, day_local)
        except Exception as e:
            return jsonify({"error": f"Error al validar pendientes de días anteriores: {str(e)}"}), 500
        if pending['total'] > 0:
            return jsonify({
                "error": "Tenés tareas pendientes de días anteriores — resolvelas antes de enviar el reporte.",
                "pending_previous_days": pending
            }), 409

    try:
        computed = CloserService.compute_daily_report_fields(current_user.id, day_local)
    except Exception as e:
        return jsonify({"error": f"Error al calcular el reporte: {str(e)}"}), 500

    # "Pedidos" no tiene ninguna señal automática confiable en el sistema (a diferencia de
    # "Concretados": un referido real, con datos, que efectivamente entró como agenda) — se
    # reporta el mismo número real en vez de inventar un "pedidos" que nadie está registrando,
    # o dejarlo en 0 al lado de un número real (mismo criterio que 'slots': honesto antes que
    # fabricado).
    try:
        activity = CloserService.get_daily_activity_summary(current_user.id, day_local)
        referidos_reales = activity.get('referidos_capturados', 0)
    except Exception:
        referidos_reales = 0
    computed['referrals_sourced'] = referidos_reales
    computed['referrals_scheduled'] = referidos_reales
    # 'slots' (cupos disponibles configurados ese día) es el único número de este reporte que
    # no existe como señal persistida en ningún lado del sistema — a diferencia de todo lo demás
    # acá, no se puede derivar de la Bandeja. Es el único campo que el closer completa a mano.
    try:
        computed['slots'] = int(data.get('slots') or 0)
    except (TypeError, ValueError):
        computed['slots'] = 0
    computed['reflections'] = data.get('reflections') or None
    computed['reflection_victory'] = (data.get('reflections') or {}).get('victory') if isinstance(data.get('reflections'), dict) else None
    computed['reflection_opportunity'] = (data.get('reflections') or {}).get('opportunity') if isinstance(data.get('reflections'), dict) else None
    computed['is_non_working_day'] = bool(data.get('is_non_working_day', False))

    from app.models import CloserDailyReport
    report = CloserDailyReport.query.filter_by(closer_id=current_user.id, date=day_local).first()
    if report:
        for key, val in computed.items():
            setattr(report, key, val)
    else:
        report = CloserDailyReport(closer_id=current_user.id, date=day_local, **computed)
        db.session.add(report)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al guardar el reporte: {str(e)}"}), 500

    try:
        from app.api.public.closer import _trigger_closer_report_discord
        _trigger_closer_report_discord(report)
    except Exception as e:
        print(f"[Daily Report Discord Error] {e}")

    return jsonify({"message": "Reporte del día enviado con éxito", "report_id": report.id, "date": day_local.isoformat()}), 200


@bp.route('/deck/<int:appt_id>', methods=['POST'])
@login_required
def process_closer_card(appt_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    appt = Appointment.query.get_or_404(appt_id)
    # Cualquier closer puede procesar cualquier lead (decisión del usuario: bloquear por dueño
    # no aportaba nada). Si el dueño actual ya no está activo, el lead se reasigna al closer que
    # lo trabaja — para un dueño activo, se edita sin robárselo de su pipeline.
    if current_user.role not in ('admin', 'closer'):
        return jsonify({"message": "Forbidden"}), 403
    if current_user.role == 'closer' and appt.closer_id != current_user.id:
        from app.models import User
        owner = User.query.get(appt.closer_id)
        if owner and owner.is_active is False:
            appt.closer_id = current_user.id

    data = request.get_json() or {}

    # Actualizar campos de la agenda
    if 'keyword' in data:
        appt.keyword = data['keyword']
    if 'linked_call' in data:
        appt.linked_call = data['linked_call']
    if 'closer_notes' in data:
        notes_str = data['closer_notes'].strip()
        appt.closer_notes = notes_str
        if notes_str and appt.client_id:
            from app.models import Comment
            comment = Comment(
                text=notes_str,
                comment_type='client',
                associated_id=appt.client_id,
                author_id=current_user.id
            )
            db.session.add(comment)

    if 'result' in data:
        res_val = data['result']
        if res_val == 'Asistió':
            res_val = 'Show up'
        appt.closer_result = res_val
        
    if 'confirm_status' in data:
        appt.result = data['confirm_status']
        
    if 'with_decision_maker' in data:
        if data['with_decision_maker'] is None or data['with_decision_maker'] == '':
            appt.with_decision_maker = None
        else:
            appt.with_decision_maker = data['with_decision_maker'] == True or data['with_decision_maker'] in ('true', 'True', '1', 1)

    if 'offer_presented' in data:
        if data['offer_presented'] is None or data['offer_presented'] == '':
            appt.offer_presented = None
        else:
            appt.offer_presented = data['offer_presented'] == True or data['offer_presented'] in ('true', 'True', '1', 1)

    if 'fecha_seguimiento' in data:
        appt.fecha_seguimiento = data['fecha_seguimiento']
    if 'fecha_seguimiento_cobro' in data:
        appt.fecha_seguimiento_cobro = data['fecha_seguimiento_cobro']
    if 'seguimiento_realizado' in data:
        appt.seguimiento_realizado = bool(data['seguimiento_realizado'])
    if 'seguimiento_tipo' in data:
        appt.seguimiento_tipo = data['seguimiento_tipo']
    if 'seguimiento_sub' in data:
        appt.seguimiento_sub = data['seguimiento_sub']
    if 'seguimiento_intento' in data:
        appt.seguimiento_intento = data['seguimiento_intento']
    if 'pre_call_reminder_at' in data:
        val = data['pre_call_reminder_at']
        appt.pre_call_reminder_at = datetime.fromisoformat(val.replace('Z', '')) if val else None

    if data.get('contact_result'):
        appt.last_contact_outcome = data['contact_result']
        appt.last_contact_at = datetime.utcnow()

    # Si es una actualización de confirmación rápida (con o sin nota adjunta), no marcamos
    # la cita como procesada: el lead sigue vivo dentro del pipeline de confirmaciones
    # (Por confirmar / Conversando / Confirmado), no se resolvió ni salió del mazo.
    confirm_only_keys = {'confirm_status', 'closer_notes', 'pre_call_reminder_at'}
    if 'confirm_status' in data and set(data.keys()).issubset(confirm_only_keys):
        pass
    else:
        appt.closer_processed = True
    
    from app.services.booking_service import BookingService
    description = f"Closer {current_user.username} completó seguimiento. Estado: {data.get('result', 'Pendiente')}."
    if data.get('closer_notes'):
        description += f" Notas: \"{data['closer_notes']}\""
    BookingService.log_lead_event(appt.id, current_user.id, 'closer_notes', description)
    
    # Sincronizar de vuelta a FinancialAgenda
    try:
        BookingService.sync_appointment_to_financial_agenda(appt)
    except Exception as sync_err:
        pass
        
    try:
        db.session.commit()
        return jsonify({"message": "Carta procesada con éxito", "id": appt.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar: {str(e)}"}), 500


@bp.route('/deck/<int:appt_id>', methods=['DELETE'])
@login_required
def delete_deck_appointment(appt_id):
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403

    appt = Appointment.query.get_or_404(appt_id)
    if current_user.role != 'admin' and appt.closer_id != current_user.id:
        return jsonify({"message": "Forbidden"}), 403

    try:
        # Liberar respuestas de encuesta asociadas (se conserva el historial del cliente,
        # solo se desvincula de la cita que se está borrando; no tiene cascade de borrado).
        SurveyAnswer.query.filter_by(appointment_id=appt.id).update({'appointment_id': None})

        if appt.google_event_id:
            try:
                from app.services.google_service import GoogleService
                GoogleService.delete_event(appt.closer_id, appt.google_event_id)
            except Exception as gcal_err:
                print(f"[GCal Delete Error] {gcal_err}")

        db.session.delete(appt)
        db.session.commit()
        return jsonify({"message": "Agenda eliminada correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@bp.route('/team-members', methods=['GET'])
@login_required
def get_team_members():
    if current_user.role not in ['closer', 'setter', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.models import User
    members = User.query.filter(
        User.role.in_(['closer', 'setter']),
        or_(User.is_active == True, User.is_active == None)
    ).order_by(User.username.asc()).all()
    return jsonify([{"id": u.id, "username": u.username, "role": u.role} for u in members]), 200


@bp.route('/deck/referrals/manual', methods=['POST'])
@login_required
def create_manual_referral():
    if current_user.role not in ['closer', 'admin', 'setter']:
        return jsonify({"message": "Forbidden"}), 403

    data = request.get_json() or {}
    from_lead_id = data.get('from_lead_id')
    lead_name = (data.get('lead_name') or '').strip()
    contact = (data.get('contact') or '').strip()
    phone = (data.get('phone') or '').strip() or None
    instagram = (data.get('instagram') or '').strip().replace('@', '') or None
    email = (data.get('email') or '').strip() or None
    notes = (data.get('notes') or '').strip()

    if not from_lead_id:
        return jsonify({"error": "Selecciona el lead origen del referido"}), 400
    if not lead_name:
        return jsonify({"error": "El nombre del referido es obligatorio"}), 400

    try:
        from app.services.booking_service import BookingService
        from app.models import Client, Appointment, Comment, User, db

        # Resolver lead / cliente origen
        referrer_client = None
        origin_appt = Appointment.query.get(from_lead_id)
        if origin_appt and origin_appt.client:
            referrer_client = origin_appt.client
        else:
            referrer_client = Client.query.get(from_lead_id)

        referrer_name = referrer_client.full_name if referrer_client else f"Lead #{from_lead_id}"

        # El modal "Referido manual" envía teléfono/instagram/correo por separado (los 3
        # obligatorios ahí). El flujo rápido de "¿le pediste referidos?" durante un seguimiento
        # sigue enviando un único campo `contact` libre (instagram o teléfono) sin obligar nada
        # — se clasifica acá como antes, solo cuando no llegaron los campos explícitos.
        if not phone and not instagram and contact:
            if '@' in contact or not contact.replace('+', '').replace(' ', '').replace('-', '').isdigit():
                instagram = contact.replace('@', '').strip()
            else:
                phone = contact

        contact_display = contact or ', '.join(filter(None, [phone, f"@{instagram}" if instagram else None, email])) or 'N/A'

        # Crear o buscar cliente referido
        ref_client = BookingService.find_or_create_client(
            nombre=lead_name,
            email=email,
            instagram=instagram,
            phone=phone
        )

        # Crear cita para el referido. closer_id es NOT NULL en la base — un admin/setter
        # creando el referido a nombre de otro closer no puede dejarlo sin dueño (quedaría
        # huérfano, invisible en cualquier pool de Seguimientos): hereda el closer del lead que
        # lo refirió, y si tampoco tiene, cae al mismo fallback ya usado en
        # BookingService.sync_financial_agenda_to_appointment.
        closer_id_for_referral = current_user.id if current_user.role == 'closer' else (origin_appt.closer_id if origin_appt else None)
        if not closer_id_for_referral:
            fallback_closer = User.query.filter_by(role='closer').first() or User.query.filter_by(role='admin').first()
            closer_id_for_referral = fallback_closer.id if fallback_closer else current_user.id

        now = datetime.utcnow()
        appt = Appointment(
            closer_id=closer_id_for_referral,
            client_id=ref_client.id,
            start_time=now,
            origin=f"Referido de {referrer_name}",
            last_stage='Nueva',
            closer_notes=f"Referido por {referrer_name}. Contacto: {contact_display}. Notas: {notes}",
            closer_processed=False
        )
        db.session.add(appt)

        # Dejar comentario en el perfil del cliente origen
        if referrer_client:
            comment_text = f"💡 Referencia otorgada: creó un nuevo referido '{lead_name}' ({contact_display}). Contexto: {notes}"
            comment = Comment(
                text=comment_text,
                comment_type='client',
                associated_id=referrer_client.id,
                author_id=current_user.id
            )
            db.session.add(comment)

        db.session.commit()
        return jsonify({"message": "Referido guardado correctamente", "id": appt.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@bp.route('/deck/bulk-update', methods=['POST'])
@login_required
def bulk_update_closer_cards():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    appt_ids = data.get('appt_ids', [])
    result = data.get('result')
    
    if not appt_ids:
        return jsonify({"message": "No se proporcionaron IDs de citas"}), 400
        
    appointments = Appointment.query.filter(Appointment.id.in_(appt_ids)).all()
    
    from app.services.closer_service import CloserService
    
    for appt in appointments:
        if current_user.role != 'admin' and appt.closer_id != current_user.id:
            continue
            
        if result:
            # Procesar individualmente para ejecutar logica de negocio
            try:
                CloserService.process_agenda(current_user.id, appt.id, {"status": result, "role": "closer"}, is_admin=(current_user.role == 'admin'))
            except Exception as e:
                print(f"Error al procesar en lote para {appt.id}: {e}")
                
    try:
        db.session.commit()
        return jsonify({"message": f"Se actualizaron {len(appointments)} citas con éxito"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al actualizar en masa: {str(e)}"}), 500



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


@bp.route('/sales/client-state', methods=['GET'])
@login_required
def get_sales_client_state():
    """Estado de pago de un cliente para un programa (RR/AL/SI): cuánto pagó, cuánto le
    falta, y qué tipos de pago corresponden a continuación según la secuencia de negocio
    (Seña->Parcial/Completo->Cuota->Renovación/Upsell). Usado por el modal de Declarar Venta
    para no volver a pedir el monto total y para deshabilitar tipos de pago inválidos."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.services.sales_consistency_service import SalesConsistencyService
    from app.services.booking_service import BookingService

    programa = (request.args.get('programa') or 'RR').strip().upper()
    client_id = request.args.get('client_id', type=int)

    if not client_id:
        # Resolver por email/instagram/teléfono si todavía no hay un client_id conocido
        # (ej. lead sintético de búsqueda global sin cita local aún).
        email = request.args.get('email')
        instagram = request.args.get('instagram')
        phone = request.args.get('phone')
        if email or instagram or phone:
            client = BookingService.create_or_update_client({
                'name': request.args.get('name'), 'email': email, 'instagram': instagram, 'phone': phone
            })
            client_id = client.id if client else None

    state = SalesConsistencyService.get_client_payment_state(client_id, programa)
    state['allowed_types'] = SalesConsistencyService.get_allowed_types(client_id, programa)
    state['client_id'] = client_id
    return jsonify(state), 200


@bp.route('/sales/<int:sale_id>', methods=['PUT'])
@login_required
def update_closer_sale(sale_id):
    """Corrección de una venta ya declarada, desde el historial del cliente en el mazo.

    Hasta ahora el closer que se equivocaba en el monto o el tipo de pago tenía que pedirle a
    Operaciones que lo corrigiera (el único endpoint de edición vivía en el panel de admin). Se
    permite editar, **no borrar**: dar de baja una venta sigue siendo exclusivo de admin.

    `enviar_webhook` (default **false**) decide si la corrección se reenvía a la automatización
    de n8n. Va apagado por defecto a propósito: corregir un typo no debería volver a disparar los
    mensajes al cliente que la automatización manda al registrar una venta — el closer lo prende
    solo cuando la corrección sí tiene que salir hacia afuera."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.models import FinancialSale
    sale = FinancialSale.query.get_or_404(sale_id)
    data = request.get_json() or {}

    CAMPOS = {
        'tipo_pago': str, 'metodo_pago': str, 'monto': float, 'segundo_pago': str,
        'examen': str, 'estado': str, 'nombre_cliente': str, 'mail_cliente': str,
        'telefono': str, 'instagram': str, 'setter': str
    }
    cambios = {}
    for campo, tipo in CAMPOS.items():
        if campo not in data:
            continue
        valor = data[campo]
        if tipo is float:
            try:
                valor = float(valor or 0)
            except (TypeError, ValueError):
                return jsonify({"error": f"'{campo}' tiene que ser un número"}), 400
        else:
            valor = (valor or '').strip()
        anterior = getattr(sale, campo)
        if anterior != valor:
            cambios[campo] = {'antes': anterior, 'despues': valor}
            setattr(sale, campo, valor)

    if 'date' in data and data['date']:
        try:
            sale.date = datetime.fromisoformat(str(data['date']).replace('Z', ''))
            cambios['date'] = {'despues': sale.date.isoformat()}
        except ValueError:
            return jsonify({"error": "Fecha inválida (se espera ISO 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM')"}), 400

    if not cambios:
        return jsonify({"message": "No hubo cambios que guardar", "sale": sale.to_dict()}), 200

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al guardar la venta: {str(e)}"}), 500

    # Traza en el historial del lead: quién tocó qué, para que una corrección no sea un cambio
    # silencioso sobre un registro financiero.
    try:
        from app.models import Appointment
        from app.services.booking_service import BookingService
        detalle = ', '.join(f"{k}: {v.get('antes')!r} → {v.get('despues')!r}" for k, v in cambios.items())
        appt = Appointment.query.filter_by(client_id=sale.client_id).order_by(Appointment.start_time.desc()).first() if sale.client_id else None
        if appt:
            BookingService.log_lead_event(
                appt.id, current_user.id, 'sale_edited',
                f"{current_user.username} corrigió la venta {sale.id}. {detalle}"
            )
    except Exception as log_err:
        print(f"[Sale Edit Log Error] {log_err}")

    webhook_enviado = False
    if data.get('enviar_webhook') in (True, 'true', 'True', 1, '1', 'on'):
        try:
            from app.services.sheets_service import SheetsService
            SheetsService._trigger_n8n_webhook(SheetsService.build_sale_webhook_payload(sale))
            webhook_enviado = True
        except Exception as hook_err:
            print(f"[Sale Edit Webhook Error] {hook_err}")

    return jsonify({
        "message": "Venta actualizada" + (" y reenviada a la automatización" if webhook_enviado else ""),
        "sale": sale.to_dict(),
        "cambios": list(cambios.keys()),
        "webhook_enviado": webhook_enviado
    }), 200


@bp.route('/payments/<int:payment_id>', methods=['PATCH'])
@login_required
def update_closer_payment(payment_id):
    """Corrección de un pago ya cargado (Payment, el sistema de inscripciones) desde el historial
    del cliente. Igual que con las ventas: se edita, no se borra. Al cambiar el monto se
    recalcula el total pagado de la inscripción, que es lo que alimenta la deuda del cliente."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.models import Payment, Enrollment
    payment = Payment.query.get_or_404(payment_id)
    data = request.get_json() or {}

    if 'amount' in data:
        try:
            payment.amount = float(data['amount'] or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "'amount' tiene que ser un número"}), 400
    if 'payment_type' in data:
        payment.payment_type = (data['payment_type'] or '').strip()
    if 'status' in data:
        payment.status = (data['status'] or '').strip() or 'completed'
    if 'date' in data and data['date']:
        try:
            payment.date = datetime.fromisoformat(str(data['date']).replace('Z', ''))
        except ValueError:
            return jsonify({"error": "Fecha inválida"}), 400

    # `Enrollment.total_paid` es una propiedad calculada sobre los pagos, no una columna: no se
    # asigna, se recalcula sola al leerla después del commit.
    enrollment = Enrollment.query.get(payment.enrollment_id) if payment.enrollment_id else None

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al guardar el pago: {str(e)}"}), 500

    return jsonify({
        "message": "Pago actualizado",
        "payment": {
            'id': payment.id, 'amount': payment.amount, 'payment_type': payment.payment_type,
            'status': payment.status, 'date': payment.date.isoformat() if payment.date else None
        },
        "enrollment_total_paid": enrollment.total_paid if enrollment else None
    }), 200


@bp.route('/cleanup-queue', methods=['GET'])
@login_required
def get_cleanup_queue():
    """Cola de limpieza diaria: hasta 10 clientes cuyo registro de agendas/pagos tiene algo
    que revisar (secuencia de pago inconsistente, oferta sin seguimiento, fusión reciente,
    descuadre entre ventas y pagos)."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.services.client_cleanup_service import ClientCleanupService
    limit = request.args.get('limit', 10, type=int)
    items = ClientCleanupService.get_cleanup_queue(current_user.id, limit=limit)
    return jsonify(items), 200


@bp.route('/clients/<int:client_id>/full-history', methods=['GET'])
@login_required
def get_client_full_history(client_id):
    """Historial completo de un cliente: todas sus agendas, ventas declaradas y pagos
    (Enrollment/Payment), para que el closer pueda auditarlo de una sola vista."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.services.client_cleanup_service import ClientCleanupService
    history = ClientCleanupService.get_client_full_history(client_id)
    if not history:
        return jsonify({"message": "Cliente no encontrado"}), 404
    return jsonify(history), 200


@bp.route('/deck/card/<int:appt_id>', methods=['GET'])
@login_required
def get_closer_deck_card(appt_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    appt = Appointment.query.get_or_404(appt_id)
    # Cualquier closer puede abrir y editar cualquier lead (decisión del usuario: el buscador
    # global no filtra por dueño a propósito, para poder ubicar cualquier lead del sistema, y
    # bloquear la edición ahí solo generaba fricción sin aislamiento real entre closers). Se
    # sigue reasignando el `closer_id` cuando el dueño actual quedó huérfano (ManyChat sin
    # asignar, o el dueño ya no está activo) para que el lead entre al pipeline de quien lo
    # trabaja; si el dueño sigue activo, se edita sin quitárselo de su propio pipeline.
    is_owner = appt.closer_id == current_user.id
    if current_user.role == 'closer' and not is_owner:
        from app.models import User
        owner = User.query.get(appt.closer_id)
        if appt.origin == 'ManyChat' or not appt.closer_id or (owner and owner.is_active is False):
            appt.closer_id = current_user.id
            db.session.commit()

    card = _format_appointment_for_deck(appt, recover_form=True)
    card['can_edit'] = True
    card['owner_closer_name'] = None if appt.closer_id == current_user.id else (appt.closer.username if appt.closer else None)
    return jsonify(card), 200


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
        
    from app.models import Appointment, Client
    from sqlalchemy import or_, and_
    from datetime import date, timedelta, datetime
    
    # Obtener el rango de fechas para el filtrado temporal
    date_range = request.args.get('date_range', 'all')
    start_date = None
    today = date.today()
    
    if date_range == 'today':
        start_date = datetime.combine(today, datetime.min.time())
    elif date_range == 'week':
        start_date = datetime.combine(today - timedelta(days=7), datetime.min.time())
    elif date_range == 'month':
        start_date = datetime.combine(today - timedelta(days=30), datetime.min.time())
        
    # Unir con Client para acceder a sus atributos en el filtro
    query = Appointment.query.join(Client)
    
    # 1. Filtro: Citas sin agendar o con resultado no confirmado como Agendado
    query = query.filter(
        or_(
            Appointment.result == None,
            Appointment.result == '',
            Appointment.result != 'Agendado'
        )
    )
    
    # 2. Filtro: Que no tengan todos los campos completados para la carta del mazo
    query = query.filter(
        or_(
            Client.instagram == None,
            Client.instagram == '',
            Appointment.ig_chat_link == None,
            Appointment.ig_chat_link == '',
            Appointment.keyword == None,
            Appointment.keyword == '',
            Appointment.setter_notes == None,
            Appointment.setter_notes == ''
        )
    )
    
    # Aplicar restriccion de fechas si corresponde
    if start_date:
        query = query.filter(Appointment.created_at >= start_date)
        
    appointments = query.order_by(Appointment.created_at.desc()).limit(30).all()
    
    return jsonify([{
        "id": a.id,
        "lead_name": a.client.full_name or "Sin Nombre" if a.client else "Sin Cliente",
        "created_at": a.created_at.isoformat(),
        "origin": a.origin or "ManyChat"
    } for a in appointments]), 200

@bp.route('/unread-no-agenda', methods=['GET'])
@login_required
def get_unread_no_agenda_closer():
    # Obtener clientes que tienen notificaciones de comentarios no leídos para este closer
    from app.models import CommentNotification, Client, Appointment
    
    unread_notifications = CommentNotification.query.filter_by(user_id=current_user.id, is_read=False).all()
    unread_client_ids = {n.client_id for n in unread_notifications}
    
    if not unread_client_ids:
        return jsonify([]), 200
        
    clients = Client.query.filter(Client.id.in_(list(unread_client_ids))).all()
    
    results = []
    for c in clients:
        # Verificar si tiene cita para el closer en base de datos
        appt_exists = Appointment.query.filter_by(client_id=c.id).first() is not None
        
        if not appt_exists:
            results.append({
                "id": -(c.id + 5000000), # ID negativo especial
                "client_id": c.id,
                "lead_name": c.full_name or "Sin Nombre",
                "email": c.email or "",
                "instagram": c.instagram or "",
                "whatsapp": c.phone or "",
                "result": "Pendiente",
                "origin": "Mensaje (Sin Agenda)",
                "unread_comment": True,
                "start_time": None
            })

    return jsonify(results), 200

@bp.route('/leads-audit/status', methods=['GET'])
@login_required
def get_leads_audit_status():
    toggle = FeatureToggle.query.filter_by(key='closer_leads_audit').first()
    return jsonify({"enabled": bool(toggle and toggle.is_active)}), 200

@bp.route('/leads-audit', methods=['GET'])
@login_required
def get_leads_audit():
    if current_user.role not in ['closer', 'admin', 'operator']:
        return jsonify({"message": "Forbidden"}), 403

    toggle = FeatureToggle.query.filter_by(key='closer_leads_audit').first()
    if not (toggle and toggle.is_active) and current_user.role == 'closer':
        return jsonify({"error": "La auditoría de leads no está activa en este momento"}), 403

    closer_id = current_user.id
    if current_user.role in ('admin', 'operator'):
        requested = request.args.get('closer_id')
        if requested:
            closer_id = int(requested)

    month_param = request.args.get('month')
    try:
        if month_param:
            year, mon = [int(x) for x in month_param.split('-')]
        else:
            today = date.today()
            year, mon = today.year, today.month
        start = datetime(year, mon, 1)
        end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)
    except (ValueError, TypeError):
        return jsonify({"error": "Parámetro month inválido, use YYYY-MM"}), 400

    appts_in_month = Appointment.query.filter(
        Appointment.closer_id == closer_id,
        Appointment.start_time >= start,
        Appointment.start_time < end
    ).all()
    client_ids = sorted({a.client_id for a in appts_in_month})

    leads = []
    for client_id in client_ids:
        client = Client.query.get(client_id)
        if not client:
            continue

        appts = Appointment.query.filter_by(closer_id=closer_id, client_id=client_id).order_by(Appointment.start_time.asc()).all()

        enrollments = Enrollment.query.filter_by(closer_id=closer_id, client_id=client_id).all()
        payments = []
        for e in enrollments:
            for p in e.payments.order_by(Payment.date.asc()).all():
                payments.append({
                    "id": p.id,
                    "enrollment_id": e.id,
                    "amount": p.amount,
                    "date": p.date.isoformat() if p.date else None,
                    "payment_type": p.payment_type,
                    "status": p.status
                })

        leads.append({
            "client_id": client.id,
            "full_name": client.full_name or "Sin Nombre",
            "email": client.email,
            "phone": client.phone,
            "appointments": [{
                "id": a.id,
                "closer_result": a.closer_result,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "start_time": a.start_time.isoformat() if a.start_time else None
            } for a in appts],
            "payments": payments
        })

    leads.sort(key=lambda r: r['full_name'])
    return jsonify({"month": f"{year}-{mon:02d}", "leads": leads}), 200

