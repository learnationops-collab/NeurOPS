from flask import render_template, redirect, url_for, flash, request, jsonify
from app.admin import bp
from app.decorators import admin_required, role_required
from app.services.user_service import UserService
from app.admin.forms import UserForm, ManualAddForm, ClientEditForm
from app.models import User, LeadProfile, Program, UserViewSetting, Enrollment, Appointment, db
from flask_login import current_user, login_required
import pytz

@bp.route('/users')
@admin_required
def users_list():
    users = UserService.get_users_by_role(['admin', 'closer'])
    return render_template('admin/users_list.html', users=users)

@bp.route('/users/create', methods=['GET', 'POST'])
@admin_required
def create_user():
    form = UserForm()
    form.timezone.choices = [(tz, tz) for tz in pytz.common_timezones]
    
    if request.method == 'GET' and not form.timezone.data:
         form.timezone.data = 'America/La_Paz'

    if form.validate_on_submit():
        data = {
            'username': form.username.data,
            'email': form.email.data,
            'role': form.role.data,
            'timezone': form.timezone.data,
            'password': form.password.data
        }
        res, code = UserService.create_user(data)
        if res['success']:
            flash(res['message'])
            return redirect(url_for('admin.users_list'))
        flash(res['message'])
        
    return render_template('admin/user_form.html', form=form, title='Nuevo Usuario')

