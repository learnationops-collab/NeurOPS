from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from app.closer import bp
from app.models import Availability, Appointment, User, LeadProfile, db
from app.closer.forms import AppointmentForm
from app.closer.utils import send_calendar_webhook
from datetime import datetime, time, timedelta, date
import pytz
from functools import wraps

def closer_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if current_user.role not in ['closer', 'admin']: 
            flash('No tienes permiso para acceder a esta página.')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

@bp.route('/calendar', methods=['GET'])
@closer_required
def calendar():
    week_offset = request.args.get('offset', 0, type=int)
    today = date.today()
    start_of_period = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset * 2)
    match_dates = [start_of_period + timedelta(days=i) for i in range(14)]
    
    availabilities = Availability.query.filter(
        Availability.closer_id == current_user.id,
        Availability.date >= start_of_period,
        Availability.date <= match_dates[-1]
    ).all()
    
    appointments = Appointment.query.filter(
        Appointment.closer_id == current_user.id,
        Appointment.start_time >= datetime.combine(start_of_period, time.min),
        Appointment.start_time <= datetime.combine(match_dates[-1], time.max),
        Appointment.status != 'canceled'
    ).all()
    
    import pytz
    return render_template('closer/calendar.html', 
                           week_dates=match_dates, 
                           week_offset=week_offset,
                           availabilities=availabilities,
                           appointments=appointments,
                           today=today,
                           now=datetime.now(),
                           pytz=pytz)

@bp.route('/calendar/update', methods=['POST'])
@closer_required
def update_availability():
    data = request.json
    slots = data.get('slots', [])
    
    if not slots and not data.get('week_start'):
        return jsonify({'status': 'error', 'msg': 'No data'}), 400

    week_start_str = data.get('week_start')
    week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
    week_end = week_start + timedelta(days=13)
    
    try:
        Availability.query.filter(
            Availability.closer_id == current_user.id,
            Availability.date >= week_start,
            Availability.date <= week_end
        ).delete()
        
        for slot in slots:
            slot_date = datetime.strptime(slot['date'], '%Y-%m-%d').date()
            start_t = datetime.strptime(slot['hour'].strip(), '%H:%M').time()
            end_t = (datetime.combine(date.min, start_t) + timedelta(hours=1)).time()
            
            new_slot = Availability(
                closer_id=current_user.id,
                date=slot_date,
                start_time=start_t,
                end_time=end_t
            )
            db.session.add(new_slot)
            
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'msg': str(e)}), 500
            
    return jsonify({'status': 'success', 'count': len(slots)})

@bp.route('/appointment/add', methods=['GET', 'POST'])
@closer_required
def create_appointment():
    form = AppointmentForm()
    # Filter leads by assignment if closer
    leads_query = User.query.filter_by(role='lead')
    if current_user.role != 'admin':
        leads_query = leads_query.join(LeadProfile).filter(LeadProfile.assigned_closer_id == current_user.id)
    leads = leads_query.order_by(User.username).all()
    form.lead_id.choices = [(l.id, f"{l.username} ({l.email})") for l in leads]
    
    lead_id = request.args.get('lead_id', type=int)
    if lead_id and not form.lead_id.data:
        form.lead_id.data = lead_id

    if form.validate_on_submit():
        tz_name = current_user.timezone or 'America/La_Paz'
        try:
            user_tz = pytz.timezone(tz_name)
        except:
            user_tz = pytz.timezone('America/La_Paz')
            
        local_dt = user_tz.localize(datetime.combine(form.date.data, form.time.data))
        start_utc = local_dt.astimezone(pytz.UTC).replace(tzinfo=None)
        
        appt = Appointment(
            closer_id=current_user.id,
            lead_id=form.lead_id.data,
            start_time=start_utc,
            status='scheduled',
            appointment_type=form.appointment_type.data
        )
        db.session.add(appt)
        db.session.commit()
        
        if appt.lead:
            appt.lead.update_status_based_on_debt()
        
        send_calendar_webhook(appt, 'created')
        
        flash('Cita agendada exitosamente.')
        return redirect(url_for('closer.dashboard'))
        
    return render_template('closer/appointment_form.html', form=form, title="Nueva Cita")

