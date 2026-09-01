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
        
        if closer_id:
            appt_filters.append(Appointment.closer_id == closer_id)
            avail_filters.append(Availability.closer_id == closer_id)
            
        slots_defined_count = Availability.query.filter(*avail_filters).count()
        total_appts = Appointment.query.filter(*appt_filters).all()
        
        slots_used = len(total_appts)
        slots_available = max(0, slots_defined_count - slots_used)
        
        # Estructura de estadísticas base
        def empty_bucket():
            return {
                'total': 0, 
                'completed': 0, 
                'no_show': 0, 
                'canceled': 0, 
                'rescheduled': 0, 
                'scheduled': 0, 
                'confirmed': 0,
                'pending': 0 # Combinación de scheduled y confirmed
            }

        stats = {
            'total_agendas': empty_bucket(),
            'first_agendas': empty_bucket(),
            'second_agendas': empty_bucket(),
            'presentations': 0
        }
        
        def update_bucket(bucket, status):
            bucket['total'] += 1
            if status == 'completed': bucket['completed'] += 1
            elif status == 'no_show': bucket['no_show'] += 1
            elif status == 'canceled': bucket['canceled'] += 1
            elif status in ['rescheduled', 'reprogrammed']: bucket['rescheduled'] += 1
            elif status == 'scheduled': 
                bucket['scheduled'] += 1
                bucket['pending'] += 1
            elif status == 'confirmed': 
                bucket['confirmed'] += 1
                bucket['pending'] += 1
            else:
                # Manejar estados desconocidos como pendientes
                bucket['pending'] += 1
        
        def get_mapped_status(appt):
            """BUG real encontrado (31/ago/2026): esto leía `Appointment.result` — el estado de
            CONFIRMACIÓN (Pendiente/Confirmado/Cancelado/...) — buscando además valores viejos
            que ya no se escriben ('Terminada', 'No Show', 'Cancelada', 'Reprogramada') en vez de
            los actuales. El resultado REAL de la llamada de ventas vive en `closer_result`
            (Show up/No show/Cancelado/Reagendado), un campo aparte a propósito — confirmación y
            agenda son dos pasos distintos del embudo y no deben mezclarse (reportado por el
            usuario: "el show up no es muy real"). Con el campo viejo, `result == 'Terminada'`
            (la confirmación terminó, no dice nada de si asistió) marcaba como "completed" el
            72% de las citas reales, contra el ~16% real que sí tiene `closer_result == 'Show up'`
            — un show up rate inflado sin relación con la asistencia real.

            Ahora se lee primero el resultado real de la llamada; si la cita nunca llegó a
            evaluarse (sigue 'Pendiente' o fue archivada como 'Lead Perdido' sin haberse
            confirmado nunca), se cae al estado de confirmación para no perder esas filas."""
            cr = (appt.closer_result or '').strip().lower()
            if cr == 'show up':
                return 'completed'
            if cr == 'no show':
                return 'no_show'
            if cr in ('cancelado', 'cancelada'):
                return 'canceled'
            if cr in ('reagendado', 'reagendada'):
                return 'rescheduled'

            res = (appt.result or '').strip().lower()
            if res == 'cancelado' or res == 'cancelada':
                return 'canceled'
            if res in ('reagendado', 'reagendada', 'reprogramada', 'reprogramar'):
                return 'rescheduled'
            if res == 'confirmado':
                return 'confirmed'
            return 'scheduled'

        for appt in total_appts:
            status = get_mapped_status(appt)
            update_bucket(stats['total_agendas'], status)
            if status == 'completed':
                stats['presentations'] += 1
                
            # Todo se agrupa en 'Agendas' ya que no usamos tipo
            update_bucket(stats['first_agendas'], status)

        # Conteo de Ventas (Enrollments con pago completado)
        sale_q = Enrollment.query.join(Payment).filter(
            Enrollment.enrollment_date >= start_date, 
            Enrollment.enrollment_date <= end_date,
            Payment.status == 'completed'
        )
        if closer_id:
            sale_q = sale_q.filter(Enrollment.closer_id == closer_id)
        
        sales_count = sale_q.distinct().count()
        
        def safe_div(n, d): return (n / d * 100) if d > 0 else 0
        
        m = stats['total_agendas']
        total_shows = m['completed'] + m['no_show'] # Asistencias reales + faltas
        
        # Financials
        cash_q = db.session.query(func.sum(Payment.amount)).join(Enrollment).filter(
            Payment.date >= start_date, 
            Payment.date <= end_date,
            Payment.status == 'completed'
        )
        if closer_id:
            cash_q = cash_q.filter(Enrollment.closer_id == closer_id)
            
        cash_collected = cash_q.scalar() or 0.0
        average_ticket = (cash_collected / sales_count) if sales_count > 0 else 0.0

        kpis = {
            'closing_rate': safe_div(sales_count, m['completed']), 
            'closing_rate_presentation': safe_div(sales_count, m['completed']),
            'conversion_rate': safe_div(sales_count, m['total']), 
            'closing_rate_global': safe_div(sales_count, m['total']),
            'attendance_rate': safe_div(m['completed'], (m['completed'] + m['no_show'] + m['canceled'])), 
            'show_up_rate': safe_div(m['completed'], (m['completed'] + m['no_show'] + m['canceled'])),
            'cancellation_rate': safe_div(m['canceled'], m['total']),
            'rescheduling_rate': safe_div(m['rescheduled'], m['total']),
            'no_show_rate': safe_div(m['no_show'], m['total'])
        }
        
        return {
            'slots': {'total': slots_defined_count, 'available': slots_available, 'used': slots_used},
            'agendas': stats,
            'sales': sales_count,
            'financials': {
                'cash_collected': float(cash_collected),
                'average_ticket': float(average_ticket)
            },
            'kpis': kpis
        }

    @staticmethod
    def get_detailed_setter_metrics(start_date, end_date, setter_id=None):
        from app.models import SetterDailyStats
        if isinstance(start_date, date): start_date = datetime.combine(start_date, time.min)
        if isinstance(end_date, date): end_date = datetime.combine(end_date, time.max)
        
        query = db.session.query(
            func.sum(SetterDailyStats.not_lead).label('not_lead'),
            func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
            func.sum(SetterDailyStats.stage_1_value).label('s1'),
            func.sum(SetterDailyStats.stage_2_value).label('s2'),
            func.sum(SetterDailyStats.stage_3_value).label('s3'),
            func.sum(SetterDailyStats.stage_4_value).label('s4'),
            func.sum(SetterDailyStats.stage_5_value).label('s5'),
            func.sum(SetterDailyStats.qualification_fu + SetterDailyStats.pain_fu + SetterDailyStats.offer_fu + SetterDailyStats.link_fu + SetterDailyStats.agenda_fu).label('tfu_s'),
            func.sum(SetterDailyStats.qualification_fur + SetterDailyStats.pain_fur + SetterDailyStats.offer_fur + SetterDailyStats.link_fur + SetterDailyStats.agenda_fur).label('tfu_r'),
            func.count(SetterDailyStats.id).label('report_count')
        ).filter(SetterDailyStats.date >= start_date.date(), SetterDailyStats.date <= end_date.date())
        
        if setter_id:
            query = query.filter(SetterDailyStats.setter_id == setter_id)
            
        res = query.first()
        
        def safe_div(n, d): return (n / d * 100) if d > 0 else 0
        
        # We need the stage names to be dynamic
        from app.api.setter import _get_setter_stages_ordered
        db_stages = _get_setter_stages_ordered()
        
        # Create a dynamic stages list with actual names
        stages_output = []
        stage_values = [res.s1, res.s2, res.s3, res.s4, res.s5]
        
        for i, db_stage in enumerate(db_stages[:5]):
            stages_output.append({
                "id": db_stage.id,
                "name": db_stage.name,
                "value": int(stage_values[i] or 0)
            })
            
        inbound = int(res.entrantes or 0)
        not_lead = int(res.not_lead or 0)
        qualification = int(res.s1 or 0)
        qualified = max(0, qualification - not_lead)
        
        return {
            'stats': {
                'inbound_leads': inbound,
                'not_lead': not_lead,
                'qualified_leads': qualified,
                'no_response': max(0, inbound - qualification)
            },
            'stages': stages_output,
            'kpis': {
                'conversion_rate': safe_div(float(int(res.s4 or 0)), float(inbound)),
                'opening_rate': safe_div(float(qualified), float(inbound)),
                'fu_response_rate': safe_div(float(int(res.tfu_r or 0)), float(int(res.tfu_s or 0)))
            },
            'count': int(res.report_count or 0)
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
        elif period == 'last_7_days':
            start_date = today - timedelta(days=6) # 7 days including today
            end_date = today
        elif period == 'last_14_days':
            start_date = today - timedelta(days=13)
            end_date = today
        elif period == 'last_3_weeks':
            start_date = today - timedelta(weeks=3)
            end_date = today
        elif period == 'last_4_weeks':
            start_date = today - timedelta(weeks=4)
            end_date = today
        elif period == 'last_1_month':
            # Simply 30 days for graph consistency or actual calendar month? 
            # Usually for graphs "1m" means last 30 days.
            start_date = today - timedelta(days=30)
            end_date = today
        elif period == 'last_3_months':
            start_date = today - timedelta(days=90)
            end_date = today
        elif period == 'last_4_months':
            start_date = today - timedelta(days=120)
            end_date = today
        elif period == 'last_6_months':
            start_date = today - timedelta(days=180)
            end_date = today
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
        elif period == 'today':
            start_date = today
            end_date = today
        elif period == 'yesterday':
            start_date = today - timedelta(days=1)
            end_date = today - timedelta(days=1)
        else:
            # this_month
            start_date = today.replace(day=1)
            end_date = today
            
        return start_date, end_date

    @staticmethod
    def get_dashboard_kpis(period='this_month', start_date_arg=None, end_date_arg=None, closer_ids=None, program_ids=None):
        start_date, end_date = DashboardService._get_date_range(period, start_date_arg, end_date_arg)
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        # Base filters
        payment_filters = [Payment.date >= start_dt, Payment.date <= end_dt, Payment.status == 'completed']
        expense_filters = [Expense.date >= start_dt, Expense.date <= end_dt] # Expense usually doesn't have closer/program? Maybe Closer specific expenses?
        client_filters = [Client.created_at >= start_dt, Client.created_at <= end_dt] # Filtering cohort by closer/program is tricky.
        
        # If filtering by closer/program, we need joins.
        
        # 1. Financials: Join Enrollment for IDs
        if closer_ids or program_ids:
            payment_q = Payment.query.join(Enrollment).filter(Payment.date >= start_dt, Payment.date <= end_dt, Payment.status == 'completed')
            if closer_ids: payment_q = payment_q.filter(Enrollment.closer_id.in_(closer_ids))
            if program_ids: payment_q = payment_q.filter(Enrollment.program_id.in_(program_ids))
            payments = payment_q.all()
            
            # Gross Revenue & Enrollments count
            enrollment_q = Enrollment.query.filter(Enrollment.enrollment_date >= start_dt, Enrollment.enrollment_date <= end_dt)
            if closer_ids: enrollment_q = enrollment_q.filter(Enrollment.closer_id.in_(closer_ids))
            if program_ids: enrollment_q = enrollment_q.filter(Enrollment.program_id.in_(program_ids))
            enrollments = enrollment_q.all()

            total_expenses = 0 
        else:
            payments = Payment.query.filter(*payment_filters).all()
            total_expenses = db.session.query(func.sum(Expense.amount)).filter(Expense.date >= start_dt, Expense.date <= end_dt).scalar() or 0
            enrollments = Enrollment.query.filter(Enrollment.enrollment_date >= start_dt, Enrollment.enrollment_date <= end_dt).all()

        income = sum(p.amount for p in payments)
        total_comm = 0
        closer_commission_total = 0
        
        # Calculate fees and commissions
        for p in payments:
            if p.method:
                total_comm += (p.amount * (p.method.commission_percent / 100) + p.method.commission_fixed)
            
            # Closer Commissions (10% of net after payment fee)
            if p.enrollment and p.enrollment.closer_id:
                p_amount = p.amount
                if p.method:
                    p_fee = (p.amount * (p.method.commission_percent / 100)) + p.method.commission_fixed
                    p_amount -= p_fee
                closer_commission_total += (p_amount * 0.10)

        # Revenue Calculation (Potential)
        gross_revenue_value = sum(e.program.price for e in enrollments if e.program)
        enrollments_count = len(enrollments)
        
        # Total Expenses = Plain Expenses + Closer Commissions
        total_expenses_with_commissions = total_expenses + closer_commission_total
        net_profit = (income - total_comm) - total_expenses_with_commissions
        
        # 2. Agendas count
        appt_q = Appointment.query.filter(Appointment.start_time >= start_dt, Appointment.start_time <= end_dt)
        if closer_ids: appt_q = appt_q.filter(Appointment.closer_id.in_(closer_ids))
        agendas_count = appt_q.count()

        # 3. Cohort & Debt Calculation
        active_leads_count = Client.query.filter(Client.created_at >= start_dt, Client.created_at <= end_dt).count()
        
        # Debt Query with Filters
        query_debt_bs = db.session.query(
            func.sum(Program.price),
            Enrollment.id
        ).select_from(Client)\
         .join(Enrollment, Client.enrollments)\
         .join(Program, Enrollment.program)\
         .filter(Client.created_at >= start_dt, Client.created_at <= end_dt)
         
        if closer_ids: query_debt_bs = query_debt_bs.filter(Enrollment.closer_id.in_(closer_ids))
        if program_ids: query_debt_bs = query_debt_bs.filter(Enrollment.program_id.in_(program_ids))
            
        relevant_enrollments = query_debt_bs.group_by(Enrollment.id).all() 
        
        period_debt = 0.0
        if relevant_enrollments:
            e_ids = [r[1] for r in relevant_enrollments]
            prices = {r[1]: r[0] for r in relevant_enrollments}
            paid_q = db.session.query(Payment.enrollment_id, func.sum(Payment.amount))\
                .filter(Payment.enrollment_id.in_(e_ids), Payment.status == 'completed')\
                .group_by(Payment.enrollment_id).all()
            paid_map = {r[0]: r[1] for r in paid_q}
            for eid, price in prices.items():
                paid = paid_map.get(eid, 0)
                period_debt += max(0, price - paid)

        # 4. Average Ticket (Ticket Promedio)
        # Promedio de inscripciones: Tipos de pago "Completo" y "Primer pago"
        # Calculation: Average amount of initial payments made in this period
        # We need to filter payments by type
        
        initial_payments_q = Payment.query.filter(
            Payment.date >= start_dt, 
            Payment.date <= end_dt, 
            Payment.status == 'completed',
            Payment.payment_type.in_(['Completo', 'Pago Completo', 'Primer pago', 'Primer Pago'])
        )
        if closer_ids:
            initial_payments_q = initial_payments_q.join(Enrollment).filter(Enrollment.closer_id.in_(closer_ids))
        if program_ids:
            # If not joined yet
            if not closer_ids: initial_payments_q = initial_payments_q.join(Enrollment)
            initial_payments_q = initial_payments_q.filter(Enrollment.program_id.in_(program_ids))
            
        initial_payments = initial_payments_q.all()
        
        total_initial_amount = sum(p.amount for p in initial_payments)
        count_initial = len(initial_payments)
        average_ticket = (total_initial_amount / count_initial) if count_initial > 0 else 0.0

        return {
            'financials': {
                'income': income, 
                'gross_revenue': gross_revenue_value,
                'enrollments_count': enrollments_count,
                'cash_collected': income - total_comm, 
                'total_fees': total_comm,
                'net_profit': net_profit, 
                'total_expenses': total_expenses_with_commissions,
                'pending_revenue': float(period_debt), # Dinero pendiente según ese Revenue
                'average_ticket': average_ticket
            },
            'cohort': {
                'active_leads': active_leads_count,
                'p_debt': float(period_debt)
            },
            'agendas': {
                'count': agendas_count
            },
            'dates': {'start': start_date.isoformat(), 'end': end_date.isoformat()}
        }

    @staticmethod
    def get_dashboard_charts(period='this_month', start_date_arg=None, end_date_arg=None, closer_ids=None, program_ids=None):
        start_date, end_date = DashboardService._get_date_range(period, start_date_arg, end_date_arg)
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        # 1. Revenue, Agendas & Sales
        # Revenue
        rev_q = db.session.query(func.date(Payment.date), func.sum(Payment.amount)).join(Enrollment).filter(
            Payment.date >= start_dt, Payment.date <= end_dt, Payment.status == 'completed'
        )
        if closer_ids: rev_q = rev_q.filter(Enrollment.closer_id.in_(closer_ids))
        if program_ids: rev_q = rev_q.filter(Enrollment.program_id.in_(program_ids))
        
        daily_rev_q = rev_q.group_by(func.date(Payment.date)).all()
        rev_dict = {str(r[0]): float(r[1]) for r in daily_rev_q}

        # Sales
        sales_q = db.session.query(func.date(Enrollment.enrollment_date), func.count(Enrollment.id)).join(Payment, Enrollment.payments).filter(
            Enrollment.enrollment_date >= start_dt, Enrollment.enrollment_date <= end_dt, Payment.status == 'completed'
        )
        if closer_ids: sales_q = sales_q.filter(Enrollment.closer_id.in_(closer_ids))
        if program_ids: sales_q = sales_q.filter(Enrollment.program_id.in_(program_ids))
        
        daily_sales_q = sales_q.group_by(func.date(Enrollment.enrollment_date)).all()
        sales_dict = {str(r[0]): int(r[1]) for r in daily_sales_q}

        # Agendas
        appt_q = db.session.query(func.date(Appointment.start_time), func.count(Appointment.id)).filter(
            Appointment.start_time >= start_dt, Appointment.start_time <= end_dt
        )
        if closer_ids: appt_q = appt_q.filter(Appointment.closer_id.in_(closer_ids))
        
        if program_ids:
            agendas_dict = {} 
        else:
            daily_agendas_q = appt_q.group_by(func.date(Appointment.start_time)).all()
            agendas_dict = {str(r[0]): int(r[1]) for r in daily_agendas_q}

        chart_dates = []
        chart_revs = []
        chart_agendas = []
        chart_sales = []
        
        curr = start_date
        while curr <= end_date:
            d_str = str(curr)
            chart_dates.append(d_str)
            chart_revs.append(rev_dict.get(d_str, 0.0))
            chart_agendas.append(agendas_dict.get(d_str, 0))
            chart_sales.append(sales_dict.get(d_str, 0))
            curr += timedelta(days=1)

        # 2. Agenda Status Breakdown (Usando result)
        status_q = db.session.query(Appointment.result, func.count(Appointment.id)).filter(
            Appointment.start_time >= start_dt, Appointment.start_time <= end_dt
        )
        if closer_ids: status_q = status_q.filter(Appointment.closer_id.in_(closer_ids))
        res_status_raw = status_q.group_by(Appointment.result).all()
        
        # Mapeo de nombres para el gráfico
        mapped_labels = []
        mapped_values = []
        for res, count in res_status_raw:
            label = res if res else 'Agendada'
            mapped_labels.append(label)
            mapped_values.append(count)
            
        stats_status = (mapped_labels, mapped_values)
        
        # 3. Programs Breakdown
        prog_q = db.session.query(Program.name, func.count(Enrollment.id)).join(Program).filter(
            Enrollment.enrollment_date >= start_dt, Enrollment.enrollment_date <= end_dt
        )
        if closer_ids: prog_q = prog_q.filter(Enrollment.closer_id.in_(closer_ids))
        if program_ids: prog_q = prog_q.filter(Enrollment.program_id.in_(program_ids))
        
        res_prog = prog_q.group_by(Program.name).all()

        return {
            'dates_labels': chart_dates, 
            'revenue_values': chart_revs, 
            'agendas_values': chart_agendas,
            'sales_values': chart_sales,
            'status_labels': stats_status[0], 
            'status_values': stats_status[1],
            'program_labels': [r[0] for r in res_prog],
            'program_values': [r[1] for r in res_prog]
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
        
    @staticmethod
    def get_revenue_chart_data(period='this_month', granularity='day', group_by='program', metric='amount', start_date_arg=None, end_date_arg=None, closer_ids=None, program_ids=None):
        start_date, end_date = DashboardService._get_date_range(period, start_date_arg, end_date_arg)
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        # Query Basic Data
        # We need to join everything possibly needed: Enrollment -> Closer(User), Payment -> PaymentMethod
        query = db.session.query(
            Payment.amount,
            Payment.date,
            Program.name,
            Payment.payment_type,
            User.username, # Closer
            PaymentMethod.name # Method
        ).select_from(Payment).join(Enrollment).join(Program).outerjoin(User, Enrollment.closer_id == User.id)\
         .outerjoin(PaymentMethod, Payment.payment_method_id == PaymentMethod.id)\
         .filter(
            Payment.date >= start_dt,
            Payment.date <= end_dt,
            Payment.status == 'completed'
        )
        
        if closer_ids:
            query = query.filter(Enrollment.closer_id.in_(closer_ids))
        if program_ids:
            query = query.filter(Enrollment.program_id.in_(program_ids))
            
        results = query.all()
        print(f"DEBUG CHART: period={period} start={start_dt} end={end_dt} count={len(results)}")
        
        # Structure: Map[TimeLabel][StackKey] = Amount/Count
        data_map = {}
        stack_keys = set()
        
        def get_time_key(dt):
            if granularity == 'day':
                return dt.strftime('%Y-%m-%d')
            elif granularity == 'week':
                return dt.strftime('%Y-W%U')
            elif granularity == 'month':
                return dt.strftime('%Y-%m')
            return dt.strftime('%Y-%m-%d')

        for amount, p_date, prog_name, p_type, closer_name, method_name in results:
            t_key = get_time_key(p_date)
            
            if group_by == 'program':
                s_key = prog_name
            elif group_by == 'payment_type':
                s_key = p_type or 'Desconocido'
            elif group_by == 'closer':
                s_key = closer_name or 'Sin Closer'
            elif group_by == 'payment_method':
                s_key = method_name or 'N/A'
            else:
                s_key = 'Total'
                
            stack_keys.add(s_key)
            
            val_to_add = amount if metric == 'amount' else 1
            
            if t_key not in data_map: data_map[t_key] = {}
            data_map[t_key][s_key] = data_map[t_key].get(s_key, 0.0) + val_to_add
            
        # Generate complete timeline labels (fill gaps with 0 if needed? ChartJS mostly handles it if we provide sorted labels)
        # But cleaner if we have continuous axis.
        # Generating date range list
        labels = []
        curr = start_date
        while curr <= end_date:
            dt = datetime.combine(curr, time.min)
            l = get_time_key(dt)
            if not labels or labels[-1] != l:
                labels.append(l)
            
            # Step increment
            if granularity == 'day':
                curr += timedelta(days=1)
            elif granularity == 'week':
                curr += timedelta(days=7) # Approximate
            elif granularity == 'month':
                 # Next month first day
                 if curr.month == 12:
                     curr = curr.replace(year=curr.year+1, month=1, day=1)
                 else:
                     curr = curr.replace(month=curr.month+1, day=1)
        
        # Ensure all generated labels are in data_map (even empty ones)
        # Actually, iterating day by day for 'week' might skip if start date is not week start.
        # Better: use the keys present in data_map + sort them + gap fill?
        # Or just use the sorted keys from data_map if gaps are okay.
        # Let's use sorted keys from data_map for simplicity in first iteration, 
        # but ChartJS line/bar looks better with continuous axis.
        # Re-using the labels list generated above is safer for consistency.
        
        # Align data
        datasets = []
        # Fixed colors usually needed? Or random?
        # Let's define a palette or let frontend handle colors?
        # Backend returning raw structs is better.
        
        sorted_stack_keys = sorted(list(stack_keys))
        
        for key in sorted_stack_keys:
            ds_data = []
            for l in labels:
                val = data_map.get(l, {}).get(key, 0.0)
                ds_data.append(val)
            
            datasets.append({
                'label': key,
                'data': ds_data
            })
            
        return {
            'labels': labels,
            'datasets': datasets
        }

