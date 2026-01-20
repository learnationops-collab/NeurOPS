from flask import render_template, request
from app.admin import bp
from app.decorators import admin_required, role_required
from app.services.dashboard_service import DashboardService
from app.models import User
from flask_login import login_required
from datetime import datetime, timedelta, date

@bp.route('/dashboard')
@admin_required
def dashboard():
    period = request.args.get('period', 'this_month')
    start_date_arg = request.args.get('start_date')
    end_date_arg = request.args.get('end_date')

    data = DashboardService.get_main_dashboard_data(period, start_date_arg, end_date_arg)
    
    # Format for template
    s_date_val = start_date_arg if start_date_arg else data['dates']['start'].strftime('%Y-%m-%d')
    e_date_val = end_date_arg if end_date_arg else data['dates']['end'].strftime('%Y-%m-%d')
    
    # Calculate missing KPIs for template
    income = data['financials']['income']
    cash = data['financials']['cash_collected']
    commissions = income - cash
    
    # Placeholder Chart Data (To be implemented fully in Service later)
    # Keeping it empty for now to unblock rendering
    
    return render_template('admin/dashboard.html',
                           start_date=data['dates']['start'],
                           end_date=data['dates']['end'],
                           period_start=s_date_val,
                           period_end=e_date_val,
                           current_period=period,
                           start_date_filter=s_date_val,
                           end_date_filter=e_date_val,
                           
                           # Financials
                           dashboard_revenue=(cash + data['cohort']['p_debt']), # "Revenue" = Cash + Debt
                           period_cash_from_sales=cash,
                           period_gross_cash=income,
                           period_commission=commissions,
                           total_expenses=data['financials']['total_expenses'],
                           net_profit=data['financials']['net_profit'],
                           cash_collected_month=cash, 
                           
                           # Cohort / CRM
                           leads_count=data['cohort']['active_leads'],
                           period_debt=data['cohort']['p_debt'],
                           top_debtors=data['cohort']['top_debtors'],
                           closing_rate=0.0, # TODO: Calculate
                           
                           # Charts (Placeholders)
                           dates_labels=[],
                           daily_revenue_values=[],
                           prog_labels=[],
                           prog_values=[],
                           status_labels=[],
                           status_values=[],
                           method_labels=[],
                           method_values=[],
                           recent_activity=[]
                           )


@bp.route('/admin/closer-stats')
@login_required
@role_required('admin')
def closer_stats():
    # filters
    start_date_str = request.args.get('start_date', (datetime.today() - timedelta(days=30)).strftime('%Y-%m-%d'))
    end_date_str = request.args.get('end_date', datetime.today().strftime('%Y-%m-%d'))
    closer_id = request.args.get('closer_id', '')
    
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    
    stats_data = DashboardService.get_closer_stats(start_date, end_date, closer_id)
    
    closers = User.query.filter_by(role='closer').all()

    return render_template('admin/closer_stats.html', 
                           stats=stats_data['records'], 
                           kpis=stats_data['kpis'], 
                           total=stats_data['totals'],
                           closers=closers,
                           start_date=start_date_str,
                           end_date=end_date_str,
                           selected_closer=closer_id)

@bp.route('/appointments')
@admin_required
def appointments_list():
    today = date.today()
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    if start_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    else:
        start_date = None
        
    if end_date_str:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    else:
        end_date = None

    # We need Appointment model and db
    from app.models import Appointment, db
    
    query = db.session.query(Appointment, User).join(User, Appointment.closer_id == User.id).order_by(Appointment.start_time.desc())
    
    search = request.args.get('search')
    if search:
        search_term = f"%{search}%"
        LeadUser = db.aliased(User)
        query = db.session.query(Appointment, User).join(User, Appointment.closer_id == User.id).join(LeadUser, Appointment.lead_id == LeadUser.id, isouter=True).filter(
            db.or_(
                User.username.ilike(search_term),
                LeadUser.username.ilike(search_term),
                LeadUser.email.ilike(search_term)
            )
        ).order_by(Appointment.start_time.desc())

    if start_date:
        start_dt = datetime.combine(start_date, time.min)
        query = query.filter(Appointment.start_time >= start_dt)
        
    if end_date:
        end_dt = datetime.combine(end_date, time.max)
        query = query.filter(Appointment.start_time <= end_dt)

    appointments = query.all()

    return render_template('admin/appointments_list.html', 
                           appointments=appointments,
                           start_date=start_date,
                           end_date=end_date)

@bp.route('/appointments/delete/<int:id>')
@admin_required
def delete_appointment(id):
    from app.models import Appointment, db
    appt = Appointment.query.get_or_404(id)
    db.session.delete(appt)
    db.session.commit()
    from flask import flash, redirect, url_for
    flash('Cita eliminada.')
    return redirect(url_for('admin.appointments_list'))


