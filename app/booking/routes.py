from flask import render_template, redirect, url_for, flash, request, session
from app.booking import bp
from app import db
from app.models import User, LeadProfile, Event, Availability, Appointment, SurveyQuestion, SurveyAnswer
from werkzeug.security import generate_password_hash
import uuid
from datetime import datetime, timedelta, date, time
from sqlalchemy import or_
from app.closer.utils import send_calendar_webhook

@bp.route('/booking', methods=['GET'])
def start_booking():
    """Entry Point: Initializes the booking flow based on Event/Group settings."""
    utm_source = request.args.get('utm_source', 'direct')
    
    # 1. Identify Event & Funnel Steps
    event = Event.query.filter_by(utm_source=utm_source).first()
    funnel_steps = ['contact', 'calendar', 'survey'] # Default
    
    # session.clear() -> This logs out admins! Use selective clear.
    keys_to_clear = ['booking_data', 'booking_event_id', 'funnel_steps', 'funnel_index', 'booking_user_id', 'current_appt_id']
    for k in keys_to_clear:
        session.pop(k, None)
        
    session['booking_utm'] = utm_source
    
    # Check for referral (Closer Preference)
    # 1. Explicit 'ref' arg (e.g. ?utm_source=vsl&ref=123)
    ref_id = request.args.get('ref')
    if ref_id:
        try:
            session['preferred_closer_id'] = int(ref_id)
        except ValueError:
            pass
            
    # 2. 'referral_' in utm_source
    elif utm_source and utm_source.startswith('referral_'):
        try:
            closer_id = int(utm_source.split('_')[1])
            session['preferred_closer_id'] = closer_id
        except (IndexError, ValueError):
            session.pop('preferred_closer_id', None)
    
    # If neither, clear it (unless we want to persist? No, typically one-shot)
    if not ref_id and not (utm_source and utm_source.startswith('referral_')):
         session.pop('preferred_closer_id', None)
    
    # Init booking data container
    session['booking_data'] = {
        'answers': [],  # list of {question_id, answer}
        'slot': None    # {date, time, closer_id}
    }

    if event:
        session['booking_event_id'] = event.id
        if event.funnel_steps:
             funnel_steps = event.funnel_steps
        elif event.group and event.group.funnel_steps:
             funnel_steps = event.group.funnel_steps
    else:
        # Check if global group has defaults? For now uses hardcoded default.
        pass

    session['funnel_steps'] = funnel_steps
    session['funnel_index'] = 0
    
    return redirect(url_for('booking.handle_flow'))

@bp.route('/booking/flow')
def handle_flow():
    """Router: Redirects to the current step's view."""
    steps = session.get('funnel_steps', ['contact', 'calendar', 'survey'])
    index = session.get('funnel_index', 0)
    
    if index >= len(steps):
        # Done!
        return redirect(url_for('booking.thank_you'))
        
    current_step = steps[index]
    
    if current_step == 'contact':
        return redirect(url_for('booking.contact_view'))
    elif current_step == 'calendar':
        return redirect(url_for('booking.calendar_view'))
    elif current_step == 'survey':
        return redirect(url_for('booking.survey_view'))
    else:
        # Unknown step, skip
        session['funnel_index'] = index + 1
        return redirect(url_for('booking.handle_flow'))

@bp.route('/booking/next')
def next_step():
    """Increment step and route."""
    session['funnel_index'] = session.get('funnel_index', 0) + 1
    return redirect(url_for('booking.handle_flow'))

