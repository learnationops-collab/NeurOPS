from app.models import Availability, Appointment, User, Client, SurveyAnswer, db
from sqlalchemy import or_
from datetime import datetime, timedelta, date, time
import pytz

class BookingService:
    @staticmethod
    def get_available_slots_utc(start_date, end_date, preferred_closer_id=None):
        availabilities = Availability.query.join(Availability.closer).filter(
            Availability.date >= start_date, 
            Availability.date <= end_date,
            User.role == 'closer'
        ).all()
        
        appointments = Appointment.query.filter(
            Appointment.start_time >= datetime.combine(start_date, time.min),
            Appointment.start_time <= datetime.combine(end_date, time.max) + timedelta(days=1),
            Appointment.status != 'canceled'
        ).all()
        
        booked_slots = set()
        for appt in appointments:
            booked_slots.add((appt.closer_id, appt.start_time))
            
        unique_slots = {}
        for av in availabilities:
            closer = av.closer
            if not closer: continue
            
            try: closer_tz = pytz.timezone(closer.timezone or 'America/La_Paz')
            except: closer_tz = pytz.timezone('America/La_Paz')
                
            local_dt = closer_tz.localize(datetime.combine(av.date, av.start_time))
            utc_dt = local_dt.astimezone(pytz.UTC).replace(tzinfo=None)
            
            if utc_dt < datetime.utcnow(): continue
            
            if (av.closer_id, utc_dt) not in booked_slots:
                ts_key = utc_dt
                if ts_key not in unique_slots:
                    unique_slots[ts_key] = {'utc_iso': utc_dt.isoformat() + 'Z', 'closer_id': av.closer_id, 'ts': utc_dt.timestamp()}
                elif preferred_closer_id and av.closer_id == preferred_closer_id:
                     unique_slots[ts_key]['closer_id'] = av.closer_id
        
        available_slots = list(unique_slots.values())
        available_slots.sort(key=lambda x: x['ts'])
        return available_slots

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
    def create_appointment(client_id, closer_id, start_time_utc, origin='direct'):
        conflict = Appointment.query.filter_by(closer_id=closer_id, start_time=start_time_utc).filter(Appointment.status != 'canceled').first()
        if conflict: return None
            
        appt = Appointment(
            closer_id=closer_id,
            client_id=client_id,
            start_time=start_time_utc,
            status='scheduled',
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
