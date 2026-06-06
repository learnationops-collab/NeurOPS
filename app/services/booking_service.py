from app.models import Availability, Appointment, User, Client, SurveyAnswer, Notification, db
from sqlalchemy import or_
from datetime import datetime, timedelta, date, time
import pytz

class BookingService:
    @staticmethod
    def get_available_slots_utc(start_date, end_date, preferred_closer_id=None):
        from app.models import WeeklyAvailability
        
        # Get all active appointments (not cancelled or rescheduled) in range to avoid double booking
        appointments = Appointment.query.filter(
            Appointment.start_time >= datetime.combine(start_date, time.min),
            Appointment.start_time <= datetime.combine(end_date, time.max) + timedelta(days=1),
            or_(Appointment.result == None, Appointment.result == '', Appointment.result.notin_(['Cancelada', 'Reprogramada']))
        ).all()
        
        booked_slots = set()
        for appt in appointments:
            booked_slots.add((appt.closer_id, appt.start_time))
            
        unique_slots = {}
        
        # Iterate through each day in the range
        current_date = start_date
        while current_date <= end_date:
            # 1. Check for specific overrides in Availability table for this day
            day_avs = Availability.query.filter_by(date=current_date)
            if preferred_closer_id:
                day_avs = day_avs.filter_by(closer_id=preferred_closer_id)
            
            day_avs = day_avs.all()
            
            if day_avs:
                # Use specific offsets if they exist
                for av in day_avs:
                    BookingService._process_slot(av.closer, current_date, av.start_time, booked_slots, unique_slots, preferred_closer_id)
            else:
                # 2. Fallback to WeeklyAvailability
                day_of_week = current_date.weekday() # 0 = Monday, etc.
                weekly_query = WeeklyAvailability.query.filter_by(day_of_week=day_of_week, is_active=True)
                if preferred_closer_id:
                    weekly_query = weekly_query.filter_by(closer_id=preferred_closer_id)
                
                weekly_slots = weekly_query.all()
                for ws in weekly_slots:
                    BookingService._process_slot(ws.closer, current_date, ws.start_time, booked_slots, unique_slots, preferred_closer_id)
            
            current_date += timedelta(days=1)
        
        available_slots = list(unique_slots.values())
        available_slots.sort(key=lambda x: x['ts'])
        return available_slots

    @staticmethod
    def _process_slot(closer, date_val, time_val, booked_slots, unique_slots, preferred_closer_id):
        if not closer: return
        
        try: closer_tz = pytz.timezone(closer.timezone or 'America/La_Paz')
        except: closer_tz = pytz.timezone('America/La_Paz')
            
        local_dt = closer_tz.localize(datetime.combine(date_val, time_val))
        utc_dt = local_dt.astimezone(pytz.UTC).replace(tzinfo=None)
        
        # Avoid past slots (with 5 min buffer)
        if utc_dt < datetime.utcnow() - timedelta(minutes=5): return
        
        if (closer.id, utc_dt) not in booked_slots:
            ts_key = utc_dt
            if ts_key not in unique_slots:
                unique_slots[ts_key] = {
                    'utc_iso': utc_dt.isoformat() + 'Z', 
                    'closer_id': closer.id, 
                    'ts': utc_dt.replace(tzinfo=pytz.UTC).timestamp(),
                    'date': date_val.isoformat(),
                    'start': time_val.strftime('%H:%M')
                }
            elif preferred_closer_id and closer.id == preferred_closer_id:
                 unique_slots[ts_key]['closer_id'] = closer.id

    @staticmethod
    def create_or_update_client(data, client_id=None):
        email = data.get('email')
        name = data.get('name')
        
        client = None
        if client_id: client = Client.query.get(client_id)
        if not client and email: client = Client.query.filter_by(email=email).first()

        if not client:
            client = Client(
                full_name=name,
                email=email,
                phone=data.get('phone'),
                instagram=data.get('instagram')
            )
            db.session.add(client)
        else:
            if name: client.full_name = name
            if 'phone' in data: client.phone = data['phone']
            if 'instagram' in data: client.instagram = data['instagram']
        
        db.session.commit()
        return client

    @staticmethod
    def create_appointment(client_id, closer_id, start_time_utc, origin='direct', setter_id=None):
        # Check for conflict on same time for same closer, ignoring cancelled/rescheduled ones
        conflict = Appointment.query.filter_by(closer_id=closer_id, start_time=start_time_utc).filter(
            or_(Appointment.result == None, Appointment.result == '', Appointment.result.notin_(['Cancelada', 'Reprogramada']))
        ).first()
        if conflict: return None
            
        appt = Appointment(
            closer_id=closer_id,
            setter_id=setter_id,
            client_id=client_id,
            start_time=start_time_utc,
            origin=origin,
            last_stage='Nueva'
        )
        db.session.add(appt)
        
        # Crear notificación consolidada para el Closer y Admins
        try:
            client = Client.query.get(client_id)
            client_name = client.full_name or client.email or "Cliente"
            
            noti = Notification(
                subject="Nueva Agenda",
                content=f"Nueva sesión con {client_name} para el {start_time_utc.strftime('%d/%m/%Y %H:%M')} UTC.",
                target_users=["role:admin", int(closer_id)],
                related_users=[int(closer_id), client_id],
                associated_id=appt.id,
                associated_type='appointment'
            )
            db.session.add(noti)
            
            # --- SYNC LEAD (Bridge to ManyChat/Marketing Leads) ---
            try:
                from app.models import Lead, PipelineStage, Pipeline
                import uuid
                
                # 1. Search for existing Lead by email
                lead = None
                if client.email:
                    lead = Lead.query.filter_by(email=client.email).first()
                
                # 2. If not found, create new Lead
                if not lead:
                    # Find 'Nueva' stage or default
                    stage = PipelineStage.query.filter_by(name='Nueva').first()
                    if not stage:
                        # Fallback to first stage of first pipeline or just None (nullable=True?)
                        # Lead.stage_id is nullable=True
                        pass

                    # Generate dummy ID if creating from Booking (not ManyChat)
                    dummy_mc_id = f"gen_{int(datetime.utcnow().timestamp())}_{str(uuid.uuid4())[:8]}"
                    
                    lead = Lead(
                        manychat_id=dummy_mc_id,
                        name=client.full_name or client.email or "Sin Nombre",
                        email=client.email,
                        instagram_username=client.instagram,
                        # phone field does not exist in Lead model
                        stage_id=stage.id if stage else None,
                        ad_source=origin or 'Booking',
                        notes=f"Creado automáticamente desde Agenda ID {appt.id}"
                    )
                    db.session.add(lead)
                    db.session.flush() # get ID
                
                # 3. Update existing or new Lead
                # Link appointment in notes (since no direct FK)
                new_note = f"\n[Auto] Agenda creada: {start_time_utc.strftime('%Y-%m-%d %H:%M')} (ID: {appt.id})"
                lead.notes = (lead.notes or "") + new_note
                
                # Optional: Force stage to 'Agendado' if it exists? 
                # User said "se actualiza como lead". "Nueva" might be for new leads.
                # If they booked, maybe stage should be "Agendada"?
                # But Closer Kanban uses Appointments. Lead Pipeline (Marketing) might have 'Agendada'.
                # Let's check PipelineStages for 'Agendada'.
                agendada_stage = PipelineStage.query.filter(PipelineStage.name.ilike('%Agend%')).first()
                if agendada_stage:
                    lead.stage_id = agendada_stage.id
                
            except Exception as lead_err:
                print(f"[BookingService] Error syncing Lead: {lead_err}")
                # Don't fail the appointment creation
            
            # -------------------------------------------------------

        except Exception as e:
            print(f"Error creating notification for appointment: {e}")
            # No bloqueamos el agendamiento si falla la notificación

        db.session.commit()
        return appt

    @staticmethod
    def save_survey_answers(client_id, answers_data, appointment_id=None):
        for item in answers_data:
            q_id = item['question_id']
            ans_text = item['answer']
            existing = SurveyAnswer.query.filter_by(client_id=client_id, question_id=q_id).first()
            if existing:
                existing.answer = ans_text
                if appointment_id: existing.appointment_id = appointment_id
            else:
                new_ans = SurveyAnswer(client_id=client_id, question_id=q_id, answer=ans_text, appointment_id=appointment_id)
                db.session.add(new_ans)
        db.session.commit()

    @staticmethod
    def trigger_agenda_webhook(appointment, event=None):
        # Trigger the webhook

        
        try:
            from app.models import Integration
            # 1. Find 'Agenda' Integration
            webhook = Integration.query.filter(Integration.name.ilike('Agenda%')).first()
            if not webhook:
                # Try by key if name fails
                webhook = Integration.query.filter_by(key='agenda_webhook').first()
            
            if not webhook: return
            
            url = webhook.url_prod if webhook.active_env == 'prod' else webhook.url_dev
            if not url: return

            import requests
            
            # 2. Prepare Data
            client = appointment.client
            closer = appointment.closer
            
            # Count appointments for this client to get "numero_agenda"
            count = Appointment.query.filter_by(client_id=client.id).count()
            
            # Format Date/Time (Adjust to Closer's TZ if possible, else UTC)
            tz_name = closer.timezone or 'America/La_Paz'
            user_tz = pytz.timezone(tz_name)
            local_dt = appointment.start_time.replace(tzinfo=pytz.UTC).astimezone(user_tz)
            
            date_str = local_dt.strftime('%d/%m/%Y')
            time_str = local_dt.strftime('%H:%M')
            
            # Source for Discord Display (User request: Setter Name or "Sin Setter")
            display_source = appointment.setter.username if appointment.setter else "Sin Setter"
            
            payload = {
                "nombre_completo": client.full_name or "Sin Nombre",
                "primer_nombre": client.full_name.split(' ')[0] if client.full_name else "",
                "numero_telefono": client.phone or "",
                "fuente": display_source,
                "fecha_agenda": date_str,
                "hora_agenda": time_str,
                "closer": closer.username,
                "zona_geografica": tz_name,
                "tipo_evento": "agendada",
                "numero_agenda": count
            }
            
            # 3. Send
            if 'discord.com/api/webhooks' in url:
                try:
                    from app.services.image_service import ImageService
                    import json
                    
                    # Calculate todays count
                    today_start = datetime.combine(datetime.utcnow().date(), time.min)
                    today_end = datetime.combine(datetime.utcnow().date(), time.max)
                    todays_count = Appointment.query.filter(
                        Appointment.created_at >= today_start,
                        Appointment.created_at <= today_end
                    ).count()
                    
                    # Prepare Image Data
                    img_data = {
                        "client_name": payload.get('nombre_completo', 'N/A'),
                        "closer_name": payload.get('closer', 'N/A'),
                        "date_str": payload.get('fecha_agenda', ''),
                        "time_str": payload.get('hora_agenda', ''),
                        "source": payload.get('fuente', 'N/A'),
                        "client_phone": client.phone or 'N/A',
                        "client_ig": getattr(client, 'instagram_username', 'N/A'),
                        "count": todays_count
                    }
                    
                    # Generate Image
                    img_buffer = ImageService.generate_client_card(img_data)
                    
                    # Discord Multipart Payload
                    files = {
                        'file': ('agenda_card.png', img_buffer, 'image/png')
                    }
                    
                    # JSON payload
                    json_payload = {
                        "content": f"@everyone **📅 NUEVA AGENDA**\nCantidad de agendas de hoy: **{todays_count}**",
                        "embeds": [{
                            "color": 3801080, # Sky blue (matches accent)
                            "image": {
                                "url": "attachment://agenda_card.png"
                            },
                        }]
                    }
                    
                    res = requests.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=10)
                    print(f"[Discord] Status: {res.status_code} | Response: {res.text}")
                    res.raise_for_status()
                    
                except Exception as img_err:
                    print(f"[Discord Image Error] {img_err}. Fallback to text.")
                    res = requests.post(url, json=payload, timeout=5)
                    print(f"[Discord Fallback] Status: {res.status_code} | Response: {res.text}")
            else:
                requests.post(url, json=payload, timeout=5)
            print(f"[Agenda Webhook] Sent to {url}")
            
            # 4. WhatsApp Automation via 2Chat (Forcing Jean Carlo's Number)
            try:
                from app.services.two_chat_service import TwoChatService
                
                # Forced Sender (Jean Carlo)
                JEAN_CARLO_NUMBER = "+525620873819"
                
                # Refined Professional Message
                wa_message = (
                    f"¡Hola {payload['primer_nombre']}! 👋\n\n"
                    f"Te confirmo que hemos recibido tu agendamiento para tu sesión de consultoría "
                    f"con **{payload['closer']}**.\n\n"
                    f"📅 **Fecha:** {payload['fecha_agenda']}\n"
                    f"⏰ **Hora:** {payload['hora_agenda']}\n\n"
                    f"¡Nos vemos pronto! 🚀"
                )
                
                TwoChatService.send_message(
                    to_number=client.phone,
                    text=wa_message,
                    from_number=JEAN_CARLO_NUMBER
                )
                print(f"[2Chat Auto] Message sent from {JEAN_CARLO_NUMBER} to {client.phone}")
            except Exception as wa_err:
                print(f"[2Chat Auto Error] {wa_err}")
                
        except Exception as e:
            print(f"[Agenda Webhook Error] {e}")

    @staticmethod
    def log_lead_event(appt_id, user_id, action_type, description):
        from app.models import LeadEventLog
        
        log = LeadEventLog(
            appointment_id=appt_id,
            user_id=user_id,
            action_type=action_type,
            description=description
        )
        db.session.add(log)
        try:
            db.session.commit()
            return log
        except Exception as err:
            db.session.rollback()
            print(f"[LeadEventLog Error] {err}")
            return None

    @staticmethod
    def resolve_user_by_name(name_str, default_role=None):
        """Resuelve un usuario por nombre/username de forma flexible."""
        if not name_str:
            return None
        name_clean = str(name_str).strip().lower()
        if name_clean in ('n/a', 'none', 'undefined', 'sin asignar', 'sin_asignar', 'equipo', ''):
            return None
        
        # 1. Coincidencia exacta por username
        user = User.query.filter(User.username.ilike(name_clean)).first()
        if user:
            return user
            
        # 2. Coincidencia sin espacios
        name_no_spaces = name_clean.replace(' ', '')
        user = User.query.filter(User.username.ilike(name_no_spaces)).first()
        if user:
            return user
            
        # 3. Coincidencia parcial priorizando rol
        users = User.query.all()
        for u in users:
            u_name = u.username.lower()
            if u_name in name_no_spaces or name_no_spaces in u_name:
                if default_role and u.role == default_role:
                    return u
                    
        # 4. Fallback de coincidencia parcial simple
        for u in users:
            u_name = u.username.lower()
            if u_name in name_no_spaces or name_no_spaces in u_name:
                return u
                
        return None

    @staticmethod
    def find_or_create_client(nombre, email, instagram, phone):
        """Busca o crea un cliente usando cruzado inteligente de campos."""
        email_clean = str(email).strip().lower() if email and '@' in str(email) else None
        ig_clean = str(instagram).strip().replace('@', '').lower() if instagram and str(instagram).lower() not in ('n/a', 'none', '') else None
        phone_clean = str(phone).strip() if phone and str(phone).lower() not in ('n/a', 'none', '') else None
        
        client = None
        
        # 1. Buscar por email
        if email_clean:
            client = Client.query.filter_by(email=email_clean).first()
            
        # 2. Buscar por instagram normalizado
        if not client and ig_clean:
            client = Client.query.filter(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig_clean).first()
            
        # 3. Buscar por teléfono (últimos 8 dígitos)
        if not client and phone_clean and len(phone_clean) >= 8:
            client = Client.query.filter(Client.phone.like(f"%{phone_clean[-8:]}%")).first()
            
        # 4. Crear si no existe
        if not client:
            client = Client(
                full_name=nombre or (email_clean.split('@')[0] if email_clean else "Cliente Nuevo"),
                email=email_clean or f"no-email-{int(datetime.utcnow().timestamp())}@neurops.com",
                phone=phone_clean,
                instagram=ig_clean
            )
            db.session.add(client)
            db.session.flush()
        else:
            # Actualizar datos vacíos
            if nombre and not client.full_name:
                client.full_name = nombre
            if email_clean and not client.email:
                client.email = email_clean
            if phone_clean and not client.phone:
                client.phone = phone_clean
            if ig_clean and not client.instagram:
                client.instagram = ig_clean
                
        return client

    @staticmethod
    def sync_financial_agenda_to_appointment(agenda):
        """Sincroniza un registro de agenda financiera con la tabla de citas."""
        if not agenda:
            return None
            
        # 1. Obtener o crear Cliente
        client = BookingService.find_or_create_client(
            nombre=agenda.lead,
            email=agenda.mail,
            instagram=agenda.instagram,
            phone=agenda.whatsapp
        )
        
        # 2. Resolver Closer
        closer_user = BookingService.resolve_user_by_name(agenda.closer, default_role='closer')
        if not closer_user:
            # Fallback al primer closer/admin del sistema
            closer_user = User.query.filter_by(role='closer').first() or User.query.filter_by(role='admin').first()
            
        if not closer_user:
            print("[SYNC ERROR] No se encontró Closer ni Admin en la base de datos.")
            return None
            
        # 3. Resolver Setter
        setter_user = BookingService.resolve_user_by_name(agenda.nombre, default_role='setter')
        setter_id = setter_user.id if setter_user else None
        
        # 4. Buscar cita del mismo día
        start_of_day = datetime.combine(agenda.date.date(), datetime.min.time())
        end_of_day = datetime.combine(agenda.date.date(), datetime.max.time())
        
        appt = Appointment.query.filter(
            Appointment.client_id == client.id,
            Appointment.start_time >= start_of_day,
            Appointment.start_time <= end_of_day
        ).first()
        
        # 5. Mapear estado
        estado_clean = str(agenda.estado).strip().lower() if agenda.estado else ""
        
        if estado_clean in ('pendiente', 'agendado', ''):
            result = 'Agendado'
            closer_processed = False
            setter_processed = False
        else:
            # Estado procesado (No show, Show Up, Cancelada, Reagendada)
            if estado_clean == 'no show':
                result = 'No show'
            elif estado_clean == 'show up':
                result = 'Show Up'
            elif estado_clean == 'cancelada':
                result = 'Cancelada'
            elif estado_clean == 'reagendada':
                result = 'Reagendada'
            else:
                result = agenda.estado
            closer_processed = True
            setter_processed = True
            
        if not appt:
            appt = Appointment(
                closer_id=closer_user.id,
                setter_id=setter_id,
                client_id=client.id,
                start_time=agenda.date,
                origin=agenda.nombre or 'n8n',
                result=result,
                closer_processed=closer_processed,
                setter_processed=setter_processed
            )
            db.session.add(appt)
        else:
            appt.closer_id = closer_user.id
            appt.setter_id = setter_id
            appt.start_time = agenda.date
            appt.origin = agenda.nombre or appt.origin
            appt.result = result
            appt.closer_processed = closer_processed
            appt.setter_processed = setter_processed
            
        try:
            db.session.commit()
            return appt
        except Exception as e:
            db.session.rollback()
            print(f"[SYNC ERROR] No se pudo guardar el Appointment: {e}")
            return None

