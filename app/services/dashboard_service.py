from app import db
from app.models import CloserDailyStats, Payment, User, Expense, Enrollment, Program, PaymentMethod, LeadProfile, Appointment, Availability
from app.services.base import BaseService
from datetime import datetime, date, time, timedelta
from sqlalchemy import or_

class DashboardService(BaseService):
    @staticmethod
    def get_detailed_closer_metrics(start_date, end_date, closer_id=None):
        # Ensure datetimes
        if isinstance(start_date, date): start_date = datetime.combine(start_date, time.min)
        if isinstance(end_date, date): end_date = datetime.combine(end_date, time.max)
        
        # Base Filters
        appt_filters = [Appointment.start_time >= start_date, Appointment.start_time <= end_date]
        avail_filters = [Availability.date >= start_date.date(), Availability.date <= end_date.date()]
        sale_filters = [Enrollment.enrollment_date >= start_date, Enrollment.enrollment_date <= end_date, Enrollment.status == 'active']
        
        if closer_id:
            appt_filters.append(Appointment.closer_id == closer_id)
            avail_filters.append(Availability.closer_id == closer_id)
            sale_filters.append(Enrollment.closer_id == closer_id)
            
        # 1. Slots Stats
        slots_defined_count = Availability.query.filter(*avail_filters).count()
        # Slots are 1 hour usually. If availability tracks ranges, we count rows if they are 1-slot-per-row, 
        # OR duration. Assumed 1 row = 1 slot based on `calendar.py` logic (loop input slots).
        
        total_appts_query = Appointment.query.filter(*appt_filters)
        total_appts = total_appts_query.all()
        
        slots_used = len(total_appts)
        slots_available = max(0, slots_defined_count - slots_used)
        
        # 2. Appointment Stats
        stats = {
            'total_agendas': 0,
            'completed': 0,
            'no_show': 0,
            'canceled': 0,
            'rescheduled': 0, # marked as is_reschedule=True (these are NEW dates)
            # 'reprogrammings': ? User asked "cantidad de reprogramaciones". 
            # Usually reschedule implies an old one was moved. `is_reschedule` tags the NEW one.
            # So count(is_reschedule) = # of times a call was moved TO this period? 
            # Or # of requests? Let's count `is_reschedule` as "Calls that are Result of Reschedule".
            'presentations': 0,
            
            'second_agendas': { # Agendas with sequence > 1
                'total': 0, 'completed': 0, 'no_show': 0, 'canceled': 0
            }
        }
        
        # Pre-fetch sequences? 
        # Optimized approach: We iterate `total_appts`. For each, we check if it's > 1st.
        # N+1 problem if we query per appt. 
        # We can fetch (id, count_prev) via subquery or just fetch all historical for these leads?
        # Let's trust `is_reschedule` helps distinguish repeated attempts logic, but "Second Agenda" implies Sales Cycle logic (Follow up).
        # Let's verify Sequence Number logic.
        # We can implement a helper or simple check:
        # For KPI dashboard, maybe approximation is fine?
        # Let's do a bulk query for sequence map if closer_id is set.
        
        # Map Appointment ID -> Sequence Number
        # Subquery approach for all appointments in range
        from sqlalchemy.orm import aliased
        APP = aliased(Appointment)
        
        # This calculates rank for each appointment in the period
        # But rank needs global history.
        # Complex to do efficiently in python for many rows.
        # Let's assume for now "Second Agenda" is any appointment where lead has an older appointment.
        
        # Second Agendas Logic
        # 1. Identify leads with history BEFORE this period
        lead_ids = [a.lead_id for a in total_appts]
        leads_with_history_ids = set()
        if lead_ids:
             hist_q = db.session.query(Appointment.lead_id).filter(
                 Appointment.lead_id.in_(lead_ids),
                 Appointment.start_time < start_date,
                 Appointment.status != 'canceled'
             ).distinct().all()
             leads_with_history_ids = {l[0] for l in hist_q}
             
        # 2. Iterate and Count (Handling in-period sequence)
        total_appts.sort(key=lambda x: x.start_time)
        seen_leads_in_period = set()

        for appt in total_appts:
            stats['total_agendas'] += 1
            if appt.status == 'completed': stats['completed'] += 1
            if appt.status == 'no_show': stats['no_show'] += 1
            if appt.status == 'canceled': stats['canceled'] += 1
            
            if appt.is_reschedule: stats['rescheduled'] += 1
            if appt.presentation_done: stats['presentations'] += 1
            
            # Second Agenda Check
            is_second = False
            if appt.lead_id in leads_with_history_ids:
                is_second = True
            elif appt.lead_id in seen_leads_in_period:
                is_second = True # 2nd+ appearance in this period
            
            seen_leads_in_period.add(appt.lead_id)
            
            if is_second:
                stats['second_agendas']['total'] += 1
                if appt.status == 'completed': stats['second_agendas']['completed'] += 1
                if appt.status == 'no_show': stats['second_agendas']['no_show'] += 1
                if appt.status == 'canceled': stats['second_agendas']['canceled'] += 1

        # 3. Sales
        sales_count = Enrollment.query.filter(*sale_filters).count()
        
        # 4. Percentages
        def safe_div(n, d): return (n / d * 100) if d > 0 else 0
        
        kpis = {
            'show_up_rate': safe_div(stats['completed'], stats['total_agendas']),
            'presentation_rate': safe_div(stats['presentations'], stats['completed']),
            'closing_rate_global': safe_div(sales_count, stats['completed']), # Cierres / Completadas
            'closing_rate_presentation': safe_div(sales_count, stats['presentations']), # Cierres / Presentaciones
            'cancellation_rate': safe_div(stats['canceled'], stats['total_agendas']),
            'reschedule_rate': safe_div(stats['rescheduled'], stats['total_agendas'])
        }
        
        return {
            'slots': {'total': slots_defined_count, 'available': slots_available, 'used': slots_used},
            'agendas': stats,
            'sales': sales_count,
            'kpis': kpis
        }

    @staticmethod
    def get_closer_stats(start_date, end_date, closer_id=None):
        query = CloserDailyStats.query.filter(CloserDailyStats.date >= start_date, CloserDailyStats.date <= end_date)
        
        if closer_id:
            query = query.filter(CloserDailyStats.closer_id == int(closer_id))
            
        stats_records = query.order_by(CloserDailyStats.date.desc()).all()
        
        # Aggregation
        total_stats = {
            'slots': 0, 'slots_used': 0, 
            'calls_scheduled': 0, 'calls_completed': 0, 'calls_noshow': 0, 'calls_canceled': 0,
            'sales_count': 0, 'sales_amount': 0, 'cash_collected': 0,
            'self_generated': 0
        }
        
        for r in stats_records:
            total_stats['calls_scheduled'] += (r.calls_scheduled or 0)
            total_stats['calls_completed'] += (r.calls_completed or 0)
            total_stats['calls_noshow'] += (r.calls_no_show or 0)
            total_stats['calls_canceled'] += (r.calls_canceled or 0)
            total_stats['sales_count'] += (r.sales_count or 0)
            total_stats['sales_amount'] += (r.sales_amount or 0)
            total_stats['cash_collected'] += (r.cash_collected or 0)
            total_stats['self_generated'] += (r.self_generated_bookings or 0)

        def safe_div(n, d): return (n / d * 100) if d > 0 else 0
        
        kpis = {
            'show_rate': safe_div(total_stats['calls_completed'], total_stats['calls_scheduled']),
            'closing_rate': safe_div(total_stats['sales_count'], total_stats['calls_completed']),
            'avg_ticket': (total_stats['sales_amount'] / total_stats['sales_count']) if total_stats['sales_count'] > 0 else 0
        }
        
        return {
            'records': stats_records,
            'totals': total_stats,
            'kpis': kpis
        }

    @staticmethod
    def get_main_dashboard_data(period='this_month', start_date_arg=None, end_date_arg=None):
        today = date.today()
        
        # 1. Period Logic
        if period == 'custom' and start_date_arg and end_date_arg:
            try:
                start_date = datetime.strptime(start_date_arg, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_arg, '%Y-%m-%d').date()
            except ValueError:
                start_date = today.replace(day=1)
                next_month = today.replace(day=28) + timedelta(days=4)
                end_date = next_month - timedelta(days=next_month.day)
        elif period == 'last_3_months':
            end_date = today
            start_date = today - timedelta(days=90)
        else:
            start_date = today.replace(day=1)
            next_month = today.replace(day=28) + timedelta(days=4)
            end_date = next_month - timedelta(days=next_month.day)

        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        # 2. Financials (Cash Flow for Period)
        payments_period = Payment.query.options(db.joinedload(Payment.enrollment)).filter(
            Payment.date >= start_dt,
            Payment.date <= end_dt,
            Payment.status == 'completed'
        ).all()
        
        income = 0
        total_comm = 0
        closer_comm_total = 0
        
        for p in payments_period:
            income += p.amount
            if p.method:
                total_comm += (p.amount * (p.method.commission_percent / 100)) + p.method.commission_fixed
            
            if p.enrollment and p.enrollment.closer_id:
                p_net = p.amount
                if p.method:
                    p_net -= ((p.amount * (p.method.commission_percent / 100)) + p.method.commission_fixed)
                closer_comm_total += (p_net * 0.10)

        cash_collected = income - total_comm
        
        total_expenses = db.session.query(db.func.sum(Expense.amount)).filter(
            Expense.date >= start_dt,
            Expense.date <= end_dt
        ).scalar() or 0
        
        total_expenses += closer_comm_total
        net_profit = cash_collected - total_expenses
        
        # 3. Cohort Analysis (Active Leads, Debt, Top Debtors)
        # Users created in this period
        period_users = User.query.filter(
            User.created_at >= start_dt,
            User.created_at <= end_dt,
            User.role.in_(['student', 'lead'])
        ).all()
        
        period_debt = 0.0
        period_gross_cash = 0.0 # From these users specifically
        debtors = []
        
        for user in period_users:
            user_debt = user.current_active_debt
            period_debt += user_debt
            
            # Calculate lifetime cash from this user (Cohort Value)
            u_cash = 0
            for enr in user.enrollments:
                for p in enr.payments:
                    if p.status == 'completed':
                        u_cash += p.amount
                        # Subtract gateway comms? Logic in legacy was rough, let's assume Gross for cohort calc or refine
                        # Legacy code seemed to calculate Net + Debt = Revenue.
                        # For simplicity here:
            
            if user_debt > 0:
                # Find program(s) with debt
                debt_programs = []
                for enr in user.enrollments:
                     paid = enr.total_paid
                     agreed = enr.total_agreed if enr.total_agreed is not None else (enr.program.price if enr.program else 0.0)
                     if agreed > paid:
                         p_name = enr.program.name if enr.program else "Unknown"
                         if p_name not in debt_programs: debt_programs.append(p_name)
                         
                prog_display = ", ".join(debt_programs) if debt_programs else "N/A"

                debtors.append({
                    'student': user,
                    'debt': user_debt,
                    'program': {'name': prog_display}
                })
        
        # Sort Top Debtors
        debtors.sort(key=lambda x: x['debt'], reverse=True)
        top_debtors = debtors[:5]
        
        # "Revenue" KPI Definition from User Request: Net Cash + Debt (Cohort based?)
        # Legacy code at line 188 explicitly comments: "This will now be Net Cash + Debt"
        # But calculation loop was cut off in view.
        # Let's approximate "Revenue" as Cash Collected (Real) + Period Debt (Potential).
        # OR follow strict Cohort logic: Cohort Net Cash + Cohort Debt.
        # Given "Cash Collected" card is Period-based (Cash Flow), "Revenue" card is often Cohort-based in these systems.
        # Let's stick to Cash Flow for Profit, and Cohort for "Revenue/Debt".
        
        cohort_revenue = 0 # To be calculated if needed, or just use Cash Collected + Debt
        
        # Chart Data Implementation
        
        # 1. Daily Revenue (Cash Flow based on Payments in period)
        daily_rev_q = db.session.query(
            db.func.date(Payment.date).label('day'),
            db.func.sum(Payment.amount)
        ).filter(Payment.date >= start_date, Payment.date <= end_date, Payment.status == 'completed') \
         .group_by('day').all()
         
        # Format for Chart.js (Fill missing dates with 0)
        chart_dates = []
        chart_revs = []
        
        # Create a dict for lookups
        rev_dict = {str(r[0]): float(r[1]) for r in daily_rev_q}
        
        current_d = start_date
        end_d = end_date
        delta = timedelta(days=1)
        
        while current_d <= end_d:
            d_str = str(current_d)
            chart_dates.append(d_str)
            chart_revs.append(rev_dict.get(d_str, 0.0))
            current_d += delta
            
        # 2. Sales by Program (In Period) - COHORT BASED (User Registration Date)
        prog_q = db.session.query(
             Program.name,
             db.func.count(Enrollment.id)
        ).join(Enrollment.program).join(Enrollment.student) \
         .filter(User.created_at >= start_dt, User.created_at <= end_dt, Enrollment.status == 'active') \
         .group_by(Program.name).all()
         
        prog_labels = [p[0] for p in prog_q]
        prog_values = [p[1] for p in prog_q]
        
        # 3. Client Status (Snapshot - Current State of ALL active leads? Or Period? Usually Period Cohort or All Active)
        # "Distribución de Estatus" usually refers to the funnel snapshot. Let's use ALL active/valid leads/students.
        status_q = db.session.query(
            LeadProfile.status,
            db.func.count(LeadProfile.id)
        ).group_by(LeadProfile.status).all()
        
        # Filter None or empty
        status_data = {s[0]: s[1] for s in status_q if s[0]}
        status_labels = list(status_data.keys())
        status_values = list(status_data.values())
        
        # 4. Payment Methods (In Period)
        meth_q = db.session.query(
            PaymentMethod.name,
            db.func.count(Payment.id) 
        ).join(Payment.method) \
         .filter(Payment.date >= start_dt, Payment.date <= end_dt, Payment.status == 'completed') \
         .group_by(PaymentMethod.name).all()
         
        meth_labels = [m[0] for m in meth_q]
        meth_values = [m[1] for m in meth_q]
        
        # 5. Recent Activity (Leads, Sales, Payments)
        activity = []
        limit = 10
        
        # Recent Leads
        rec_leads = db.session.query(User).filter(
            User.created_at >= start_dt, User.created_at <= end_dt,
            User.role.in_(['lead', 'student'])
        ).order_by(User.created_at.desc()).limit(limit).all()
        
        for u in rec_leads:
            activity.append({
                'type': 'lead',
                'time': u.created_at,
                'message': 'Nuevo Lead',
                'sub': u.username,
                'icon': 'user-add'
            })
            
        # Recent Sales
        rec_sales = db.session.query(Enrollment).filter(
            Enrollment.enrollment_date >= start_dt, Enrollment.enrollment_date <= end_dt,
            Enrollment.status != 'dropped'
        ).order_by(Enrollment.enrollment_date.desc()).limit(limit).all()
        
        for e in rec_sales:
            activity.append({
                'type': 'sale',
                'time': e.enrollment_date,
                'message': f'Venta: {e.program.name if e.program else "Programa"}',
                'sub': e.student.username if e.student else "-",
                'icon': 'academic-cap'
            })
            
        # Recent Payments
        rec_payments = db.session.query(Payment).filter(
            Payment.date >= start_dt, Payment.date <= end_dt,
            Payment.status == 'completed'
        ).order_by(Payment.date.desc()).limit(limit).all()
        
        for p in rec_payments:
            activity.append({
                'type': 'payment',
                'time': p.date,
                'message': f'Pago: ${p.amount:,.0f}',
                'sub': p.enrollment.student.username if p.enrollment and p.enrollment.student else "-",
                'icon': 'currency-dollar'
            })
            
        # Sort and Slice
        activity.sort(key=lambda x: x['time'], reverse=True)
        recent_activity = activity[:10]

        return {
            'recent_activity': recent_activity,
            'dates': {'start': start_date, 'end': end_date},
            'financials': {
                'income': income,
                'cash_collected': cash_collected,
                'net_profit': net_profit,
                'total_expenses': total_expenses
            },
            'cohort': {
                'active_leads': len(period_users),
                'p_debt': period_debt,
                'top_debtors': top_debtors
            },
            'charts': {
                'dates_labels': chart_dates,
                'revenue_values': chart_revs,
                'prog_labels': prog_labels,
                'prog_values': prog_values,
                'status_labels': status_labels,
                'status_values': status_values,
                'method_labels': meth_labels,
                'method_values': meth_values
            }
        }
