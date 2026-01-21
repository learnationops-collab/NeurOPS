from app.models import User, LeadProfile, Enrollment, Appointment, Payment, PaymentMethod, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, Event, db
from app.services.dashboard_service import DashboardService
from sqlalchemy import or_
from datetime import datetime, time, timedelta, date
import pytz

class CloserService:
    @staticmethod
    def get_leads_pagination(closer_id, page=1, per_page=50, filters=None):
        """
        Retrieves paginated leads assigned to a closer with advanced filtering.
        """
        filters = filters or {}
        search = filters.get('search')
        start_date_str = filters.get('start_date')
        end_date_str = filters.get('end_date')
        program_filter = filters.get('program')
        status_filter = filters.get('status')
        sort_by = filters.get('sort_by', 'newest')

        # Base Query: Users assigned to this closer
        query = User.query.filter(User.role.in_(['lead', 'student']))
        
        query = query.filter(
            or_(
                User.enrollments.any(Enrollment.closer_id == closer_id),
                User.appointments_as_lead.any(Appointment.closer_id == closer_id),
                User.lead_profile.has(assigned_closer_id=closer_id)
            )
        )

        # Filters
        if status_filter:
            query = query.join(LeadProfile).filter(LeadProfile.status == status_filter)
        
        if program_filter:
            query = query.join(Enrollment, Enrollment.student_id == User.id).filter(Enrollment.program_id == program_filter)

        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            query = query.filter(User.created_at >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(User.created_at < end_date)

        if search:
            search_term = f"%{search}%"
            query = query.filter(or_(User.username.ilike(search_term), User.email.ilike(search_term)))

        # Sorting
        if sort_by == 'oldest':
            query = query.order_by(User.created_at.asc())
        elif sort_by == 'a-z':
            query = query.order_by(User.username.asc())
        elif sort_by == 'z-a':
            query = query.order_by(User.username.desc())
        else: # newest
            query = query.order_by(User.created_at.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return pagination

    @staticmethod
    def get_leads_kpis(closer_id, filters=None):
        """
        Calculates KPIs for leads (Total, Cash, Commission, Debt) based on filters.
        """
        filters = filters or {}
        search = filters.get('search')
        start_date_str = filters.get('start_date')
        end_date_str = filters.get('end_date')
        program_filter = filters.get('program')
        status_filter = filters.get('status')

        # Reuse similar filter logic for consistency
        def apply_lead_filters(q, model=User):
            if start_date_str: q = q.filter(model.created_at >= datetime.strptime(start_date_str, '%Y-%m-%d'))
            if end_date_str: q = q.filter(model.created_at < datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1))
            if search: q = q.filter(or_(model.username.ilike(f"%{search}%"), model.email.ilike(f"%{search}%")))
            return q

        # 1. Total Users Count (Filtered)
        kpi_query = User.query.filter(User.role.in_(['lead', 'student']))
        kpi_query = kpi_query.filter(or_(
            User.enrollments.any(Enrollment.closer_id == closer_id), 
            User.appointments_as_lead.any(Appointment.closer_id == closer_id),
            User.lead_profile.has(assigned_closer_id=closer_id)
        ))
        kpi_query = apply_lead_filters(kpi_query)
        total_users = kpi_query.count()

        # 2. Financials (Cash Collected & Commission)
        fin_query = db.session.query(db.func.sum(Payment.amount)).select_from(User).join(Enrollment, Enrollment.student_id == User.id).join(Payment).filter(
            Payment.status == 'completed',
            Enrollment.closer_id == closer_id
        )
        fin_query = apply_lead_filters(fin_query)
        if status_filter: fin_query = fin_query.join(LeadProfile).filter(LeadProfile.status == status_filter)
        if program_filter: fin_query = fin_query.filter(Enrollment.program_id == program_filter)
        
        total_revenue_gross = fin_query.scalar() or 0.0

        # Platform Fees for Net Cash
        comm_query = db.session.query(
            db.func.sum(
                (Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed
            )
        ).select_from(User).join(Enrollment, Enrollment.student_id == User.id).join(Payment).join(PaymentMethod).filter(
            Payment.status == 'completed',
            Enrollment.closer_id == closer_id
        )
        comm_query = apply_lead_filters(comm_query)
        if status_filter: comm_query = comm_query.join(LeadProfile).filter(LeadProfile.status == status_filter)
        if program_filter: comm_query = comm_query.filter(Enrollment.program_id == program_filter)
        
        platform_fees = comm_query.scalar() or 0.0
        cash_collect_net = total_revenue_gross - platform_fees
        closer_commission = cash_collect_net * 0.10

        # 3. Debt
        enr_query = db.session.query(Enrollment).join(User, Enrollment.student_id == User.id).filter(
            Enrollment.status == 'active',
            Enrollment.closer_id == closer_id
        )
        enr_query = apply_lead_filters(enr_query, model=User)
        if status_filter: enr_query = enr_query.join(LeadProfile).filter(LeadProfile.status == status_filter)
        if program_filter: enr_query = enr_query.filter(Enrollment.program_id == program_filter)
        
        active_enrollments = enr_query.all()
        total_debt = 0.0
        for enr in active_enrollments:
            paid = enr.total_paid
            agreed = enr.total_agreed if enr.total_agreed is not None else (enr.program.price if enr.program else 0.0)
            debt = agreed - paid
            if debt > 0:
                total_debt += debt

        return {
            'total': total_users,
            'cash_collected': cash_collect_net,
            'my_commission': closer_commission,
            'debt': total_debt
        }

    @staticmethod
    def get_dashboard_data(closer_id, timezone_name='America/La_Paz'):
        """
        Calculates all data needed for the Closer Dashboard.
        """
        try:
            user_tz = pytz.timezone(timezone_name)
        except:
            user_tz = pytz.timezone('America/La_Paz')
            
        now_local = datetime.now(user_tz)
        today_local = now_local.date()
        
        start_local = user_tz.localize(datetime.combine(today_local, time.min))
        end_local = user_tz.localize(datetime.combine(today_local, time.max))
        
        start_utc = start_local.astimezone(pytz.UTC).replace(tzinfo=None)
        end_utc = end_local.astimezone(pytz.UTC).replace(tzinfo=None)
        
        # 1. KPIs Today
        # Use centralized logic for activity metrics (Consistency)
        detailed_metrics = DashboardService.get_detailed_closer_metrics(start_utc, end_utc, closer_id)
        
        # Activity from Detailed Metrics
        agendas = detailed_metrics['agendas']
        first = agendas['first_agendas']
        second = agendas['second_agendas']
        
        kpi_scheduled = agendas['total_agendas']
        kpi_completed = first['completed'] + second['completed']
        kpi_no_show = first['no_show'] + second['no_show']
        kpi_canceled = first['canceled'] + second['canceled']
        
        # New Detailed Metrics
        kpi_presentations = agendas['presentations']
        kpi_reschedules = first['rescheduled'] + second['rescheduled']
        
        sec_agendas = second
        kpi_second_agendas_total = sec_agendas['total']
        kpi_second_agendas_completed = sec_agendas['completed']
        kpi_second_agendas_noshow = sec_agendas['no_show']
        kpi_second_agendas_canceled = sec_agendas['canceled']
        
        # Sales Count from Detailed (Verify consistency?)
        # detailed_metrics['sales'] is count.
        
        # Financials (Amount/Cash) - Keep separate or enhance Service later. Keeping local for now to ensure we get specific "New Enrollments Today" logic correct.
        # (Service uses Enrollment date logic too, so it matches).
        
        # Sales Count & Amount (New Enrollments Today)
        new_enrollments = Enrollment.query.filter(
            Enrollment.closer_id == closer_id,
            Enrollment.enrollment_date >= start_utc,
            Enrollment.enrollment_date <= end_utc,
            Enrollment.status != 'dropped'
        ).all()
        
        kpi_sales_count = len(new_enrollments)
        kpi_sales_amount = sum(e.total_agreed for e in new_enrollments)
        
        # Cash Collected Today (Payments Today)
        payments_today = Payment.query.join(Enrollment).filter(
            Enrollment.closer_id == closer_id,
            Payment.date >= start_utc,
            Payment.date <= end_utc,
            Payment.status == 'completed'
        ).all()
        kpi_cash_collected = sum(p.amount for p in payments_today)
        
        # Calculated Rates
        kpi_show_rate = detailed_metrics['kpis']['show_up_rate']
        kpi_closing_rate = detailed_metrics['kpis']['closing_rate_global']
        kpi_avg_ticket = (kpi_sales_amount / kpi_sales_count) if kpi_sales_count > 0 else 0
        
        # Additional Rates
        kpi_presentation_rate = detailed_metrics['kpis']['presentation_rate']
        kpi_closing_on_pres = detailed_metrics['kpis']['closing_rate_presentation']
        
        # 2. Commissions & Monthly Rates
        month_start_local = user_tz.localize(datetime(today_local.year, today_local.month, 1))
        month_start_utc = month_start_local.astimezone(pytz.UTC).replace(tzinfo=None)
        
        def calculate_commission(start_dt, end_dt):
            gross_cash = db.session.query(db.func.sum(Payment.amount)).select_from(Enrollment).join(Payment).filter(
                Enrollment.closer_id == closer_id,
                Payment.status == 'completed',
                Payment.date >= start_dt,
                Payment.date <= end_dt
            ).scalar() or 0.0
            
            fees = db.session.query(
                db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)
            ).select_from(Enrollment).join(Payment).join(PaymentMethod).filter(
                 Enrollment.closer_id == closer_id,
                 Payment.status == 'completed',
                 Payment.date >= start_dt,
                 Payment.date <= end_dt
            ).scalar() or 0.0
            
            return (gross_cash - fees) * 0.10

        commission_month = calculate_commission(month_start_utc, end_utc)
        commission_today = calculate_commission(start_utc, end_utc)
        
        def calculate_closing_rate(start_dt, end_dt):
            completed_appts = Appointment.query.filter(
                Appointment.closer_id == closer_id,
                Appointment.start_time >= start_dt,
                Appointment.start_time <= end_dt,
                Appointment.status == 'completed'
            ).count()
            
            sales = Enrollment.query.filter(
                Enrollment.closer_id == closer_id,
                Enrollment.enrollment_date >= start_dt,
                Enrollment.enrollment_date <= end_dt,
                Enrollment.status != 'dropped'
            ).count()
            
            return (sales / completed_appts * 100) if completed_appts > 0 else 0

        closing_rate_month = calculate_closing_rate(month_start_utc, end_utc)
        
        # 3. Daily Progress
        total_agendas_query = Appointment.query.filter(
            Appointment.closer_id == closer_id,
            Appointment.start_time >= start_utc,
            Appointment.start_time <= end_utc
        )
        total_agendas = total_agendas_query.count()
        processed_agendas = total_agendas_query.filter(Appointment.status.in_(['completed', 'no_show', 'canceled'])).count()
        
        today_stats = CloserDailyStats.query.filter_by(closer_id=closer_id, date=today_local).first()
        report_done = 1 if today_stats else 0
        
        total_steps = total_agendas + 1
        completed_steps = processed_agendas + report_done
        daily_progress = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
        # 4. Lists
        from sqlalchemy.orm import aliased
        
        # Sequence Number Subquery
        ApptPrev = aliased(Appointment)
        seq_subq = db.session.query(db.func.count(ApptPrev.id)).filter(
            ApptPrev.lead_id == Appointment.lead_id,
            ApptPrev.start_time <= Appointment.start_time
        ).correlate(Appointment).label('seq_num')
        
        upcoming_agendas = db.session.query(Appointment, seq_subq).filter(
            Appointment.closer_id == closer_id,
            Appointment.start_time >= start_utc,
            Appointment.start_time <= end_utc,
            Appointment.status == 'scheduled'
        ).order_by(Appointment.start_time.asc()).limit(20).all()

        recent_clients = User.query.filter(User.role.in_(['lead', 'student'])).filter(
            or_(
                User.enrollments.any(Enrollment.closer_id == closer_id),
                User.appointments_as_lead.any(Appointment.closer_id == closer_id),
                User.lead_profile.has(assigned_closer_id=closer_id)
            )
        ).order_by(User.created_at.desc()).limit(15).all()

        return {
            'kpis': {
                'scheduled': kpi_scheduled,
                'completed': kpi_completed,
                'no_show': kpi_no_show,
                'canceled': kpi_canceled,
                'sales_count': kpi_sales_count,
                'sales_amount': kpi_sales_amount,
                'cash_collected': kpi_cash_collected,
                'show_rate': kpi_show_rate,
                'closing_rate': kpi_closing_rate,
                'avg_ticket': kpi_avg_ticket,
                'presentations': kpi_presentations,
                'reschedules': kpi_reschedules,
                'second_agendas': kpi_second_agendas_total,
                'second_agendas_completed': kpi_second_agendas_completed,
                'second_agendas_noshow': kpi_second_agendas_noshow,
                'second_agendas_canceled': kpi_second_agendas_canceled,
                'closing_rate_pres': kpi_closing_on_pres
            },
            'commission': {
                'month': commission_month,
                'today': commission_today
            },
            'rates': {
                'closing_month': closing_rate_month,
                'closing_today': kpi_closing_rate
            },
            'progress': daily_progress,
            'upcoming_agendas': upcoming_agendas,
            'recent_clients': recent_clients,
            'today_stats': today_stats,
            'dates': {
                'today_local': today_local,
                'start_utc': start_utc
            }
        }
