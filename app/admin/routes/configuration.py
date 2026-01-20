from flask import render_template, redirect, url_for, flash, request, jsonify
from app.admin import bp
from app.decorators import admin_required
from app.admin.forms import SurveyQuestionForm, EventForm, ProgramForm, EventGroupForm
from app.models import SurveyQuestion, Event, Program, EventGroup, db, PaymentMethod, DailyReportQuestion
from sqlalchemy import or_

# --- Survey Management Routes ---

@bp.route('/survey', methods=['GET', 'POST'])
@admin_required
def survey_mgmt():
    form = SurveyQuestionForm()
    
    # Populate Choices (Global, Groups, Events)
    events = Event.query.all()
    groups = EventGroup.query.all()
    
    choices = [('global_0', 'Global (Todos los eventos)')]
    choices += [(f'group_{g.id}', f'Grupo: {g.name}') for g in groups]
    choices += [(f'event_{e.id}', f'Evento: {e.name}') for e in events]
    form.target.choices = choices

    if form.validate_on_submit():
        target = form.target.data
        t_type, t_id = target.split('_')
        t_id = int(t_id)
        
        evt_id = None
        grp_id = None
        
        if t_type == 'event':
            evt_id = t_id
        elif t_type == 'group':
            grp_id = t_id
            
        q = SurveyQuestion(
            text=form.text.data,
            question_type=form.question_type.data,
            options=form.options.data,
            order=0, # Default order, managed by builder
            is_active=form.is_active.data,
            step=form.step.data,
            mapping_field=form.mapping_field.data if form.step.data == 'landing' else None,
            event_id=evt_id,
            event_group_id=grp_id
        )
        db.session.add(q)
        db.session.commit()
        flash('Pregunta añadida exitosamente.')
        return redirect(url_for('admin.survey_mgmt'))
        
    # Filter Logic
    selected_target = request.args.get('target')
    selected_step = request.args.get('step', 'all')
    
    query = SurveyQuestion.query
    
    if selected_target:
        t_type, t_id = selected_target.split('_')
        t_id = int(t_id)
        if t_type == 'global':
             query = query.filter(SurveyQuestion.event_id == None, SurveyQuestion.event_group_id == None)
        elif t_type == 'group':
             query = query.filter(SurveyQuestion.event_group_id == t_id)
        elif t_type == 'event':
             query = query.filter(SurveyQuestion.event_id == t_id)

    if selected_step != 'all':
        query = query.filter(SurveyQuestion.step == selected_step)

    all_questions = query.order_by(SurveyQuestion.order).all()
    
    landing_questions = [q for q in all_questions if q.step == 'landing']
    survey_questions = [q for q in all_questions if q.step == 'survey']
    
    return render_template('admin/survey_mgmt.html', form=form, landing_questions=landing_questions, survey_questions=survey_questions, title="Nueva Pregunta", choices=choices, selected_target=selected_target)

@bp.route('/survey/funnel', methods=['GET'])
@admin_required
def funnel_builder():
    target = request.args.get('target', 'global')
    
    funnel_steps = ['contact', 'calendar', 'survey'] # Default
    
    if target.startswith('event_'):
        evt_id = int(target.split('_')[1])
        event = Event.query.get_or_404(evt_id)
        if event.funnel_steps: funnel_steps = event.funnel_steps
        
        query = SurveyQuestion.query.filter_by(is_active=True)
        conditions = [SurveyQuestion.event_id == evt_id]
        if event.group_id:
             conditions.append(SurveyQuestion.event_group_id == event.group_id)
        global_condition = (SurveyQuestion.event_id == None) & (SurveyQuestion.event_group_id == None)
        conditions.append(global_condition)
        query = query.filter(or_(*conditions))
        
    elif target.startswith('group_'):
        grp_id = int(target.split('_')[1])
        group = EventGroup.query.get_or_404(grp_id)
        if group.funnel_steps: funnel_steps = group.funnel_steps
        
        query = SurveyQuestion.query.filter_by(is_active=True)
        conditions = [SurveyQuestion.event_group_id == grp_id]
        global_condition = (SurveyQuestion.event_id == None) & (SurveyQuestion.event_group_id == None)
        conditions.append(global_condition)
        query = query.filter(or_(*conditions))
        
    else:
        target = 'global'
        query = SurveyQuestion.query.filter_by(is_active=True)
        query = query.filter((SurveyQuestion.event_id == None) & (SurveyQuestion.event_group_id == None))

    all_questions = query.order_by(SurveyQuestion.step, SurveyQuestion.order).all()
    
    questions_landing = [q for q in all_questions if q.step == 'landing']
    questions_survey = [q for q in all_questions if q.step == 'survey']

    events = Event.query.all()
    groups = EventGroup.query.all()

    return render_template('admin/funnel_builder.html', 
                           funnel_steps=funnel_steps,
                           questions_landing=questions_landing,
                           questions_survey=questions_survey,
                           selected_target=target,
                           events=events,
                           groups=groups)

