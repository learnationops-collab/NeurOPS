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
            
            # Source from Event if available, else appointment origin
            source = event.utm_source if event else (appointment.origin or "Desconocido")
            
            payload = {
                "nombre_completo": client.full_name or "Sin Nombre",
                "primer_nombre": client.full_name.split(' ')[0] if client.full_name else "",
                "numero_telefono": client.phone or "",
                "fuente": source,
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
