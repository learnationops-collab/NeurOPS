from app.models import Availability, Appointment, User, Client, SurveyAnswer, Notification, db
from sqlalchemy import or_
from datetime import datetime, timedelta, date, time
import pytz

class BookingService:
    @staticmethod
    def get_available_slots_utc(start_date, end_date, preferred_closer_id=None):
        from app.models import WeeklyAvailability
        
        # Get all active appointments (not cancelled/rescheduled, not already resolved by the closer) in range to avoid double booking
        appointments = Appointment.query.filter(
            Appointment.start_time >= datetime.combine(start_date, time.min),
            Appointment.start_time <= datetime.combine(end_date, time.max) + timedelta(days=1),
            Appointment.closer_processed == False,
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
        phone = data.get('phone')
        instagram = data.get('instagram')

        email_clean = str(email).strip().lower() if email and '@' in str(email) else None
        ig_clean = str(instagram).strip().replace('@', '').lower() if instagram and str(instagram).lower() not in ('n/a', 'none', '') else None
        phone_clean = str(phone).strip() if phone and str(phone).lower() not in ('n/a', 'none', '') else None
        
        client = None
        if client_id:
            client = Client.query.get(client_id)

        if not client:
            # Buscamos por las 3 vías SIN cortar en el primer match (a diferencia de antes) para
            # poder detectar si email/instagram/teléfono apuntan a clientes YA duplicados entre
            # sí en la base — y fusionarlos acá mismo, evitando crear un cuarto registro más.
            found = {}  # client_id -> (fuente, Client)
            if email_clean:
                m = Client.query.filter(db.func.lower(Client.email) == email_clean).first()
                if m and m.id not in found:
                    found[m.id] = ('email', m)
            if ig_clean:
                m = Client.query.filter(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig_clean).first()
                if m and m.id not in found:
                    found[m.id] = ('instagram', m)
            if phone_clean and len(phone_clean) >= 8:
                m = Client.query.filter(Client.phone.like(f"%{phone_clean[-8:]}%")).first()
                if m and m.id not in found:
                    found[m.id] = ('phone', m)

            if len(found) == 1:
                client = next(iter(found.values()))[1]
            elif len(found) > 1:
                from app.services.client_dedup_service import ClientDedupService, _names_compatible
                # El email es la señal más fuerte: si hubo match por email, es el sobreviviente.
                by_email = [m for source, m in found.values() if source == 'email']
                survivor = by_email[0] if by_email else next(iter(found.values()))[1]
                to_merge = []
                for source, m in found.values():
                    if m.id == survivor.id:
                        continue
                    # Instagram/teléfono son señales más débiles (recicladas entre cuentas
                    # distintas) — solo se fusionan acá si además el nombre es compatible.
                    if source == 'email' or _names_compatible(survivor.full_name, m.full_name):
                        to_merge.append(m.id)
                if to_merge:
                    ClientDedupService.merge_clients(survivor.id, to_merge, matched_on='auto-on-write')
                client = Client.query.get(survivor.id)

        if not client:
            import uuid
            client = Client(
                full_name=name or (email_clean.split('@')[0] if email_clean else "Cliente Nuevo"),
                email=email_clean or f"no-email-{uuid.uuid4().hex[:12]}@neurops.com",
                phone=phone_clean,
                instagram=ig_clean
            )
            db.session.add(client)
        else:
            if name: client.full_name = name
            if email_clean and (not client.email or 'no-email-' in client.email): client.email = email_clean
            if phone_clean: client.phone = phone_clean
            if ig_clean: client.instagram = ig_clean
        
        db.session.commit()
        return client

    @staticmethod
    def create_appointment(client_id, closer_id, start_time_utc, origin='direct', setter_id=None):
        # Validar existencia de cliente
        client = Client.query.get(client_id)
        if not client:
            from app.models import Lead
            lead_obj = Lead.query.get(client_id)
            if lead_obj:
                client = BookingService.find_or_create_client(
                    nombre=lead_obj.name,
                    email=lead_obj.email,
                    instagram=lead_obj.instagram_username,
                    phone=None
                )
                client_id = client.id

        if not client:
            print(f"[BookingService Error] Cliente con ID {client_id} no encontrado.")
            return None

        # Verificar conflicto de horario para el mismo closer (una cita ya resuelta por el closer,
        # p.ej. Show up/No Show/No Lead/Lead Perdido, no debe seguir bloqueando ese horario)
        conflict = Appointment.query.filter_by(closer_id=closer_id, start_time=start_time_utc).filter(
            Appointment.closer_processed == False,
            or_(Appointment.result == None, Appointment.result == '', Appointment.result.notin_(['Cancelada', 'Reprogramada']))
        ).first()
        if conflict: return None
            
        appt = Appointment(
            closer_id=closer_id,
            setter_id=setter_id,
            client_id=client.id,
            start_time=start_time_utc,
            origin=origin,
            last_stage='Nueva'
        )
        db.session.add(appt)
        
        # Notificación para Closer y Admins
        try:
            client_name = client.full_name or client.email or "Cliente"
            
            noti = Notification(
                subject="Nueva Agenda",
                content=f"Nueva sesión con {client_name} para el {start_time_utc.strftime('%d/%m/%Y %H:%M')} UTC.",
                target_users=["role:admin", int(closer_id)],
                related_users=[int(closer_id), client.id],
                associated_id=appt.id,
                associated_type='appointment'
            )
            db.session.add(noti)
            
            # Sincronizar Lead
            try:
                from app.models import Lead, PipelineStage
                import uuid
                
                lead = None
                if client.email and 'no-email-' not in client.email:
                    lead = Lead.query.filter(db.func.lower(Lead.email) == client.email.lower()).first()
                if not lead and client.instagram:
                    ig_clean = client.instagram.replace('@', '').strip().lower()
                    lead = Lead.query.filter(db.func.lower(db.func.replace(Lead.instagram_username, '@', '')) == ig_clean).first()
                
                if not lead:
                    stage = PipelineStage.query.filter_by(name='Nueva').first()
                    dummy_mc_id = f"gen_{int(datetime.utcnow().timestamp())}_{str(uuid.uuid4())[:8]}"
                    
                    lead = Lead(
                        manychat_id=dummy_mc_id,
                        name=client.full_name or client.email or "Sin Nombre",
                        email=client.email if client.email and 'no-email-' not in client.email else None,
                        instagram_username=client.instagram,
                        stage_id=stage.id if stage else None,
                        ad_source=origin or 'Booking',
                        notes=f"Creado automáticamente desde Agenda ID {appt.id}"
                    )
                    db.session.add(lead)
                    db.session.flush()
                
                new_note = f"\n[Auto] Agenda creada: {start_time_utc.strftime('%Y-%m-%d %H:%M')} (ID: {appt.id})"
                lead.notes = (lead.notes or "") + new_note
                
                agendada_stage = PipelineStage.query.filter(PipelineStage.name.ilike('%Agend%')).first()
                if agendada_stage:
                    lead.stage_id = agendada_stage.id
                
            except Exception as lead_err:
                print(f"[BookingService] Error sincronizando Lead: {lead_err}")
            
        except Exception as e:
            print(f"Error creando notificación de cita: {e}")

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
        from app.models import LeadEventLog, User
        from flask import has_request_context, session
        
        # Validar trazabilidad si se realiza bajo suplantación de identidad
        if has_request_context() and session.get('is_impersonating'):
            original_user_id = session.get('original_user_id')
            original_user = db.session.get(User, original_user_id)
            target_user = db.session.get(User, user_id)
            
            orig_name = original_user.username if original_user else f"Usuario {original_user_id}"
            target_name = target_user.username if target_user else f"Usuario {user_id}"
            
            suffix = f" (Acción ejecutada por {orig_name} actuando en nombre de {target_name})"
            description = f"{description}{suffix}"
            
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
    def normalize_closer_name(name_str):
        """Normaliza cualquier alias de closer al nombre de usuario canónico (User.username)."""
        if not name_str:
            return "Sin asignar"
        name_clean = str(name_str).strip()
        if name_clean.lower() in ('n/a', 'none', 'undefined', 'sin asignar', 'sin_asignar', 'equipo', ''):
            return "Sin asignar"
            
        user = BookingService.resolve_user_by_name(name_clean, default_role='closer')
        if user and user.username:
            return user.username
        return name_clean

    @staticmethod
    def resolve_user_by_name(name_str, default_role=None):
        """Resuelve un usuario por nombre/username de forma flexible."""
        if not name_str:
            return None
        name_clean = str(name_str).strip().lower()
        if name_clean in ('n/a', 'none', 'undefined', 'sin asignar', 'sin_asignar', 'equipo', ''):
            return None
            
        # 0. Buscar por alias explícito (CloserAlias)
        from app.models import CloserAlias
        alias = CloserAlias.query.filter(db.func.lower(CloserAlias.alias_name) == name_clean).first()
        if alias and alias.user:
            return alias.user
            
        # 1. Coincidencia exacta por username
        user = User.query.filter(User.username.ilike(name_clean)).first()
        if user:
            return user
            
        # 2. Coincidencia sin espacios
        name_no_spaces = name_clean.replace(' ', '')
        user = User.query.filter(User.username.ilike(name_no_spaces)).first()
        if user:
            return user
            
        # 3. Coincidencia parcial priorizando rol (removiendo espacios de ambos)
        users = User.query.all()
        for u in users:
            u_name_no_spaces = u.username.lower().replace(' ', '')
            if u_name_no_spaces in name_no_spaces or name_no_spaces in u_name_no_spaces:
                if default_role and u.role == default_role:
                    return u
                    
        # 4. Fallback de coincidencia parcial simple
        for u in users:
            u_name_no_spaces = u.username.lower().replace(' ', '')
            if u_name_no_spaces in name_no_spaces or name_no_spaces in u_name_no_spaces:
                return u
                
        return None

    @staticmethod
    def find_or_create_client(nombre, email, instagram, phone, grupo=None):
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
            
        grupo_clean = str(grupo).strip() if grupo and str(grupo).strip() else None

        # 4. Crear si no existe
        if not client:
            import uuid
            client = Client(
                full_name=nombre or (email_clean.split('@')[0] if email_clean else "Cliente Nuevo"),
                email=email_clean or f"no-email-{uuid.uuid4().hex[:12]}@neurops.com",
                phone=phone_clean,
                instagram=ig_clean,
                grupo=grupo_clean
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
            if grupo_clean and not client.grupo:
                client.grupo = grupo_clean

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
            phone=agenda.whatsapp,
            grupo=getattr(agenda, 'grupo', None)
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
        
        # 4. Buscar cita del mismo día (rango de +/- 12 horas para tolerar desfases UTC/local)
        start_search = agenda.date - timedelta(hours=12)
        end_search = agenda.date + timedelta(hours=12)
        
        appt = Appointment.query.filter(
            Appointment.client_id == client.id,
            Appointment.start_time >= start_search,
            Appointment.start_time <= end_search
        ).first()
        
        # 5. Mapear estado
        estado_clean = str(agenda.estado).strip().lower() if agenda.estado else ""

        # Conservar valores existentes
        existing_result = appt.result if appt else None
        existing_closer_result = appt.closer_result if appt else 'Pendiente'

        result = existing_result
        closer_result = existing_closer_result

        # Una vez que el Closer avanzó el pipeline de confirmación DENTRO de NeurOPS
        # (por_confirmar → conversando → confirmado, ver modalStep 'confirm' en
        # CloserWorkflowPage.jsx), ese estado es autoritativo — no debe pisarse con un valor
        # potencialmente desactualizado de la hoja de cálculo (la hoja la mantiene el Call
        # Confirmer por separado y no siempre refleja en tiempo real lo que el closer ya hizo).
        # Mismo criterio que ya usaba _format_appointment_for_deck (app/api/closer.py) para
        # decidir qué mostrar, pero acá faltaba aplicarlo también al GUARDAR: un cliente
        # reportó que sus agendas marcadas "Confirmado" desaparecían solas de esa columna —
        # el resync masivo de /public/financial-agendas/sync-appointments (o cualquier edición
        # del sheet que dispare el webhook por-item) las revertía a 'Pendiente'/'Agendado' sin
        # que el closer hiciera nada. Cancelado/Reagendado sí se siguen aplicando siempre: son
        # señales reales de un evento externo, no un default desactualizado.
        CLOSER_CONFIRM_STAGES = ('por_confirmar', 'conversando', 'confirmado')
        existing_result_lower = (existing_result or '').strip().lower()
        closer_owns_confirm_stage = existing_result_lower in CLOSER_CONFIRM_STAGES

        # Si es un estado del Call Confirmer (antes de la llamada)
        if estado_clean in ('pendiente', '', 'agendado', 'agendada', 'confirmado', 'confirmada', 'sin respuesta', 'contactado', 'contactada'):
            if not closer_owns_confirm_stage:
                if estado_clean in ('pendiente', ''):
                    result = 'Pendiente'
                elif estado_clean in ('agendado', 'agendada'):
                    result = 'Agendado'
                elif estado_clean in ('confirmado', 'confirmada'):
                    result = 'Confirmado'
                elif estado_clean == 'sin respuesta':
                    result = 'Sin respuesta'
                elif estado_clean in ('contactado', 'contactada'):
                    result = 'Contactado'
        elif estado_clean in ('cancelado', 'cancelada', 'reagendado', 'reagendada'):
            if estado_clean in ('cancelado', 'cancelada'):
                result = 'Cancelado'
            elif estado_clean in ('reagendado', 'reagendada'):
                result = 'Reagendado'
        
        # Si es un estado del Closer (después de la llamada)
        elif estado_clean in ('show up', 'show_up', 'no show', 'no_show', 'cerrada', 'cerrado', '2th call', '2da call', 'lead perdido', 'perdido', 'no lead', 'venta', 'cerrado/pif', 'cerrado/split'):
            if estado_clean in ('no show', 'no_show'):
                closer_result = 'No Show'
            elif estado_clean in ('show up', 'show_up'):
                closer_result = 'Show up'
            elif estado_clean in ('cerrada', 'cerrado', 'venta', 'cerrado/pif', 'cerrado/split'):
                closer_result = 'Cerrada'
            elif estado_clean in ('2th call', '2da call'):
                closer_result = '2da call'
            elif estado_clean in ('lead perdido', 'perdido'):
                closer_result = 'Lead Perdido'
            elif estado_clean == 'no lead':
                closer_result = 'No Lead'
            
            # Si se procesa con un estado de Closer pero el result del confirmer estaba vacío,
            # lo dejamos como Confirmado por defecto.
            if not result:
                result = 'Confirmado'

        # Determinar si está procesado por el Closer o Setter
        is_already_closer_processed = appt.closer_processed if appt else False
        is_closer_state = estado_clean in ('show up', 'show_up', 'no show', 'no_show', 'cerrada', 'cerrado', '2th call', '2da call', 'lead perdido', 'perdido', 'no lead', 'cancelado', 'cancelada', 'reagendado', 'reagendada', 'venta', 'cerrado/pif', 'cerrado/split')
        
        if is_already_closer_processed and not is_closer_state:
            # Si ya fue procesado por el closer y el webhook no envía un estado de closer,
            # mantenemos el estado de closer procesado para no degradarla a pendiente.
            closer_processed = True
            closer_result = existing_closer_result
            setter_processed = True
        else:
            if is_closer_state:
                closer_processed = True
                setter_processed = True
            else:
                closer_processed = False
                setter_processed = False
            
        if not appt:
            appt = Appointment(
                closer_id=closer_user.id,
                setter_id=setter_id,
                client_id=client.id,
                start_time=agenda.date,
                origin=agenda.nombre or 'n8n',
                result=result,
                closer_result=closer_result,
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
            appt.closer_result = closer_result
            appt.closer_processed = closer_processed
            appt.setter_processed = setter_processed
            
        try:
            db.session.commit()
            return appt
        except Exception as e:
            db.session.rollback()
            print(f"[SYNC ERROR] No se pudo guardar el Appointment: {e}")
            return None

    @staticmethod
    def sync_appointment_to_financial_agenda(appt):
        """Sincroniza un Appointment de vuelta a la tabla de FinancialAgenda (BD de agendas financieras)."""
        from app.models.financial import FinancialAgenda
        from app.models import User
        from sqlalchemy import or_
        
        if not appt or not appt.client:
            return None
            
        client = appt.client
        # Buscar agenda financiera existente (rango de +/- 36 horas para tolerar desfases UTC/local)
        start_search = appt.start_time - timedelta(hours=36)
        end_search = appt.start_time + timedelta(hours=36)
        
        # Buscar agenda financiera existente (normalizando email e instagram para evitar problemas de matching exacto)
        from sqlalchemy import func
        ig_clean = client.instagram.strip().replace('@', '').lower() if client.instagram and client.instagram.lower() not in ('n/a', '') else None
        mail_clean = client.email.strip().lower() if client.email and client.email.lower() not in ('n/a', '') else None
        
        filters = []
        if mail_clean:
            filters.append(func.lower(FinancialAgenda.mail) == mail_clean)
        if ig_clean:
            filters.append(func.lower(func.replace(FinancialAgenda.instagram, '@', '')) == ig_clean)
            
        agenda = None
        if filters:
            agenda = FinancialAgenda.query.filter(
                or_(*filters),
                FinancialAgenda.date >= start_search,
                FinancialAgenda.date <= end_search
            ).first()
            
            if not agenda:
                agenda = FinancialAgenda.query.filter(or_(*filters)).order_by(FinancialAgenda.date.desc()).first()
            
        # Mapear estado: prioritario el resultado del closer si ya fue procesado por él
        mapped_state = 'Pendiente'
        if appt.closer_result and appt.closer_result != 'Pendiente':
            mapped_state = appt.closer_result
        elif appt.result and appt.result != 'Pendiente':
            mapped_state = appt.result

        # Normalizar strings para evitar inconsistencias en reportes y sheets
        mapped_state_lower = mapped_state.lower()
        if mapped_state_lower in ('show up', 'show_up'):
            mapped_state = 'Show Up'
        elif mapped_state_lower in ('no show', 'no_show'):
            mapped_state = 'No Show'
        elif mapped_state_lower in ('cancelado', 'cancelada'):
            mapped_state = 'Cancelada'
        elif mapped_state_lower in ('reagendado', 'reagendada'):
            mapped_state = 'Reagendada'
        elif mapped_state_lower in ('2th call', '2da call'):
            mapped_state = '2TH Call'
        elif mapped_state_lower in ('lead perdido', 'perdido'):
            mapped_state = 'Lead Perdido'
        elif mapped_state_lower == 'no lead':
            mapped_state = 'No Lead'
                
        # Buscar nombres de closer y setter
        closer_name = 'Sin asignar'
        if appt.closer_id:
            c_user = User.query.get(appt.closer_id)
            if c_user:
                closer_name = c_user.username
                
        setter_name = 'Sin asignar'
        if appt.setter_id:
            s_user = User.query.get(appt.setter_id)
            if s_user:
                setter_name = s_user.username
                
        if not agenda:
            # Crear nueva agenda financiera si no existe
            agenda = FinancialAgenda(
                nombre=setter_name,
                lead=client.full_name or 'Desconocido',
                closer=closer_name,
                fecha_meet=appt.start_time.isoformat(),
                date=appt.start_time,
                registro=datetime.utcnow().isoformat(),
                instagram=client.instagram or 'N/A',
                whatsapp=client.phone or 'N/A',
                mail=client.email or 'N/A',
                estado=mapped_state,
                raw_data={"created_by_sync": True}
            )
            db.session.add(agenda)
        else:
            # Actualizar datos de existente
            agenda.nombre = setter_name
            agenda.closer = closer_name
            agenda.estado = mapped_state
            agenda.date = appt.start_time
            agenda.fecha_meet = appt.start_time.isoformat()
            
        try:
            db.session.flush()
            return agenda
        except Exception as e:
            print(f"[SYNC ERROR] No se pudo guardar la FinancialAgenda: {e}")
            return None

