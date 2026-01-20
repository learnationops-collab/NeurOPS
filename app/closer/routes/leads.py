from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from app.closer import bp
from app.services.closer_service import CloserService
from app.models import User, LeadProfile, Program, Event, SurveyAnswer, SurveyQuestion, Appointment, Enrollment, db
from app.closer.forms import LeadForm
import uuid
from sqlalchemy import or_

# Re-using the local closer_required or importing it if moved. 
# For now, repeating local definition or assuming shared availability.
# To be robust, let's redefine it here as well or move it to a util later.
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

@bp.route('/leads')
@closer_required
def leads_list():
    filters = {
        'search': request.args.get('search', ''),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'program': request.args.get('program'),
        'status': request.args.get('status'),
        'sort_by': request.args.get('sort_by', 'newest')
    }
    
    page = request.args.get('page', 1, type=int)
    
    pagination = CloserService.get_leads_pagination(current_user.id, page, 50, filters)
    leads = pagination.items
    kpis = CloserService.get_leads_kpis(current_user.id, filters)
    
    all_programs = Program.query.order_by(Program.name).all()
    all_statuses = db.session.query(LeadProfile.status).distinct().filter(LeadProfile.status != None).all()
    all_statuses = [s[0] for s in all_statuses]
    
    is_load_more = request.args.get('load_more')
    start_index = (page - 1) * 50
    
    if is_load_more:
        # Assuming partial template exists or creating it? 
        # Plan mentions moving routes, not templates.
        # But legacy used 'closer/partials/leads_rows.html'.
        # We should ensure that file exists or create it.
        return render_template('closer/partials/leads_rows.html', leads=leads, start_index=start_index)

    return render_template('closer/leads_list.html', 
                           leads=leads, 
                           pagination=pagination,
                           kpis=kpis,
                           search=filters['search'],
                           start_date=filters['start_date'],
                           end_date=filters['end_date'],
                           program_filter=filters['program'],
                           status_filter=filters['status'],
                           sort_by=filters['sort_by'],
                           all_programs=all_programs,
                           all_statuses=all_statuses,
                           start_index=start_index)

@bp.route('/lead/<int:id>')
@closer_required
def lead_detail(id):
    lead = User.query.get_or_404(id)
    # Validate access? 
    # Closer service fetch allows seeing anyone? 
    # Usually restricted to leads/students.
    if lead.role not in ['lead', 'student']:
        flash('Usuario no es un lead válido.')
        return redirect(url_for('closer.leads_list'))
        
    profile = lead.lead_profile
    
    # Funnel Steps
    funnel_steps = ['contact', 'calendar', 'survey']
    if profile.utm_source:
        event = Event.query.filter_by(utm_source=profile.utm_source).first()
        if event:
             if event.funnel_steps: funnel_steps = event.funnel_steps
             elif event.group and event.group.funnel_steps: funnel_steps = event.group.funnel_steps
             
    # Answers
    answers_query = SurveyAnswer.query.join(SurveyQuestion).filter(SurveyAnswer.lead_id == lead.id).order_by(SurveyQuestion.order).all()
    landing_answers = [a for a in answers_query if a.question.step == 'landing']
    survey_answers = [a for a in answers_query if a.question.step == 'survey']
    
    appointments = Appointment.query.filter_by(lead_id=lead.id).order_by(Appointment.start_time.desc()).all()
    
    return render_template('closer/lead_detail.html', lead=lead, profile=profile, landing_answers=landing_answers, survey_answers=survey_answers, appointments=appointments, funnel_steps=funnel_steps)

@bp.route('/leads/add', methods=['GET', 'POST'])
@closer_required
def add_lead():
    form = LeadForm()
    if form.validate_on_submit():
        if User.query.filter_by(email=form.email.data).first():
            flash('Este email ya está registrado.')
            return render_template('closer/lead_form.html', form=form, title="Nuevo Lead")
            
        temp_pass = str(uuid.uuid4())
        user = User(username=form.username.data, email=form.email.data, role='lead')
        user.set_password(temp_pass)
        db.session.add(user)
        db.session.flush()
        
        profile = LeadProfile(
            user_id=user.id,
            phone=form.phone.data,
            instagram=form.instagram.data,
            utm_source='closer_added',
            assigned_closer_id=current_user.id # Assign to creator
        )
        db.session.add(profile)
        db.session.commit()
        
        flash('Lead creado exitosamente.')
        return redirect(url_for('closer.leads_list'))
        
    return render_template('closer/lead_form.html', form=form, title="Nuevo Lead")

@bp.route('/leads/edit/<int:id>', methods=['GET', 'POST'])
@closer_required
def edit_lead(id):
    user = User.query.get_or_404(id)
    if user.role != 'lead' and current_user.role != 'admin':
         # Allow only leads or own students?
         pass 
         
    form = LeadForm(obj=user)
    
    if request.method == 'GET' and user.lead_profile:
        form.phone.data = user.lead_profile.phone
        form.instagram.data = user.lead_profile.instagram
        
    if form.validate_on_submit():
        user.username = form.username.data
        user.email = form.email.data 
        
        if not user.lead_profile:
             profile = LeadProfile(user_id=user.id)
             db.session.add(profile)
             
        user.lead_profile.phone = form.phone.data
        user.lead_profile.instagram = form.instagram.data
        
        db.session.commit()
        flash('Lead actualizado.')
        return redirect(url_for('closer.lead_detail', id=user.id))
        
    return render_template('closer/lead_form.html', form=form, title="Editar Lead")

@bp.route('/leads/delete/<int:id>')
@closer_required
def delete_lead(id):
    user = User.query.get_or_404(id)
    if user.role == 'admin':
        flash('No puedes eliminar administradores.')
        return redirect(url_for('closer.leads_list'))
        
    db.session.delete(user)
    db.session.commit()
    flash('Lead eliminado.')
    return redirect(url_for('closer.leads_list'))

@bp.route('/leads/update/<int:id>', methods=['POST'])
@closer_required
def update_lead_quick(id):
    user = User.query.get_or_404(id)
    if user.role not in ['lead', 'student']:
        flash('No puedes modificar este usuario.')
        return redirect(url_for('closer.leads_list'))

    new_role = request.form.get('role')
    if new_role in ['lead', 'student']:
        user.role = new_role
        
    new_status = request.form.get('status')
    if new_status:
        if not user.lead_profile:
            profile = LeadProfile(user_id=user.id)
            db.session.add(profile)
        user.lead_profile.status = new_status
        
    db.session.commit()
    flash('Cliente actualizado.')
    return redirect(url_for('closer.leads_list'))

@bp.route('/search_leads')
@closer_required
def search_leads():
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify({'results': []})
        
    search = f"%{query}%"
    leads = User.query.outerjoin(LeadProfile, User.id == LeadProfile.user_id).filter(
        User.role == 'lead',
        or_(
            User.username.ilike(search),
            User.email.ilike(search),
            LeadProfile.phone.ilike(search),
            LeadProfile.instagram.ilike(search)
        )
    ).limit(10).all()
    
    results = []
    for lead in leads:
        info = f"{lead.username} ({lead.email})"
        if lead.lead_profile:
            if lead.lead_profile.phone:
                info += f" - Tel: {lead.lead_profile.phone}"
            if lead.lead_profile.instagram:
                info += f" - IG: {lead.lead_profile.instagram}"
                
        results.append({
            'id': lead.id,
            'text': info
        })
        
    return jsonify({'results': results})
