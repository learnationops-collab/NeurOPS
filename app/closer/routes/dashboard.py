from flask import render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.closer import bp
from app.services.closer_service import CloserService
from app.models import CloserDailyStats, DailyReportQuestion, DailyReportAnswer, Appointment, Event, Enrollment, Payment, db, User
from datetime import datetime, time, date, timedelta
import pytz
from functools import wraps

# Re-define or import decorator? It's better to keep it in a shared place or base closer routes.
# Since we are splitting, maybe put it in app/decorators.py? 
# It is already in @bp.route context in legacy. 
# Let's import from app.decorators or redefine if it was local.
# It was local in legacy.py. Let's assume we can move it to app/decorators.py or copy it.
# Ideally app/decorators.py.
# But for now, to avoid import circles or if it's specific, let's copy it here or create a shared util.
# Actually, let's use the one in app.decorators if it exists, but 'closer_required' might not be there.
# Let's add it to app/decorators.py if needed, OR just define it here for now.
# However, modifying app/decorators.py is cleaner.
# "role_required" is in decorators. We can use @role_required('closer')?
# But closer access also allows 'admin'.
# @role_required('closer') might be strict.
# Let's check decorators.py content via tool if needed, but I recall admin_required.
# Let's use a local one for now to match behavior: ['closer', 'admin'].

def closer_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if current_user.role not in ['closer', 'admin']: 
            flash('No tienes permiso para acceder a esta página.')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

@bp.route('/dashboard', methods=['GET', 'POST'])
@closer_required
def dashboard():
    tz_name = current_user.timezone or 'America/La_Paz'
    data = CloserService.get_dashboard_data(current_user.id, tz_name)
    
    questions = DailyReportQuestion.query.filter_by(is_active=True).order_by(DailyReportQuestion.order).all()
    today_stats = data['today_stats']
    
    # Handle Report POST
    if request.method == 'POST' and 'save_report' in request.form:
        if not today_stats:
            today_stats = CloserDailyStats(closer_id=current_user.id, date=data['dates']['today_local'])
            db.session.add(today_stats)
        
        # Save Automated KPIs Snapshot
        kpis = data['kpis']
        today_stats.calls_scheduled = kpis['scheduled']
        today_stats.calls_completed = kpis['completed']
        today_stats.calls_no_show = kpis['no_show']
        today_stats.calls_canceled = kpis['canceled']
        today_stats.sales_count = kpis['sales_count']
        today_stats.sales_amount = kpis['sales_amount']
        today_stats.cash_collected = kpis['cash_collected']
        
        today_stats.self_generated_bookings = request.form.get('self_generated_bookings', 0, type=int)
        db.session.commit()
        
        # Save Answers
        current_answers = DailyReportAnswer.query.filter_by(daily_stats_id=today_stats.id).all()
        for ans in current_answers:
             db.session.delete(ans)
             
        for q in questions:
            ans_text = request.form.get(f'question_{q.id}')
            if q.question_type == 'boolean':
                ans_text = 'Sí' if request.form.get(f'question_{q.id}') else 'No'
            
            if ans_text:
                new_ans = DailyReportAnswer(
                    daily_stats_id=today_stats.id,
                    question_id=q.id,
                    answer=str(ans_text)
                )
                db.session.add(new_ans)
        
        db.session.commit()
        flash('Reporte diario guardado.')
        return redirect(url_for('closer.dashboard'))

    return render_template('closer/dashboard.html',
                           commission_month=data['commission']['month'],
                           commission_today=data['commission']['today'],
                           closing_rate_month=data['rates']['closing_month'],
                           closing_rate_today=data['rates']['closing_today'],
                           daily_progress=data['progress'],
                           upcoming_agendas=data['upcoming_agendas'],
                           recent_clients=data['recent_clients'],
                           questions=questions,
                           today_stats=today_stats,
                           datetime=datetime,
                           pytz=pytz)

@bp.route('/daily_report', methods=['GET', 'POST'])
@closer_required
def daily_report():
    # Similar to dashboard logic but focused on report page
    tz_name = current_user.timezone or 'America/La_Paz'
    data = CloserService.get_dashboard_data(current_user.id, tz_name)
    questions = DailyReportQuestion.query.filter_by(is_active=True).order_by(DailyReportQuestion.order).all()
    today_stats = data['today_stats']
    
    if request.method == 'POST':
        # Same saving logic as dashboard POST
        if not today_stats:
            today_stats = CloserDailyStats(closer_id=current_user.id, date=data['dates']['today_local'])
            db.session.add(today_stats)
            
        kpis = data['kpis']
        today_stats.calls_scheduled = kpis['scheduled']
        today_stats.calls_completed = kpis['completed']
        today_stats.calls_no_show = kpis['no_show']
        today_stats.calls_canceled = kpis['canceled']
        today_stats.sales_count = kpis['sales_count']
        today_stats.sales_amount = kpis['sales_amount']
        today_stats.cash_collected = kpis['cash_collected']
        
        today_stats.self_generated_bookings = request.form.get('self_generated_bookings', 0, type=int)
        db.session.commit()
        
        current_answers = DailyReportAnswer.query.filter_by(daily_stats_id=today_stats.id).all()
        for ans in current_answers:
             db.session.delete(ans)
             
        for q in questions:
            ans_text = request.form.get(f'question_{q.id}')
            if q.question_type == 'boolean':
                ans_text = 'Sí' if request.form.get(f'question_{q.id}') else 'No'
            
            if ans_text:
                new_ans = DailyReportAnswer(
                    daily_stats_id=today_stats.id,
                    question_id=q.id,
                    answer=str(ans_text)
                )
                db.session.add(new_ans)
        
        db.session.commit()
        flash('Reporte diario guardado exitosamente.')
        return redirect(url_for('closer.dashboard'))

    return render_template('closer/daily_report.html', 
                           questions=questions,
                           # Pass individual KPIs for report view
                           kpi_scheduled=data['kpis']['scheduled'],
                           kpi_completed=data['kpis']['completed'],
                           kpi_no_show=data['kpis']['no_show'],
                           kpi_canceled=data['kpis']['canceled'],
                           kpi_sales_count=data['kpis']['sales_count'],
                           kpi_sales_amount=data['kpis']['sales_amount'],
                           kpi_cash_collected=data['kpis']['cash_collected'],
                           kpi_show_rate=data['kpis']['show_rate'],
                           kpi_closing_rate=data['kpis']['closing_rate'],
                           kpi_avg_ticket=data['kpis']['avg_ticket'],
                           today_stats=today_stats, 
                           today=data['dates']['today_local']
                           )

