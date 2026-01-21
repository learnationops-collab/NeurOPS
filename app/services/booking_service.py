from app.models import Availability, Appointment, User, LeadProfile, SurveyAnswer, db
from sqlalchemy import or_
from datetime import datetime, timedelta, date, time
import pytz
import uuid

class BookingService:
    @staticmethod
    def get_available_slots_utc(start_date, end_date, preferred_closer_id=None):
        """
        Retrieves available booking slots within a date range, returning them as a 
        list of unique UTC slots with assigned closers.
        """
        # 1. Fetch Availability (Stored in Closer's Local Time)
        # Filter broad to catch any potential availability in range
        availabilities = Availability.query.join(Availability.closer).filter(
            Availability.date >= start_date, 
            Availability.date <= end_date,
            User.role == 'closer' # Ensure valid closers
        ).all()
        
        # 2. Fetch Existing Appointments (Stored in UTC)
        # Fetch overlapping appointments to block slots
        appointments = Appointment.query.filter(
            Appointment.start_time >= datetime.combine(start_date, time.min),
            Appointment.start_time <= datetime.combine(end_date, time.max) + timedelta(days=1), # Buffer
            Appointment.status != 'canceled'
        ).all()
        
        booked_slots = set()
        for appt in appointments:
            booked_slots.add((appt.closer_id, appt.start_time))
            
        unique_slots = {}
        
        for av in availabilities:
            closer = av.closer
            if not closer: continue
            
            # Get Closer Timezone
            try:
                closer_tz = pytz.timezone(closer.timezone or 'America/La_Paz')
            except:
                closer_tz = pytz.timezone('America/La_Paz')
                
            # Create Local Datetime
            local_dt = datetime.combine(av.date, av.start_time) # Naive
            local_dt = closer_tz.localize(local_dt) # Aware (Closer Time)
            
            # Convert to UTC
            utc_dt = local_dt.astimezone(pytz.UTC).replace(tzinfo=None) # Naive UTC
            
            # Filter Past
            if utc_dt < datetime.utcnow(): continue
            
            # Check overlap
            if (av.closer_id, utc_dt) not in booked_slots:
                ts_key = utc_dt
                
                # If not present, add it
                if ts_key not in unique_slots:
                    unique_slots[ts_key] = {
                        'utc_iso': utc_dt.isoformat() + 'Z',
                        'closer_id': av.closer_id,
                        'ts': utc_dt.timestamp()
                    }
                # If present, prioritize preferred closer if matched
                elif preferred_closer_id and av.closer_id == preferred_closer_id:
                     unique_slots[ts_key]['closer_id'] = av.closer_id
        
        # Convert to sorted list
        available_slots = list(unique_slots.values())
        available_slots.sort(key=lambda x: x['ts'])
        
        return available_slots

    @staticmethod
    def create_or_update_lead(data, user_id=None):
        """
        Creates a new lead or updates an existing one based on form data.
        Returns the User object.
        """
        email = data.get('email')
        name = data.get('name')
        phone = data.get('phone') # Assumed full formatted phone
        instagram = data.get('instagram')
        utm_source = data.get('utm_source', 'direct')
        
        user = None
        if user_id:
            user = User.query.get(user_id)
        
        # If no user_id, check by email just in case (though identify step usually handles this)
        if not user and email:
            user = User.query.filter_by(email=email).first()

        if not user:
            # Create NEW
            if not email:
                return None # Error
                
            temp_pass = str(uuid.uuid4())
            base_username = name or email.split('@')[0]
            # Uniqueness logic
            username = base_username[:60]
            while User.query.filter_by(username=username).first():
                import random
                username = f"{base_username}_{random.randint(1000,9999)}"[:64]
                
            user = User(username=username, email=email, role='lead')
            user.set_password(temp_pass)
            db.session.add(user)
            db.session.flush()
            
            profile = LeadProfile(
                user_id=user.id, 
                phone=phone, 
                instagram=instagram, 
                utm_source=utm_source, 
                status='new'
            )
            db.session.add(profile)
            
        else:
            # Update EXISTING
            if name: user.username = name
            
            if user.lead_profile:
                if phone: user.lead_profile.phone = phone
                if instagram: user.lead_profile.instagram = instagram
            else:
                profile = LeadProfile(
                    user_id=user.id, 
                    phone=phone, 
                    instagram=instagram, 
                    utm_source=utm_source, # Or keep existing? Usually keep. 
                    # If user didn't have profile, use new source.
                    status='new'
                )
                db.session.add(profile)
        
        # 3. Assign Closer if NOT assigned
        if user.lead_profile and not user.lead_profile.assigned_closer_id:
             import random
             # Simple random assignment for now
             closers = User.query.filter_by(role='closer').all()
             if closers:
                 selected = random.choice(closers)
                 user.lead_profile.assigned_closer_id = selected.id
                 db.session.add(user.lead_profile)
        
        db.session.commit()
        return user

    @staticmethod
    def create_appointment(lead_id, closer_id, start_time_utc, event_id=None):
        """
        Creating an appointment transactionally.
        """
        # Concurrency Check
        conflict = Appointment.query.filter_by(closer_id=closer_id, start_time=start_time_utc).filter(Appointment.status != 'canceled').first()
        if conflict:
            return None # Slot taken
            
        appt = Appointment(
            closer_id=closer_id,
            lead_id=lead_id,
            start_time=start_time_utc,
            status='scheduled',
            event_id=event_id
        )
        db.session.add(appt)
        db.session.commit()
        
        # Auto-update status
        if appt.lead:
            appt.lead.update_status_based_on_debt()
            
        return appt

    @staticmethod
    def save_survey_answers(lead_id, answers_data, appointment_id=None):
        """
        Saves or updates survey answers.
        answers_data: list of dicts {'question_id', 'answer'}
        """
        for item in answers_data:
            q_id = item['question_id']
            ans_text = item['answer']
            
            # Upsert
            existing = SurveyAnswer.query.filter_by(lead_id=lead_id, question_id=q_id).first()
            if existing:
                existing.answer = ans_text
                if appointment_id:
                     existing.appointment_id = appointment_id
            else:
                new_ans = SurveyAnswer(
                    lead_id=lead_id,
                    question_id=q_id,
                    answer=ans_text,
                    appointment_id=appointment_id
                )
                db.session.add(new_ans)
        
        db.session.commit()
