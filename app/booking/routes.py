from flask import render_template, redirect, url_for, flash, request, session
from app.booking import bp
from app.models import User, Event, SurveyQuestion, SurveyAnswer
from app.services.booking_service import BookingService
from app.closer.utils import send_calendar_webhook
from datetime import datetime, timedelta, date

@bp.route('/booking', methods=['GET'])
def start_booking():
    """Entry Point: Initializes the booking flow"""
    utm_source = request.args.get('utm_source', 'direct')
    event = Event.query.filter_by(utm_source=utm_source).first()
    
    # Clear Session safely
    keys_to_clear = ['booking_data', 'booking_event_id', 'funnel_steps', 'funnel_index', 'booking_user_id', 'current_appt_id', 'booking_email_input']
    for k in keys_to_clear:
        session.pop(k, None)
        
    session['booking_utm'] = utm_source
    if event:
        session['booking_event_id'] = event.id
    
    # Define Flow
    funnel_steps = ['identify', 'contact_details', 'survey', 'calendar']
    session['funnel_steps'] = funnel_steps
    session['funnel_index'] = 0
    
    return redirect(url_for('booking.handle_flow'))

@bp.route('/booking/flow')
def handle_flow():
    """Router"""
    steps = session.get('funnel_steps', [])
    index = session.get('funnel_index', 0)
    
    if index >= len(steps):
        return redirect(url_for('booking.thank_you'))
        
    current_step = steps[index]
    
    if current_step == 'identify': return redirect(url_for('booking.identify_view'))
    elif current_step == 'contact_details': return redirect(url_for('booking.contact_details_view'))
    elif current_step == 'calendar': return redirect(url_for('booking.calendar_view'))
    elif current_step == 'survey': return redirect(url_for('booking.survey_view'))
    else:
        # Skip unknown
        session['funnel_index'] = index + 1
        return redirect(url_for('booking.handle_flow'))

@bp.route('/booking/next')
def next_step():
    session['funnel_index'] = session.get('funnel_index', 0) + 1
    return redirect(url_for('booking.handle_flow'))

@bp.route('/booking/identify', methods=['GET', 'POST'])
def identify_view():
    if request.method == 'POST':
        email = request.form.get('email')
        if not email:
            flash('El correo es obligatorio.', 'error')
            return render_template('booking/identify.html')
            
        user = User.query.filter_by(email=email).first()
        if user:
            session['booking_user_id'] = user.id
            flash(f'¡Hola de nuevo, {user.username}!', 'info')
        else:
            session.pop('booking_user_id', None)
            session['booking_email_input'] = email
            
        return redirect(url_for('booking.next_step'))
        
    return render_template('booking/identify.html')

@bp.route('/booking/details', methods=['GET', 'POST'])
def contact_details_view():
    user_id = session.get('booking_user_id')
    
    if request.method == 'POST':
        # Prepare data for Service
        data = {
            'email': session.get('booking_email_input') or request.form.get('email'),
            'name': request.form.get('name'),
            'instagram': request.form.get('instagram'),
            'utm_source': session.get('booking_utm', 'direct')
        }
        
        # Phone cleaning
        code = request.form.get('phone_code')
        phone = request.form.get('phone')
        if phone:
             data['phone'] = f"{code} {phone}".strip() if code else phone
        else:
             data['phone'] = None

        user = BookingService.create_or_update_lead(data, user_id=user_id)
        if not user:
             flash('Error al procesar sus datos. Intente nuevamente.')
             return redirect(url_for('booking.start_booking'))
             
        session['booking_user_id'] = user.id
        return redirect(url_for('booking.next_step'))

    # GET: Pre-fill
    prefill = {}
    if user_id:
        user = User.query.get(user_id)
        if user:
            prefill['email'] = user.email
            prefill['name'] = user.username
            if user.lead_profile:
                if user.lead_profile.phone and ' ' in user.lead_profile.phone:
                     parts = user.lead_profile.phone.split(' ', 1)
                     prefill['phone_code'] = parts[0]
                     prefill['phone'] = parts[1]
                else:
                     prefill['phone'] = user.lead_profile.phone
                prefill['instagram'] = user.lead_profile.instagram
    else:
        prefill['email'] = session.get('booking_email_input')
        
    return render_template('booking/contact_details.html', data=prefill)

