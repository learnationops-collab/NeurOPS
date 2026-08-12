from flask import Blueprint, request, jsonify
from app.models import db, Event, Client, Appointment, SurveyAnswer, SurveyQuestion, User, Notification
from app.services.booking_service import BookingService
from datetime import datetime, date, timedelta
import json

bp = Blueprint('public_api', __name__)

@bp.route('/public/funnel/<string:utm_source>', methods=['GET'])
def get_funnel_by_source(utm_source):
    target_username = request.args.get('username')
    
    try:
        # 1. Try exact match (General Link: /book/event-slug)
        event = Event.query.filter_by(utm_source=utm_source, is_active=True).first()
        
        # 2. If not found, try parsing 'slug-username' (Personal Link)
        if not event:
            parts = utm_source.rsplit('-', 1)
            if len(parts) == 2:
                slug_part, user_part = parts
                
                # Verify user exists
                potential_user = User.query.filter_by(username=user_part, role='closer').first()
                if potential_user:
                    # Verify event exists
                    potential_event = Event.query.filter_by(utm_source=slug_part, is_active=True).first()
                    if potential_event:
                        event = potential_event
                        target_username = user_part

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
        
        closers = []
        target_username = request.args.get('username')
        
        if target_username:
            user = User.query.filter_by(username=target_username, role='closer').first()
            if user:
                closers = [user]
        
        # If no specific closer or user not found, try event assigned closers
        if not closers:
            if event.closers:
                closers = event.closers
            else:
                # Fallback: All closers
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
                "options": (json.loads(q.options) if q.options and q.options.startswith('[') else q.options) if q.options else [],
                "step": q.step,
                "mapping": q.mapping_field
            } for q in questions],
            "availability": all_slots,
            "closer_name": closers[0].username if len(closers) == 1 else "Equipo NeurOPS"
        }), 200
    except Exception as e:
        print(f"[ERROR] Funnel Data API: {e}")
        return jsonify({"error": "Error interno al cargar la información del evento"}), 500

@bp.route('/public/clients/check', methods=['POST'])
def check_client_exists():
    data = request.get_json() or {}
    email = data.get('email')
    instagram = data.get('instagram')
    
    if not email and not instagram:
        return jsonify({"error": "Email or Instagram required"}), 400
    
    client = None
    if email:
        client = Client.query.filter_by(email=email).first()
    
    if not client and instagram:
        # Try finding by instagram (case insensitive if possible, or exact)
        # We strip @ if present for consistency
        ig_username = instagram.strip().replace('@', '')
        client = Client.query.filter(or_(Client.instagram == ig_username, Client.instagram == f"@{ig_username}")).first()
    
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
        
        if not client:
            return jsonify({"error": "Error al procesar la información del cliente"}), 500
        
        # 2. Identify Event
        event = Event.query.get(event_id)
        if not event:
            return jsonify({"error": "Evento no encontrado"}), 404

        # 2b. Identify Setter (from ID, Username, or Event Default)
        setter_id = data.get('setter_id')
        
        if not setter_id:
            setter_username = data.get('setter')
            if setter_username:
                # Case insensitive search for setter
                setter_user = User.query.filter(User.username.ilike(setter_username), User.role.in_(['setter', 'admin', 'closer'])).first()
                if setter_user:
                    setter_id = setter_user.id
        
        # Fallback to event's default setter if still not identified
        if not setter_id and event.setter_id:
            setter_id = event.setter_id

        # 3. Find a closer (Generic logic: use the one from the slot if possible, or any available)
        # The frontend sends 'timestamp'. We need to find which closer has that slot.
        try:
            from datetime import timezone
            start_time = datetime.fromtimestamp(float(timestamp), tz=timezone.utc).replace(tzinfo=None)
        except (ValueError, TypeError) as e:
            print(f"[ERROR] Invalid timestamp format: {timestamp} - {e}")
            return jsonify({"error": "Formato de fecha inválido"}), 400
        
        # Find which closer has this availability
        closer_id = data.get('closer_id')
        appt = None

        if closer_id:
            appt = BookingService.create_appointment(client.id, int(closer_id), start_time, origin='Funnel Web', setter_id=setter_id)
        else:
            # Pick any closer that has this slot available and no conflict
            # Use event-assigned closers if defined, fallback to all closers
            target_closers = event.closers if event.closers else User.query.filter_by(role='closer').all()
            for c in target_closers:
                appt = BookingService.create_appointment(client.id, c.id, start_time, origin='Funnel Web', setter_id=setter_id)
                if appt:
                    closer_id = c.id
                    break
            
        if not appt:
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

        # Sync with Google Calendar
        try:
            from app.services.google_service import GoogleService
            # appt is guaranteed to exist here
            evt_id = GoogleService.create_event(appt.closer_id, appt)
            if evt_id:
                appt.google_event_id = evt_id
                db.session.commit()
        except Exception as e:
            print(f"GCal Sync Error (Public): {e}")
        
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


from . import triage
from . import marketing
from . import setter
from . import closer
from . import financial_sales
from . import financial_agendas
from . import lead_roadmap
from . import finance
from . import new_clients
from . import workshop_lead


@bp.route('/public/clients/search', methods=['GET'])
def search_clients_public():
    """Busca clientes por nombre (usado en buscador del mazo para leads sin agenda)."""
    from sqlalchemy import func
    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify([]), 200

    term = f"%{q.lower()}%"
    # Busca solo clientes que tienen form_data (vinieron de formulario n8n) o coinciden por nombre
    clients = Client.query.filter(
        func.lower(Client.full_name).like(term)
    ).order_by(Client.created_at.desc()).limit(20).all()

    return jsonify([{
        "client_id": c.id,
        "full_name": c.full_name,
        "fuente": (c.form_data or {}).get('fuente_form', 'Formulario'),
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "has_form_data": bool(c.form_data)
    } for c in clients]), 200