@bp.route('/survey/funnel/save', methods=['POST'])
@admin_required
def save_funnel_state():
    data = request.json
    target = data.get('target')
    new_steps = data.get('funnel_steps')
    questions_data = data.get('questions') # List of {id, step, order}
    
    if not new_steps or not questions_data:
        return jsonify({'status': 'error', 'message': 'Datos incompletos'}), 400
        
    if target.startswith('event_'):
        evt_id = int(target.split('_')[1])
        event = Event.query.get(evt_id)
        if event: event.funnel_steps = new_steps
    elif target.startswith('group_'):
        grp_id = int(target.split('_')[1])
        group = EventGroup.query.get(grp_id)
        if group: group.funnel_steps = new_steps
    
    for q_item in questions_data:
        q = SurveyQuestion.query.get(q_item['id'])
        if q:
            q.step = q_item['step']
            q.order = q_item['order']
    
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/survey/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_question(id):
    q = SurveyQuestion.query.get_or_404(id)
    form = SurveyQuestionForm(obj=q)
    
    events = Event.query.all()
    groups = EventGroup.query.all()
    
    choices = [('global_0', 'Global (Todos los eventos)')]
    choices += [(f'group_{g.id}', f'Grupo: {g.name}') for g in groups]
    choices += [(f'event_{e.id}', f'Evento: {e.name}') for e in events]
    form.target.choices = choices
    
    if request.method == 'GET':
        if q.event_id:
            form.target.data = f'event_{q.event_id}'
        elif q.event_group_id:
            form.target.data = f'group_{q.event_group_id}'
        else:
            form.target.data = 'global_0'
    
    if form.validate_on_submit():
        q.text = form.text.data
        q.question_type = form.question_type.data
        q.options = form.options.data
        q.is_active = form.is_active.data
        q.step = form.step.data
        q.mapping_field = form.mapping_field.data if form.step.data == 'landing' else None
        
        t_val = form.target.data
        t_type, t_id = t_val.split('_')
        t_id = int(t_id)
        
        q.event_id = None
        q.event_group_id = None
        
        if t_type == 'event':
            q.event_id = t_id
        elif t_type == 'group':
            q.event_group_id = t_id
        
        db.session.commit()
        flash('Pregunta actualizada.')
        return redirect(url_for('admin.survey_mgmt'))
        
    questions = SurveyQuestion.query.order_by(SurveyQuestion.order).all()
    return render_template('admin/survey_mgmt.html', form=form, questions=questions, title="Editar Pregunta", editing_id=q.id, choices=choices)

@bp.route('/survey/delete/<int:id>')
@admin_required
def delete_question(id):
    q = SurveyQuestion.query.get_or_404(id)
    db.session.delete(q)
    db.session.commit()
    flash('Pregunta eliminada.')
    return redirect(url_for('admin.survey_mgmt'))

# --- Event Management Routes ---

@bp.route('/events/groups', methods=['GET', 'POST'])
@admin_required
def event_groups():
    form = EventGroupForm()
    if form.validate_on_submit():
        group = EventGroup(name=form.name.data)
        db.session.add(group)
        db.session.commit()
        flash('Grupo de eventos creado exitosamente.')
        return redirect(url_for('admin.event_groups'))
    
    groups = EventGroup.query.all()
    return render_template('admin/event_groups_list.html', form=form, groups=groups, title="Grupos de Eventos")