@bp.route('/booking/contact', methods=['GET', 'POST'])
def contact_view():
    # Helper to clean phone
    def clean_phone(code, number):
        if not number: return None
        return f"{code} {number}".strip()

    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        phone_code = request.form.get('phone_code')
        phone_number = request.form.get('phone')
        instagram = request.form.get('instagram')
        
        full_phone = clean_phone(phone_code, phone_number)

        if not email or not name:
            flash('Nombre y Correo son obligatorios.')
            return render_template('booking/landing.html', utm=session.get('booking_utm'))

        # Create/Find User
        user = User.query.filter_by(email=email).first()
        utm_source = session.get('booking_utm', 'direct')
        
        if not user:
            temp_pass = str(uuid.uuid4())
            base_username = name or email.split('@')[0] or "Lead"
            if len(base_username) > 60:
                base_username = base_username[:60]
            
            username = base_username
            # Ensure uniqueness
            while User.query.filter_by(username=username).first():
                import random
                suffix = f"_{random.randint(1000, 9999)}"
                # Ensure suffix fits (already trimmed base to 60, suffix is 5 chars max usually)
                username = f"{base_username}{suffix}"[:64]
            
            user = User(username=username, email=email, role='lead')
            user.set_password(temp_pass)
            db.session.add(user)
            db.session.flush()
            
            # New leads start as 'new' status
            profile = LeadProfile(user_id=user.id, phone=full_phone, instagram=instagram, utm_source=utm_source, status='new')
            db.session.add(profile)
            db.session.commit()
        else:
            if user.lead_profile:
                if full_phone: user.lead_profile.phone = full_phone
                if instagram: user.lead_profile.instagram = instagram
                user.lead_profile.utm_source = utm_source 
            else:
                profile = LeadProfile(user_id=user.id, phone=full_phone, instagram=instagram, utm_source=utm_source, status='new')
                db.session.add(profile)
            
            # Update name if provided
            if name: user.username = name
            db.session.commit()
            
        session['booking_user_id'] = user.id
        
        # FLUSH CACHED DATA (If any from previous steps, though unlikely here)
        _flush_session_data(user.id)
        
        return redirect(url_for('booking.next_step'))
        
    return render_template('booking/landing.html', utm=session.get('booking_utm'))

def _flush_session_data(user_id):
    """Saves cached slot/answers to DB for this user."""
    bdata = session.get('booking_data', {})
    
    # 1. Flush Slot -> Appointment
    slot = bdata.get('slot')
    if slot:
        utc_iso = slot.get('utc_iso')
        if utc_iso:
            start_time = datetime.fromisoformat(utc_iso.replace('Z', '+00:00')).replace(tzinfo=None)
            
            # Check duplicate
            exists = Appointment.query.filter_by(closer_id=slot['closer_id'], start_time=start_time).filter(Appointment.status!='canceled').first()
            if not exists:
                appt = Appointment(
                    closer_id=slot['closer_id'],
                    lead_id=user_id,
                    start_time=start_time,
                    status='scheduled', # or pending_survey? if survey not done yet
                    event_id=session.get('booking_event_id')
                )
                db.session.add(appt)
                db.session.commit()
                session['current_appt_id'] = appt.id
                
                # Trigger Webhook
                send_calendar_webhook(appt, 'created')
                
                # Update User Status automatically
                user = User.query.get(user_id)
                if user:
                    user.update_status_based_on_debt()
                
                # Clear slot from session
                bdata['slot'] = None
                session['booking_data'] = bdata
            bdata['slot'] = None
            session['booking_data'] = bdata

    # 2. Flush Answers -> SurveyAnswer
    answers = bdata.get('answers')
    if answers:
        if 'current_appt_id' in session:
            appt_id = session['current_appt_id']
        else:
            appt_id = None # Should we link to existing appointment?
            # Start logic: if user has an upcoming appointment, maybe link?
            # For dynamic flow, usually appointment is created in same session.
        
        for ans in answers:
            new_ans = SurveyAnswer(
                lead_id=user_id,
                question_id=ans['question_id'],
                answer=ans['answer'],
                appointment_id=appt_id
            )
            db.session.add(new_ans)
        
        db.session.commit()
        bdata['answers'] = []
        session['booking_data'] = bdata

