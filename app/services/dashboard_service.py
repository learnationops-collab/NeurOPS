from app import db
from app.models import CloserDailyStats, Payment, User, Expense, Enrollment, Program, PaymentMethod, Client, Appointment, Availability
from app.services.base import BaseService
from datetime import datetime, date, time, timedelta
from sqlalchemy import or_

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

        sales_count = Enrollment.query.filter(*sale_filters).count()
        
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

    @staticmethod
    def get_main_dashboard_data(period='this_month', start_date_arg=None, end_date_arg=None):
        today = date.today()
        if period == 'custom' and start_date_arg and end_date_arg:
            try:
                start_date = datetime.strptime(start_date_arg, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_arg, '%Y-%m-%d').date()
            except ValueError:
                start_date = today.replace(day=1)
                end_date = today
        else:
            start_date = today.replace(day=1)
            end_date = today

        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        payments = Payment.query.filter(Payment.date >= start_dt, Payment.date <= end_dt, Payment.status == 'completed').all()
        income = sum(p.amount for p in payments)
        total_comm = sum((p.amount * (p.method.commission_percent / 100) + p.method.commission_fixed) for p in payments if p.method)
        
        total_expenses = db.session.query(db.func.sum(Expense.amount)).filter(Expense.date >= start_dt, Expense.date <= end_dt).scalar() or 0
        net_profit = (income - total_comm) - total_expenses
        
        # Debt calculation
        period_clients = Client.query.filter(Client.created_at >= start_dt, Client.created_at <= end_dt).all()
        period_debt = 0.0
        top_debtors_list = []
        
        for c in period_clients:
            c_debt = 0.0
            for enr in c.enrollments:
                debt = (enr.program.price if enr.program else 0.0) - enr.total_paid
                if debt > 0: c_debt += debt
            if c_debt > 0:
                period_debt += c_debt
                top_debtors_list.append({'student': c, 'debt': c_debt})
        
        top_debtors = sorted(top_debtors_list, key=lambda x: x['debt'], reverse=True)[:5]

        # Charts
        daily_rev_q = db.session.query(db.func.date(Payment.date), db.func.sum(Payment.amount)).filter(
            Payment.date >= start_dt, Payment.date <= end_dt, Payment.status == 'completed'
        ).group_by(db.func.date(Payment.date)).all()
        
        rev_dict = {str(r[0]): float(r[1]) for r in daily_rev_q}
        chart_dates, chart_revs = [], []
        curr = start_date
        while curr <= end_date:
            d_str = str(curr)
            chart_dates.append(d_str)
            chart_revs.append(rev_dict.get(d_str, 0.0))
            curr += timedelta(days=1)

        activity = []
        rec_clients = Client.query.order_by(Client.created_at.desc()).limit(5).all()
        for c in rec_clients:
            activity.append({'type': 'lead', 'time': c.created_at, 'message': 'Nuevo Lead', 'sub': c.full_name or c.email})
        
        rec_payments = Payment.query.join(Enrollment).join(Client).filter(Payment.status == 'completed').order_by(Payment.date.desc()).limit(5).all()
        for p in rec_payments:
            activity.append({'type': 'payment', 'time': p.date, 'message': f'Pago: ${p.amount:,.0f}', 'sub': p.enrollment.client.full_name or p.enrollment.client.email})

        activity.sort(key=lambda x: x['time'], reverse=True)

        return {
            'recent_activity': activity[:10],
            'dates': {'start': start_date, 'end': end_date},
            'financials': {'income': income, 'cash_collected': income - total_comm, 'net_profit': net_profit, 'total_expenses': total_expenses},
            'cohort': {'active_leads': len(period_clients), 'p_debt': period_debt, 'top_debtors': top_debtors},
            'charts': {'dates_labels': chart_dates, 'revenue_values': chart_revs, 'status_labels': [], 'status_values': []}
        }