@bp.route('/appointment/edit/<int:id>', methods=['GET', 'POST'])
@closer_required
def edit_appointment(id):
    appt = Appointment.query.get_or_404(id)
    if appt.closer_id != current_user.id and current_user.role != 'admin':
         flash('No tienes permiso.')
         return redirect(url_for('closer.dashboard'))
         
    form = AppointmentForm()
    # Filter leads by assignment if closer
    leads_query = User.query.filter_by(role='lead')
    if current_user.role != 'admin':
        leads_query = leads_query.join(LeadProfile).filter(LeadProfile.assigned_closer_id == current_user.id)
    leads = leads_query.order_by(User.username).all()
    form.lead_id.choices = [(l.id, f"{l.username} ({l.email})") for l in leads]
    
    if request.method == 'GET':
        form.lead_id.data = appt.lead_id
        # Convert UTC to Closer Time for display
        # Default to UTC if no timezone, but ideal display requires conversion
        # We'll just display object date/time, assuming form logic or js handles it?
        # Form logic in legacy: form.date.data = appt.start_time.date()
        # This displays UTC date/time. Logic suggests localizing it but legacy didn't explicit conversion in GET?
        # Actually legacy: form.date.data = appt.start_time.date()
        # We should improve this by converting to local first.
        tz_name = current_user.timezone or 'America/La_Paz'
        try:
            user_tz = pytz.timezone(tz_name)
            local_dt = pytz.utc.localize(appt.start_time).astimezone(user_tz)
            form.date.data = local_dt.date()
            form.time.data = local_dt.time()
        except:
            form.date.data = appt.start_time.date()
            form.time.data = appt.start_time.time()
            
        form.appointment_type.data = appt.appointment_type or 'Primera agenda'
        
    if form.validate_on_submit():
        tz_name = current_user.timezone or 'America/La_Paz'
        try:
            user_tz = pytz.timezone(tz_name)
        except:
            user_tz = pytz.timezone('America/La_Paz')
            
        local_dt = user_tz.localize(datetime.combine(form.date.data, form.time.data))
        start_utc = local_dt.astimezone(pytz.UTC).replace(tzinfo=None)
        
        old_start_time = appt.start_time if appt.start_time != start_utc else None
        
        if old_start_time:
             # Create new appointment for the reschedule
             new_appt = Appointment(
                 closer_id=current_user.id,
                 lead_id=form.lead_id.data,
                 start_time=start_utc,
                 status='scheduled',
                 appointment_type=form.appointment_type.data,
                 google_event_id=appt.google_event_id, # Transfer GCal ID
                 rescheduled_from_id=appt.id,
                 is_reschedule=True
             )
             
             # Archive old appointment
             appt.status = 'rescheduled'
             appt.google_event_id = None # Release GCal ID
             
             db.session.add(new_appt)
             db.session.commit()
             
             # Sync GCal (Updates event because new_appt has the same google_event_id)
             send_calendar_webhook(new_appt, 'rescheduled', old_start_time=old_start_time)
             
             flash('Cita reagendada (Se ha creado una nueva cita).')
        else:
            # Just updating details, no time change
            appt.lead_id = form.lead_id.data
            appt.appointment_type = form.appointment_type.data
            
            if appt.status == 'canceled':
                appt.status = 'scheduled'
                
            db.session.commit()
            flash('Detalles de la cita actualizados.')
            
        return redirect(url_for('closer.dashboard'))
        
    return render_template('closer/appointment_form.html', form=form, title="Editar Cita")

@bp.route('/appointment/<int:id>/status/<status>')
@closer_required
def update_appt_status(id, status):
    appt = Appointment.query.get_or_404(id)
    if appt.closer_id != current_user.id and current_user.role != 'admin':
        flash('No tienes permiso para modificar esta cita.')
        return redirect(url_for('closer.dashboard'))
        
    valid_statuses = ['scheduled', 'completed', 'canceled', 'no_show', 'confirmed']
    if status not in valid_statuses:
        flash('Estado inválido.')
        return redirect(url_for('closer.dashboard'))
        
    appt.status = status
    
    # Advanced Metrics: Capture Presentation
    if status == 'completed':
        presentation = request.args.get('presentation') == 'true'
        appt.presentation_done = presentation
        
    db.session.commit()
    
    if appt.lead:
        appt.lead.update_status_based_on_debt()
    
    msg_map = {
        'completed': 'Cita marcada como Realizada.',
        'canceled': 'Cita cancelada.',
        'no_show': 'Cita marcada como No Show.',
        'confirmed': 'Cita confirmada exitosamente.'
    }
    
    send_calendar_webhook(appt, 'canceled' if status == 'canceled' else 'status_changed')

    flash(msg_map.get(status, 'Estado actualizado.'))
    return redirect(request.referrer or url_for('closer.agendas'))
