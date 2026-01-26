from app.models import User, Client, Enrollment, Appointment, Payment, PaymentMethod, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, Event, db
from app.services.dashboard_service import DashboardService
from sqlalchemy import or_
from datetime import datetime, time, timedelta, date
import pytz

class CloserService:
    @staticmethod
    def get_leads_pagination(closer_id, page=1, per_page=50, filters=None):
        filters = filters or {}
        search = filters.get('search')
        start_date_str = filters.get('start_date')
        end_date_str = filters.get('end_date')
        program_filter = filters.get('program')
        sort_by = filters.get('sort_by', 'newest')

        query = Client.query
        
        from flask_login import current_user
        if current_user.role != 'admin':
            query = query.filter(
                or_(
                    Client.enrollments.any(Enrollment.closer_id == closer_id),
                    Client.appointments.any(Appointment.closer_id == closer_id)
                )
            )
        
        if program_filter:
            query = query.join(Enrollment).filter(Enrollment.program_id == program_filter)

        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            query = query.filter(Client.created_at >= start_date)
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Client.created_at < end_date)

        if search:
            search_term = f"%{search}%"
            query = query.filter(or_(Client.full_name.ilike(search_term), Client.email.ilike(search_term)))

        if sort_by == 'oldest':
            query = query.order_by(Client.created_at.asc())
        elif sort_by == 'a-z':
            query = query.order_by(Client.full_name.asc())
        elif sort_by == 'z-a':
            query = query.order_by(Client.full_name.desc())
        else:
            query = query.order_by(Client.created_at.desc())

        return query.paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def get_leads_kpis(closer_id, filters=None):
        filters = filters or {}
        search = filters.get('search')
        start_date_str = filters.get('start_date')
        end_date_str = filters.get('end_date')

        def apply_lead_filters(q):
            if start_date_str: q = q.filter(Client.created_at >= datetime.strptime(start_date_str, '%Y-%m-%d'))
            if end_date_str: q = q.filter(Client.created_at < datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1))
            if search: q = q.filter(or_(Client.full_name.ilike(f"%{search}%"), Client.email.ilike(f"%{search}%")))
            return q

        from flask_login import current_user
        kpi_query = Client.query
        if current_user.role != 'admin':
            kpi_query = kpi_query.filter(or_(
                Client.enrollments.any(Enrollment.closer_id == closer_id), 
                Client.appointments.any(Appointment.closer_id == closer_id)
            ))
        kpi_query = apply_lead_filters(kpi_query)
        total_clients = kpi_query.count()

        fin_query = db.session.query(db.func.sum(Payment.amount)).select_from(Client).join(Enrollment).join(Payment).filter(
            Payment.status == 'completed',
            Enrollment.closer_id == closer_id
        )
        fin_query = apply_lead_filters(fin_query)
        total_revenue_gross = fin_query.scalar() or 0.0

        comm_query = db.session.query(
            db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)
        ).select_from(Client).join(Enrollment).join(Payment).join(PaymentMethod).filter(
            Payment.status == 'completed', Enrollment.closer_id == closer_id
        )
        comm_query = apply_lead_filters(comm_query)
        platform_fees = comm_query.scalar() or 0.0
        cash_collect_net = total_revenue_gross - platform_fees

        enr_query = Enrollment.query.filter(Enrollment.closer_id == closer_id)
        enr_query = enr_query.join(Client)
        enr_query = apply_lead_filters(enr_query)
        enrs = enr_query.all()
        total_debt = sum(max(0, (e.program.price if e.program else 0.0) - e.total_paid) for e in enrs)

        return {
            'total': total_clients,
            'cash_collected': cash_collect_net,
            'my_commission': cash_collect_net * 0.10,
            'debt': total_debt
        }

    @staticmethod
    def get_dashboard_data(closer_id, timezone_name='America/La_Paz', is_admin=False):
        try: user_tz = pytz.timezone(timezone_name)
        except: user_tz = pytz.timezone('America/La_Paz')
            
        now_local = datetime.now(user_tz)
        today_local = now_local.date()
        start_utc = user_tz.localize(datetime.combine(today_local, time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
        end_utc = user_tz.localize(datetime.combine(today_local, time.max)).astimezone(pytz.UTC).replace(tzinfo=None)
        
        detailed_metrics = DashboardService.get_detailed_closer_metrics(start_utc, end_utc, closer_id)
        
        agendas = detailed_metrics['agendas']
        first, second = agendas['first_agendas'], agendas['second_agendas']
        
        new_enrollments = Enrollment.query.filter(
            Enrollment.closer_id == closer_id,
            Enrollment.enrollment_date >= start_utc,
            Enrollment.enrollment_date <= end_utc
        ).all()
        
        kpi_sales_count = len(new_enrollments)
        kpi_sales_amount = sum(e.program.price if e.program else 0.0 for e in new_enrollments)
        
        payments_today = Payment.query.join(Enrollment).filter(
            Enrollment.closer_id == closer_id,
            Payment.date >= start_utc, Payment.date <= end_utc, Payment.status == 'completed'
        ).all()
        kpi_cash_collected = sum(p.amount for p in payments_today)
        
        month_start_utc = user_tz.localize(datetime(today_local.year, today_local.month, 1)).astimezone(pytz.UTC).replace(tzinfo=None)
        
        def calculate_commission(s_dt, e_dt):
            gross = db.session.query(db.func.sum(Payment.amount)).select_from(Enrollment).join(Payment).filter(
                Enrollment.closer_id == closer_id, Payment.status == 'completed', Payment.date >= s_dt, Payment.date <= e_dt
            ).scalar() or 0.0
            fees = db.session.query(db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)).select_from(Enrollment).join(Payment).join(PaymentMethod).filter(
                 Enrollment.closer_id == closer_id, Payment.status == 'completed', Payment.date >= s_dt, Payment.date <= e_dt
            ).scalar() or 0.0
            return (gross - fees) * 0.10

        upcoming = Appointment.query.filter(
            Appointment.closer_id == closer_id,
            Appointment.start_time >= start_utc, Appointment.start_time <= end_utc
        ).order_by(Appointment.start_time.asc()).limit(20).all()

        recent_query = Client.query
        if not is_admin:
            recent_query = recent_query.filter(or_(
                Client.enrollments.any(Enrollment.closer_id == closer_id),
                Client.appointments.any(Appointment.closer_id == closer_id)
            ))
        recent_clients = recent_query.order_by(Client.created_at.desc()).limit(10).all()

        today_stats = CloserDailyStats.query.filter_by(closer_id=closer_id, date=today_local).first()

        return {
            'kpis': {
                'scheduled': agendas['total_agendas'],
                'completed': first['completed'] + second['completed'],
                'no_show': first['no_show'] + second['no_show'],
                'canceled': first['canceled'] + second['canceled'],
                'sales_count': kpi_sales_count,
                'sales_amount': kpi_sales_amount,
                'cash_collected': kpi_cash_collected,
                'presentations': agendas['presentations'],
                'reschedules': first['rescheduled'] + second['rescheduled'],
            },
            'rates': {
                'show_up': detailed_metrics['kpis']['show_up_rate'],
                'closing_month': detailed_metrics['kpis']['closing_rate_global'],
                'closing_today': detailed_metrics['kpis']['closing_rate_global'], # Placeholder logic
                'closing_pres': detailed_metrics['kpis']['closing_rate_presentation']
            },
            'commission': {'month': calculate_commission(month_start_utc, end_utc), 'today': calculate_commission(start_utc, end_utc)},
            'progress': 0,
            'upcoming_agendas': [(a, 1) for a in upcoming],
            'recent_clients': recent_clients,
            'today_stats': today_stats
        }

    @staticmethod
    def register_sale(closer_id, client_id, data):
        program_id = data.get('program_id')
        
        # Look for existing active enrollment for this client and program
        enrollment = Enrollment.query.filter_by(client_id=client_id, program_id=program_id).first()
        
        if not enrollment:
            enrollment = Enrollment(
                client_id=client_id,
                program_id=program_id,
                closer_id=closer_id
            )
            db.session.add(enrollment)
            db.session.flush()
        
        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=data.get('payment_method_id'),
            amount=data.get('payment_amount'),
            payment_type=data.get('payment_type', 'full'),
            status='completed'
        )
        db.session.add(payment)
        db.session.commit()
        return enrollment

    @staticmethod
    def get_sale_metadata(closer_id):
        from app.models import Program, PaymentMethod
        programs = Program.query.filter_by(is_active=True).all()
        methods = PaymentMethod.query.filter_by(is_active=True).all()
        # Leads for sale selection: clients with recent appointments with this closer
        leads = Client.query.filter(Client.appointments.any(Appointment.closer_id == closer_id)).limit(50).all()
        
        return {
            "programs": [{"id": p.id, "name": p.name, "price": p.price} for p in programs],
            "payment_methods": [{"id": m.id, "name": m.name} for m in methods],
            "leads": [{"id": l.id, "username": l.full_name or l.email, "email": l.email} for l in leads]
        }
    @staticmethod
    def process_agenda(closer_id, appt_id, data):
        from app.models import Appointment, db
        from app.services.booking_service import BookingService
        
        appt = Appointment.query.get_or_404(appt_id)
        if appt.closer_id != closer_id:
            raise Exception("No tienes permiso sobre esta agenda")
            
        new_status = data.get('status') # Completada, Primera Agenda, Cancelada, No Show, Reprogramada
        reschedule_date = data.get('reschedule_date') # ISO string
        
        # Logic: 
        # - "Completada" -> status 'completed'
        # - "Cancelada" -> status 'canceled'
        # - "No Show" -> status 'no_show'
        # - "Reprogramada" -> Old appt becomes 'reprogrammed', new one created as 'Primera agenda'
        # - "Primera Agenda" -> Old appt becomes 'completed', new one created as 'Segunda agenda'

        if new_status == 'Completada':
            appt.status = 'completed'
        elif new_status == 'Cancelada':
            appt.status = 'canceled'
        elif new_status == 'No Show':
            appt.status = 'no_show'
        elif new_status == 'Reprogramada':
            if not reschedule_date: raise Exception("Fecha de reagenda requerida")
            appt.status = 'reprogrammed'
            # Create new Primera Agenda
            new_dt = datetime.fromisoformat(reschedule_date.replace('Z', ''))
            BookingService.create_appointment(appt.client_id, appt.closer_id, new_dt, origin=appt.origin)
            # Find the new appt and set its type (create_appointment defaults to Primera if we follow standard, let's fix type)
            new_appt = Appointment.query.filter_by(closer_id=appt.closer_id, client_id=appt.client_id, start_time=new_dt).first()
            if new_appt: new_appt.appointment_type = 'Primera agenda'
        elif new_status == 'Primera Agenda':
            if not reschedule_date: raise Exception("Fecha de segunda agenda requerida")
            appt.status = 'completed'
            # Create new Segunda Agenda
            new_dt = datetime.fromisoformat(reschedule_date.replace('Z', ''))
            BookingService.create_appointment(appt.client_id, appt.closer_id, new_dt, origin=appt.origin)
            new_appt = Appointment.query.filter_by(closer_id=appt.closer_id, client_id=appt.client_id, start_time=new_dt).first()
        db.session.commit()
        return appt

    @staticmethod
    def get_lead_payment_status(client_id):
        client = Client.query.get_or_404(client_id)
        
        enrollment = Enrollment.query.filter_by(client_id=client_id).order_by(Enrollment.enrollment_date.desc()).first()
        
        if not enrollment:
            return {
                "allowed_types": ["down_payment", "first_payment", "full"],
                "has_debt": False,
                "total_paid": 0,
                "program_id": None
            }
        
        payments = enrollment.payments.filter_by(status='completed').all()
        payment_types = [p.payment_type for p in payments]
        
        program_price = enrollment.program.price if enrollment.program else 0.0
        total_paid = sum(p.amount for p in payments)
        has_debt = total_paid < program_price
        
        payload = {
            "has_debt": has_debt,
            "total_paid": total_paid,
            "program_id": enrollment.program_id,
            "program_price": program_price
        }
        
        if not payments:
            payload["allowed_types"] = ["down_payment", "first_payment", "full"]
            return payload
            
        if not has_debt or 'full' in payment_types:
            payload["allowed_types"] = ["renewal"]
            return payload

        if 'first_payment' in payment_types:
            payload["allowed_types"] = ["installment"]
            return payload

        if 'down_payment' in payment_types:
            payload["allowed_types"] = ["first_payment", "full"]
            return payload
            
        payload["allowed_types"] = ["installment", "renewal"]
        return payload

    @staticmethod
    def get_enrollment_details(enrollment_id):
        from app.models import SurveyQuestion
        import json
        
        enrollment = Enrollment.query.get_or_404(enrollment_id)
        client = enrollment.client
        
        # 1. Payments
        payments = []
        for p in enrollment.payments:
            payments.append({
                "id": p.id,
                "amount": p.amount,
                "date": p.date.isoformat(),
                "type": p.payment_type,
                "method": p.method.name if p.method else "N/A",
                "status": p.status,
                "method_id": p.payment_method_id
            })
            
        # 2. Appointments
        appointments = []
        for a in client.appointments.order_by(Appointment.start_time.desc()):
            appointments.append({
                "id": a.id,
                "start_time": a.start_time.isoformat(),
                "status": a.status,
                "type": a.appointment_type,
                "origin": a.origin
            })
            
        # 3. Survey Answers + Scores
        survey_data = []
        for sa in client.survey_answers:
            points = 0
            q = sa.question
            if q and q.options:
                try:
                    opts = json.loads(q.options)
                    if isinstance(opts, list):
                        for opt in opts:
                            if str(opt.get('text')) == str(sa.answer):
                                points = int(opt.get('points', 0))
                                break
                except: pass
                
            survey_data.append({
                "question": q.text if q else "Pregunta eliminada",
                "answer": sa.answer,
                "points": points
            })
            
        return {
            "id": enrollment.id,
            "client": {
                "id": client.id,
                "name": client.full_name,
                "email": client.email,
                "phone": client.phone,
                "instagram": client.instagram
            },
            "program": {
                "id": enrollment.program_id,
                "name": enrollment.program.name if enrollment.program else "N/A",
                "price": enrollment.program.price if enrollment.program else 0.0
            },
            "payments": payments,
            "appointments": appointments,
            "survey": survey_data,
            "total_paid": enrollment.total_paid
        }

    @staticmethod
    def add_payment(enrollment_id, data):
        enrollment = Enrollment.query.get_or_404(enrollment_id)
        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=data.get('payment_method_id'),
            amount=data.get('amount'),
            payment_type=data.get('payment_type'),
            status='completed'
        )
        db.session.add(payment)
        db.session.commit()
        return payment

    @staticmethod
    def delete_payment(payment_id):
        payment = Payment.query.get_or_404(payment_id)
        db.session.delete(payment)
        db.session.commit()
        return True

    @staticmethod
    def delete_enrollment(enrollment_id):
        enrollment = Enrollment.query.get_or_404(enrollment_id)
        db.session.delete(enrollment)
        db.session.commit()
        return True
