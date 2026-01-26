from flask import Blueprint, request, jsonify
from app.models import db, Event, Client, Appointment, SurveyAnswer, SurveyQuestion, User
from app.services.booking_service import BookingService
from datetime import datetime, date, timedelta
import json

bp = Blueprint('public_api', __name__)

@bp.route('/public/funnel/<string:utm_source>', methods=['GET'])
def get_funnel_by_source(utm_source):
    # Find event by utm_source
    event = Event.query.filter_by(utm_source=utm_source, is_active=True).first()
    if not event:
        return jsonify({"error": "Event not found"}), 404
        
    # Merge Questions: Global + Group + Event
    global_questions = SurveyQuestion.query.filter_by(is_global=True, is_active=True).all()
    group_questions = SurveyQuestion.query.filter_by(group_id=event.group_id, is_active=True).all() if event.group_id else []
    event_questions = SurveyQuestion.query.filter_by(event_id=event.id, is_active=True).all()
    
    # Simple merge and sort by order
    questions = global_questions + group_questions + event_questions
    questions.sort(key=lambda x: x.order)
        
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
            
    # Sort by timestamp for proper chronological order
    all_slots.sort(key=lambda x: x['ts'])

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
            "options": json.loads(q.options) if q.options and q.options.startswith('[') else q.options,
            "step": q.step,
            "mapping": q.mapping_field
        } for q in questions],
        "availability": all_slots,
        "closer_name": "Equipo NeurOPS" # Generic if merging
    }), 200

@bp.route('/public/clients/check', methods=['POST'])
def check_client_exists():
    data = request.get_json() or {}
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email required"}), 400
    
    client = Client.query.filter_by(email=email).first()
    if client:
        answers = {sa.question_id: sa.answer for sa in client.survey_answers}
        return jsonify({
            "exists": True,
            "client": {
                "id": client.id,
                "full_name": client.full_name,
                "phone": client.phone,
                "instagram": client.instagram,
                "survey_answers": answers
            }
        }), 200
    return jsonify({"exists": False}), 200

@bp.route('/public/submit-lead', methods=['POST'])
def submit_lead():
    data = request.get_json() or {}
    email = data.get('email')
    if not email: return jsonify({"error": "Email required"}), 400
    
    client = BookingService.create_or_update_client({
        'email': email,
        'name': data.get('name') or data.get('full_name'),
        'phone': data.get('phone'),
        'instagram': data.get('instagram')
    })
    
    return jsonify({"id": client.id, "message": "Lead saved"}), 200

@bp.route('/public/submit-survey', methods=['POST'])
def submit_survey():
    data = request.get_json() or {}
    client_id = data.get('client_id')
    answers = data.get('answers', []) # List of {question_id, answer}
    
    if not client_id: return jsonify({"error": "Client ID required"}), 400
    
    try:
        BookingService.save_survey_answers(client_id, answers)
        return jsonify({"message": "Answers saved"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

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
    all_slots.sort(key=lambda x: x['ts'])
    return jsonify(all_slots), 200

@bp.route('/public/book', methods=['POST'])
def book_appointment():
    data = request.get_json() or {}
    
    email = data.get('email')
    name = data.get('name') or data.get('full_name')
    phone = data.get('phone')
    instagram = data.get('instagram')
    
    timestamp = data.get('timestamp')
    event_id = data.get('event_id')
    survey_answers_raw = data.get('survey_answers', {})
    
    if not email or not timestamp or not event_id:
        return jsonify({"error": "Missing required fields (email, timestamp, event_id)"}), 400
        
    try:
        # 1. Create/Update Client
        client = BookingService.create_or_update_client({
            'email': email,
            'name': name,
            'phone': phone,
            'instagram': instagram
        })
        
        # 2. Find a closer (Generic logic: use the one from the slot if possible, or any available)
        # The frontend sends 'timestamp'. We need to find which closer has that slot.
        start_time = datetime.fromtimestamp(float(timestamp))
        
        # Find which closer has this availability
        # Note: In public funnel, we might want to pick a closer automatically.
        # For now, let's see if the frontend sends closer_id. 
        # Frontend BookingPage.jsx doesn't seem to send closer_id in the payload I saw.
        # Let's adjust BookingPage.jsx to send closer_id, OR find one here.
        
        closer_id = data.get('closer_id')
        if not closer_id:
            # Pick any closer that has this slot available and no conflict
            # This is a bit simplified for now.
            closers = User.query.filter_by(role='closer').all()
            for c in closers:
                appt = BookingService.create_appointment(client.id, c.id, start_time, origin='Funnel Web')
                if appt:
                    closer_id = c.id
                    break
        else:
            appt = BookingService.create_appointment(client.id, closer_id, start_time, origin='Funnel Web')
            
        if not closer_id:
            return jsonify({"error": "Lo sentimos, este horario ya no está disponible. Por favor elige otro."}), 400

        # 3. Save Survey Answers and Calculate Score
        total_score = 0
        if survey_answers_raw:
            formatted_answers = []
            for q_id, val in survey_answers_raw.items():
                q_id_int = int(q_id)
                formatted_answers.append({"question_id": q_id_int, "answer": str(val)})
                
                # Calculate points for this answer
                q = SurveyQuestion.query.get(q_id_int)
                if q and q.options:
                    try:
                        import json
                        opts = json.loads(q.options)
                        if isinstance(opts, list):
                            for opt in opts:
                                if str(opt.get('text')) == str(val):
                                    total_score += int(opt.get('points', 0))
                                    break
                    except: # Fallback for old comma-separated format
                        pass
                        
            BookingService.save_survey_answers(client.id, formatted_answers, appointment_id=appt.id)
        
        # 4. Link to event and determine redirect
        event = Event.query.get(event_id)
        redirect_url = None
        is_qualified = True
        
        if event:
            appt.origin = f"Funnel: {event.name}"
            print(f"[DEBUG] Total Score: {total_score}, Min Score: {event.min_score}")
            # Check qualification
            if total_score < (event.min_score or 0):
                is_qualified = False
                redirect_url = event.redirect_url_fail
                print(f"[DEBUG] Lead NOT qualified. Redirecting to: {redirect_url}")
            else:
                redirect_url = event.redirect_url_success
                print(f"[DEBUG] Lead QUALIFIED. Redirecting to: {redirect_url}")
        
        
        db.session.commit()

        # Trigger Agenda Webhook
        BookingService.trigger_agenda_webhook(appt, event)

        return jsonify({
            "message": "Booking successful", 
            "id": appt.id,
            "total_score": total_score,
            "is_qualified": is_qualified,
            "redirect_url": redirect_url,
            "closer_name": appt.closer.username if appt.closer else "Equipo"
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
