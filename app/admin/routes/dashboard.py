from flask import render_template, request
from app.admin import bp
from app.decorators import admin_required, role_required
from app.services.dashboard_service import DashboardService
from app.models import User, CloserDailyStats, DailyReportQuestion
from flask_login import login_required
from datetime import datetime, timedelta, date, time

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
                           
                           # Charts
                           dates_labels=data['charts']['dates_labels'],
                           daily_revenue_values=data['charts']['revenue_values'],
                           prog_labels=data['charts']['prog_labels'],
                           prog_values=data['charts']['prog_values'],
                           status_labels=data['charts']['status_labels'],
                           status_values=data['charts']['status_values'],
                           method_labels=data['charts']['method_labels'],
                           method_values=data['charts']['method_values'],
                           
                           recent_activity=data.get('recent_activity', []),
                           today_stats=data.get('today_stats', {}),
                           now=datetime.now()
                           )


@bp.route('/admin/closer-stats')
@login_required
@role_required('admin')
def closer_stats():
    # filters
    period = request.args.get('period', 'this_month')
    closer_id = request.args.get('closer_id', '')
    
    today = date.today()
    
    if period == 'today':
        start_date = today
        end_date = today
    elif period == 'this_month':
        start_date = today.replace(day=1)
        next_month = today.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
    else: # custom
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                 # Fallback
                 start_date = today.replace(day=1)
                 end_date = today
        else:
            # Default to this month if custom selected but no dates
            start_date = today.replace(day=1)
            next_month = today.replace(day=28) + timedelta(days=4)
            end_date = next_month - timedelta(days=next_month.day)

    # Convert back to string for input values if needed, actually template uses date objects usually or strings
    start_date_str = start_date.strftime('%Y-%m-%d')
    end_date_str = end_date.strftime('%Y-%m-%d')
    
    # stats_data = DashboardService.get_closer_stats(start_date, end_date, closer_id)
    # Using new Detailed Metrics
    metrics = DashboardService.get_detailed_closer_metrics(start_date, end_date, closer_id if closer_id else None)
    
    closers = User.query.filter_by(role='closer').all()

    return render_template('admin/closer_stats.html', 
                           metrics=metrics,
                           closers=closers,
                           start_date=start_date_str,
                           end_date=end_date_str,
                           selected_closer=closer_id,
                           period=period)

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
    from app.models import Appointment, db, User
    
    # Sequence Number (1st, 2nd, etc.) per Client
    # We use a window function for this.
    # Note: query(Appointment, User, sequence_num)
    
    seq_col = db.func.row_number().over(
        partition_by=Appointment.lead_id, 
        order_by=Appointment.start_time
    ).label('seq_num')
    
    base_query = db.session.query(Appointment, User, seq_col).join(User, Appointment.closer_id == User.id)
    
    search = request.args.get('search')
    if search:
        search_term = f"%{search}%"
        LeadUser = db.aliased(User)
        base_query = base_query.join(LeadUser, Appointment.lead_id == LeadUser.id, isouter=True).filter(
            db.or_(
                User.username.ilike(search_term),
                LeadUser.username.ilike(search_term),
                LeadUser.email.ilike(search_term)
            )
        )

    # Apply date filters
    if start_date:
        start_dt = datetime.combine(start_date, time.min)
        base_query = base_query.filter(Appointment.start_time >= start_dt)
        
    if end_date:
        end_dt = datetime.combine(end_date, time.max)
        base_query = base_query.filter(Appointment.start_time <= end_dt)
        
    # Order by start time desc for display
    # Note: Using subquery might be safer if we want proper sorting of the final list while keeping row_number correct relative to history.
    # However, row_number().over() is calculated *before* ORDER BY of the main query usually in SQL logical order if not careful, 
    # but here sequence is PART of the SELECT, so it is calculated per row based on partition.
    # Simply ordering the result DESC will just reorder the rows, seq_num remains attached to the row.
    appointments = base_query.order_by(Appointment.start_time.desc()).all()

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



@bp.route('/stats/closer')
@admin_required
def stats_closer():
    today = date.today()
    
    # Filters
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    closer_id = request.args.get('closer_id')
    
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        except ValueError:
            start_date = today.replace(day=1)
    else:
        start_date = today.replace(day=1)
        
    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            end_date = today
    else:
        end_date = today
        
    # Query Stats
    query = CloserDailyStats.query.filter(
        CloserDailyStats.date >= start_date,
        CloserDailyStats.date <= end_date
    ).order_by(CloserDailyStats.date.desc())
    
    if closer_id:
        query = query.filter(CloserDailyStats.closer_id == closer_id)
        
    stats = query.all()
    
    # Totals (Aggregations)
    total_sales = sum((s.sales_count or 0) for s in stats)
    total_cash = sum((s.cash_collected or 0) for s in stats)
    total_calls = sum((s.calls_completed or 0) for s in stats)
    
    closing_rate = (total_sales / total_calls * 100) if total_calls > 0 else 0
    
    closers = User.query.filter_by(role='closer').all()
    questions = DailyReportQuestion.query.order_by(DailyReportQuestion.order).all()
    
    # Calculate totals for questions
    questions_totals = {}
    for q in questions:
        if q.question_type == 'number':
            # Sum all answers for this question
            total = 0
            for s in stats:
                ans = s.answers.filter_by(question_id=q.id).first()
                if ans and ans.answer:
                    try:
                        total += float(ans.answer)
                    except ValueError:
                        pass
            questions_totals[q.id] = total
            
        elif q.question_type == 'boolean':
            # Count "Yes" answers
            count = 0
            for s in stats:
                ans = s.answers.filter_by(question_id=q.id).first()
                if ans and (ans.answer == 'true' or ans.answer == '1' or ans.answer == 'Sí'):
                    count += 1
            questions_totals[q.id] = count
        else:
            questions_totals[q.id] = None

    return render_template('admin/stats_closer.html', 
                           stats=stats, 
                           total_sales=total_sales,
                           total_cash=total_cash,
                           total_calls=total_calls,
                           closing_rate=closing_rate,
                           closers=closers,
                           questions=questions,
                           questions_totals=questions_totals,
                           start_date=start_date.strftime('%Y-%m-%d'),
                           end_date=end_date.strftime('%Y-%m-%d'))


@bp.route('/mock-generator', methods=['GET', 'POST'])
@admin_required
def mock_generator():
    from app.services.mock_data_service import MockDataService
    from flask import flash, redirect, url_for
    
    if request.method == 'POST':
        try:
            qty = int(request.form.get('quantity', 5))
            sales = request.form.get('include_sales') == 'on'
            
            msg = MockDataService.generate_bulk_data(lead_count=qty, create_sales=sales)
            flash(f'Éxito: {msg}', 'success')
        except Exception as e:
            flash(f'Error generando datos: {str(e)}', 'error')
            
        return redirect(url_for('admin.mock_generator'))
        
    return render_template('admin/mock_generator.html')