@bp.route('/booking/calendar')
def calendar_view():
    import pytz
    
    # 1. Fetch Availability (Stored in Closer's Local Time - assumed per closer)
    # Optimization: Filter roughly by date range first
    today = date.today()
    end_date = today + timedelta(days=14)
    # Filter by date AND ensure role is 'closer' (exclude admins)
    availabilities = Availability.query.join(Availability.closer).filter(
        Availability.date >= today, 
        Availability.date <= end_date,
        User.role == 'closer'
    ).all()
    
    # 2. Fetch Appointments (Stored in UTC)
    # Need to filter effectively in UTC, so convert range to UTC
    # Since we don't know closer TZ yet, just fetch broad range
    appointments = Appointment.query.filter(
        Appointment.start_time >= datetime.utcnow(),
        Appointment.start_time <= datetime.utcnow() + timedelta(days=15),
        Appointment.status != 'canceled'
    ).all()
    
    booked_slots = set()
    for appt in appointments:
        # appt.start_time is naive but implicitly UTC
        booked_slots.add((appt.closer_id, appt.start_time))
        
    daily_slots_utc = {} # Key: Date (User's perspective? No, keep simple list) -> actually list of objects
    # We will send a flat list of available slots in UTC to the frontend
    # and let JS handle the Grouping by Day (Client Time)
    
    available_slots_utc = []
    
    unique_slots = {}
    preferred_id = session.get('preferred_closer_id')

    for av in availabilities:
        closer = av.closer
        if not closer: continue
        
        # Get Closer Timezone
        try:
            closer_tz = pytz.timezone(closer.timezone or 'America/La_Paz')
        except pytz.UnknownTimeZoneError:
            closer_tz = pytz.timezone('America/La_Paz')
            
        # Create Local Datetime
        local_dt = datetime.combine(av.date, av.start_time) # Naive
        local_dt = closer_tz.localize(local_dt) # Aware (Closer Time)
        
        # Convert to UTC
        utc_dt = local_dt.astimezone(pytz.UTC).replace(tzinfo=None) # Make naive UTC for comparison with DB
        
        # Filter Past
        if utc_dt < datetime.utcnow(): continue
        
        # Check Booking (utc_dt)
        if (av.closer_id, utc_dt) not in booked_slots:
            ts_key = utc_dt
            
            # If not present, add it
            if ts_key not in unique_slots:
                unique_slots[ts_key] = {
                    'utc_iso': utc_dt.isoformat() + 'Z', # Explicit Z for JS
                    'closer_id': av.closer_id,
                    'ts': utc_dt.timestamp()
                }
            # If present, check if we should swap for preferred closer
            elif preferred_id and av.closer_id == preferred_id:
                 unique_slots[ts_key]['closer_id'] = av.closer_id
            
    available_slots_utc = list(unique_slots.values())
    
    # DEBUG: Print what we are sending
    print(f"DEBUG SLOTS sending to frontend ({len(available_slots_utc)}):")
    for s in available_slots_utc:
        print(f"  -> {s['utc_iso']} (Closer {s['closer_id']})")
            
    # Sort by time
    available_slots_utc.sort(key=lambda x: x['ts'])
    
    # We pass raw slots to frontend, JS will group them
    return render_template('booking/calendar.html', slots_json=available_slots_utc)

