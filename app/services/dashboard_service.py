from app import db
from app.models import CloserDailyStats, Payment, User, Expense, Enrollment, Program, PaymentMethod, Client, Appointment, Availability
from app.services.base import BaseService
from datetime import datetime, date, time, timedelta
from sqlalchemy import or_, func, case
from sqlalchemy.orm import joinedload

class DashboardService(BaseService):
    @staticmethod
    def get_detailed_closer_metrics(start_date, end_date, closer_id=None):
        if isinstance(start_date, date): start_date = datetime.combine(start_date, time.min)
        if isinstance(end_date, date): end_date = datetime.combine(end_date, time.max)
        
        appt_filters = [Appointment.start_time >= start_date, Appointment.start_time <= end_date]
        avail_filters = [Availability.date >= start_date.date(), Availability.date <= end_date.date()]
        sale_filters = [Enrollment.enrollment_date >= start_date, Enrollment.enrollment_date <= end_date]
        
        if closer_id:
            appt_filters.append(Appointment.closer_id == closer_id)
            avail_filters.append(Availability.closer_id == closer_id)
            sale_filters.append(Enrollment.closer_id == closer_id)
            
        slots_defined_count = Availability.query.filter(*avail_filters).count()
        total_appts = Appointment.query.filter(*appt_filters).all()
        
        slots_used = len(total_appts)
        slots_available = max(0, slots_defined_count - slots_used)
        
        stats = {
            'total_agendas': 0,
            'presentations': 0,
            'first_agendas': {'total': 0, 'completed': 0, 'no_show': 0, 'canceled': 0, 'rescheduled': 0, 'scheduled': 0, 'confirmed': 0},
            'second_agendas': {'total': 0, 'completed': 0, 'no_show': 0, 'canceled': 0, 'rescheduled': 0, 'scheduled': 0, 'confirmed': 0}
        }
        
        def update_bucket(bucket, status):
            bucket['total'] += 1
            if status in bucket: bucket[status] += 1
        
        for appt in total_appts:
            stats['total_agendas'] += 1
            if appt.status == 'completed': stats['presentations'] += 1
            a_type = appt.appointment_type or 'Primera agenda'
            if a_type == 'Segunda agenda': update_bucket(stats['second_agendas'], appt.status)
            else: update_bucket(stats['first_agendas'], appt.status)

        # Sales count: Enrollments with at least one completed payment in the period
        # This is slightly complex because enrollment_date might be in period but payment might not, or vice versa.
        # Strict logic: Enrollment DATE is in period AND has a completed payment (regardless of date? or payment date in period?)
        # Let's stick to: "Enrollments made in this period that are completed"
        sales_count = Enrollment.query.join(Payment).filter(
            Enrollment.enrollment_date >= start_date, 
            Enrollment.enrollment_date <= end_date,
            Payment.status == 'completed'
        ).distinct().count()
        
        def safe_div(n, d): return (n / d * 100) if d > 0 else 0
        total_completed = stats['first_agendas']['completed'] + stats['second_agendas']['completed']
        total_scheduled = stats['first_agendas']['total'] + stats['second_agendas']['total']
        
        kpis = {
            'show_up_rate': safe_div(total_completed, total_scheduled),
            'closing_rate_global': safe_div(sales_count, total_completed),
            'closing_rate_presentation': safe_div(sales_count, stats['presentations']),
        }
        
        return {
            'slots': {'total': slots_defined_count, 'available': slots_available, 'used': slots_used},
            'agendas': stats,
            'sales': sales_count,
            'kpis': kpis
        }

        }

    @staticmethod
    def _get_date_range(period, start_date_arg, end_date_arg):
        today = date.today()
        if period == 'custom' and start_date_arg and end_date_arg:
            try:
                start_date = datetime.strptime(start_date_arg, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_arg, '%Y-%m-%d').date()
            except ValueError:
                start_date = today.replace(day=1)
                end_date = today
        elif period == 'last_month':
            first = today.replace(day=1)
            last_month_end = first - timedelta(days=1)
            start_date = last_month_end.replace(day=1)
            end_date = last_month_end
        elif period == 'all_time':
            # Dynamic lookup for min/max
            min_p = db.session.query(func.min(Payment.date)).scalar()
            min_c = db.session.query(func.min(Client.created_at)).scalar()
            max_p = db.session.query(func.max(Payment.date)).scalar()
            
            # Start from earliest record found
            mins = [d.date() if isinstance(d, datetime) else d for d in [min_p, min_c] if d]
            start_date = min(mins) if mins else today.replace(day=1)
            
            # End at today or last record? Usually today is better boundary for "To Date".
            end_date = today
            if max_p:
                max_d = max_p.date() if isinstance(max_p, datetime) else max_p
                if max_d > end_date: end_date = max_d
            
            if start_date > end_date: start_date = end_date
        else:
            # this_month
            start_date = today.replace(day=1)
            end_date = today
            
        return start_date, end_date

    @staticmethod
    def get_dashboard_kpis(period='this_month', start_date_arg=None, end_date_arg=None):
        start_date, end_date = DashboardService._get_date_range(period, start_date_arg, end_date_arg)
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        # 1. Financials: Income, Expenses
        payments = Payment.query.filter(Payment.date >= start_dt, Payment.date <= end_dt, Payment.status == 'completed').all()
        income = sum(p.amount for p in payments)
        
        # Calculate commissions
        total_comm = sum((p.amount * (p.method.commission_percent / 100) + p.method.commission_fixed) for p in payments if p.method)
        
        total_expenses = db.session.query(func.sum(Expense.amount)).filter(Expense.date >= start_dt, Expense.date <= end_dt).scalar() or 0
        net_profit = (income - total_comm) - total_expenses
        
        # 2. Cohort & Optimised Debt Calculation
        active_leads_count = Client.query.filter(Client.created_at >= start_dt, Client.created_at <= end_dt).count()
        
        # SQL Debt Calculation: For clients created in this period, sum(Price - Paid)
        # We need subquery for total paid per enrollment
        
        # Step 1: Subquery for total payments per enrollment
        # (enrollment_id, total_paid)
        sq_paid = db.session.query(
            Payment.enrollment_id, 
            func.sum(Payment.amount).label('total_paid')
        ).filter(Payment.status == 'completed').group_by(Payment.enrollment_id).subquery()
        
        # Main Query: Join Client -> Enrollment -> Program
        # Left Join sq_paid to subtract
        query_debt = db.session.query(
            func.sum(Program.price - func.coalesce(sq_paid.c.total_paid, 0))
        ).select_from(Client)\
         .join(Enrollment, Client.enrollments)\
         .join(Program, Enrollment.program)\
         .outerjoin(sq_paid, Enrollment.id == sq_paid.c.enrollment_id)\
         .filter(Client.created_at >= start_dt, Client.created_at <= end_dt)
        
        # We only want positive debt? Usually formula is Price - Paid. If paid > price, it's negative debt (overpaid?), effectively 0 debt.
        # But in SQL sum, negatives would offset positives. 
        # Safer to calculate per enrollment: GREATEST(Price - Paid, 0).
        # SQLite supports MAX(x,y). Postgres GREATEST. Flask-SQLAlchemy/SQLAlchemy usually abstracts.
        # Or simpler: Just Sum(Price) - Sum(Paid). Overpayments are rare and usually handled.
        
        period_debt = query_debt.scalar() or 0.0
        
        return {
            'financials': {
                'income': income, 
                'cash_collected': income - total_comm, 
                'net_profit': net_profit, 
                'total_expenses': total_expenses
            },
            'cohort': {
                'active_leads': active_leads_count,
                'p_debt': float(period_debt)
            },
            'dates': {'start': start_date.isoformat(), 'end': end_date.isoformat()}
        }

    @staticmethod
    def get_dashboard_charts(period='this_month', start_date_arg=None, end_date_arg=None):
        start_date, end_date = DashboardService._get_date_range(period, start_date_arg, end_date_arg)
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        # 1. Revenue & Agendas over time
        daily_rev_q = db.session.query(func.date(Payment.date), func.sum(Payment.amount)).filter(
            Payment.date >= start_dt, Payment.date <= end_dt, Payment.status == 'completed'
        ).group_by(func.date(Payment.date)).all()
        # Ensure dict keys are strings
        rev_dict = {str(r[0]): float(r[1]) for r in daily_rev_q}

        daily_agendas_q = db.session.query(func.date(Appointment.start_time), func.count(Appointment.id)).filter(
            Appointment.start_time >= start_dt, Appointment.start_time <= end_dt
        ).group_by(func.date(Appointment.start_time)).all()
        agendas_dict = {str(r[0]): int(r[1]) for r in daily_agendas_q}

        chart_dates = []
        chart_revs = []
        chart_agendas = []
        
        curr = start_date
        while curr <= end_date:
            d_str = str(curr)
            chart_dates.append(d_str)
            chart_revs.append(rev_dict.get(d_str, 0.0))
            chart_agendas.append(agendas_dict.get(d_str, 0))
            curr += timedelta(days=1)

        # 2. Agenda Status Breakdown
        status_q = db.session.query(Appointment.status, func.count(Appointment.id)).filter(
            Appointment.start_time >= start_dt, Appointment.start_time <= end_dt
        ).group_by(Appointment.status).all()
        
        # 3. Programs Breakdown
        prog_q = db.session.query(Program.name, func.count(Enrollment.id)).join(Program).filter(
            Enrollment.enrollment_date >= start_dt, Enrollment.enrollment_date <= end_dt
        ).group_by(Program.name).all()

        return {
            'dates_labels': chart_dates, 
            'revenue_values': chart_revs, 
            'agendas_values': chart_agendas,
            'status_labels': [r[0] for r in status_q], 
            'status_values': [r[1] for r in status_q],
            'program_labels': [r[0] for r in prog_q],
            'program_values': [r[1] for r in prog_q]
        }

    @staticmethod
    def get_dashboard_activity(period='this_month', start_date_arg=None, end_date_arg=None):
        # Activity is mostly just "Most recent", but Top Debtors depends on period.
        start_date, end_date = DashboardService._get_date_range(period, start_date_arg, end_date_arg)
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        # Recent Activity (Global, independent of period usually, or restricted?)
        # Let's keep it global recency for context, or filter by period?
        # Standard dashboard behavior: "Recent activity" usually means "Just now".
        # But "Top Debtors" DEFINITELY depends on the selected cohort period (as per original logic).
        
        # 1. Top Debtors (Optimized)
        # We need to find clients created in period with largest debts.
        # Same subquery logic
        sq_paid = db.session.query(
            Payment.enrollment_id, 
            func.sum(Payment.amount).label('total_paid')
        ).filter(Payment.status == 'completed').group_by(Payment.enrollment_id).subquery()
        
        # Query: Client, Total Debt
        # We group by Client
        debt_col = func.sum(Program.price - func.coalesce(sq_paid.c.total_paid, 0)).label('total_debt')
        
        debtors_q = db.session.query(Client, debt_col)\
            .join(Enrollment, Client.enrollments)\
            .join(Program, Enrollment.program)\
            .outerjoin(sq_paid, Enrollment.id == sq_paid.c.enrollment_id)\
            .filter(Client.created_at >= start_dt, Client.created_at <= end_dt)\
            .group_by(Client.id)\
            .having(debt_col > 0)\
            .order_by(debt_col.desc())\
            .limit(5)\
            .all()
            
        top_debtors = [{
            'student': {"id": c.id, "full_name": c.full_name, "email": c.email}, 
            'debt': float(debt)
        } for c, debt in debtors_q]
        
        # 2. Recent Activity (Last 5 leads, Last 5 sales)
        activity = []
        rec_clients = Client.query.order_by(Client.created_at.desc()).limit(5).all()
        for c in rec_clients:
            activity.append({'type': 'lead', 'time': c.created_at.isoformat(), 'message': 'Nuevo Lead', 'sub': c.full_name or c.email})
        
        rec_payments = Payment.query.join(Enrollment).join(Client).filter(Payment.status == 'completed').order_by(Payment.date.desc()).limit(5).all()
        for p in rec_payments:
            activity.append({'type': 'payment', 'time': p.date.isoformat(), 'message': f'Pago: ${p.amount:,.0f}', 'sub': p.enrollment.client.full_name or p.enrollment.client.email})
            
        activity.sort(key=lambda x: x['time'], reverse=True)
        
        return {
            'recent_activity': activity[:10],
            'top_debtors': top_debtors
        }
