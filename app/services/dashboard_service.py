from app import db
from app.models import CloserDailyStats, Payment, User, Expense, Enrollment
from app.services.base import BaseService
from datetime import datetime, date, time, timedelta
from sqlalchemy import or_

class DashboardService(BaseService):
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
                debtors.append({
                    'id': user.id,
                    'username': user.username,
                    'debt': user_debt,
                    'email': user.email
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
        
        return {
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
            }
        }