@bp.route('/booking/select', methods=['POST'])
def select_slot():
    import pytz
    # We expect 'utc_iso' or explicit components. Let's rely on 'utc_iso' from frontend if possible, 
    # OR we can reconstruct if frontend sends localized date/time + offset?
    # Simplest: Frontend sends 'closer_id' AND 'utc_iso' for the chosen slot.
    # But wait, original flow picked closer dynamically. 
    # With UTC slots pre-calculated in calendar_view, each slot already belongs to a specific closer.
    
    utc_iso = request.form.get('utc_iso')
    closer_id = request.form.get('closer_id')
    
    if not utc_iso or not closer_id:
        flash('Error en la selección de horario. Intente nuevamente.')
        return redirect(url_for('booking.calendar_view'))
        
    start_time_utc = datetime.fromisoformat(utc_iso.replace('Z', '+00:00')).replace(tzinfo=None) # Naive UTC
    chosen_closer_id = int(closer_id)

    # Double Check Availability (Concurrency)
    # Since Availability is Local, and Appointment is UTC, we must verify logic carefully.
    # Actually, we trusted the 'calendar_view' calculation.
    # Let's check overlap with Appointment (UTC)
    conflict = Appointment.query.filter_by(closer_id=chosen_closer_id, start_time=start_time_utc).filter(Appointment.status != 'canceled').first()
    
    if conflict:
        flash('Lo sentimos, este horario acaba de ser ocupado.')
        return redirect(url_for('booking.calendar_view'))
        
    # Check if User exists
    user_id = session.get('booking_user_id')
    
    if user_id:
        # Create immediately (in UTC)
        appt = Appointment(
            closer_id=chosen_closer_id,
            lead_id=user_id,
            start_time=start_time_utc, # Stored as UTC
            status='scheduled',
            event_id=session.get('booking_event_id')
        )
        db.session.add(appt)
        db.session.commit()
        session['current_appt_id'] = appt.id
        
        # Update User Status automatically
        user = User.query.get(user_id)
        if user:
            user.update_status_based_on_debt()
            
        send_calendar_webhook(appt, 'created')
    else:
        # Save to session (UTC) and redirect
        bdata = session.get('booking_data', {})
        bdata['slot'] = {
            'utc_iso': utc_iso,
            'closer_id': chosen_closer_id
        }
        session['booking_data'] = bdata
        _flush_session_data(user_id) # Won't flush if user_id None, just saves to session
        
        return redirect(url_for('booking.next_step'))
        
    return redirect(url_for('booking.next_step'))

@bp.route('/booking/survey', methods=['GET', 'POST'])
def survey_view():
    # Fetch questions
    query = SurveyQuestion.query.filter_by(is_active=True, step='survey')
    evt_id = session.get('booking_event_id')
    if evt_id:
        # ... (Same filter logic as before) ...
        # Simplified for brevity in this replace block, but must match logic
        event = Event.query.get(evt_id)
        conditions = [SurveyQuestion.event_id == evt_id]
        if event.group_id: conditions.append(SurveyQuestion.event_group_id == event.group_id)
        conditions.append((SurveyQuestion.event_id == None) & (SurveyQuestion.event_group_id == None))
        query = query.filter(or_(*conditions))
    else:
        query = query.filter((SurveyQuestion.event_id == None) & (SurveyQuestion.event_group_id == None))
        
    questions = query.order_by(SurveyQuestion.order).all()
    
    if request.method == 'POST':
        user_id = session.get('booking_user_id')
        appt_id = session.get('current_appt_id')
        
        # Collect answers
        answers_data = [] # List of {q_id, ans}
        for q in questions:
            ans_text = request.form.get(f'q_{q.id}')
            if ans_text:
                answers_data.append({'question_id': q.id, 'answer': ans_text})
        
        if user_id:
            # Save immediately
            for item in answers_data:
                ans = SurveyAnswer(lead_id=user_id, question_id=item['question_id'], answer=item['answer'], appointment_id=appt_id)
                db.session.add(ans)
            db.session.commit()
        else:
            # Cache
            bdata = session.get('booking_data', {})
            # Merge with existing?
            existing = bdata.get('answers', [])
            existing.extend(answers_data)
            bdata['answers'] = existing
            session['booking_data'] = bdata

        return redirect(url_for('booking.next_step'))
        
    return render_template('booking/survey.html', questions=questions)

@bp.route('/booking/thankyou')
def thank_you():
    utm_source = session.get('booking_utm', 'direct')
    # Loop back to start
    return redirect(url_for('booking.start_booking', utm_source=utm_source))

