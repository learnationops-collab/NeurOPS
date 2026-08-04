from app.models import User, Client, Enrollment, Appointment, Payment, PaymentMethod, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, Event, db, Integration
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
                    Client.appointments.any(or_(Appointment.closer_id == closer_id, Appointment.setter_id == closer_id))
                )
            )
        
        if program_filter:
            query = query.join(Enrollment).filter(Enrollment.program_id == program_filter)

        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
                query = query.filter(Client.created_at >= start_date)
            except ValueError:
                pass
        
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Client.created_at < end_date)
            except ValueError:
                pass

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
    def get_customers_pagination(closer_id, page=1, per_page=50, filters=None):
        filters = filters or {}
        search = filters.get('search')
        program_filter = filters.get('program')
        sort_by = filters.get('sort_by', 'newest')

        # Solo clientes que tienen inscripciones (enrollments)
        query = Client.query.join(Enrollment)
        
        from flask_login import current_user
        if current_user.role != 'admin':
            query = query.filter(Enrollment.closer_id == closer_id)
        
        if program_filter:
            if isinstance(program_filter, str):
                programs = program_filter.split(',')
                query = query.filter(Enrollment.program_id.in_(programs))
            else:
                query = query.filter(Enrollment.program_id == program_filter)

        if search:
            search_term = f"%{search}%"
            query = query.filter(or_(
                Client.full_name.ilike(search_term), 
                Client.email.ilike(search_term),
                Client.phone.ilike(search_term),
                Client.instagram.ilike(search_term)
            ))

        # Agrupar por cliente para evitar duplicados si tienen múltiples enrollments
        query = query.group_by(Client.id)

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
            if start_date_str:
                try:
                    q = q.filter(Client.created_at >= datetime.strptime(start_date_str, '%Y-%m-%d'))
                except ValueError:
                    pass
            if end_date_str:
                try:
                    q = q.filter(Client.created_at < datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1))
                except ValueError:
                    pass
            if search: q = q.filter(or_(Client.full_name.ilike(f"%{search}%"), Client.email.ilike(f"%{search}%")))
            return q

        from flask_login import current_user
        kpi_query = Client.query
        if current_user.role != 'admin':
            kpi_query = kpi_query.filter(or_(
                Client.enrollments.any(Enrollment.closer_id == closer_id), 
                Client.appointments.any(or_(Appointment.closer_id == closer_id, Appointment.setter_id == closer_id))
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

        print(f"[DEBUG] Closer: {closer_id}, TZ: {timezone_name}")
        print(f"[DEBUG] Today Local: {today_local}")
        print(f"[DEBUG] UTC Range: {start_utc} to {end_utc}")
        
        detailed_metrics = DashboardService.get_detailed_closer_metrics(start_utc, end_utc, closer_id)
        
        agendas = detailed_metrics['agendas']
        first, second = agendas['first_agendas'], agendas['second_agendas']
        
        new_enrollments = Enrollment.query.filter(
            Enrollment.closer_id == closer_id,
            Enrollment.enrollment_date >= start_utc,
            Enrollment.enrollment_date <= end_utc
        ).all()
        
        kpi_sales_count = 0
        kpi_sales_amount = 0.0

        for e in new_enrollments:
            # Check if has at least one completed payment
            has_completed_payment = e.payments.filter_by(status='completed').first()
            if has_completed_payment:
                kpi_sales_count += 1
                kpi_sales_amount += e.program.price if e.program else 0.0
        
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
                Client.appointments.any(or_(Appointment.closer_id == closer_id, Appointment.setter_id == closer_id))
            ))
        recent_clients = recent_query.order_by(Client.created_at.desc()).limit(10).all()

        # Map agendas for frontend
        agendas_today_list = []
        for appt in upcoming:
            agendas_today_list.append({
                'id': appt.id,
                'lead_name': appt.client.full_name if appt.client else 'Sin Nombre',
                'start_time': appt.start_time.isoformat(),
                'last_stage': appt.last_stage
            })

        # Map sales for frontend
        sales_today_list = []
        for p in payments_today:
            debt = 0
            if p.enrollment and p.enrollment.program:
                debt = max(0, p.enrollment.program.price - p.enrollment.total_paid)
            
            sales_today_list.append({
                'id': p.enrollment_id,
                'student_name': p.enrollment.client.full_name if p.enrollment and p.enrollment.client else 'N/A',
                'program_name': p.enrollment.program.name if p.enrollment and p.enrollment.program else 'N/A',
                'amount': p.amount,
                'debt': debt,
                'time': p.date.isoformat()
            })

        # Calculate progress: Handled agendas / Total agendas
        m = agendas['total_agendas']
        total_a = m['total']
        handled = m['completed'] + m['no_show'] + m['canceled'] + m['rescheduled']
        progress_val = (handled / total_a * 100) if total_a > 0 else 0

        today_stats = CloserDailyStats.query.filter_by(closer_id=closer_id, date=today_local).first()

        return {
            'kpis': {
                'scheduled': agendas['total_agendas']['total'],
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
            'progress': progress_val,
            'upcoming_agendas': [(a, 1) for a in upcoming],
            'sales_today': sales_today_list,
            'recent_clients': recent_clients,
            'today_stats': today_stats
        }

    @staticmethod
    def register_sale(closer_id, client_id, data):
        program_id = data.get('program_id')
        instagram = data.get('instagram')
        
        # Look for existing active enrollment for this client and program
        enrollment = Enrollment.query.filter_by(client_id=client_id, program_id=program_id).first()
        
        client = Client.query.get(client_id)
        if client and instagram:
            client.instagram = instagram.strip('@').strip()
        
        
        if not enrollment:
            enrollment = Enrollment(
                client_id=client_id,
                program_id=program_id,
                closer_id=closer_id
            )
            db.session.add(enrollment)
            db.session.flush()
        
        payment_date = datetime.now()
        if data.get('payment_date'):
            try:
                payment_date = datetime.fromisoformat(data['payment_date'].replace('Z', ''))
            except: pass

        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=data.get('payment_method_id'),
            amount=data.get('payment_amount'),
            payment_type=data.get('payment_type', 'full'),
            status=data.get('status', 'completed'),
            date=payment_date
        )
        db.session.add(payment)
        
        # Sync enrollment date with the first/initial payment date
        enrollment.enrollment_date = payment_date
        
        db.session.commit()
        
        # New Sale Automation (Discord + WhatsApp)
        CloserService.trigger_sale_automation(enrollment, payment)

        # Propagar venta al modelo financiero y Google Sheets
        try:
            from app.services.sheets_service import SheetsService
            from app.models import Program, User, Appointment
            
            closer = User.query.get(closer_id)
            email_vendedor = closer.email if closer else "Sin asignar"
            nombre_cliente = client.full_name if client else "Sin nombre"
            telefono = client.phone.replace("+", "").strip() if (client and client.phone) else ""
            mail_cliente = client.email if (client and client.email) else ""
            
            # Formatear programa y tipo de pago
            program = Program.query.get(program_id) if program_id else None
            program_code = "RR"
            if program:
                name_lower = program.name.lower()
                if "ace" in name_lower or "learner" in name_lower:
                    program_code = "AL"
                elif "specialist" in name_lower or "initiative" in name_lower:
                    program_code = "SI"
                elif "roadmap" in name_lower or "residency" in name_lower:
                    program_code = "RR"
                    
            payment_type_friendly = "completo"
            pay_type = data.get('payment_type', 'full')
            if pay_type == 'full':
                payment_type_friendly = "completo"
            elif pay_type == 'first_payment':
                payment_type_friendly = "parcial"
            elif pay_type == 'down_payment':
                payment_type_friendly = "Seña"
            elif pay_type == 'installment':
                payment_type_friendly = "Cuota"
            elif pay_type == 'renewal':
                payment_type_friendly = "Renovacion"
            elif pay_type == 'upsell':
                payment_type_friendly = "Upsell"
                
            tipo_pago = f"{program_code} - {payment_type_friendly}"
            
            # Buscar el metodo de pago
            metodo_pago = "No Especificado"
            payment_method_id = data.get('payment_method_id')
            if payment_method_id:
                payment_method = PaymentMethod.query.get(payment_method_id)
                if payment_method:
                    metodo_pago = payment_method.name
                    
            # Obtener setter de la cita mas reciente
            setter_username = ""
            last_appt = Appointment.query.filter_by(client_id=client_id).order_by(Appointment.start_time.desc()).first()
            if last_appt and last_appt.setter:
                setter_username = last_appt.setter.username or last_appt.setter.name or ""
                
            client_instagram = client.instagram.replace("@", "").strip() if (client and client.instagram) else "N/A"
            
            payload = {
                "email_vendedor": email_vendedor,
                "nombre_cliente": nombre_cliente,
                "telefono": telefono,
                "mail_cliente": mail_cliente,
                "tipo_pago": tipo_pago,
                "monto": float(payment.amount or 0.0),
                "segundo_pago": "",
                "metodo_pago": metodo_pago,
                "examen": "",
                "instagram": client_instagram,
                "setter": setter_username,
                "estado": "Completada" if payment.status == 'completed' else payment.status,
                "documento_identidad": "",
                "marca_temporal": datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
                "enviar_webhook": data.get('trigger_webhook', True),
                "enviar_mensaje": False # Mensaje ya enviado
            }
            
            # Llamar de forma sincronizada
            SheetsService.post_to_sheets("Ventas_DB", payload)
            
        except Exception as e:
            # Registrar el error para evitar romper la respuesta del registro local
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"[QUICK SALE SYNC ERROR] Error al propagar venta rapida a sheets: {e}")

        return enrollment

    @staticmethod
    def _get_sales_integration():
        from app.models import Integration
        # Try strict key match first
        webhook = Integration.query.filter_by(key='sale_wins').first()
        if not webhook:
            # Fallback to general sales webhook if specific wins one not found
            webhook = Integration.query.filter_by(key='sales_webhook').first()
            if not webhook:
                webhook = Integration.query.filter(Integration.name.ilike('Ventas%')).first()
        return webhook

    @staticmethod
    def trigger_sale_automation(enrollment, payment):
        """
        Handles Discord Wins, Onboarding and WhatsApp confirmations for new sales.
        """
        try:
            from app.models import Enrollment, Integration, User, PaymentMethod
            from app.services.image_service import ImageService
            from app.services.two_chat_service import TwoChatService
            import requests
            import json

            client = enrollment.client
            closer = enrollment.closer_rel
            program = enrollment.program
            
            # Map payment types to friendly names
            type_labels = {
                'full': 'Pago Completo',
                'first_payment': 'Primer Pago',
                'down_payment': 'Seña',
                'installment': 'Cuota',
                'renewal': 'Renovación'
            }
            payment_type_label = type_labels.get(payment.payment_type, payment.payment_type)

            # Verificar si es conversión de seña a venta real
            try:
                client_data = {
                    'email': client.email,
                    'phone': client.phone,
                    'instagram': client.instagram,
                    'name': client.full_name
                }
                sale_data = {
                    'payment_type': payment.payment_type,
                    'payment_type_friendly': payment_type_label,
                    'amount': payment.amount,
                    'closer_name': closer.username if closer else 'N/A',
                    'program_name': program.name if program else 'N/A',
                    'payment_id': payment.id
                }
                CloserService.check_and_notify_down_payment_conversion(client_data, sale_data)
            except Exception as conv_err:
                print(f"[Down Payment Conversion Hook Error] {conv_err}")
            closer = enrollment.closer_rel
            program = enrollment.program
            pm = payment.method or PaymentMethod.query.get(payment.payment_method_id)
            
            # Map payment types to friendly names
            type_labels = {
                'full': 'Pago Completo',
                'first_payment': 'Primer Pago',
                'down_payment': 'Seña',
                'installment': 'Cuota',
                'renewal': 'Renovación'
            }
            payment_type_label = type_labels.get(payment.payment_type, payment.payment_type)

            # 1. DISCORD WINS (Sales Channel)
            try:
                wins_webhook = Integration.query.filter_by(key='sale_wins').first()
                if wins_webhook:
                    url = wins_webhook.url_prod if wins_webhook.active_env == 'prod' else wins_webhook.url_dev
                    if url:
                        # Todays sales count
                        today_start = datetime.combine(datetime.utcnow().date(), time.min)
                        todays_count = Enrollment.query.filter(Enrollment.enrollment_date >= today_start).count()

                        img_data = {
                            "client_name": client.full_name or "Sin Nombre",
                            "closer_name": closer.username if closer else "N/A",
                            "program_name": program.name if program else "N/A",
                            "amount": str(payment.amount),
                            "payment_type": payment_type_label,
                            "payment_method": pm.name if pm else "N/A",
                            "count": todays_count
                        }
                        img_buffer = ImageService.generate_sale_card(img_data)
                        
                        files = {'file': ('sale_card.png', img_buffer, 'image/png')}
                        json_payload = {
                            "content": f"🏆 **¡NUEVA VENTA!**\nCloser: **{closer.username if closer else 'N/A'}** | Programa: **{program.name if program else 'N/A'}**",
                            "embeds": [{
                                "color": 16766720, # Gold
                                "image": {"url": "attachment://sale_card.png"}
                            }]
                        }
                        requests.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=10)
            except Exception as disc_err:
                print(f"[Sale Auto Discord Wins Error] {disc_err}")

            # 2. DISCORD ONBOARDING (fulfillment Channel)
            try:
                onboarding_webhook = Integration.query.filter_by(key='sale_onboarding').first()
                if onboarding_webhook:
                    url = onboarding_webhook.url_prod if onboarding_webhook.active_env == 'prod' else onboarding_webhook.url_dev
                    if url:
                        onboarding_payload = {
                            "content": f"📦 **NUEVO ONBOARDING PENDIENTE**",
                            "embeds": [{
                                "title": "Detalles de Inscripción",
                                "color": 3447003, # Deep Blue
                                "fields": [
                                    {"name": "Cliente", "value": client.full_name or "N/A", "inline": True},
                                    {"name": "Programa", "value": program.name if program else "N/A", "inline": True},
                                    {"name": "Email", "value": client.email or "N/A", "inline": False},
                                    {"name": "Instagram", "value": client.instagram or "N/A", "inline": True},
                                    {"name": "Teléfono", "value": client.phone or "N/A", "inline": True},
                                    {"name": "Closer", "value": closer.username if closer else "N/A", "inline": True}
                                ],
                                "timestamp": datetime.utcnow().isoformat()
                            }]
                        }
                        requests.post(url, json=onboarding_payload, timeout=5)
            except Exception as onb_err:
                print(f"[Sale Auto Discord Onboarding Error] {onb_err}")

            # 3. WHATSAPP (Client Confirmation)
            try:
                JEAN_CARLO_NUMBER = "+525620873819"
                first_name = client.full_name.split(' ')[0] if client.full_name else "Inversionista"
                
                wa_message = (
                    f"🏆 ¡Felicidades {first_name}! 🚀\n\n"
                    f"Te confirmo que hemos recibido con éxito tu pago de **${payment.amount}** "
                    f"por concepto de: *{payment_type_label}* para el programa **{program.name if program else 'NeurOPS'}**.\n\n"
                    f"¡Bienvenido/a a la familia! En breve el equipo de onboarding se pondrá en contacto contigo para los siguientes pasos.\n\n"
                    f"¡Vamos con todo! 🔥"
                )
                
                TwoChatService.send_message(
                    to_number=client.phone,
                    text=wa_message,
                    from_number=JEAN_CARLO_NUMBER
                )
            except Exception as wa_err:
                print(f"[Sale Auto WhatsApp Error] {wa_err}")

        except Exception as global_err:
            print(f"[Sale Automation Global Error] {global_err}")

    @staticmethod
    def check_and_notify_down_payment_conversion(client_data, sale_data):
        """
        Detecta si la venta es PIF/Split Pay y si el lead tenía una seña previa,
        enviando notificaciones en Discord.
        """
        try:
            from app.models import FinancialSale, Payment, Client, Enrollment, Integration
            from sqlalchemy import func, or_
            from datetime import datetime
            import requests

            # 1. Verificar si es PIF o Split Pay
            pay_type = str(sale_data.get('payment_type') or '').lower().strip()
            
            # Si es seña, omitimos (no es conversión a venta real)
            is_down_payment = (
                'down_payment' in pay_type or 
                'seña' in pay_type or 
                'sena' in pay_type or 
                'deposito' in pay_type or 
                'deposit' in pay_type
            )
            if is_down_payment:
                return
                
            is_pif_or_split = (
                'full' in pay_type or
                'first_payment' in pay_type or
                'completo' in pay_type or
                'pif' in pay_type or
                'cuota' in pay_type or
                'parcial' in pay_type or
                'primer pago' in pay_type or
                'split' in pay_type
            )
            if not is_pif_or_split:
                return

            # 2. Normalizar datos del cliente para la búsqueda
            email = str(client_data.get('email') or '').strip().lower()
            phone = str(client_data.get('phone') or '').strip()
            instagram = str(client_data.get('instagram') or '').strip().lower().replace('@', '')
            
            # 3. Buscar señas anteriores
            has_previous_seña = False
            
            client_filters = []
            if email and email != 'n/a' and len(email) > 2:
                client_filters.append(func.lower(FinancialSale.mail_cliente) == email)
            if instagram and instagram != 'n/a' and len(instagram) > 2:
                client_filters.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == instagram)
            if phone and phone != 'n/a' and len(phone) > 4:
                client_filters.append(FinancialSale.telefono == phone)
                
            # A) Buscar seña en FinancialSale
            if client_filters:
                exclude_id = sale_data.get('financial_sale_id')
                query = FinancialSale.query.filter(
                    or_(*client_filters),
                    or_(
                        FinancialSale.tipo_pago.ilike('%seña%'),
                        FinancialSale.tipo_pago.ilike('%deposito%'),
                        FinancialSale.tipo_pago.ilike('%deposit%')
                    )
                )
                if exclude_id:
                    query = query.filter(FinancialSale.id != exclude_id)
                if query.first():
                    has_previous_seña = True
                    
            # B) Buscar seña en la base de datos interna de pagos si no se ha encontrado en FinancialSale
            if not has_previous_seña:
                client_db_filters = []
                if email and email != 'n/a' and len(email) > 2:
                    client_db_filters.append(func.lower(Client.email) == email)
                if instagram and instagram != 'n/a' and len(instagram) > 2:
                    client_db_filters.append(func.lower(func.replace(Client.instagram, '@', '')) == instagram)
                if phone and phone != 'n/a' and len(phone) > 4:
                    client_db_filters.append(Client.phone.like(f"%{phone}%"))
                    
                if client_db_filters:
                    matching_clients = Client.query.filter(or_(*client_db_filters)).all()
                    if matching_clients:
                        client_ids = [c.id for c in matching_clients]
                        exclude_payment_id = sale_data.get('payment_id')
                        payment_query = Payment.query.join(Enrollment).filter(
                            Enrollment.client_id.in_(client_ids),
                            Payment.payment_type == 'down_payment',
                            Payment.status == 'completed'
                        )
                        if exclude_payment_id:
                            payment_query = payment_query.filter(Payment.id != exclude_payment_id)
                        if payment_query.first():
                            has_previous_seña = True

            # 4. Enviar notificaciones si se detecta conversión
            if has_previous_seña:
                import os
                
                wins_webhook_url = os.environ.get('DISCORD_WINS_WEBHOOK')
                onboarding_webhook_url = os.environ.get('DISCORD_ONBOARDING_WEBHOOK')
                
                if not wins_webhook_url:
                    wins_int = Integration.query.filter_by(key='sale_wins').first()
                    if wins_int:
                        wins_webhook_url = wins_int.url_prod if wins_int.active_env == 'prod' else wins_int.url_dev
                if not onboarding_webhook_url:
                    onboarding_int = Integration.query.filter_by(key='sale_onboarding').first()
                    if onboarding_int:
                        onboarding_webhook_url = onboarding_int.url_prod if onboarding_int.active_env == 'prod' else onboarding_int.url_dev
                        
                if not wins_webhook_url and not onboarding_webhook_url:
                    print("[Discord Conversion Alert] No webhooks configured in environment or database integrations.")
                    return
                    
                client_name = client_data.get('name') or 'Desconocido'
                closer_name = sale_data.get('closer_name') or 'N/A'
                program_name = sale_data.get('program_name') or 'N/A'
                amount = sale_data.get('amount') or 0.0
                
                content = (
                    f"🔥 **¡CONVERSIÓN DE SEÑA A VENTA REAL!** 🔥\n"
                    f"El lead **{client_name}** ha convertido su seña registrada anteriormente en una venta real.\n\n"
                    f"• **Tipo de pago:** {sale_data.get('payment_type_friendly', pay_type.title())}\n"
                    f"• **Monto:** ${amount}\n"
                    f"• **Closer:** {closer_name}\n"
                    f"• **Programa:** {program_name}\n"
                )
                
                payload = {
                    "content": content,
                    "embeds": [{
                        "title": "🎉 Conversión Lograda",
                        "description": f"Seña previa de **{client_name}** convertida con éxito a venta definitiva.",
                        "color": 16737792, # Naranja/Fuego
                        "timestamp": datetime.utcnow().isoformat()
                    }]
                }
                
                if wins_webhook_url:
                    try:
                        res = requests.post(wins_webhook_url, json=payload, timeout=10)
                        print(f"[Discord Conversion Alert Wins] Sent. Status: {res.status_code}")
                    except Exception as e:
                        print(f"[Discord Conversion Alert Wins Error] {e}")
                        
                if onboarding_webhook_url:
                    try:
                        res = requests.post(onboarding_webhook_url, json=payload, timeout=10)
                        print(f"[Discord Conversion Alert Onboarding] Sent. Status: {res.status_code}")
                    except Exception as e:
                        print(f"[Discord Conversion Alert Onboarding Error] {e}")
        except Exception as global_err:
            print(f"[Down Payment Conversion Hook Global Error] {global_err}")

    @staticmethod
    def get_sale_metadata(closer_id):
        from app.models import Program, PaymentMethod, Integration
        programs = Program.query.filter_by(is_active=True).all()
        methods = PaymentMethod.query.filter_by(is_active=True).all()
        # Leads for sale selection: Show 50 most recent clients globally
        leads = Client.query.order_by(Client.created_at.desc()).limit(50).all()
        
        # Check integration status using helper
        webhook = CloserService._get_sales_integration()
        integration_status = {
            "configured": bool(webhook),
            "active_env": webhook.active_env if webhook else 'dev'
        }
        
        return {
            "programs": [{"id": p.id, "name": p.name, "price": p.price} for p in programs],
            "payment_methods": [{"id": m.id, "name": m.name} for m in methods],
            "leads": [{"id": l.id, "username": l.full_name or l.email, "email": l.email, "instagram": l.instagram} for l in leads],
            "integration": integration_status
        }
    @staticmethod
    def get_available_slots(closer_id, days=7):
        # We'll use BookingService logic but restricted to this closer
        from app.services.booking_service import BookingService
        start_date = date.today()
        end_date = start_date + timedelta(days=days)
        return BookingService.get_available_slots_utc(start_date, end_date, preferred_closer_id=closer_id)

    @staticmethod
    def process_agenda(closer_id, appt_id, data, is_admin=False):
        from app.models import Appointment, db, ClientComment, User
        from app.services.booking_service import BookingService
        
        user = User.query.get(closer_id) if closer_id else None
        if not user:
            # Buscar un administrador o primer usuario como autor fallback
            user = User.query.filter_by(role='admin').first() or User.query.first()
            if user:
                closer_id = user.id
                user_display = f"Sistema (vía {user.username})"
            else:
                closer_id = None
                user_display = "Sistema"
        else:
            user_display = user.username
        
        appt = Appointment.query.get_or_404(appt_id)
        if not is_admin:
            if appt.closer_id is None and user and user.role == 'closer':
                appt.closer_id = closer_id
            elif user and user.role not in ['closer', 'admin', 'setter', 'call_confirmer', 'triage']:
                if appt.closer_id != closer_id and appt.setter_id != closer_id:
                    raise Exception("No tienes permiso sobre esta agenda")
            
        new_status = data.get('status')
        reschedule_date = data.get('reschedule_date') # ISO string
        last_stage = data.get('last_stage')
        role = data.get('role', 'closer') # 'closer' por defecto si no viene
        note = data.get('note') # Razón guardada en Lead Roadmap

        formatted_reschedule = reschedule_date
        if reschedule_date:
            try:
                from datetime import datetime as dt_class
                dt_obj = dt_class.fromisoformat(reschedule_date.replace('Z', ''))
                formatted_reschedule = dt_obj.strftime('%d/%m/%Y %H:%M')
            except Exception:
                pass

        # Actualizar etapa del lead si se proporciona
        if last_stage:
            appt.last_stage = last_stage

        if 'fecha_seguimiento' in data:
            appt.fecha_seguimiento = data['fecha_seguimiento']
        if 'fecha_seguimiento_cobro' in data:
            appt.fecha_seguimiento_cobro = data['fecha_seguimiento_cobro']
        if 'seguimiento_realizado' in data:
            appt.seguimiento_realizado = bool(data['seguimiento_realizado'])

        if 'with_decision_maker' in data:
            if data['with_decision_maker'] is None or data['with_decision_maker'] == '':
                appt.with_decision_maker = None
            else:
                appt.with_decision_maker = data['with_decision_maker'] == True or data['with_decision_maker'] in ('true', 'True', '1', 1)

        if role == 'closer' or not role:
            # Manejo del estado del Closer (closer_result)
            if new_status:
                appt.closer_result = new_status
            
            if new_status in ['Show up', 'Completada', 'Terminada']:
                if new_status == 'Completada' or new_status == 'Terminada':
                    appt.closer_result = 'Show up'
                appt.closer_processed = True

            elif new_status == 'No Show':
                appt.closer_result = 'No Show'
                appt.closer_processed = True

            elif new_status in ['Lead Perdido', 'Perdido']:
                appt.closer_result = 'Lead Perdido'
                appt.closer_processed = True
                appt.seguimiento_realizado = True
                if note and closer_id:
                    comment = ClientComment(client_id=appt.client_id, author_id=closer_id, text=f"Marcado como Lead Perdido por {user_display}: {note}")
                    db.session.add(comment)

            elif new_status == 'No Lead':
                appt.closer_result = 'No Lead'
                appt.closer_processed = True
                appt.seguimiento_realizado = True
                if note and closer_id:
                    comment = ClientComment(client_id=appt.client_id, author_id=closer_id, text=f"Marcado como No Lead por {user_display}: {note}")
                    db.session.add(comment)

            elif new_status == 'Cancelado':
                appt.closer_processed = True
                if note:
                    if closer_id:
                        comment = ClientComment(client_id=appt.client_id, author_id=closer_id, text=f"Cancelado por {user_display}: {note}")
                        db.session.add(comment)
                # Delete GCal
                if appt.google_event_id:
                    try:
                        from app.services.google_service import GoogleService
                        GoogleService.delete_event(appt.closer_id, appt.google_event_id)
                    except Exception as e:
                        print(f"Error deleting GCal event: {e}")

            elif new_status == 'Reagendado':
                appt.closer_processed = True
                if not reschedule_date:
                    raise Exception("Fecha de reagenda requerida")
                if note:
                    if closer_id:
                        comment = ClientComment(client_id=appt.client_id, author_id=closer_id, text=f"Reagendado por {user_display}. Razón: {note}. Nueva cita el {formatted_reschedule}")
                        db.session.add(comment)
                
                # Delete GCal
                if appt.google_event_id:
                    try:
                        from app.services.google_service import GoogleService
                        GoogleService.delete_event(appt.closer_id, appt.google_event_id)
                    except Exception as e:
                        print(f"Error deleting old GCal event: {e}")

                # Create new appointment
                new_dt = datetime.fromisoformat(reschedule_date.replace('Z', ''))
                new_appt = BookingService.create_appointment(appt.client_id, appt.closer_id, new_dt, origin=appt.origin)
                if new_appt:
                    new_appt.is_rescheduled = True
                    db.session.add(new_appt)
                    # Sync GCal
                    try:
                        from app.services.google_service import GoogleService
                        evt_id = GoogleService.create_event(new_appt.closer_id, new_appt)
                        if evt_id:
                            new_appt.google_event_id = evt_id
                    except Exception as e:
                        print(f"Error syncing GCal event for rescheduled appointment: {e}")

            elif new_status == '2da call':
                appt.closer_processed = True
                if not reschedule_date:
                    raise Exception("Fecha de segunda agenda requerida")
                if note:
                    comment = ClientComment(client_id=appt.client_id, author_id=closer_id, text=f"2da Call agendada por {user_display}. Razón: {note}. Programada para {formatted_reschedule}")
                    db.session.add(comment)

                # Intentar actualizar estado de FinancialAgenda actual a Follow Up
                try:
                    from app.models.financial import FinancialAgenda
                    from sqlalchemy import or_
                    from datetime import time
                    start_of_day = datetime.combine(appt.start_time.date(), time.min)
                    end_of_day = datetime.combine(appt.start_time.date(), time.max)
                    client = appt.client
                    financial_agenda = None
                    # Normalizar email e instagram para evitar problemas de matching exacto
                    from sqlalchemy import func
                    ig_clean = client.instagram.strip().replace('@', '').lower() if client.instagram and client.instagram.lower() not in ('n/a', '') else None
                    mail_clean = client.email.strip().lower() if client.email and client.email.lower() not in ('n/a', '') else None

                    filters = []
                    if mail_clean:
                        filters.append(func.lower(FinancialAgenda.mail) == mail_clean)
                    if ig_clean:
                        filters.append(func.lower(func.replace(FinancialAgenda.instagram, '@', '')) == ig_clean)
                    if filters:
                        financial_agenda = FinancialAgenda.query.filter(
                            or_(*filters),
                            FinancialAgenda.date >= start_of_day,
                            FinancialAgenda.date <= end_of_day
                        ).first()
                    if financial_agenda:
                        financial_agenda.estado = 'Follow Up'
                except Exception as e:
                    print(f"Error updating FinancialAgenda status to Follow Up: {e}")

                # Create new Segunda Agenda
                new_dt = datetime.fromisoformat(reschedule_date.replace('Z', ''))
                new_appt = BookingService.create_appointment(appt.client_id, appt.closer_id, new_dt, origin=appt.origin)
                if new_appt:
                    new_appt.result = '2TH Call' # Etiqueta al crear la segunda agenda
                    new_appt.closer_result = 'Pendiente'
                    db.session.add(new_appt)
                    
                    # Intentar crear una FinancialAgenda correspondiente a esta segunda llamada
                    try:
                        from app.models.financial import FinancialAgenda
                        new_fa = FinancialAgenda(
                            nombre=appt.origin or '2TH Call',
                            lead=client.full_name,
                            mail=client.email,
                            instagram=client.instagram,
                            whatsapp=client.phone,
                            closer=appt.closer.username if appt.closer else None,
                            estado='2TH Call',
                            date=new_dt,
                            fecha_meet=new_dt.isoformat()
                        )
                        db.session.add(new_fa)
                    except Exception as e:
                        print(f"Error creating FinancialAgenda for 2TH Call: {e}")

                    # Sync GCal
                    try:
                        from app.services.google_service import GoogleService
                        evt_id = GoogleService.create_event(new_appt.closer_id, new_appt)
                        if evt_id:
                            new_appt.google_event_id = evt_id
                    except Exception as e:
                        print(f"Error syncing GCal event for 2nd agenda: {e}")

        else:
            # Manejo del estado del Call Confirmer (result)
            if new_status:
                appt.result = new_status

            if new_status == 'Reagendado':
                if not reschedule_date:
                    raise Exception("Fecha de reagenda requerida")
                if note:
                    if closer_id:
                        comment = ClientComment(client_id=appt.client_id, author_id=closer_id, text=f"Reagendado por {user_display}. Razón: {note}. Nueva cita el {formatted_reschedule}")
                        db.session.add(comment)

                # Delete GCal
                if appt.google_event_id:
                    try:
                        from app.services.google_service import GoogleService
                        GoogleService.delete_event(appt.closer_id, appt.google_event_id)
                    except Exception as e:
                        print(f"Error deleting GCal event: {e}")

                # Create new appointment
                new_dt = datetime.fromisoformat(reschedule_date.replace('Z', ''))
                new_appt = BookingService.create_appointment(appt.client_id, appt.closer_id, new_dt, origin=appt.origin)
                if new_appt:
                    new_appt.is_rescheduled = True
                    db.session.add(new_appt)
                    # Sync GCal
                    try:
                        from app.services.google_service import GoogleService
                        evt_id = GoogleService.create_event(new_appt.closer_id, new_appt)
                        if evt_id:
                            new_appt.google_event_id = evt_id
                    except Exception as e:
                        print(f"Error syncing GCal event for rescheduled appointment: {e}")

            elif new_status == 'Cancelado':
                if note:
                    if closer_id:
                        comment = ClientComment(client_id=appt.client_id, author_id=closer_id, text=f"Cancelado por {user_display}: {note}")
                        db.session.add(comment)
                # Delete GCal
                if appt.google_event_id:
                    try:
                        from app.services.google_service import GoogleService
                        GoogleService.delete_event(appt.closer_id, appt.google_event_id)
                    except Exception as e:
                        print(f"Error deleting GCal event: {e}")

        # Sincronizar el Appointment de vuelta a la FinancialAgenda correspondiente
        try:
            BookingService.sync_appointment_to_financial_agenda(appt)
        except Exception as sync_err:
            print(f"[SYNC ERROR] No se pudo sincronizar de vuelta a FinancialAgenda: {sync_err}")

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
                "last_stage": a.last_stage,
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
        payment_date = datetime.now()
        if data.get('date'):
            try:
                payment_date = datetime.fromisoformat(data['date'].replace('Z', ''))
            except: pass

        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=data.get('payment_method_id'),
            amount=data.get('amount'),
            payment_type=data.get('payment_type'),
            status=data.get('status', 'completed'),
            date=payment_date
        )
        db.session.add(payment)
        db.session.commit()
        return payment

    @staticmethod
    def update_payment(payment_id, data):
        payment = Payment.query.get_or_404(payment_id)
        
        if 'status' in data:
            payment.status = data['status']
            
        if 'amount' in data:
            payment.amount = data['amount']
            
        if 'payment_type' in data:
            payment.payment_type = data['payment_type']
            
        if 'payment_method_id' in data:
            payment.payment_method_id = data['payment_method_id']
            
        if 'date' in data:
            try:
                new_date = datetime.fromisoformat(data['date'].replace('Z', ''))
                payment.date = new_date
                
                # If this is the earliest completed payment, sync with enrollment
                if payment.enrollment:
                    first_comp = payment.enrollment.payments.filter_by(status='completed').order_by(Payment.date.asc()).first()
                    if first_comp and first_comp.id == payment.id:
                        payment.enrollment.enrollment_date = new_date
            except: pass
            
        # Update enrollment stats? (Handled by implicit relationships or stats calc)
        # However, total_paid is a property or calced field? 
        # Enrollment model doesn't store total_paid, it's calculated on fly usually?
        # Checked SaleDetailModal: data.total_paid comes from backend response.
        # Let's check get_enrollment_details to see how total_paid is sent.
        
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

    @staticmethod
    def update_client(client_id, data):
        client = Client.query.get_or_404(client_id)
        
        if 'full_name' in data:
            client.full_name = data['full_name']
        if 'email' in data:
            email_val = data['email']
            if email_val:
                email_val = email_val.strip().lower()
                if email_val in ('n/a', 'na', 'none', 'null', '') or '@' not in email_val:
                    email_val = None
            client.email = email_val
        if 'phone' in data:
            phone_val = data['phone']
            if phone_val:
                phone_val = phone_val.strip()
                if phone_val.lower() in ('n/a', 'na', 'none', 'null', ''):
                    phone_val = None
            client.phone = phone_val
        if 'instagram' in data:
            val = data['instagram']
            if val:
                val = val.strip().strip('@')
                if val.lower() in ('n/a', 'na', 'none', 'null', ''):
                    val = None
            client.instagram = val
            
        db.session.commit()
        return client
    @staticmethod
    def get_agenda_stats(closer_id, start_date=None, end_date=None):
        from app.models import Appointment, db
        from sqlalchemy import func, and_
        
        # Build base filter
        base_filter = [Appointment.closer_id == closer_id]
        
        if start_date:
            try:
                base_filter.append(Appointment.start_time >= datetime.strptime(start_date, '%Y-%m-%d'))
            except ValueError:
                pass
        if end_date:
            try:
                # Include the full end date
                end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                base_filter.append(Appointment.start_time < end_dt)
            except ValueError:
                pass

        # 1. Agendas Pendientes (Sin resultado definido)
        # Note: Pending might be future or past, usually we care about past pending but let's stick to standard definition
        # If filtering by date, we show pending IN THAT RANGE (e.g. appointments scheduled today that have no result yet)
        pending_filter = base_filter + [or_(Appointment.result == None, Appointment.result == '')]
        pending_count = Appointment.query.filter(*pending_filter).count()
        
        # 2. Conteo por Resultado (Outcomes)
        outcomes_filter = base_filter + [Appointment.result != None, Appointment.result != '']
        outcomes_q = db.session.query(
            Appointment.result, func.count(Appointment.id)
        ).filter(
            *outcomes_filter
        ).group_by(Appointment.result).all()
        
        outcomes = {r[0]: r[1] for r in outcomes_q}
        
        # 3. Desglose por Resultado (Sin tipo de agenda)
        # Use same filter as outcomes for breakdown
        result_breakdown_q = db.session.query(
            Appointment.result, 
            func.count(Appointment.id)
        ).filter(
            *base_filter # Use base filter to include pending in total count if needed, but breakdown usually excludes pending?
            # Actually frontend expects 'results' map. Let's filter by base only to group by result (including None?)
            # The original code grouped by result on base filter?
            # Original: filter(closer_id).group_by(result).all() -> included everything
        ).group_by(
            Appointment.result
        ).all()
        
        result_stats = {}
        total_count = 0
        for result, count in result_breakdown_q:
            res_key = result if result else 'Pendiente'
            result_stats[res_key] = count
            total_count += count

        # Mantenemos 'type_stats' para compatibilidad con el frontend
        type_stats = {
            'Agendas': {
                'total': total_count,
                'results': result_stats
            }
        }

        return {
            'pending': pending_count,
            'outcomes': outcomes,
            'type_stats': type_stats
        }

    @staticmethod
    def get_comprehensive_stats(closer_id=None, start_date=None, end_date=None, agg_type='sum'):
        """Retorna estadísticas agregadas de closers con soporte de suma/promedio."""
        from app.models import CloserDailyReport, Appointment, User
        from sqlalchemy import func, or_
        from datetime import datetime, timedelta

        # 1. Base Query for Daily Reports
        query = db.session.query(
            func.sum(CloserDailyReport.slots).label('slots'),
            func.sum(CloserDailyReport.offers_made).label('offers_made'),
            func.sum(CloserDailyReport.decision_makers).label('decision_makers'),
            func.sum(CloserDailyReport.rescheduled_calls).label('rescheduled_calls'),
            func.sum(CloserDailyReport.first_call_scheduled).label('fc_scheduled'),
            func.sum(CloserDailyReport.first_call_attended).label('fc_attended'),
            func.sum(CloserDailyReport.first_call_no_show).label('fc_no_show'),
            func.sum(CloserDailyReport.first_call_rescheduled).label('fc_rescheduled'),
            func.sum(CloserDailyReport.first_call_canceled).label('fc_canceled'),
            func.sum(CloserDailyReport.second_call_scheduled).label('sc_scheduled'),
            func.sum(CloserDailyReport.second_call_attended).label('sc_attended'),
            func.sum(CloserDailyReport.second_call_no_show).label('sc_no_show'),
            func.sum(CloserDailyReport.second_call_rescheduled).label('sc_rescheduled'),
            func.sum(CloserDailyReport.second_call_canceled).label('sc_canceled'),
            func.sum(CloserDailyReport.pif_count).label('pif_count'),
            func.sum(CloserDailyReport.pif_cash_collected).label('pif_cash'),
            func.sum(CloserDailyReport.pif_in_call_count).label('pif_ic_count'),
            func.sum(CloserDailyReport.pif_in_call_cash).label('pif_ic_cash'),
            func.sum(CloserDailyReport.split_count).label('split_count'),
            func.sum(CloserDailyReport.split_cash_collected).label('split_cash'),
            func.sum(CloserDailyReport.split_in_call_count).label('split_ic_count'),
            func.sum(CloserDailyReport.split_in_call_cash).label('split_ic_cash'),
            func.sum(CloserDailyReport.deposit_count).label('deposit_count'),
            func.sum(CloserDailyReport.deposit_cash_collected).label('deposit_cash'),
            func.sum(CloserDailyReport.deposit_in_call_count).label('deposit_ic_count'),
            func.sum(CloserDailyReport.deposit_in_call_cash).label('deposit_ic_cash'),
            func.sum(CloserDailyReport.follow_ups_sent).label('fu_sent'),
            func.sum(CloserDailyReport.follow_ups_replied).label('fu_replied'),
            func.sum(CloserDailyReport.follow_ups_closed).label('fu_closed'),
            func.sum(CloserDailyReport.recoveries_contacted).label('rec_contacted'),
            func.sum(CloserDailyReport.recoveries_replied).label('rec_replied'),
            func.sum(CloserDailyReport.recoveries_scheduled).label('rec_scheduled'),
            func.sum(CloserDailyReport.referrals_sourced).label('ref_sourced'),
            func.sum(CloserDailyReport.referrals_scheduled).label('ref_scheduled')
        )

        filters = []
        if start_date:
            try:
                dt_val = datetime.strptime(start_date, '%Y-%m-%d').date() if isinstance(start_date, str) else start_date
                filters.append(CloserDailyReport.date >= dt_val)
            except ValueError:
                pass
        if end_date:
            try:
                dt_val = datetime.strptime(end_date, '%Y-%m-%d').date() if isinstance(end_date, str) else end_date
                filters.append(CloserDailyReport.date <= dt_val)
            except ValueError:
                pass
        if closer_id:
            filters.append(CloserDailyReport.closer_id == closer_id)

        for f in filters:
            query = query.filter(f)

        stats = query.one()
        
        # Days count for averages
        days_query = db.session.query(func.count(CloserDailyReport.id))
        for f in filters:
            days_query = days_query.filter(f)
        days_count = days_query.scalar() or 1

        # 2. Legacy Operational Stats (from Appointment model)
        # Reusing parts of get_agenda_stats logic
        base_appt_filter = []
        if closer_id: base_appt_filter.append(Appointment.closer_id == closer_id)
        if start_date:
            try:
                dt_val = datetime.strptime(start_date, '%Y-%m-%d') if isinstance(start_date, str) else datetime.combine(start_date, datetime.min.time())
                base_appt_filter.append(Appointment.start_time >= dt_val)
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, '%Y-%m-%d') if isinstance(end_date, str) else datetime.combine(end_date, datetime.min.time())
                base_appt_filter.append(Appointment.start_time < (end_dt + timedelta(days=1)))
            except ValueError:
                pass

        pending_count = Appointment.query.filter(*base_appt_filter, or_(Appointment.result == None, Appointment.result == '')).count()
        outcomes_q = db.session.query(Appointment.result, func.count(Appointment.id)).filter(*base_appt_filter, Appointment.result != None, Appointment.result != '').group_by(Appointment.result).all()
        outcomes = {r[0]: r[1] for r in outcomes_q}

        # Format helpers
        def val(v):
            n = float(v or 0)
            return round(n / days_count, 2) if agg_type == 'avg' else n

        def div(n, d):
            return round((n / d) * 100, 1) if d and d > 0 else 0

        # Retrieve closer identifiers to link with official sales
        closer_identifiers = []
        if closer_id:
            user = User.query.get(closer_id)
            if user:
                username_lower = (user.username or '').lower()
                mapping = {
                    'jean carlo': ['jeancarlo@thelearnation.com'],
                    'marlon': ['marlon@thelearnation.com', 'marlongarcia27948@gmail.com'],
                    'guillermo': ['guillermo@thelearnation.com'],
                    'tomas': ['tomas@thelearnation.com', 'tomaszetaaa@gmail.com'],
                    'mario': ['mario@neurocogniciones.com', 'mario@thelearnation.com'],
                    'mercari': ['mercaricc@gmail.com', 'mírcari', 'mircari', 'mercari'],
                    'iñaki': ['iñaki', 'inaki'],
                    'rafael': ['rafael'],
                    'mateo': ['mateo'],
                    'belén': ['mbelenamerise@gmail.com', 'belen'],
                    'valery': ['valeryjohana.cabrera@gmail.com', 'valery']
                }
                
                matched = False
                for key, val_list in mapping.items():
                    if key in username_lower:
                        closer_identifiers = val_list
                        matched = True
                        break
                
                if not matched and user.email:
                    closer_identifiers = [user.email]

        # Query official sales from FinancialSale to match Sales Log exactly
        from app.models import FinancialSale
        from sqlalchemy import case, func, or_
        
        neto_monto_expr = case(
            (func.lower(func.trim(FinancialSale.metodo_pago)) == 'stripe', FinancialSale.monto * 0.955),
            (func.lower(func.trim(FinancialSale.metodo_pago)) == 'hotmart', FinancialSale.monto * 0.911),
            else_=FinancialSale.monto
        )
        
        sales_query = db.session.query(
            FinancialSale.tipo_pago,
            func.count(FinancialSale.id).label('count'),
            func.sum(FinancialSale.monto).label('cash'),
            func.sum(neto_monto_expr).label('cash_neto')
        )
        
        sales_filters = [
            or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == '')
        ]
        if start_date:
            try:
                dt_val = datetime.strptime(start_date, '%Y-%m-%d') if isinstance(start_date, str) else datetime.combine(start_date, datetime.min.time())
                sales_filters.append(FinancialSale.date >= dt_val)
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, '%Y-%m-%d') if isinstance(end_date, str) else datetime.combine(end_date, datetime.min.time())
                sales_filters.append(FinancialSale.date < (end_dt + timedelta(days=1)))
            except ValueError:
                pass
        if closer_identifiers:
            sales_filters.append(FinancialSale.email_vendedor.in_(closer_identifiers))
            
        sales_rows = sales_query.filter(*sales_filters).group_by(FinancialSale.tipo_pago).all()
        
        official_pif_count = 0.0
        official_pif_cash = 0.0
        official_pif_cash_neto = 0.0
        official_split_count = 0.0
        official_split_cash = 0.0
        official_split_cash_neto = 0.0
        official_deposit_count = 0.0
        official_deposit_cash = 0.0
        official_deposit_cash_neto = 0.0
        official_installment_count = 0.0
        official_installment_cash = 0.0
        official_installment_cash_neto = 0.0
        official_upsell_count = 0.0
        official_upsell_cash = 0.0
        official_upsell_cash_neto = 0.0
        official_renovacion_count = 0.0
        official_renovacion_cash = 0.0
        official_renovacion_cash_neto = 0.0
        
        for tipo, count, cash, cash_neto in sales_rows:
            tipo_lower = (tipo or '').lower()
            cash_val = float(cash or 0.0)
            cash_neto_val = float(cash_neto or 0.0)
            count_val = float(count or 0.0)
            
            if 'upsell' in tipo_lower:
                official_upsell_count += count_val
                official_upsell_cash += cash_val
                official_upsell_cash_neto += cash_neto_val
            elif 'renovacion' in tipo_lower or 'renovación' in tipo_lower:
                official_renovacion_count += count_val
                official_renovacion_cash += cash_val
                official_renovacion_cash_neto += cash_neto_val
            elif 'completo' in tipo_lower or 'unico' in tipo_lower or 'pif' in tipo_lower:
                official_pif_count += count_val
                official_pif_cash += cash_val
                official_pif_cash_neto += cash_neto_val
            elif 'seña' in tipo_lower or 'deposito' in tipo_lower or 'deposit' in tipo_lower:
                official_deposit_count += count_val
                official_deposit_cash += cash_val
                official_deposit_cash_neto += cash_neto_val
            elif 'primer pago' in tipo_lower or 'split' in tipo_lower:
                official_split_count += count_val
                official_split_cash += cash_val
                official_split_cash_neto += cash_neto_val
            elif 'cuota' in tipo_lower or 'installment' in tipo_lower or 'pago 2' in tipo_lower or 'pago 3' in tipo_lower or 'pago 4' in tipo_lower:
                official_installment_count += count_val
                official_installment_cash += cash_val
                official_installment_cash_neto += cash_neto_val
            else:
                # Si no matchea palabras clave de cuota pero es un pago fraccionado, verificar si es posterior
                is_subsequent = False
                import re
                match = re.search(r'pago\s*(\d+)', tipo_lower)
                if match:
                    num = int(match.group(1))
                    if num > 1:
                        is_subsequent = True
                
                if is_subsequent:
                    official_installment_count += count_val
                    official_installment_cash += cash_val
                    official_installment_cash_neto += cash_neto_val
                else:
                    official_split_count += count_val
                    official_split_cash += cash_val
                    official_split_cash_neto += cash_neto_val

        # Scale official sales metrics by aggregation type
        final_pif_count = round(official_pif_count / days_count, 2) if agg_type == 'avg' else official_pif_count
        final_pif_cash = round(official_pif_cash / days_count, 2) if agg_type == 'avg' else official_pif_cash
        final_pif_cash_neto = round(official_pif_cash_neto / days_count, 2) if agg_type == 'avg' else official_pif_cash_neto
        
        final_split_count = round(official_split_count / days_count, 2) if agg_type == 'avg' else official_split_count
        final_split_cash = round(official_split_cash / days_count, 2) if agg_type == 'avg' else official_split_cash
        final_split_cash_neto = round(official_split_cash_neto / days_count, 2) if agg_type == 'avg' else official_split_cash_neto
        
        final_deposit_count = round(official_deposit_count / days_count, 2) if agg_type == 'avg' else official_deposit_count
        final_deposit_cash = round(official_deposit_cash / days_count, 2) if agg_type == 'avg' else official_deposit_cash
        final_deposit_cash_neto = round(official_deposit_cash_neto / days_count, 2) if agg_type == 'avg' else official_deposit_cash_neto
        
        final_installment_count = round(official_installment_count / days_count, 2) if agg_type == 'avg' else official_installment_count
        final_installment_cash = round(official_installment_cash / days_count, 2) if agg_type == 'avg' else official_installment_cash
        final_installment_cash_neto = round(official_installment_cash_neto / days_count, 2) if agg_type == 'avg' else official_installment_cash_neto

        final_upsell_count = round(official_upsell_count / days_count, 2) if agg_type == 'avg' else official_upsell_count
        final_upsell_cash = round(official_upsell_cash / days_count, 2) if agg_type == 'avg' else official_upsell_cash
        final_upsell_cash_neto = round(official_upsell_cash_neto / days_count, 2) if agg_type == 'avg' else official_upsell_cash_neto

        final_renovacion_count = round(official_renovacion_count / days_count, 2) if agg_type == 'avg' else official_renovacion_count
        final_renovacion_cash = round(official_renovacion_cash / days_count, 2) if agg_type == 'avg' else official_renovacion_cash
        final_renovacion_cash_neto = round(official_renovacion_cash_neto / days_count, 2) if agg_type == 'avg' else official_renovacion_cash_neto

        # Calcular conversión de señas en venta real (PIF o Split)
        señas_convertidas = 0
        total_señas = 0
        
        # Recuperar todas las transacciones individuales de tipo "seña" del closer en el periodo consultado
        señas_rows_periodo = FinancialSale.query.filter(
            *sales_filters,
            or_(
                FinancialSale.tipo_pago.ilike('%seña%'),
                FinancialSale.tipo_pago.ilike('%deposito%'),
                FinancialSale.tipo_pago.ilike('%deposit%')
            )
        ).all()
        
        total_señas = len(señas_rows_periodo)
        
        for seña in señas_rows_periodo:
            # Buscar si el mismo cliente tiene una venta posterior/igual de tipo PIF/Split
            ig_norm = seña.instagram.strip().lstrip('@').lower() if seña.instagram else None
            email_norm = seña.mail_cliente.strip().lower() if seña.mail_cliente else None
            tel_norm = seña.telefono.strip() if seña.telefono else None
            
            sub_filters = []
            if ig_norm and ig_norm != 'n/a' and len(ig_norm) > 2:
                sub_filters.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == ig_norm)
            if email_norm and email_norm != 'n/a' and len(email_norm) > 2:
                sub_filters.append(func.lower(FinancialSale.mail_cliente) == email_norm)
            if tel_norm and tel_norm != 'n/a' and len(tel_norm) > 4:
                sub_filters.append(FinancialSale.telefono == tel_norm)
                
            if sub_filters:
                venta_definitiva = FinancialSale.query.filter(
                    or_(*sub_filters),
                    FinancialSale.id != seña.id,
                    ~or_(
                        FinancialSale.tipo_pago.ilike('%seña%'),
                        FinancialSale.tipo_pago.ilike('%deposito%'),
                        FinancialSale.tipo_pago.ilike('%deposit%')
                    )
                ).first()
                
                if venta_definitiva:
                    señas_convertidas += 1
                    
        conversion_señas_rate = round((señas_convertidas / total_señas * 100), 1) if total_señas > 0 else 0.0

        # Totals
        total_scheduled = val(stats.fc_scheduled) + val(stats.sc_scheduled)
        total_attended = val(stats.fc_attended) + val(stats.sc_attended)
        total_no_show = val(stats.fc_no_show) + val(stats.sc_no_show)
        total_rescheduled = val(stats.fc_rescheduled) + val(stats.sc_rescheduled)
        total_canceled = val(stats.fc_canceled) + val(stats.sc_canceled)

        # Cierres reales excluyen las cuotas
        total_sales = final_pif_count + final_split_count + final_deposit_count + final_upsell_count + final_renovacion_count
        # Efectivo total recaudado incluye las cuotas, upsells y renovaciones
        total_cash = final_pif_cash + final_split_cash + final_deposit_cash + final_installment_cash + final_upsell_cash + final_renovacion_cash
        total_cash_neto = final_pif_cash_neto + final_split_cash_neto + final_deposit_cash_neto + final_installment_cash_neto + final_upsell_cash_neto + final_renovacion_cash_neto
        total_ic_sales = val(stats.pif_ic_count) + val(stats.split_ic_count) + val(stats.deposit_ic_count)
        total_ic_cash = val(stats.pif_ic_cash) + val(stats.split_ic_cash) + val(stats.deposit_ic_cash)

        # Calculo de ticket promedio general y por programa (solo PIF y Split Pays)
        all_sales = FinancialSale.query.filter(*sales_filters).all()
        program_data = {}
        total_pif_split_cash = 0.0
        total_pif_split_count = 0.0

        for sale in all_sales:
            tipo_lower = (sale.tipo_pago or '').lower()
            monto_val = float(sale.monto or 0.0)

            is_pif = 'completo' in tipo_lower or 'unico' in tipo_lower or 'pif' in tipo_lower
            is_deposit = 'seña' in tipo_lower or 'deposito' in tipo_lower or 'deposit' in tipo_lower
            is_installment = 'cuota' in tipo_lower or 'installment' in tipo_lower or 'pago 2' in tipo_lower or 'pago 3' in tipo_lower or 'pago 4' in tipo_lower

            is_subsequent = False
            if not is_pif and not is_deposit and not is_installment:
                import re
                match = re.search(r'pago\s*(\d+)', tipo_lower)
                if match:
                    num = int(match.group(1))
                    if num > 1:
                        is_subsequent = True

            if is_installment or is_subsequent:
                is_installment = True

            # Solo cuentan pagos PIF y Split Pays
            if is_pif or (not is_deposit and not is_installment):
                prog_raw = (sale.tipo_pago or '').upper()
                examen_raw = (sale.examen or '').upper()

                if "RR" in prog_raw or "RESIDENCY" in prog_raw or "ROADMAP" in prog_raw:
                    prog_name = "Residency Roadmap"
                elif "AL" in prog_raw or "ACE" in prog_raw or "LEARNERS" in prog_raw:
                    prog_name = "Ace Learners"
                elif "SI" in prog_raw or "SPECIALIST" in prog_raw or "INITIATIVE" in prog_raw or "INICIATIVE" in prog_raw:
                    prog_name = "Specialist Initiative"
                elif "RR" in examen_raw or "RESIDENCY" in examen_raw or "ROADMAP" in examen_raw:
                    prog_name = "Residency Roadmap"
                elif "AL" in examen_raw or "ACE" in examen_raw or "LEARNERS" in examen_raw:
                    prog_name = "Ace Learners"
                elif "SI" in examen_raw or "SPECIALIST" in examen_raw or "INITIATIVE" in examen_raw or "INICIATIVE" in examen_raw:
                    prog_name = "Specialist Initiative"
                else:
                    prog_name = "Sin Programa"

                if prog_name not in program_data:
                    program_data[prog_name] = {"cash": 0.0, "count": 0}

                program_data[prog_name]["cash"] += monto_val
                program_data[prog_name]["count"] += 1

                total_pif_split_cash += monto_val
                total_pif_split_count += 1

        general_average_ticket = round(total_pif_split_cash / total_pif_split_count, 2) if total_pif_split_count > 0 else 0.0

        program_tickets = []
        for prog_name, p_info in program_data.items():
            avg = round(p_info["cash"] / p_info["count"], 2) if p_info["count"] > 0 else 0.0
            program_tickets.append({
                "program": prog_name,
                "average_ticket": avg,
                "count": p_info["count"]
            })

        program_tickets.sort(key=lambda x: x["count"], reverse=True)

        # Obtener reportes diarios en el rango para discrepancias
        reports_in_period = CloserDailyReport.query.filter(*filters).all()
        
        # Agrupar cash en llamada reportado por dia
        reports_by_day = {}
        for r in reports_in_period:
            d_str = r.date.strftime('%Y-%m-%d') if r.date else None
            if not d_str:
                continue
            in_call_cash = (
                float(r.pif_in_call_cash or 0.0) +
                float(r.split_in_call_cash or 0.0) +
                float(r.deposit_in_call_cash or 0.0) +
                float(r.installment_in_call_cash or 0.0)
            )
            reports_by_day[d_str] = reports_by_day.get(d_str, 0.0) + in_call_cash

        # Agrupar cash total registrado (ventas brutos) por dia
        sales_by_day = {}
        for sale in all_sales:
            d_str = sale.date.strftime('%Y-%m-%d') if sale.date else None
            if not d_str:
                continue
            monto_val = float(sale.monto or 0.0)
            sales_by_day[d_str] = sales_by_day.get(d_str, 0.0) + monto_val

        # Detectar discrepancias diarias (donde el cash reportado en llamada supere a las ventas registradas)
        discrepancies = []
        all_dates = sorted(list(set(list(reports_by_day.keys()) + list(sales_by_day.keys()))))
        
        for d_str in all_dates:
            rep_ic = reports_by_day.get(d_str, 0.0)
            reg_total = sales_by_day.get(d_str, 0.0)
            diff = reg_total - rep_ic
            
            if diff < -0.01:
                discrepancies.append({
                    "date": d_str,
                    "reported_in_call": round(rep_ic, 2),
                    "registered_total": round(reg_total, 2),
                    "difference": round(diff, 2)
                })

        # Escalar metricas por tipo de agregacion (promedio de dias en dashboard)
        if agg_type == 'avg':
            scaled_general_avg = round(general_average_ticket / days_count, 2)
            scaled_program_tickets = [
                {
                    "program": pt["program"],
                    "average_ticket": round(pt["average_ticket"] / days_count, 2),
                    "count": round(pt["count"] / days_count, 2)
                }
                for pt in program_tickets
            ]
        else:
            scaled_general_avg = general_average_ticket
            scaled_program_tickets = program_tickets

        # Obtener cumplimiento de reportes diarios
        import pytz
        from datetime import datetime, date, timedelta

        active_closers = User.query.filter_by(role='closer', is_active=True).all()

        closer_reports_status = []
        al_dia_count = 0
        vencidos_count = 0

        for c in active_closers:
            try:
                c_tz = pytz.timezone(c.timezone or 'America/La_Paz')
            except Exception:
                c_tz = pytz.UTC
            today_local = datetime.now(c_tz).date()
            yesterday_local = today_local - timedelta(days=1)

            last_report = CloserDailyReport.query.filter_by(closer_id=c.id).order_by(CloserDailyReport.date.desc()).first()

            if last_report:
                last_date = last_report.date
                # Al día = hizo el reporte de ayer o hoy
                if last_date >= yesterday_local:
                    status_text = "Al día"
                    status_type = "al_dia"
                    days_late = 0
                    al_dia_count += 1
                else:
                    # Días de retraso = días desde ayer que no ha reportado
                    days_late = (yesterday_local - last_date).days
                    status_text = f"{days_late} día{'s' if days_late != 1 else ''} de retraso"
                    status_type = "vencido"
                    vencidos_count += 1
                last_report_str = last_date.strftime('%d/%m/%Y')
            else:
                days_late = 999
                status_text = "Sin reportes"
                status_type = "sin_reporte"
                vencidos_count += 1
                last_report_str = "Nunca"
                
            closer_reports_status.append({
                "closer_id": c.id,
                "closer_name": c.username,
                "last_report": last_report_str,
                "status": status_text,
                "status_type": status_type,
                "days_late": days_late if last_report else 999
            })
            
        # Ordenar: vencidos primero (mayor retraso arriba), luego al día
        closer_reports_status.sort(key=lambda x: -(x.get('days_late', 0)))
            
        total_active_closers = len(active_closers)
        pct_al_dia = round((al_dia_count / total_active_closers) * 100, 1) if total_active_closers > 0 else 0.0
        pct_vencidos = round((vencidos_count / total_active_closers) * 100, 1) if total_active_closers > 0 else 0.0
        
        reports_productivity = {
            "al_dia_pct": pct_al_dia,
            "al_dia_count": al_dia_count,
            "vencidos_pct": pct_vencidos,
            "vencidos_count": vencidos_count,
            "total_closers": total_active_closers,
            "details": closer_reports_status
        }


        return {
            "metadata": {
                "days_analyzed": days_count,
                "agg_type": agg_type
            },
            "reports_productivity": reports_productivity,
            "operational": {
                "pending": pending_count,
                "outcomes": outcomes
            },
            "general": {
                "slots": val(stats.slots),
                "offers_made": val(stats.offers_made),
                "decision_makers": val(stats.decision_makers),
                "rescheduled_calls": val(stats.rescheduled_calls),
            },
            "agendas": {
                "first_call": {
                    "scheduled": val(stats.fc_scheduled), "attended": val(stats.fc_attended),
                    "no_show": val(stats.fc_no_show), "rescheduled": val(stats.fc_rescheduled), "canceled": val(stats.fc_canceled),
                },
                "second_call": {
                    "scheduled": val(stats.sc_scheduled), "attended": val(stats.sc_attended),
                    "no_show": val(stats.sc_no_show), "rescheduled": val(stats.sc_rescheduled), "canceled": val(stats.sc_canceled),
                },
                "totals": {
                    "scheduled": total_scheduled, "attended": total_attended,
                    "no_show": total_no_show, "rescheduled": total_rescheduled, "canceled": total_canceled,
                }
            },
            "sales": {
                "pif": {"count": final_pif_count, "cash": final_pif_cash, "cash_neto": final_pif_cash_neto, "in_call_count": val(stats.pif_ic_count), "in_call_cash": val(stats.pif_ic_cash)},
                "split": {"count": final_split_count, "cash": final_split_cash, "cash_neto": final_split_cash_neto, "in_call_count": val(stats.split_ic_count), "in_call_cash": val(stats.split_ic_cash)},
                "deposit": {"count": final_deposit_count, "cash": final_deposit_cash, "cash_neto": final_deposit_cash_neto, "in_call_count": val(stats.deposit_ic_count), "in_call_cash": val(stats.deposit_ic_cash)},
                "installment": {"count": final_installment_count, "cash": final_installment_cash, "cash_neto": final_installment_cash_neto, "in_call_count": 0, "in_call_cash": 0},
                "upsell": {"count": final_upsell_count, "cash": final_upsell_cash, "cash_neto": final_upsell_cash_neto, "in_call_count": 0, "in_call_cash": 0},
                "renovacion": {"count": final_renovacion_count, "cash": final_renovacion_cash, "cash_neto": final_renovacion_cash_neto, "in_call_count": 0, "in_call_cash": 0},
                "deposit_conversions": {"total": total_señas, "converted": señas_convertidas, "rate": conversion_señas_rate},
                "general_average_ticket": scaled_general_avg,
                "program_tickets": scaled_program_tickets,
                "discrepancies": discrepancies,
                "totals": {"count": total_sales, "cash": total_cash, "cash_neto": total_cash_neto, "in_call_count": total_ic_sales, "in_call_cash": total_ic_cash}
            },
            "follow_ups": {
                "sent": val(stats.fu_sent), "replied": val(stats.fu_replied),
                "closed": val(stats.fu_closed),
                "recoveries_contacted": val(stats.rec_contacted),
                "recoveries_replied": val(stats.rec_replied),
                "recoveries_scheduled": val(stats.rec_scheduled),
                "referrals_sourced": val(stats.ref_sourced),
                "referrals_scheduled": val(stats.ref_scheduled)
            },
            "percentages": {
                "show_rate": div(total_attended, total_scheduled),
                "no_show_rate": div(total_no_show, total_scheduled),
                "cancel_rate": div(total_canceled, total_scheduled),
                "close_rate": div(total_sales, total_attended),
                "offer_to_sale": div(total_sales, float(stats.offers_made or 0)),
                "respond_rate": div(val(stats.fu_replied), val(stats.fu_sent)),
                "pitch_rate": div(val(stats.offers_made), total_attended),
                "decision_maker_rate": div(val(stats.decision_makers), total_attended),
                "rescheduled_rate": div(val(stats.rescheduled_calls), total_attended - val(stats.decision_makers)),
                "deposit_conversion_rate": conversion_señas_rate
            }
        }

    @staticmethod
    def archive_stale_backlog(days=30, dry_run=False, limit=None):
        """Archiva citas que nunca fueron confirmadas (result/closer_result siguen en
        'Pendiente'/vacío, closer_processed=False) y cuya fecha ya pasó hace más de
        `days` días. Las marca como 'Lead Perdido' (mismo estado terminal que usa un
        closer al descartar manualmente un lead, vía CloserService.process_agenda),
        para que dejen de acumularse invisibles fuera de la ventana de "Confirmaciones"
        del mazo del closer sin perder el registro histórico de la cita.

        Corte por fecha en UTC absoluto (no por zona horaria de cada closer): es un
        barrido de mantenimiento en segundo plano, no una vista para el usuario, así
        que una imprecisión de pocas horas contra el corte real de cada closer es
        aceptable y evita tener que iterar closer por closer.
        """
        cutoff_utc = datetime.utcnow() - timedelta(days=days)

        query = Appointment.query.filter(
            Appointment.start_time < cutoff_utc,
            Appointment.closer_processed == False,
            or_(Appointment.closer_result == 'Pendiente', Appointment.closer_result == None, Appointment.closer_result == '')
        )
        if limit:
            query = query.limit(limit)

        appointments = query.all()
        archived_ids = [a.id for a in appointments]

        if dry_run:
            return {"count": len(archived_ids), "ids": archived_ids[:50], "dry_run": True}

        note = f"[Sistema] Archivado automáticamente: sin confirmar ni procesar tras {days}+ días desde su fecha."
        for appt in appointments:
            appt.closer_result = 'Lead Perdido'
            appt.closer_processed = True
            appt.seguimiento_realizado = True
            appt.closer_notes = f"{appt.closer_notes}\n{note}".strip() if appt.closer_notes else note

        db.session.commit()
        return {"count": len(archived_ids), "ids": archived_ids[:50], "dry_run": False}
