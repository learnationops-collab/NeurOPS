from app.models import Availability, Appointment, User, Client, SurveyAnswer, db
from sqlalchemy import or_
from datetime import datetime, timedelta, date, time
import pytz

class BookingService:
    @staticmethod
    def get_available_slots_utc(start_date, end_date, preferred_closer_id=None):
        from app.models import WeeklyAvailability
        
        # Get all appointments in range to avoid double booking
        appointments = Appointment.query.filter(
            Appointment.start_time >= datetime.combine(start_date, time.min),
            Appointment.start_time <= datetime.combine(end_date, time.max) + timedelta(days=1),
            Appointment.status != 'canceled'
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
                    'ts': utc_dt.timestamp(),
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
    def create_appointment(client_id, closer_id, start_time_utc, origin='direct', status='scheduled'):
        conflict = Appointment.query.filter_by(closer_id=closer_id, start_time=start_time_utc).filter(Appointment.status != 'canceled').first()
        if conflict: return None
            
        appt = Appointment(
            closer_id=closer_id,
            client_id=client_id,
            start_time=start_time_utc,
            status=status,
            origin=origin
        )
        db.session.add(appt)
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
            requests.post(url, json=payload, timeout=5)
            print(f"[Agenda Webhook] Sent to {url}")
            
        except Exception as e:
            print(f"[Agenda Webhook Error] {e}")