def _flush_session_data(user_id):
    """Saves cached slot/answers using Service."""
    bdata = session.get('booking_data', {})
    
    # 1. Appointment
    slot = bdata.get('slot')
    if slot:
        utc_iso = slot.get('utc_iso')
        if utc_iso:
            start_time = datetime.fromisoformat(utc_iso.replace('Z', '+00:00')).replace(tzinfo=None)
            
            appt = BookingService.create_appointment(
                lead_id=user_id,
                closer_id=slot['closer_id'],
                start_time_utc=start_time,
                event_id=session.get('booking_event_id')
            )
            
            if appt:
                session['current_appt_id'] = appt.id
                send_calendar_webhook(appt, 'created')
            
            bdata['slot'] = None # Clear
            session['booking_data'] = bdata

    # 2. Answers
    answers = bdata.get('answers')
    if answers:
        appt_id = session.get('current_appt_id')
        BookingService.save_survey_answers(user_id, answers, appointment_id=appt_id)
        
        bdata['answers'] = []
        session['booking_data'] = bdata

@bp.route('/booking/calendar')
def calendar_view():
    today = date.today()
    end_date = today + timedelta(days=14)
    preferred_id = session.get('preferred_closer_id')
    
    slots = BookingService.get_available_slots_utc(today, end_date, preferred_id)
    return render_template('booking/calendar.html', slots_json=slots)

@bp.route('/booking/select', methods=['POST'])
def select_slot():
    utc_iso = request.form.get('utc_iso')
    closer_id = request.form.get('closer_id')
    
    if not utc_iso or not closer_id:
        flash('Error en la selección.')
        return redirect(url_for('booking.calendar_view'))
        
    start_time_utc = datetime.fromisoformat(utc_iso.replace('Z', '+00:00')).replace(tzinfo=None)
    chosen_id = int(closer_id)
    user_id = session.get('booking_user_id')
    
    if user_id:
        # Create Immediately
        appt = BookingService.create_appointment(user_id, chosen_id, start_time_utc, session.get('booking_event_id'))
        if not appt:
            flash('Lo sentimos, este horario acaba de ser ocupado.')
            return redirect(url_for('booking.calendar_view'))
            
        session['current_appt_id'] = appt.id
        send_calendar_webhook(appt, 'created')
    else:
        # Cache in Session
        bdata = session.get('booking_data', {})
        bdata['slot'] = {'utc_iso': utc_iso, 'closer_id': chosen_id}
        session['booking_data'] = bdata
        
    return redirect(url_for('booking.next_step'))

@bp.route('/booking/survey', methods=['GET', 'POST'])
def survey_view():
    from sqlalchemy import or_
    query = SurveyQuestion.query.filter_by(is_active=True, step='survey')
    evt_id = session.get('booking_event_id')
    
    if evt_id:
        # Logic to include event specific questions
        event = Event.query.get(evt_id)
        if event:
            conditions = [SurveyQuestion.event_id == evt_id]
            if event.group_id: conditions.append(SurveyQuestion.event_group_id == event.group_id)
            conditions.append((SurveyQuestion.event_id == None) & (SurveyQuestion.event_group_id == None))
            query = query.filter(or_(*conditions))
    else:
        query = query.filter((SurveyQuestion.event_id == None) & (SurveyQuestion.event_group_id == None))
        
    questions = query.order_by(SurveyQuestion.order).all()
    user_id = session.get('booking_user_id')
    
    existing_answers = {}
    if user_id:
        prev = SurveyAnswer.query.filter_by(lead_id=user_id).all()
        for p in prev: existing_answers[p.question_id] = p.answer

    if request.method == 'POST':
        answers_data = []
        for q in questions:
            ans = request.form.get(f'q_{q.id}')
            if ans: answers_data.append({'question_id': q.id, 'answer': ans})
            
        if user_id:
             appt_id = session.get('current_appt_id')
             BookingService.save_survey_answers(user_id, answers_data, appt_id)
        else:
             # Cache
             bdata = session.get('booking_data', {})
             existing = bdata.get('answers', [])
             existing.extend(answers_data)
             bdata['answers'] = existing
             session['booking_data'] = bdata
             
        # Try flush if we have user now (e.g. if order was different, rare)
        if user_id: _flush_session_data(user_id) # Just in case slot was waiting
             
        return redirect(url_for('booking.next_step'))
        
    return render_template('booking/survey.html', questions=questions, existing_answers=existing_answers)

@bp.route('/booking/thankyou')
def thank_you():
    # Final check if anything to flush?
    user_id = session.get('booking_user_id')
    if user_id: _flush_session_data(user_id)
    
    return redirect("https://www.videoask.com/f0izqogih")