@bp.route('/agendas')
@closer_required
def agendas():
    import pytz
    
    tz_name = current_user.timezone or 'America/La_Paz'
    try:
        closer_tz = pytz.timezone(tz_name)
    except:
        closer_tz = pytz.timezone('America/La_Paz')
        
    now_local = datetime.now(closer_tz)
    today_local = now_local.date()
    
    start_local = closer_tz.localize(datetime.combine(today_local, time.min))
    end_local = closer_tz.localize(datetime.combine(today_local, time.max))
    start_utc = start_local.astimezone(pytz.UTC).replace(tzinfo=None)
    end_utc = end_local.astimezone(pytz.UTC).replace(tzinfo=None)
    
    # KPIs for Agendas View
    todays_calls_count = Appointment.query.filter(
        Appointment.closer_id == current_user.id,
        Appointment.start_time >= start_utc,
        Appointment.start_time <= end_utc,
        Appointment.status != 'canceled'
    ).count()
    
    # Month Sales
    month_start_local = closer_tz.localize(datetime(today_local.year, today_local.month, 1))
    month_start_utc = month_start_local.astimezone(pytz.UTC).replace(tzinfo=None)
    
    month_enrollments = Enrollment.query.filter(
        Enrollment.enrollment_date >= month_start_utc,
        Enrollment.enrollment_date <= end_utc, # until now/end of today
        Enrollment.status != 'dropped',
        Enrollment.closer_id == current_user.id
    ).all()
    
    monthly_sales = sum(e.total_agreed for e in month_enrollments)
    monthly_sales_count = len(month_enrollments)
    
    # Closing Rate
    month_appointments_count = Appointment.query.filter(
        Appointment.closer_id == current_user.id,
        Appointment.start_time >= month_start_utc,
        Appointment.start_time <= end_utc,
        Appointment.status == 'completed'
    ).count()
    
    closing_rate = (monthly_sales_count / month_appointments_count * 100) if month_appointments_count > 0 else 0
    
    # Lists - Agendas (All, Ordered by Priority)
    from sqlalchemy.orm import aliased
    order_map = {'scheduled': 0, 'completed': 1, 'no_show': 2, 'canceled': 3}
    
    # Global Sequence Number Subquery (Count of ALL previous appointments for this lead, regardless of closer)
    ApptPrev = aliased(Appointment)
    seq_subq = db.session.query(db.func.count(ApptPrev.id)).filter(
        ApptPrev.lead_id == Appointment.lead_id,
        ApptPrev.start_time <= Appointment.start_time
    ).correlate(Appointment).label('seq_num')
    
    # Query (Appt, seq_num)
    results = db.session.query(Appointment, seq_subq).filter(
        Appointment.closer_id == current_user.id
    ).all()
    
    # Sort: Status Priority -> Start Time
    # x is tuple (Appointment, seq_num)
    sorted_appointments = sorted(results, key=lambda x: (order_map.get(x[0].status, 4), x[0].start_time))
    next_calls = sorted_appointments[:15]
    
    events = Event.query.filter_by(is_active=True).all()
    
    # Top Debtors
    active_enrollments = Enrollment.query.filter(Enrollment.status == 'active', Enrollment.closer_id == current_user.id).all()
    debtors = []
    for enr in active_enrollments:
        paid = db.session.query(db.func.sum(Payment.amount)).filter(
            Payment.enrollment_id == enr.id,
            Payment.status == 'completed'
        ).scalar() or 0
        debt = enr.total_agreed - paid
        if debt > 0:
            debtors.append({
                'student': enr.student,
                'program': enr.program,
                'total_agreed': enr.total_agreed,
                'total_paid': paid,
                'debt': debt
            })
    top_debtors = sorted(debtors, key=lambda x: x['debt'], reverse=True)[:5]
    
    return render_template('closer/agendas.html', 
                           today_appointments_count=todays_calls_count, 
                           next_calls=next_calls,
                           events=events,
                           top_debtors=top_debtors,
                           monthly_sales=monthly_sales,
                           closing_rate=closing_rate,
                           pytz=pytz,
                           datetime=datetime)
