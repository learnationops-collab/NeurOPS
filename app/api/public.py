from flask import Blueprint, request, jsonify
from app import db
from app.models import User, Availability, Appointment, Client, Event, SurveyAnswer, SurveyQuestion, WeeklyAvailability
from datetime import datetime, date, time, timedelta

bp = Blueprint('public', __name__)

@bp.route('/public/funnel/@<username>/<event_slug>', methods=['GET'])
def get_funnel_info(username, event_slug):
    user = User.query.filter_by(username=username).first()
    if not user: return jsonify({"error": "Closer not found"}), 404
        
    event = Event.query.filter_by(utm_source=event_slug, is_active=True).first()
    if not event: return jsonify({"error": "Event not found or inactive"}), 404
    
    questions = SurveyQuestion.query.filter(
        (SurveyQuestion.is_active == True)
    ).order_by(SurveyQuestion.order).all()
    
    duration = event.duration_minutes or 30
    buffer = event.buffer_minutes or 0
    total_slot_time = duration + buffer
    today = date.today()
    end_date = today + timedelta(days=21)
    
    def merge_ranges(ranges):
        if not ranges: return []
        sorted_ranges = sorted(ranges)
        merged = []
        curr_start, curr_end = sorted_ranges[0]
        for next_start, next_end in sorted_ranges[1:]:
            if next_start == curr_end: curr_end = next_end
            else:
                merged.append((curr_start, curr_end))
                curr_start, curr_end = next_start, next_end
        merged.append((curr_start, curr_end))
        return merged

    weekly = WeeklyAvailability.query.filter_by(closer_id=user.id, is_active=True).all()
    weekly_map = {}
    for wa in weekly:
        if wa.day_of_week not in weekly_map: weekly_map[wa.day_of_week] = []
        weekly_map[wa.day_of_week].append((wa.start_time, wa.end_time))
    for d in weekly_map: weekly_map[d] = merge_ranges(weekly_map[d])
        
    overrides = Availability.query.filter(Availability.closer_id == user.id, Availability.date >= today, Availability.date <= end_date).all()
    overrides_map = {}
    for o in overrides:
        if o.date not in overrides_map: overrides_map[o.date] = []
        overrides_map[o.date].append((o.start_time, o.end_time))
    for d in overrides_map: overrides_map[d] = merge_ranges(overrides_map[d])
        
    appts = Appointment.query.filter(Appointment.closer_id == user.id, Appointment.start_time >= datetime.combine(today, time.min), Appointment.status != 'canceled').all()
    booked_ranges = []
    for a in appts:
        # Since we decoupled, we assume standard 30min or pass manually
        a_dur = 30 
        booked_ranges.append((a.start_time, a.start_time + timedelta(minutes=a_dur)))
    
    available_slots = []
    curr_date = today
    while curr_date <= end_date:
        day_ranges = overrides_map.get(curr_date, weekly_map.get(curr_date.weekday(), []))
        for start_t, end_t in day_ranges:
            slot_start = datetime.combine(curr_date, start_t)
            day_end = datetime.combine(curr_date, end_t)
            if curr_date == today:
                now_plus_2h = datetime.now() + timedelta(hours=2)
                if slot_start < now_plus_2h: slot_start = now_plus_2h
            
            while slot_start + timedelta(minutes=duration) <= day_end:
                slot_end = slot_start + timedelta(minutes=duration)
                if not any(max(slot_start, b_start) < min(slot_end, b_end) for b_start, b_end in booked_ranges):
                    available_slots.append({"date": curr_date.isoformat(), "start_time": slot_start.strftime("%H:%M"), "end_time": slot_end.strftime("%H:%M"), "timestamp": slot_start.isoformat()})
                slot_start += timedelta(minutes=total_slot_time)
        curr_date += timedelta(days=1)

    return jsonify({
        "closer_name": user.username,
        "event": {"id": event.id, "name": event.name, "utm_source": event.utm_source, "duration": duration},
        "questions": [{"id": q.id, "text": q.text, "type": q.question_type, "options": q.options, "mapping_field": q.mapping_field} for q in questions],
        "availability": available_slots
    })

@bp.route('/public/book/@<username>', methods=['POST'])
def book_appointment(username):
    user = User.query.filter_by(username=username).first()
    if not user: return jsonify({"error": "Closer not found"}), 404
        
    data = request.get_json() or {}
    name, email, phone = data.get('name'), data.get('email'), data.get('phone')
    timestamp_str, event_source = data.get('timestamp'), data.get('utm_source', 'direct')
    survey_answers = data.get('survey_answers', {})
    
    if not all([name, email, phone, timestamp_str]):
        return jsonify({"error": "Missing required fields"}), 400
        
    try: slot_dt = datetime.fromisoformat(timestamp_str)
    except: return jsonify({"error": "Invalid timestamp"}), 400
    
    if Appointment.query.filter_by(closer_id=user.id, start_time=slot_dt).filter(Appointment.status != 'canceled').first():
        return jsonify({"error": "Horario ya reservado"}), 400
        
    client = Client.query.filter_by(email=email).first()
    if not client:
        client = Client(email=email, full_name=name, phone=phone)
        db.session.add(client)
    else:
        client.full_name, client.phone = name, phone
    
    db.session.flush()

    appointment = Appointment(closer_id=user.id, client_id=client.id, start_time=slot_dt, status='scheduled', origin=event_source)
    db.session.add(appointment)
    db.session.flush()

    for q_id, val in survey_answers.items():
        db.session.add(SurveyAnswer(client_id=client.id, question_id=int(q_id), answer=str(val), appointment_id=appointment.id))
    
    try:
        db.session.commit()
        return jsonify({"message": "Success", "appointment_id": appointment.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