@bp.route('/users/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_user(id):
    if current_user.role != 'admin':
        flash('Acceso denegado.')
        return redirect(url_for('admin.dashboard'))
        
    user = User.query.get_or_404(id)
    form = UserForm(obj=user)
    form.timezone.choices = [(tz, tz) for tz in pytz.common_timezones]
    
    if request.method == 'GET' and not form.timezone.data:
         form.timezone.data = user.timezone or 'America/La_Paz'

    if form.validate_on_submit():
        data = {
            'username': form.username.data,
            'email': form.email.data,
            'role': form.role.data,
            'timezone': form.timezone.data,
            'password': form.password.data
        }
        res, code = UserService.update_user(id, data)
        if res['success']:
            flash(res['message'])
            return redirect(url_for('admin.users_list'))
        flash(res['message'])
        
    return render_template('admin/user_form.html', form=form, title='Editar Usuario')

@bp.route('/users/delete/<int:id>')
@admin_required
def delete_user(id):
    res, code = UserService.delete_user(id, current_user.id)
    if res['success']:
        flash(res['message'])
        if res['data']['role'] in ['lead', 'student']:
            return redirect(url_for('admin.leads_list'))
        return redirect(url_for('admin.users_list'))
    
    flash(res['message'])
    return redirect(url_for('admin.users_list'))

@bp.route('/leads')
@admin_required
def leads_list():
    # --- Persistence Logic (Keep local as it depends on flask request/session heavily) ---
    view_name = 'leads_list'
    relevant_keys = ['search', 'program', 'status', 'start_date', 'end_date', 'sort_by']
    
    if request.args.get('clear'):
        setting = UserViewSetting.query.filter_by(user_id=current_user.id, view_name=view_name).first()
        if setting:
             db.session.delete(setting)
             db.session.commit()
        return redirect(url_for('admin.leads_list'))
        
    has_args = any(key in request.args for key in relevant_keys)
    is_paginating = request.args.get('page') or request.args.get('load_more') or request.args.get('ajax')

    if has_args:
        # Save current state
        new_settings = {k: request.args.get(k) for k in relevant_keys if request.args.get(k) is not None}
        setting = UserViewSetting.query.filter_by(user_id=current_user.id, view_name=view_name).first()
        if not setting:
            setting = UserViewSetting(user_id=current_user.id, view_name=view_name)
            db.session.add(setting)
        if setting.settings != new_settings:
            setting.settings = new_settings
            db.session.commit()
    elif not is_paginating:
        # Load from DB
        setting = UserViewSetting.query.filter_by(user_id=current_user.id, view_name=view_name).first()
        if setting and setting.settings:
             return redirect(url_for('admin.leads_list', **setting.settings))

    # --- Filters ---
    filters = {
        'search': request.args.get('search', ''),
        'program': request.args.get('program'),
        'status': request.args.get('status'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'sort_by': request.args.get('sort_by', 'newest')
    }

    page = request.args.get('page', 1, type=int)
    pagination = UserService.get_leads_list(filters, page, 50)
    leads = pagination.items
    
    # KPIs
    kpis = UserService.get_leads_kpis(filters)
    
    # Context
    all_programs = Program.query.order_by(Program.name).all()
    all_statuses = db.session.query(LeadProfile.status).distinct().filter(LeadProfile.status != None).all()
    all_statuses = [s[0] for s in all_statuses]
    closers = User.query.filter_by(role='closer').all()
    
    if request.args.get('ajax'):
        start_index = (page -1) * 50
        return jsonify({
            'html': render_template('admin/partials/leads_rows.html', leads=leads, start_index=start_index),
            'kpis': kpis,
            'has_next': pagination.has_next
        })
        
    if request.args.get('load_more'):
         start_index = (page -1) * 50
         return render_template('admin/partials/leads_rows.html', leads=leads, start_index=start_index)

    return render_template('admin/leads_list.html', 
                           title='Gestión de Clientes', 
                           leads=leads, 
                           pagination=pagination, 
                           search=filters['search'], 
                           start_date=filters['start_date'], 
                           end_date=filters['end_date'],
                           program_filter=filters['program'],
                           status_filter=filters['status'],
                           sort_by=filters['sort_by'],
                           kpis=kpis,
                           start_index=0,
                           all_programs=all_programs,
                           all_statuses=all_statuses,
                           closers=closers)

@bp.route('/users/add-manual', methods=['GET', 'POST'])
@admin_required
def add_manual_user():
    form = ManualAddForm()
    if form.validate_on_submit():
        status = 'new'
        if form.role.data == 'student': status = 'completed'
        
        data = {
            'username': form.username.data,
            'email': form.email.data,
            'role': form.role.data,
            'phone': form.phone.data,
            'instagram': form.instagram.data,
            'status': status,
            'utm_source': 'manual'
        }
        res, code = UserService.create_user(data)
        if res['success']:
            flash(res['message'])
            return redirect(url_for('admin.leads_list'))
        flash(res['message'])
            
    return render_template('admin/add_manual_user.html', form=form, title='Agregar Nuevo Cliente')

@bp.route('/leads/profile/<int:id>')
@admin_required
def lead_profile(id):
    user = User.query.get_or_404(id)
    if user.role not in ['lead', 'student', 'agenda']:
        flash('Perfil no disponible para este rol.')
        return redirect(url_for('admin.leads_list'))
    
    # We can add this get logic to service if needed, but simple fetches are fine here
    enrollments = user.enrollments.order_by(Enrollment.enrollment_date.desc()).all()
    appointments = user.appointments_as_lead.order_by(Appointment.start_time.desc()).all()
    
    return render_template('admin/lead_profile.html', user=user, enrollments=enrollments, appointments=appointments)

@bp.route('/leads/update/<int:id>', methods=['POST'])
@admin_required
def update_lead_quick(id):
    data = {}
    if request.form.get('role'): data['role'] = request.form.get('role')
    if request.form.get('status'): data['status'] = request.form.get('status')
    
    res, code = UserService.update_user(id, data)
    flash(res['message'])
    return redirect(url_for('admin.leads_list'))

@bp.route('/leads/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_client(id):
    user = User.query.get_or_404(id)
    form = ClientEditForm()
    
    if request.method == 'GET':
        form.username.data = user.username
        form.email.data = user.email
        form.role.data = user.role
        if user.lead_profile:
            form.phone.data = user.lead_profile.phone
            form.instagram.data = user.lead_profile.instagram
            form.status.data = user.lead_profile.status
    
    if form.validate_on_submit():
        data = {
            'username': form.username.data,
            'email': form.email.data,
            'role': form.role.data,
            'phone': form.phone.data,
            'instagram': form.instagram.data,
            'status': form.status.data
        }
        res, code = UserService.update_user(id, data)
        if res['success']:
            flash(res['message'])
            return redirect(url_for('admin.edit_client', id=user.id))
        flash(res['message'])

    enrollments = user.enrollments.all()
    return render_template('admin/client_edit.html', form=form, user=user)

@bp.route('/enrollment/delete/<int:id>')
@admin_required
def delete_enrollment(id):
    enrollment = Enrollment.query.get_or_404(id)
    user_id = enrollment.student_id
    
    db.session.delete(enrollment)
    db.session.commit()
    
    # Update status if needed
    user = User.query.get(user_id)
    # Check if any active enrollments remain, else set to new/pending?
    # For now, minimal implementation as per request to fix the error.
    
    flash('Inscripción eliminada.')
    return redirect(url_for('admin.lead_profile', id=user_id))

@bp.route('/users/bulk_delete', methods=['POST'])
@admin_required
def bulk_delete_users():
    user_ids = request.form.getlist('user_ids')
    
    if not user_ids:
        flash('No se seleccionaron usuarios.')
        return redirect(url_for('admin.leads_list'))
        
    count = 0
    for uid in user_ids:
        if str(uid) == str(current_user.id):
            continue # Don't delete yourself
            
        res, code = UserService.delete_user(uid, current_user.id)
        if res['success']:
            count += 1
            
    flash(f'{count} usuarios eliminados correctamente.')
    return redirect(url_for('admin.leads_list'))

@bp.route('/users/bulk_assign', methods=['POST'])
@admin_required
def bulk_assign_closer():
    closer_id = request.form.get('closer_id')
    user_ids = request.form.getlist('user_ids')
    
    if not closer_id or not user_ids:
        flash('Seleccione un Closer y al menos un cliente.')
        return redirect(url_for('admin.leads_list'))
        
    closer = User.query.get(closer_id)
    if not closer or closer.role != 'closer':
        flash('Closer inválido.')
        return redirect(url_for('admin.leads_list'))
        
    count = 0
    for uid in user_ids:
        user = User.query.get(uid)
        if user:
            if not user.lead_profile:
                profile = LeadProfile(user_id=user.id)
                db.session.add(profile)
            user.lead_profile.assigned_closer_id = closer.id
            count += 1
            
    db.session.commit()
    flash(f'{count} clientes asignados a {closer.username}.')
    return redirect(url_for('admin.leads_list'))

