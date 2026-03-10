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

@bp.route('/public/active-setters', methods=['GET'])
def get_active_setters():
    """Retorna lista de setters activos (Nombre e ID)"""
    try:
        setters = User.query.filter_by(role='setter', is_active=True).all()
        return jsonify([
            {"id": s.id, "name": s.username} 
            for s in setters
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/public/setter-questions', methods=['GET'])
def get_public_setter_questions():
    """Retorna las preguntas configuradas para los setters"""
    from app.models import DailyReportQuestion
    try:
        questions = DailyReportQuestion.query.filter_by(role='setter', is_active=True).order_by(DailyReportQuestion.order).all()
        return jsonify([{"id": q.id, "text": q.text, "type": q.question_type} for q in questions]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/public/setter-report', methods=['POST'])
def submit_public_setter_report():
    """Recibe y guarda el reporte diario de un setter, disparando las automatizaciones."""
    from app.models import SetterDailyStats, PipelineStage
    from app.api.setter import _trigger_setter_report_webhook, _get_setter_stages_ordered
    
    data = request.get_json() or {}
    
    setter_id = data.get('setter_id')
    report_date_str = data.get('date')
    
    if not setter_id or not report_date_str:
        return jsonify({"message": "ID del setter y fecha son obligatorios"}), 400
        
    try:
        report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400
        
    # Verificar existencia
    stat = SetterDailyStats.query.filter_by(setter_id=setter_id, date=report_date).first()
    
    if stat:
        stat.not_lead = int(data.get('not_lead') or 0)
        stat.inbox_entrantes = int(data.get('inbox_entrantes') or 0)
        stat.inbox_inabribles = int(data.get('inbox_inabribles') or 0)
        stat.inbox_leads = int(data.get('inbox_leads') or 0)
        stat.opening_submitted = int(data.get('opening_submitted') or 0)
        stat.opening_responded = int(data.get('opening_responded') or 0)
        stat.funnel_qualification = int(data.get('funnel_qualification') or 0)
        stat.funnel_pain = int(data.get('funnel_pain') or 0)
        stat.funnel_offer = int(data.get('funnel_offer') or 0)
        stat.funnel_link = int(data.get('funnel_link') or 0)
        stat.funnel_agenda = int(data.get('funnel_agenda') or 0)
        stat.follow_up_submitted = int(data.get('follow_up_submitted') or 0)
        stat.follow_up_responded = int(data.get('follow_up_responded') or 0)
    else:
        stat = SetterDailyStats(
            setter_id=setter_id,
            date=report_date,
            not_lead=int(data.get('not_lead') or 0),
            inbox_entrantes=int(data.get('inbox_entrantes') or 0),
            inbox_inabribles=int(data.get('inbox_inabribles') or 0),
            inbox_leads=int(data.get('inbox_leads') or 0),
            opening_submitted=int(data.get('opening_submitted') or 0),
            opening_responded=int(data.get('opening_responded') or 0),
            funnel_qualification=int(data.get('funnel_qualification') or 0),
            funnel_pain=int(data.get('funnel_pain') or 0),
            funnel_offer=int(data.get('funnel_offer') or 0),
            funnel_link=int(data.get('funnel_link') or 0),
            funnel_agenda=int(data.get('funnel_agenda') or 0),
            follow_up_submitted=int(data.get('follow_up_submitted') or 0),
            follow_up_responded=int(data.get('follow_up_responded') or 0)
        )
        db.session.add(stat)
        
    # Procesar Funnel Metrics -> Map to stage_X_value
    funnel_metrics = data.get('funnel_metrics', [])
    stages = _get_setter_stages_ordered()
    stage_id_to_index = {s.id: i for i, s in enumerate(stages)}
    
    stat.stage_1_value = 0
    stat.stage_2_value = 0
    stat.stage_3_value = 0
    stat.stage_4_value = 0
    stat.stage_5_value = 0

    for metric in funnel_metrics:
        stage_id = metric.get('stage_id')
        value = int(metric.get('value', 0))
        
        if stage_id in stage_id_to_index:
            idx = stage_id_to_index[stage_id]
            if idx == 0: stat.stage_1_value = value
            elif idx == 1: stat.stage_2_value = value
            elif idx == 2: stat.stage_3_value = value
            elif idx == 3: stat.stage_4_value = value
            elif idx == 4: stat.stage_5_value = value
            
    # Process dinamic answers
    answers_data = data.get('answers', [])
    answers_json = {}
    for ans in answers_data:
        question_id = str(ans.get('question_id'))
        answer_text = str(ans.get('answer', ''))
        if question_id:
            answers_json[question_id] = answer_text
            
    stat.answers = answers_json
    
    try:
        db.session.commit()
        # Trigger webhook AFTER successful save (imported directly from setter.py logic)
        _trigger_setter_report_webhook(stat)
        return jsonify({"message": "Reporte guardado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/setter-stats', methods=['GET'])
def get_public_setter_stats():
    """Returns aggregated stats for setters with sum/avg support."""
    from app.models import SetterDailyStats
    from sqlalchemy import func
    
    # Filter by date range if provided
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    setter_id = request.args.get('setter_id')
    agg_type = request.args.get('agg_type', 'sum') # 'sum' or 'avg'
    
    # Count how many days of reports are in this range to calculate averages correctly
    days_count_query = db.session.query(func.count(SetterDailyStats.id))
    
    query = db.session.query(
        func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
        func.sum(SetterDailyStats.not_lead).label('not_lead'),
        func.sum(SetterDailyStats.inbox_inabribles).label('inabribles'),
        func.sum(SetterDailyStats.inbox_leads).label('leads'),
        func.sum(SetterDailyStats.opening_submitted).label('op_sub'),
        func.sum(SetterDailyStats.opening_responded).label('op_res'),
        func.sum(SetterDailyStats.funnel_qualification).label('fun_qual'),
        func.sum(SetterDailyStats.funnel_pain).label('fun_pain'),
        func.sum(SetterDailyStats.funnel_offer).label('fun_offer'),
        func.sum(SetterDailyStats.funnel_link).label('fun_link'),
        func.sum(SetterDailyStats.funnel_agenda).label('fun_agenda'),
        func.sum(SetterDailyStats.follow_up_submitted).label('fu_sub'),
        func.sum(SetterDailyStats.follow_up_responded).label('fu_res')
    )
    
    filters = []
    if start_date_str:
        filters.append(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        filters.append(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
    if setter_id:
        filters.append(SetterDailyStats.setter_id == setter_id)
        
    for f in filters:
        query = query.filter(f)
        days_count_query = days_count_query.filter(f)
        
    stats = query.one()
    days_count = days_count_query.scalar() or 1
    
    # helper for safe division and averaging
    def div(n, d):
        return round((n / d) * 100, 2) if d and d > 0 else 0
    
    def process_val(v):
        val = float(v or 0)
        if agg_type == 'avg':
            return round(val / days_count, 2)
        return val

    # Totals/Averages
    entrantes = float(stats.entrantes or 0)
    
    res = {
        "metadata": {
            "days_analyzed": days_count,
            "agg_type": agg_type
        },
        "totals": {
            "entrantes": process_val(stats.entrantes),
            "not_lead": process_val(stats.not_lead),
            "inabribles": process_val(stats.inabribles),
            "leads": process_val(stats.leads),
            "opening_submitted": process_val(stats.op_sub),
            "opening_responded": process_val(stats.op_res),
            "funnel_qualification": process_val(stats.fun_qual),
            "funnel_pain": process_val(stats.fun_pain),
            "funnel_offer": process_val(stats.fun_offer),
            "funnel_link": process_val(stats.fun_link),
            "funnel_agenda": process_val(stats.fun_agenda),
            "follow_up_submitted": process_val(stats.fu_sub),
            "follow_up_responded": process_val(stats.fu_res)
        },
        "percentages": {
            "inbox": {
                "leads": div(float(stats.leads or 0), entrantes),
                "not_lead": div(float(stats.not_lead or 0), entrantes),
                "inabribles": div(float(stats.inabribles or 0), entrantes)
            },
            "rates": {
                "opening_response": div(float(stats.op_res or 0), float(stats.op_sub or 0)),
                "follow_up_response": div(float(stats.fu_res or 0), float(stats.fu_sub or 0))
            },
            "funnel_evolution": {
                "qual_to_pain": div(float(stats.fun_pain or 0), float(stats.fun_qual or 0)),
                "pain_to_offer": div(float(stats.fun_offer or 0), float(stats.fun_pain or 0)),
                "offer_to_link": div(float(stats.fun_link or 0), float(stats.fun_offer or 0)),
                "link_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_link or 0))
            },
            "conversions_to_agenda": {
                "opening_to_agenda": div(float(stats.fun_agenda or 0), float(stats.op_res or 0)),
                "offer_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_offer or 0)),
                "link_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_link or 0))
            }
        }
    }
    
    return jsonify(res), 200
@bp.route('/public/setter-reports', methods=['GET'])
def get_public_setter_reports():
    """Retorna lista paginada de reportes con filtros."""
    from app.models import SetterDailyStats, User
    
    setter_id = request.args.get('setter_id')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    
    query = SetterDailyStats.query
    
    if setter_id:
        query = query.filter(SetterDailyStats.setter_id == setter_id)
    if start_date_str:
        query = query.filter(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
        
    pagination = query.order_by(SetterDailyStats.date.desc()).paginate(page=page, per_page=per_page)
    
    reports = []
    for r in pagination.items:
        reports.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "setter_id": r.setter_id,
            "setter_name": r.setter.username if r.setter else "Unknown",
            "entrantes": r.inbox_entrantes,
            "not_lead": r.not_lead,
            "inabribles": r.inbox_inabribles,
            "leads": r.inbox_leads,
            "op_sub": r.opening_submitted,
            "op_res": r.opening_responded,
            "fun_qual": r.funnel_qualification,
            "fun_pain": r.funnel_pain,
            "fun_offer": r.funnel_offer,
            "fun_link": r.funnel_link,
            "fun_agenda": r.funnel_agenda,
            "fu_sub": r.follow_up_submitted,
            "fu_res": r.follow_up_responded
        })
        
    return jsonify({
        "reports": reports,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    }), 200

@bp.route('/public/setter-reports/<int:report_id>', methods=['PUT'])
def update_public_setter_report(report_id):
    """Actualiza un reporte existente."""
    from app.models import SetterDailyStats
    stat = SetterDailyStats.query.get_or_404(report_id)
    data = request.get_json() or {}
    
    try:
        stat.inbox_entrantes = int(data.get('entrantes') or stat.inbox_entrantes)
        stat.not_lead = int(data.get('not_lead') or stat.not_lead)
        stat.inbox_inabribles = int(data.get('inabribles') or stat.inbox_inabribles)
        stat.inbox_leads = int(data.get('leads') or stat.inbox_leads)
        stat.opening_submitted = int(data.get('op_sub') or stat.opening_submitted)
        stat.opening_responded = int(data.get('op_res') or stat.opening_responded)
        stat.funnel_qualification = int(data.get('fun_qual') or stat.funnel_qualification)
        stat.funnel_pain = int(data.get('fun_pain') or stat.funnel_pain)
        stat.funnel_offer = int(data.get('fun_offer') or stat.funnel_offer)
        stat.funnel_link = int(data.get('fun_link') or stat.funnel_link)
        stat.funnel_agenda = int(data.get('fun_agenda') or stat.funnel_agenda)
        stat.follow_up_submitted = int(data.get('fu_sub') or stat.follow_up_submitted)
        stat.follow_up_responded = int(data.get('fu_res') or stat.follow_up_responded)
        
        db.session.commit()
        return jsonify({"message": "Reporte actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@bp.route('/public/setter-reports/<int:report_id>', methods=['DELETE'])
def delete_public_setter_report(report_id):
    """Elimina un reporte."""
    from app.models import SetterDailyStats
    stat = SetterDailyStats.query.get_or_404(report_id)
    try:
        db.session.delete(stat)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


# ============================================================
# CLOSER DAILY REPORT
# ============================================================

@bp.route('/public/active-closers', methods=['GET'])
def get_active_closers():
    """Retorna lista de closers activos (ID y nombre)."""
    try:
        closers = User.query.filter_by(role='closer', is_active=True).all()
        return jsonify([
            {"id": c.id, "name": c.username}
            for c in closers
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/public/closer-report', methods=['POST'])
def submit_public_closer_report():
    """Recibe y guarda el reporte diario de un closer."""
    from app.models import CloserDailyReport

    data = request.get_json() or {}

    closer_id = data.get('closer_id')
    report_date_str = data.get('date')

    if not closer_id or not report_date_str:
        return jsonify({"message": "ID del closer y fecha son obligatorios"}), 400

    try:
        report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400

    # Buscar reporte existente o crear nuevo
    report = CloserDailyReport.query.filter_by(closer_id=closer_id, date=report_date).first()

    # Helper para parsear enteros y floats del payload
    def get_int(key):
        return int(data.get(key) or 0)

    def get_float(key):
        return float(data.get(key) or 0.0)

    field_values = {
        # Generales
        'slots': get_int('slots'),
        'offers_made': get_int('offers_made'),
        # Primera Llamada
        'first_call_scheduled': get_int('first_call_scheduled'),
        'first_call_attended': get_int('first_call_attended'),
        'first_call_no_show': get_int('first_call_no_show'),
        'first_call_rescheduled': get_int('first_call_rescheduled'),
        'first_call_canceled': get_int('first_call_canceled'),
        # Segunda Llamada
        'second_call_scheduled': get_int('second_call_scheduled'),
        'second_call_attended': get_int('second_call_attended'),
        'second_call_no_show': get_int('second_call_no_show'),
        'second_call_rescheduled': get_int('second_call_rescheduled'),
        'second_call_canceled': get_int('second_call_canceled'),
        # Ventas PIF
        'pif_count': get_int('pif_count'),
        'pif_cash_collected': get_float('pif_cash_collected'),
        'pif_in_call_count': get_int('pif_in_call_count'),
        'pif_in_call_cash': get_float('pif_in_call_cash'),
        # Ventas Split Pay
        'split_count': get_int('split_count'),
        'split_cash_collected': get_float('split_cash_collected'),
        'split_in_call_count': get_int('split_in_call_count'),
        'split_in_call_cash': get_float('split_in_call_cash'),
        # Ventas Señas
        'deposit_count': get_int('deposit_count'),
        'deposit_cash_collected': get_float('deposit_cash_collected'),
        'deposit_in_call_count': get_int('deposit_in_call_count'),
        'deposit_in_call_cash': get_float('deposit_in_call_cash'),
        # Seguimientos
        'follow_ups_sent': get_int('follow_ups_sent'),
        'follow_ups_replied': get_int('follow_ups_replied'),
        'follow_ups_hot_sent': get_int('follow_ups_hot_sent'),
        'follow_ups_hot_replied': get_int('follow_ups_hot_replied'),
        'follow_ups_cold_sent': get_int('follow_ups_cold_sent'),
        'follow_ups_cold_replied': get_int('follow_ups_cold_replied'),
    }

    if report:
        for key, val in field_values.items():
            setattr(report, key, val)
    else:
        report = CloserDailyReport(closer_id=closer_id, date=report_date, **field_values)
        db.session.add(report)

    try:
        db.session.commit()
        # Disparar webhook de Discord después de guardar
        _trigger_closer_report_discord(report)
        return jsonify({"message": "Reporte de closer guardado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def _trigger_closer_report_discord(report):
    """Envía el reporte diario del closer a Discord con un embed formateado y una imagen renderizada."""
    try:
        import requests as req
        import json
        from datetime import datetime
        from app.services.image_service import ImageService

        # Mismo webhook que los setters
        url = "https://discordapp.com/api/webhooks/1471390632223314072/D0H6JaX8dnGdiOmPsGoDQyqwoN5X6zw1YHdlIs6evOZYk-BbvK7Bt32KjWw_nvkjwhdz"

        closer_name = report.closer.username if report.closer else "Closer"
        date_str = report.date.strftime('%d/%m/%Y')

        def safe_percent(part, total):
            try:
                if total > 0:
                    return round((part / total) * 100)
            except:
                pass
            return 0

        # Totales de ventas
        total_sales = (report.pif_count or 0) + (report.split_count or 0) + (report.deposit_count or 0)
        total_cash = (report.pif_cash_collected or 0) + (report.split_cash_collected or 0) + (report.deposit_cash_collected or 0)

        # Totales de agendas
        total_scheduled = (report.first_call_scheduled or 0) + (report.second_call_scheduled or 0)
        total_attended = (report.first_call_attended or 0) + (report.second_call_attended or 0)

        # Construct image data
        img_data = {
            "closer_name": closer_name,
            "date_str": date_str,
            "agendas": {
                "totals": {
                    "scheduled": total_scheduled,
                    "attended": total_attended,
                    "no_show": (report.first_call_no_show or 0) + (report.second_call_no_show or 0),
                    "canceled": (report.first_call_canceled or 0) + (report.second_call_canceled or 0),
                    "rescheduled": (report.first_call_rescheduled or 0) + (report.second_call_rescheduled or 0),
                },
                "first_call": {
                    "scheduled": report.first_call_scheduled or 0,
                    "attended": report.first_call_attended or 0,
                    "no_show": report.first_call_no_show or 0,
                    "canceled": report.first_call_canceled or 0,
                    "rescheduled": report.first_call_rescheduled or 0,
                },
                "second_call": {
                    "scheduled": report.second_call_scheduled or 0,
                    "attended": report.second_call_attended or 0,
                    "no_show": report.second_call_no_show or 0,
                    "canceled": report.second_call_canceled or 0,
                    "rescheduled": report.second_call_rescheduled or 0,
                }
            },
            "sales": {
                "totals": {
                    "count": total_sales,
                    "cash": total_cash,
                    "in_call_count": (report.pif_in_call_count or 0) + (report.split_in_call_count or 0) + (report.deposit_in_call_count or 0),
                    "in_call_cash": (report.pif_in_call_cash or 0) + (report.split_in_call_cash or 0) + (report.deposit_in_call_cash or 0),
                },
                "pif": {
                    "count": report.pif_count or 0,
                    "cash": report.pif_cash_collected or 0,
                    "in_call_count": report.pif_in_call_count or 0,
                    "in_call_cash": report.pif_in_call_cash or 0,
                },
                "split": {
                    "count": report.split_count or 0,
                    "cash": report.split_cash_collected or 0,
                    "in_call_count": report.split_in_call_count or 0,
                    "in_call_cash": report.split_in_call_cash or 0,
                },
                "deposit": {
                    "count": report.deposit_count or 0,
                    "cash": report.deposit_cash_collected or 0,
                    "in_call_count": report.deposit_in_call_count or 0,
                    "in_call_cash": report.deposit_in_call_cash or 0,
                }
            },
            "follow_up": {
                "hot_sent": report.follow_ups_hot_sent or 0,
                "hot_replied": report.follow_ups_hot_replied or 0,
                "hot_response_pct": safe_percent(report.follow_ups_hot_replied or 0, report.follow_ups_hot_sent or 0),
                "cold_sent": report.follow_ups_cold_sent or 0,
                "cold_replied": report.follow_ups_cold_replied or 0,
                "cold_response_pct": safe_percent(report.follow_ups_cold_replied or 0, report.follow_ups_cold_sent or 0),
                "total_sent": report.follow_ups_sent or 0,
                "total_replied": report.follow_ups_replied or 0,
            }
        }

        # Generate Image
        img_buffer = ImageService.generate_closer_report_card(img_data)

        # Discord Text & Metadata
        resumen_str = f"{total_attended} Asistencias | {total_sales} Ventas (${total_cash:,.0f})"
        
        content = (
            f"💰 **REPORTE DIARIO DE CLOSER**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 **Closer:** `{closer_name}`\n"
            f"📅 **Fecha:** `{date_str}`\n"
            f"📊 **Resumen:** `{resumen_str}`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"@everyone"
        )
        
        json_payload = {
            "content": content,
            "embeds": [{
                "color": 16753920, # #FFB100 Amber color
                "image": {
                    "url": "attachment://closer_report.png"
                },
                "footer": {
                    "text": "NeurOPS Performance System • " + datetime.now().strftime('%H:%M')
                }
            }]
        }
        
        files = {
            'file': ('closer_report.png', img_buffer, 'image/png')
        }
        
        res = req.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=10)
        print(f"[Discord Closer] Status: {res.status_code}")

    except Exception as e:
        print(f"[Discord Closer Error] {e}")
        import traceback
        traceback.print_exc()


@bp.route('/public/closer-stats', methods=['GET'])
def get_public_closer_stats():
    """Retorna estadísticas agregadas de closers con soporte de suma/promedio."""
    from app.models import CloserDailyReport
    from sqlalchemy import func

    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    closer_id = request.args.get('closer_id')
    agg_type = request.args.get('agg_type', 'sum')

    # Contar días para promedios
    days_count_query = db.session.query(func.count(CloserDailyReport.id))

    query = db.session.query(
        # Generales
        func.sum(CloserDailyReport.slots).label('slots'),
        func.sum(CloserDailyReport.offers_made).label('offers_made'),
        # Primera llamada
        func.sum(CloserDailyReport.first_call_scheduled).label('fc_scheduled'),
        func.sum(CloserDailyReport.first_call_attended).label('fc_attended'),
        func.sum(CloserDailyReport.first_call_no_show).label('fc_no_show'),
        func.sum(CloserDailyReport.first_call_rescheduled).label('fc_rescheduled'),
        func.sum(CloserDailyReport.first_call_canceled).label('fc_canceled'),
        # Segunda llamada
        func.sum(CloserDailyReport.second_call_scheduled).label('sc_scheduled'),
        func.sum(CloserDailyReport.second_call_attended).label('sc_attended'),
        func.sum(CloserDailyReport.second_call_no_show).label('sc_no_show'),
        func.sum(CloserDailyReport.second_call_rescheduled).label('sc_rescheduled'),
        func.sum(CloserDailyReport.second_call_canceled).label('sc_canceled'),
        # Ventas PIF
        func.sum(CloserDailyReport.pif_count).label('pif_count'),
        func.sum(CloserDailyReport.pif_cash_collected).label('pif_cash'),
        func.sum(CloserDailyReport.pif_in_call_count).label('pif_ic_count'),
        func.sum(CloserDailyReport.pif_in_call_cash).label('pif_ic_cash'),
        # Ventas Split
        func.sum(CloserDailyReport.split_count).label('split_count'),
        func.sum(CloserDailyReport.split_cash_collected).label('split_cash'),
        func.sum(CloserDailyReport.split_in_call_count).label('split_ic_count'),
        func.sum(CloserDailyReport.split_in_call_cash).label('split_ic_cash'),
        # Ventas Señas
        func.sum(CloserDailyReport.deposit_count).label('deposit_count'),
        func.sum(CloserDailyReport.deposit_cash_collected).label('deposit_cash'),
        func.sum(CloserDailyReport.deposit_in_call_count).label('deposit_ic_count'),
        func.sum(CloserDailyReport.deposit_in_call_cash).label('deposit_ic_cash'),
        # Seguimientos
        func.sum(CloserDailyReport.follow_ups_sent).label('fu_sent'),
        func.sum(CloserDailyReport.follow_ups_replied).label('fu_replied'),
        func.sum(CloserDailyReport.follow_ups_hot_sent).label('fu_hot_sent'),
        func.sum(CloserDailyReport.follow_ups_hot_replied).label('fu_hot_replied'),
        func.sum(CloserDailyReport.follow_ups_cold_sent).label('fu_cold_sent'),
        func.sum(CloserDailyReport.follow_ups_cold_replied).label('fu_cold_replied')
    )

    filters = []
    if start_date_str:
        filters.append(CloserDailyReport.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        filters.append(CloserDailyReport.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
    if closer_id:
        filters.append(CloserDailyReport.closer_id == closer_id)

    for f in filters:
        query = query.filter(f)
        days_count_query = days_count_query.filter(f)

    stats = query.one()
    days_count = days_count_query.scalar() or 1

    def val(v):
        n = float(v or 0)
        if agg_type == 'avg':
            return round(n / days_count, 2)
        return n

    def div(n, d):
        return round((n / d) * 100, 1) if d and d > 0 else 0

    # Totales
    total_scheduled = val(stats.fc_scheduled) + val(stats.sc_scheduled)
    total_attended = val(stats.fc_attended) + val(stats.sc_attended)
    total_no_show = val(stats.fc_no_show) + val(stats.sc_no_show)
    total_rescheduled = val(stats.fc_rescheduled) + val(stats.sc_rescheduled)
    total_canceled = val(stats.fc_canceled) + val(stats.sc_canceled)

    total_sales = val(stats.pif_count) + val(stats.split_count) + val(stats.deposit_count)
    total_cash = val(stats.pif_cash) + val(stats.split_cash) + val(stats.deposit_cash)
    total_ic_sales = val(stats.pif_ic_count) + val(stats.split_ic_count) + val(stats.deposit_ic_count)
    total_ic_cash = val(stats.pif_ic_cash) + val(stats.split_ic_cash) + val(stats.deposit_ic_cash)

    res = {
        "metadata": {
            "days_analyzed": days_count,
            "agg_type": agg_type
        },
        "general": {
            "slots": val(stats.slots),
            "offers_made": val(stats.offers_made),
        },
        "agendas": {
            "first_call": {
                "scheduled": val(stats.fc_scheduled),
                "attended": val(stats.fc_attended),
                "no_show": val(stats.fc_no_show),
                "rescheduled": val(stats.fc_rescheduled),
                "canceled": val(stats.fc_canceled),
            },
            "second_call": {
                "scheduled": val(stats.sc_scheduled),
                "attended": val(stats.sc_attended),
                "no_show": val(stats.sc_no_show),
                "rescheduled": val(stats.sc_rescheduled),
                "canceled": val(stats.sc_canceled),
            },
            "totals": {
                "scheduled": total_scheduled,
                "attended": total_attended,
                "no_show": total_no_show,
                "rescheduled": total_rescheduled,
                "canceled": total_canceled,
            }
        },
        "sales": {
            "pif": {
                "count": val(stats.pif_count),
                "cash": val(stats.pif_cash),
                "in_call_count": val(stats.pif_ic_count),
                "in_call_cash": val(stats.pif_ic_cash),
            },
            "split": {
                "count": val(stats.split_count),
                "cash": val(stats.split_cash),
                "in_call_count": val(stats.split_ic_count),
                "in_call_cash": val(stats.split_ic_cash),
            },
            "deposit": {
                "count": val(stats.deposit_count),
                "cash": val(stats.deposit_cash),
                "in_call_count": val(stats.deposit_ic_count),
                "in_call_cash": val(stats.deposit_ic_cash),
            },
            "totals": {
                "count": total_sales,
                "cash": total_cash,
                "in_call_count": total_ic_sales,
                "in_call_cash": total_ic_cash,
            }
        },
        "follow_ups": {
            "sent": val(stats.fu_sent),
            "replied": val(stats.fu_replied),
            "hot_sent": val(stats.fu_hot_sent),
            "hot_replied": val(stats.fu_hot_replied),
            "cold_sent": val(stats.fu_cold_sent),
            "cold_replied": val(stats.fu_cold_replied)
        },
        "percentages": {
            "show_rate": div(total_attended, total_scheduled),
            "no_show_rate": div(total_no_show, total_scheduled),
            "cancel_rate": div(total_canceled, total_scheduled),
            "close_rate": div(total_sales, total_attended) if total_attended else 0,
            "offer_to_sale": div(total_sales, float(stats.offers_made or 0)),
            "respond_rate": div(val(stats.fu_replied), val(stats.fu_sent))
        }
    }

    return jsonify(res), 200

@bp.route('/public/closer-reports', methods=['GET'])
def get_public_closer_reports():
    """Retorna lista paginada de reportes de closers con filtros."""
    from app.models import CloserDailyReport, User
    
    closer_id = request.args.get('closer_id')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    
    query = CloserDailyReport.query
    
    if closer_id:
        query = query.filter(CloserDailyReport.closer_id == closer_id)
    if start_date_str:
        query = query.filter(CloserDailyReport.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(CloserDailyReport.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
        
    pagination = query.order_by(CloserDailyReport.date.desc()).paginate(page=page, per_page=per_page)
    
    reports = []
    for r in pagination.items:
        reports.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "closer_id": r.closer_id,
            "closer_name": r.closer.username if r.closer else "Unknown",
            "slots": r.slots,
            "offers_made": r.offers_made,
            "first_call_scheduled": r.first_call_scheduled,
            "first_call_attended": r.first_call_attended,
            "first_call_no_show": r.first_call_no_show,
            "first_call_rescheduled": r.first_call_rescheduled,
            "first_call_canceled": r.first_call_canceled,
            "second_call_scheduled": r.second_call_scheduled,
            "second_call_attended": r.second_call_attended,
            "second_call_no_show": r.second_call_no_show,
            "second_call_rescheduled": r.second_call_rescheduled,
            "second_call_canceled": r.second_call_canceled,
            "pif_count": r.pif_count,
            "pif_cash_collected": r.pif_cash_collected,
            "pif_in_call_count": r.pif_in_call_count,
            "pif_in_call_cash": r.pif_in_call_cash,
            "split_count": r.split_count,
            "split_cash_collected": r.split_cash_collected,
            "split_in_call_count": r.split_in_call_count,
            "split_in_call_cash": r.split_in_call_cash,
            "deposit_count": r.deposit_count,
            "deposit_cash_collected": r.deposit_cash_collected,
            "deposit_in_call_count": r.deposit_in_call_count,
            "deposit_in_call_cash": r.deposit_in_call_cash,
            "follow_ups_sent": r.follow_ups_sent,
            "follow_ups_replied": r.follow_ups_replied,
            "follow_ups_hot_sent": r.follow_ups_hot_sent,
            "follow_ups_hot_replied": r.follow_ups_hot_replied,
            "follow_ups_cold_sent": r.follow_ups_cold_sent,
            "follow_ups_cold_replied": r.follow_ups_cold_replied
        })
        
    return jsonify({
        "reports": reports,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    }), 200

@bp.route('/public/closer-reports/<int:report_id>', methods=['PUT'])
def update_public_closer_report(report_id):
    """Actualiza un reporte existente."""
    from app.models import CloserDailyReport
    
    stat = CloserDailyReport.query.get_or_404(report_id)
    data = request.get_json() or {}
    
    def get_int(key, current):
        val = data.get(key)
        if val is None or val == '': return current
        try: return int(val)
        except (ValueError, TypeError): return current

    def get_float(key, current):
        val = data.get(key)
        if val is None or val == '': return current
        try: return float(val)
        except (ValueError, TypeError): return current
    
    try:
        stat.slots = get_int('slots', stat.slots)
        stat.offers_made = get_int('offers_made', stat.offers_made)
        
        stat.first_call_scheduled = get_int('first_call_scheduled', stat.first_call_scheduled)
        stat.first_call_attended = get_int('first_call_attended', stat.first_call_attended)
        stat.first_call_no_show = get_int('first_call_no_show', stat.first_call_no_show)
        stat.first_call_rescheduled = get_int('first_call_rescheduled', stat.first_call_rescheduled)
        stat.first_call_canceled = get_int('first_call_canceled', stat.first_call_canceled)
        
        stat.second_call_scheduled = get_int('second_call_scheduled', stat.second_call_scheduled)
        stat.second_call_attended = get_int('second_call_attended', stat.second_call_attended)
        stat.second_call_no_show = get_int('second_call_no_show', stat.second_call_no_show)
        stat.second_call_rescheduled = get_int('second_call_rescheduled', stat.second_call_rescheduled)
        stat.second_call_canceled = get_int('second_call_canceled', stat.second_call_canceled)
        
        stat.pif_count = get_int('pif_count', stat.pif_count)
        stat.pif_cash_collected = get_float('pif_cash_collected', stat.pif_cash_collected)
        stat.pif_in_call_count = get_int('pif_in_call_count', stat.pif_in_call_count)
        stat.pif_in_call_cash = get_float('pif_in_call_cash', stat.pif_in_call_cash)
        
        stat.split_count = get_int('split_count', stat.split_count)
        stat.split_cash_collected = get_float('split_cash_collected', stat.split_cash_collected)
        stat.split_in_call_count = get_int('split_in_call_count', stat.split_in_call_count)
        stat.split_in_call_cash = get_float('split_in_call_cash', stat.split_in_call_cash)
        
        stat.deposit_count = get_int('deposit_count', stat.deposit_count)
        stat.deposit_cash_collected = get_float('deposit_cash_collected', stat.deposit_cash_collected)
        stat.deposit_in_call_count = get_int('deposit_in_call_count', stat.deposit_in_call_count)
        stat.deposit_in_call_cash = get_float('deposit_in_call_cash', stat.deposit_in_call_cash)
        
        stat.follow_ups_sent = get_int('follow_ups_sent', stat.follow_ups_sent)
        stat.follow_ups_replied = get_int('follow_ups_replied', stat.follow_ups_replied)

        stat.follow_ups_hot_sent = get_int('follow_ups_hot_sent', stat.follow_ups_hot_sent)
        stat.follow_ups_hot_replied = get_int('follow_ups_hot_replied', stat.follow_ups_hot_replied)
        stat.follow_ups_cold_sent = get_int('follow_ups_cold_sent', stat.follow_ups_cold_sent)
        stat.follow_ups_cold_replied = get_int('follow_ups_cold_replied', stat.follow_ups_cold_replied)
        
        db.session.commit()
        return jsonify({"message": "Reporte actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@bp.route('/public/closer-reports/<int:report_id>', methods=['DELETE'])
def delete_public_closer_report(report_id):
    """Elimina un reporte."""
    from app.models import CloserDailyReport
    stat = CloserDailyReport.query.get_or_404(report_id)
    try:
        db.session.delete(stat)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
