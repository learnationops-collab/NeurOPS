from flask import Blueprint, request, jsonify
from app.models import db, Event, Client, Appointment, SurveyAnswer, SurveyQuestion, User
from app.services.booking_service import BookingService
from datetime import datetime, date, timedelta

bp = Blueprint('public_api', __name__)

@bp.route('/public/funnel/<string:utm_source>', methods=['GET'])
def get_funnel_by_source(utm_source):
    # Find event by utm_source
    event = Event.query.filter_by(utm_source=utm_source, is_active=True).first()
    if not event:
        return jsonify({"error": "Event not found"}), 404
        
    questions = SurveyQuestion.query.filter_by(event_id=event.id, is_active=True).order_by(SurveyQuestion.step, SurveyQuestion.order).all()
        
    # Get available slots (Generic for all closers)
    start_date = date.today()
    end_date = start_date + timedelta(days=14)
    
    # Simple strategy: aggregate slots from all closers
    closers = User.query.filter_by(role='closer').all()
    all_slots = []
    for closer in closers:
        slots = BookingService.get_available_slots_utc(start_date, end_date, preferred_closer_id=closer.id)
        for s in slots:
            s['closer_id'] = closer.id
            s['closer_name'] = closer.username
            all_slots.append(s)
            
    # Sort and unique? Usually we just show them.
    all_slots.sort(key=lambda x: x['start'])

    return jsonify({
        "event": {
            "id": event.id,
            "name": event.name,
            "duration": event.duration_minutes,
            "utm_source": event.utm_source,
            "min_score": event.min_score,
            "redirect_success": event.redirect_url_success,
            "redirect_fail": event.redirect_url_fail,
        },
        "questions": [{
            "id": q.id,
            "text": q.text,
            "type": q.question_type,
            "options": q.options,
            "step": q.step,
            "mapping": q.mapping_field
        } for q in questions],
        "availability": all_slots,
        "closer_name": "Equipo NeurOPS" # Generic if merging
    }), 200

@bp.route('/public/submit-lead', methods=['POST'])
def submit_lead():
    data = request.get_json() or {}
    email = data.get('email')
    if not email: return jsonify({"error": "Email required"}), 400
    
    client = Client.query.filter_by(email=email).first()
    if not client:
        client = Client(
            email=email,
            full_name=data.get('full_name'),
            phone=data.get('phone'),
            instagram=data.get('instagram')
        )
        db.session.add(client)
    else:
        # Update info if provided
        if data.get('full_name'): client.full_name = data.get('full_name')
        if data.get('phone'): client.phone = data.get('phone')
        if data.get('instagram'): client.instagram = data.get('instagram')
        
    db.session.commit()
    return jsonify({"id": client.id, "message": "Lead saved"}), 200

@bp.route('/public/submit-survey', methods=['POST'])
def submit_survey():
    data = request.get_json() or {}
    client_id = data.get('client_id')
    answers = data.get('answers', []) # List of {question_id, answer}
    
    if not client_id: return jsonify({"error": "Client ID required"}), 400
    
    for ans in answers:
        q_id = ans.get('question_id')
        val = ans.get('answer')
        if q_id:
            # Check for existing answer to update or create new? Usually surveys are one-time per event, but let's just append/replace.
            # Assuming simple append for now.
            sa = SurveyAnswer(client_id=client_id, question_id=q_id, answer=str(val))
            db.session.add(sa)
            
    db.session.commit()
    return jsonify({"message": "Answers saved"}), 200

@bp.route('/public/slots', methods=['GET'])
def get_public_slots():
    # Helper to get slots from ALL closers or specific if logic demands.
    # Usually we want Round Robin or Pool. 
    # For now, let's use BookingService to get slots from a specific closer if passed, or generic. 
    # BookingService currently takes preferred_closer_id. 
    # If no closer specified, we might want to aggregate ALL slots.
    
    # Simple strategy: standard 7 days lookahead
    start_date = datetime.now().date()
    end_date = start_date + timedelta(days=7)
    
    # We need a logic to pick which closer's slots to show, or show combined.
    # BookingService.get_available_slots_utc returns slots for a specific closer.
    # Let's iterate all active closers and merge? Or just pick one?
    # User requirement is high level. Let's merge all available slots from all closers.
    
    closers = User.query.filter_by(role='closer').all()
    all_slots = []
    
    for closer in closers:
        slots = BookingService.get_available_slots_utc(start_date, end_date, preferred_closer_id=closer.id)
        # slots structure: [{"start": ISO, "end": ISO, "closer_id": ID}...] (if we modify service to return closer_id)
        # Service returns dict per day usually or list. 
        # Let's check CloserService usage: it returns list of objects? No, usually list of dicts.
        # Assuming list of {start, end}. We add closer_id.
        for s in slots:
            s['closer_id'] = closer.id
            all_slots.append(s)
            
    # Sort by time
    all_slots.sort(key=lambda x: x['start'])
    return jsonify(all_slots), 200

@bp.route('/public/book', methods=['POST'])
def book_appointment():
    data = request.get_json() or {}
    client_id = data.get('client_id')
    closer_id = data.get('closer_id')
    start_time_str = data.get('start_time')
    event_id = data.get('event_id')
    
    if not client_id or not start_time_str or not closer_id:
        return jsonify({"error": "Missing required fields"}), 400
        
    try:
        start_time = datetime.fromisoformat(start_time_str.replace('Z', ''))
        appt = BookingService.create_appointment(client_id, closer_id, start_time, origin='Funnel Web')
        
        # Link to event if provided? Appointment model has event_id?
        # Checked models.py: Appointment has `origin`. `event_id` was removed in previous migration?
        # Let's check model again. 
        # Line 137: origin. Line 138: type. No event_id. 
        # We can store event name in origin or type.
        if event_id:
            event = Event.query.get(event_id)
            if event: appt.origin = f"Funnel: {event.name}"
        
        db.session.commit()
        return jsonify({"message": "Booking successful", "id": appt.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400