@bp.route('/events/groups/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_event_group(id):
    group = EventGroup.query.get_or_404(id)
    form = EventGroupForm(obj=group)
    if form.validate_on_submit():
        group.name = form.name.data
        db.session.commit()
        flash('Grupo actualizado.')
        return redirect(url_for('admin.event_groups'))
    return render_template('admin/event_group_form.html', form=form, title="Editar Grupo")

@bp.route('/events/groups/delete/<int:id>')
@admin_required
def delete_event_group(id):
    group = EventGroup.query.get_or_404(id)
    db.session.delete(group)
    db.session.commit()
    flash('Grupo eliminado.')
    return redirect(url_for('admin.event_groups'))

@bp.route('/events')
@admin_required
def events_list():
    events = Event.query.all()
    return render_template('admin/events_list.html', events=events)

@bp.route('/events/create', methods=['GET', 'POST'])
@admin_required
def create_event():
    form = EventForm()
    
    groups = EventGroup.query.all()
    form.group_id.choices = [(0, 'Ninguno')] + [(g.id, g.name) for g in groups]
    
    if form.validate_on_submit():
        grp_id = form.group_id.data
        if grp_id == 0: grp_id = None
        
        event = Event(
            name=form.name.data,
            utm_source=form.utm_source.data,
            is_active=form.is_active.data,
            group_id=grp_id
        )
        db.session.add(event)
        try:
            db.session.commit()
            flash('Evento creado exitosamente.')
            return redirect(url_for('admin.events_list'))
        except Exception:
            db.session.rollback()
            flash('Error: El nombre o UTM ya existen.')
            
    return render_template('admin/event_form.html', form=form, title="Nuevo Evento")

@bp.route('/events/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_event(id):
    event = Event.query.get_or_404(id)
    form = EventForm(obj=event)
    
    groups = EventGroup.query.all()
    form.group_id.choices = [(0, 'Ninguno')] + [(g.id, g.name) for g in groups]
    
    if request.method == 'GET':
        form.group_id.data = event.group_id if event.group_id else 0
    
    if form.validate_on_submit():
        event.name = form.name.data
        event.utm_source = form.utm_source.data
        event.is_active = form.is_active.data
        
        grp_id = form.group_id.data
        event.group_id = None if grp_id == 0 else grp_id
        
        try:
            db.session.commit()
            flash('Evento actualizado.')
            return redirect(url_for('admin.events_list'))
        except Exception:
            db.session.rollback()
            flash('Error al actualizar.')
            
    return render_template('admin/event_form.html', form=form, title="Editar Evento")

@bp.route('/events/delete/<int:id>')
@admin_required
def delete_event(id):
    event = Event.query.get_or_404(id)
    if event.appointments.count() > 0:
         flash('No se puede eliminar evento con citas asociadas.')
         return redirect(url_for('admin.events_list'))
         
    db.session.delete(event)
    db.session.commit()
    flash('Evento eliminado.')
    return redirect(url_for('admin.events_list'))

# --- Program Management Routes ---

@bp.route('/programs')
@admin_required
def programs_list():
    programs = Program.query.all()
    return render_template('admin/programs_list.html', programs=programs)

@bp.route('/programs/create', methods=['GET', 'POST'])
@admin_required
def create_program():
    form = ProgramForm()
    if form.validate_on_submit():
        program = Program(
            name=form.name.data,
            price=form.price.data
        )
        db.session.add(program)
        try:
            db.session.commit()
            flash('Programa creado exitosamente.')
            return redirect(url_for('admin.programs_list'))
        except Exception:
            db.session.rollback()
            flash('Error: El nombre del programa ya existe.')

    return render_template('admin/program_form.html', form=form, title="Nuevo Programa")

@bp.route('/programs/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_program(id):
    program = Program.query.get_or_404(id)
    form = ProgramForm(obj=program)
    
    if form.validate_on_submit():
        program.name = form.name.data
        program.price = form.price.data
        try:
            db.session.commit()
            flash('Programa actualizado.')
            return redirect(url_for('admin.programs_list'))
        except Exception:
            db.session.rollback()
            flash('Error al actualizar programa.')
            
    return render_template('admin/program_form.html', form=form, title="Editar Programa")

@bp.route('/programs/toggle/<int:id>')
@admin_required
def toggle_program_status(id):
    program = Program.query.get_or_404(id)
    program.is_active = not program.is_active
    db.session.commit()
    status = "activado" if program.is_active else "desactivado"
    flash(f'Programa {status}.')
    return redirect(url_for('admin.programs_list'))

@bp.route('/programs/delete/<int:id>')
@admin_required
def delete_program(id):
    program = Program.query.get_or_404(id)
    if program.enrollments:
        flash('No se puede eliminar programa con alumnos inscritos.')
        return redirect(url_for('admin.programs_list'))
        
    db.session.delete(program)
    db.session.commit()
    db.session.commit()
    flash('Programa eliminado.')
    return redirect(url_for('admin.programs_list'))

# --- Daily Report Config Routes ---

from app.models import DailyReportQuestion

@bp.route('/questions', methods=['GET', 'POST'])
@admin_required
def daily_report_questions():
    if request.method == 'POST':
        text = request.form.get('text')
        q_type = request.form.get('question_type', 'text')
        is_active = True if request.form.get('is_active') else False
        
        if text:
            # Auto order: last + 1
            last = DailyReportQuestion.query.order_by(DailyReportQuestion.order.desc()).first()
            order = (last.order + 1) if last else 1
            
            q = DailyReportQuestion(text=text, question_type=q_type, is_active=is_active, order=order)
            db.session.add(q)
            db.session.commit()
            flash('Pregunta creada.')
            
        return redirect(url_for('admin.daily_report_questions'))

    questions = DailyReportQuestion.query.order_by(DailyReportQuestion.order).all()
    return render_template('admin/questions_list.html', questions=questions)

@bp.route('/questions/delete/<int:id>')
@admin_required
def delete_daily_question(id):
    q = DailyReportQuestion.query.get_or_404(id)
    db.session.delete(q)
    db.session.commit()
    flash('Pregunta eliminada.')
    return redirect(url_for('admin.daily_report_questions'))

@bp.route('/questions/toggle/<int:id>')
@admin_required
def toggle_daily_question(id):
    q = DailyReportQuestion.query.get_or_404(id)
    q.is_active = not q.is_active
    db.session.commit()
    status = "activada" if q.is_active else "desactivada"
    flash(f'Pregunta {status}.')
    return redirect(url_for('admin.daily_report_questions'))

@bp.route('/questions/reorder', methods=['POST'])
@admin_required
def reorder_daily_questions():
    order_data = request.json.get('order', [])
    for idx, q_id in enumerate(order_data):
        q = DailyReportQuestion.query.get(q_id)
        if q:
            q.order = idx + 1
    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/questions/edit/<int:id>', methods=['POST'])
@admin_required
def edit_daily_question(id):
    q = DailyReportQuestion.query.get_or_404(id)
    q.text = request.form.get('text')
    q.question_type = request.form.get('type')
    db.session.commit()
    flash('Pregunta actualizada.')
    return redirect(url_for('admin.daily_report_questions'))

# --- Payment Method Management Routes ---

from app.admin.forms import PaymentMethodForm
from app.models import PaymentMethod

@bp.route('/payment-methods')
@admin_required
def payment_methods_list():
    methods = PaymentMethod.query.all()
    return render_template('admin/payment_methods_list.html', methods=methods)

@bp.route('/payment-methods/create', methods=['GET', 'POST'])
@admin_required
def create_payment_method():
    form = PaymentMethodForm()
    if form.validate_on_submit():
        pm = PaymentMethod(
            name=form.name.data,
            commission_percent=form.commission_percent.data,
            commission_fixed=form.commission_fixed.data,
            is_active=form.is_active.data
        )
        db.session.add(pm)
        try:
            db.session.commit()
            flash('Método de pago creado.')
            return redirect(url_for('admin.payment_methods_list'))
        except Exception:
            db.session.rollback()
            flash('Error al crear.')
            
    return render_template('admin/payment_method_form.html', form=form, title="Nuevo Método")

@bp.route('/payment-methods/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_payment_method(id):
    pm = PaymentMethod.query.get_or_404(id)
    form = PaymentMethodForm(obj=pm)
    
    if form.validate_on_submit():
        pm.name = form.name.data
        pm.commission_percent = form.commission_percent.data
        pm.commission_fixed = form.commission_fixed.data
        pm.is_active = form.is_active.data
        
        db.session.commit()
        flash('Método actualizado.')
        return redirect(url_for('admin.payment_methods_list'))
        
    return render_template('admin/payment_method_form.html', form=form, title="Editar Método")

@bp.route('/payment-methods/toggle/<int:id>')
@admin_required
def toggle_payment_method(id):
    pm = PaymentMethod.query.get_or_404(id)
    pm.is_active = not pm.is_active
    db.session.commit()
    status = "activado" if pm.is_active else "desactivado"
    flash(f'Método {status}.')
    return redirect(url_for('admin.payment_methods_list'))

@bp.route('/payment-methods/delete/<int:id>')
@admin_required
def delete_payment_method(id):
    pm = PaymentMethod.query.get_or_404(id)
    if pm.payments.count() > 0:
        flash('No se puede eliminar método con pagos asociados.')
        return redirect(url_for('admin.payment_methods_list'))
        
    db.session.delete(pm)
    db.session.commit()
    flash('Método eliminado.')
    return redirect(url_for('admin.payment_methods_list'))


