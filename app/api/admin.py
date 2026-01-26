from flask import request, jsonify
from flask_login import login_required, current_user
from app.api import bp
from app.services.user_service import UserService
from app.services.financial_service import FinancialService
from app.services.dashboard_service import DashboardService
from app.services.admin_ops_service import AdminOperationService
from app.services.import_service import ImportService
from app.decorators import admin_required
import pandas as pd
import io
import json
from app.models import Program, db, User, Client, Expense, RecurringExpense, Payment, Enrollment, PaymentMethod, Event, DailyReportQuestion, Appointment, Integration
from datetime import datetime, date, timedelta
from sqlalchemy import or_

@bp.route('/admin/dashboard', methods=['GET'])
@login_required
@admin_required
def get_dashboard():
    period = request.args.get('period', 'this_month')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    data = DashboardService.get_main_dashboard_data(period=period, start_date_arg=start_date, end_date_arg=end_date)
    if 'dates' in data:
        data['dates']['start'] = data['dates']['start'].isoformat()
        data['dates']['end'] = data['dates']['end'].isoformat()
    if 'recent_activity' in data:
        for activity in data['recent_activity']:
            if 'time' in activity: activity['time'] = activity['time'].isoformat()
    if 'cohort' in data and 'top_debtors' in data['cohort']:
        for debtor in data['cohort']['top_debtors']:
            client = debtor['student']
            debtor['student'] = {"id": client.id, "full_name": client.full_name, "email": client.email}
    return jsonify(data), 200

@bp.route('/admin/users', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_users():
    if request.method == 'POST':
        data = request.get_json() or {}
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'closer')
        
        if not username or not password:
            return jsonify({"message": "Username and password required"}), 400
            
        if User.query.filter((User.username == username) | (User.email == email)).first():
             return jsonify({"message": "User already exists"}), 409
             
        user = User(username=username, email=email, role=role)
        user.set_password(password)
        if 'timezone' in data: user.timezone = data['timezone']
        
        db.session.add(user)
        db.session.commit()
        return jsonify({"message": "User created", "id": user.id}), 201

    role_filter = request.args.getlist('role') or ['admin', 'closer']
    users = UserService.get_users_by_role(role_filter)
    user_list = [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "timezone": u.timezone, "is_active": True} for u in users]
    return jsonify(user_list), 200

@bp.route('/admin/users/<int:id>', methods=['PUT', 'DELETE'])
@login_required
@admin_required
def user_operations(id):
    user = User.query.get_or_404(id)
    
    if request.method == 'DELETE':
        if user.id == current_user.id:
            return jsonify({"message": "Cannot delete yourself"}), 400
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted"}), 200
        
    if request.method == 'PUT':
        data = request.get_json() or {}
        username = data.get('username')
        email = data.get('email')
        
        # Check conflicts
        existing = User.query.filter(
            ((User.username == username) | (User.email == email)) & (User.id != id)
        ).first()
        if existing:
            return jsonify({"message": "Username or Email already taken"}), 409
            
        user.username = username or user.username
        user.email = email or user.email
        user.role = data.get('role', user.role)
        if 'timezone' in data: user.timezone = data['timezone']
        
        if data.get('password'):
            user.set_password(data['password'])
            
        db.session.commit()
        return jsonify({"message": "User updated"}), 200

@bp.route('/admin/leads/search', methods=['GET'])
@login_required
@admin_required
def search_leads():
    query_str = request.args.get('q', '')
    if len(query_str) < 2: return jsonify([]), 200
    term = f"%{query_str}%"
    leads = Client.query.filter(or_(Client.full_name.ilike(term), Client.email.ilike(term))).limit(10).all()
    return jsonify([{"id": l.id, "username": l.full_name or l.email, "email": l.email} for l in leads]), 200

@bp.route('/admin/leads', methods=['GET'])
@login_required
@admin_required
def get_leads():
    filters = {
        'search': request.args.get('search', ''),
        'program': request.args.get('program'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'sort_by': request.args.get('sort_by', 'newest'),
        'closer_id': request.args.get('closer_id')
    }
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    pagination = UserService.get_leads_list(filters, page, per_page)
    leads = pagination.items
    lead_list = [{
        "id": l.id,
        "username": l.full_name or l.email,
        "email": l.email,
        "phone": l.phone,
        "instagram": l.instagram,
        "created_at": l.created_at.isoformat() if l.created_at else None
    } for l in leads]
    kpis = UserService.get_leads_kpis(filters)
    return jsonify({"leads": lead_list, "total": pagination.total, "pages": pagination.pages, "current_page": pagination.page, "kpis": kpis}), 200

@bp.route('/admin/leads/<int:id>', methods=['GET'])
@login_required
@admin_required
def get_lead_profile(id):
    client = Client.query.get_or_404(id)
    profile_data = {
        "id": client.id,
        "username": client.full_name or client.email,
        "email": client.email,
        "profile": {
            "phone": client.phone,
            "instagram": client.instagram
        },
        "enrollments": [{"id": e.id, "program": e.program.name, "date": e.enrollment_date.isoformat(), "closer": e.closer_rel.username if e.closer_rel else None} for e in client.enrollments],
        "appointments": [{"id": a.id, "start_time": a.start_time.isoformat(), "status": a.status, "closer": a.closer.username if a.closer else None, "origin": a.origin} for a in client.appointments]
    }
    return jsonify(profile_data), 200

# --- Admin Database CRUD (Master Access) ---

@bp.route('/admin/db/payment-methods', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_payment_methods():
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            m = PaymentMethod.query.get_or_404(id)
            m.name, m.commission_percent, m.commission_fixed, m.is_active = data.get('name', m.name), data.get('fee_percent', m.commission_percent), data.get('fee_fixed', m.commission_fixed), data.get('is_active', m.is_active)
        else:
            m = PaymentMethod(name=data.get('name'), commission_percent=data.get('fee_percent', 0.0), commission_fixed=data.get('fee_fixed', 0.0))
            db.session.add(m)
        db.session.commit()
        return jsonify({"message": "Metodo guardado"}), 200
    return jsonify([{"id": m.id, "name": m.name, "fee_percent": m.commission_percent, "fee_fixed": m.commission_fixed, "is_active": m.is_active} for m in PaymentMethod.query.all()]), 200

@bp.route('/admin/db/programs', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_programs():
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            p = Program.query.get_or_404(id)
            p.name, p.price, p.is_active = data.get('name', p.name), data.get('price', p.price), data.get('is_active', p.is_active)
        else:
            p = Program(name=data.get('name'), price=data.get('price'))
            db.session.add(p)
        db.session.commit()
        return jsonify({"message": "Programa guardado"}), 200
    return jsonify([{"id": p.id, "name": p.name, "price": p.price, "is_active": p.is_active} for p in Program.query.all()]), 200

@bp.route('/admin/db/leads_raw', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_db_leads():
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            c = Client.query.get_or_404(id)
            c.full_name, c.email, c.phone, c.instagram = data.get('full_name', c.full_name), data.get('email', c.email), data.get('phone', c.phone), data.get('instagram', c.instagram)
        else:
            c = Client(full_name=data.get('full_name'), email=data.get('email'), phone=data.get('phone'), instagram=data.get('instagram'))
            db.session.add(c)
        db.session.commit()
        return jsonify({"message": "Lead guardado"}), 200
    
    page = request.args.get('page', 1, type=int)
    search = request.args.get('search', '')
    query = Client.query
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Client.full_name.ilike(term), Client.email.ilike(term)))
    pagination = query.order_by(Client.created_at.desc()).paginate(page=page, per_page=50, error_out=False)
    return jsonify({"total": pagination.total, "pages": pagination.pages, "data": [{"id": c.id, "full_name": c.full_name, "email": c.email, "phone": c.phone, "instagram": c.instagram, "created_at": c.created_at.isoformat()} for c in pagination.items]}), 200

@bp.route('/admin/db/agendas', methods=['GET', 'POST', 'DELETE'])
@login_required
@admin_required
def manage_db_agendas():
    if request.method == 'DELETE':
        id = request.args.get('id')
        a = Appointment.query.get_or_404(id)
        db.session.delete(a)
        db.session.commit()
        return jsonify({"message": "Agenda eliminada"}), 200
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            a = Appointment.query.get_or_404(id)
            if 'status' in data: a.status = data['status']
            if 'origin' in data: a.origin = data['origin']
            if 'start_time' in data: a.start_time = datetime.fromisoformat(data['start_time'].replace('Z', ''))
        db.session.commit()
        return jsonify({"message": "Agenda actualizada"}), 200
    
    page = request.args.get('page', 1, type=int)
    search = request.args.get('search', '')
    query = Appointment.query.join(Client)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Client.full_name.ilike(term), Client.email.ilike(term)))
    pagination = query.order_by(Appointment.start_time.desc()).paginate(page=page, per_page=50, error_out=False)
    return jsonify({"total": pagination.total, "pages": pagination.pages, "data": [{"id": a.id, "lead": a.client.full_name or a.client.email, "closer": a.closer.username, "start_time": a.start_time.isoformat(), "status": a.status, "origin": a.origin} for a in pagination.items]}), 200

@bp.route('/admin/db/sales_raw', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_db_sales():
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            p = Payment.query.get_or_404(id)
            if 'amount' in data: p.amount = float(data['amount'])
            if 'payment_type' in data: p.payment_type = data['payment_type']
            if 'date' in data: p.date = datetime.fromisoformat(data['date'].replace('Z', ''))
        db.session.commit()
        return jsonify({"message": "Registro de venta actualizado"}), 200
        
    page = request.args.get('page', 1, type=int)
    search = request.args.get('search', '')
    query = Payment.query.join(Enrollment).join(Client)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Client.full_name.ilike(term), Client.email.ilike(term)))
    pagination = query.order_by(Payment.date.desc()).paginate(page=page, per_page=50, error_out=False)
    return jsonify({"total": pagination.total, "pages": pagination.pages, "data": [{
        "id": p.id, "date": p.date.isoformat(), 
        "student": p.enrollment.client.full_name or p.enrollment.client.email,
        "program": p.enrollment.program.name,
        "amount": float(p.amount), "payment_type": p.payment_type, "method": p.method.name if p.method else "N/A"
    } for p in pagination.items]}), 200

@bp.route('/admin/db/questions', methods=['GET', 'POST'])
@bp.route('/admin/db/questions/<int:id>', methods=['DELETE'])
@login_required
@admin_required
def manage_questions(id=None):
    if request.method == 'DELETE':
        q = DailyReportQuestion.query.get_or_404(id)
        db.session.delete(q)
        db.session.commit()
        return jsonify({"message": "Pregunta eliminada"}), 200
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            q = DailyReportQuestion.query.get_or_404(id)
            q.text, q.question_type, q.is_active, q.order = data.get('text', q.text), data.get('type', q.question_type), data.get('is_active', q.is_active), data.get('order', q.order)
        else:
            q = DailyReportQuestion(text=data.get('text'), question_type=data.get('type', 'text'), order=data.get('order', 0))
            db.session.add(q)
        db.session.commit()
        return jsonify({"message": "Pregunta guardada"}), 200
    return jsonify([{"id": q.id, "text": q.text, "type": q.question_type, "order": q.order, "is_active": q.is_active} for q in DailyReportQuestion.query.order_by(DailyReportQuestion.order).all()]), 200

# --- Admin Operations ---

@bp.route('/admin/ops/clear', methods=['POST'])
@login_required
@admin_required
def clear_db():
    success, message = AdminOperationService.clear_business_data()
    return jsonify({"message": message}), 200 if success else 400

@bp.route('/admin/ops/generate', methods=['POST'])
@login_required
@admin_required
def generate_mock_data():
    data = request.get_json() or {}
    success, message = AdminOperationService.generate_mock_data(
        client_count=data.get('leads', 20),
        appt_count=data.get('agendas', 15),
        sale_count=data.get('sales', 5)
    )
    return jsonify({"message": message}), 200 if success else 400
@bp.route('/admin/integrations', methods=['GET', 'POST', 'DELETE'])
@login_required
@admin_required
def manage_integrations():
    if request.method == 'DELETE':
        id = request.args.get('id')
        i = Integration.query.get_or_404(id)
        db.session.delete(i)
        db.session.commit()
        return jsonify({"message": "Integración eliminada"}), 200

    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
             i = Integration.query.get_or_404(id)
             i.key = data.get('key', i.key)
             i.name = data.get('name', i.name)
             i.url_dev = data.get('url_dev', i.url_dev)
             i.url_prod = data.get('url_prod', i.url_prod)
             i.active_env = data.get('active_env', i.active_env)
             i.payload_config = data.get('payload_config', i.payload_config)
        else:
            # Check for unique key
            if Integration.query.filter_by(key=data.get('key')).first():
                 return jsonify({"error": "Integration key already exists"}), 400
            
            i = Integration(
                key=data.get('key'),
                name=data.get('name'),
                url_dev=data.get('url_dev'),
                url_prod=data.get('url_prod'),
                active_env=data.get('active_env', 'dev'),
                payload_config=data.get('payload_config', {})
            )
            db.session.add(i)
        
        db.session.commit()
        return jsonify({"message": "Integración guardada"}), 200
        
    return jsonify([{
        "id": i.id, "key": i.key, "name": i.name, 
        "url_dev": i.url_dev, "url_prod": i.url_prod, "active_env": i.active_env,
        "payload_config": i.payload_config
    } for i in Integration.query.all()]), 200

# --- Admin Funnel Management ---

@bp.route('/admin/funnels/groups', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_event_groups():
    from app.models import EventGroup
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            g = EventGroup.query.get_or_404(id)
            g.name = data.get('name', g.name)
        else:
            g = EventGroup(name=data.get('name'))
            db.session.add(g)
        db.session.commit()
        return jsonify({"message": "Grupo guardado"}), 200
        
    return jsonify([{"id": g.id, "name": g.name} for g in EventGroup.query.all()]), 200

@bp.route('/admin/funnels/events', methods=['GET', 'POST', 'PUT', 'DELETE'])
@login_required
@admin_required
def manage_events():
    from app.models import Event, EventGroup
    
    if request.method in ['POST', 'PUT']:
        data = request.get_json() or {}
        id = data.get('id')
        
        if id: # Update
            e = Event.query.get_or_404(id)
            if 'name' in data: e.name = data['name']
            if 'utm_source' in data: e.utm_source = data['utm_source']
            if 'duration_minutes' in data: e.duration_minutes = data['duration_minutes']
            if 'buffer_minutes' in data: e.buffer_minutes = data['buffer_minutes']
            if 'group_id' in data: e.group_id = data['group_id']
            if 'min_score' in data: e.min_score = data['min_score']
            if 'is_active' in data: e.is_active = data['is_active']
            if 'redirect_url_success' in data: e.redirect_url_success = data['redirect_url_success']
            if 'redirect_url_fail' in data: e.redirect_url_fail = data['redirect_url_fail']
        else: # Create
            e = Event(
                name=data.get('name'),
                utm_source=data.get('utm_source'),
                group_id=data.get('group_id'),
                duration_minutes=data.get('duration_minutes', 30),
                buffer_minutes=data.get('buffer_minutes', 15),
                min_score=data.get('min_score', 0),
                redirect_url_success=data.get('redirect_url_success'),
                redirect_url_fail=data.get('redirect_url_fail')
            )
            db.session.add(e)
            
        try:
            db.session.commit()
            return jsonify({"message": "Evento guardado"}), 200
        except Exception as err:
            db.session.rollback()
            return jsonify({"error": str(err)}), 400

    if request.method == 'DELETE':
        id = request.args.get('id')
        e = Event.query.get_or_404(id)
        db.session.delete(e) # Questions cascade? No, need manual delete or set null.
        # Ideally SurveyQuestion should cascade delete if event is deleted, let's assume manual for now or db constraint.
        db.session.commit()
        return jsonify({"message": "Evento eliminado"}), 200
        
    # GET list
    events = Event.query.all()
    return jsonify([{
        "id": e.id,
        "name": e.name, 
        "utm_source": e.utm_source,
        "is_active": e.is_active,
        "group_id": e.group_id,
        "group_name": e.group.name if e.group else None,
        "duration_minutes": e.duration_minutes,
        "min_score": e.min_score,
        "redirect_url_success": e.redirect_url_success,
        "redirect_url_fail": e.redirect_url_fail
    } for e in events]), 200

@bp.route('/admin/funnels/events/<int:event_id>/questions', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_event_questions(event_id):
    from app.models import SurveyQuestion
    
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        
        if id:
            q = SurveyQuestion.query.get_or_404(id)
            if q.event_id != event_id: return jsonify({"error": "Pregunta no pertenece al evento"}), 400
            q.text = data.get('text', q.text)
            q.question_type = data.get('type', q.question_type)
            q.order = data.get('order', q.order)
            q.options = data.get('options', q.options) # Store as string or handle JSON
            q.step = data.get('step', q.step)
            q.is_active = data.get('is_active', q.is_active)
        else:
            q = SurveyQuestion(
                event_id=event_id,
                text=data.get('text'),
                question_type=data.get('type', 'text'),
                order=data.get('order', 0),
                options=data.get('options'),
                step=data.get('step', 'first_survey')
            )
            db.session.add(q)
        
        db.session.commit()
        return jsonify({"message": "Pregunta guardada"}), 200
        
    questions = SurveyQuestion.query.filter_by(event_id=event_id).order_by(SurveyQuestion.step, SurveyQuestion.order).all()
    return jsonify([{
        "id": q.id,
        "text": q.text,
        "type": q.question_type,
        "order": q.order,
        "step": q.step,
        "options": q.options,
        "is_active": q.is_active,
        "event_id": q.event_id,
        "group_id": q.group_id,
        "is_global": q.is_global
    } for q in questions]), 200

@bp.route('/admin/funnels/questions/global', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_global_questions():
    from app.models import SurveyQuestion
    
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            q = SurveyQuestion.query.get_or_404(id)
            q.text = data.get('text', q.text)
            q.question_type = data.get('type', 'select')
            q.options = data.get('options') # Already JSON string or text
            q.order = data.get('order', q.order)
            q.is_active = data.get('is_active', q.is_active)
        else:
            q = SurveyQuestion(
                text=data.get('text'),
                is_global=True,
                question_type=data.get('type', 'select'),
                options=data.get('options'),
                order=data.get('order', 0)
            )
            db.session.add(q)
        db.session.commit()
        return jsonify({"message": "Pregunta global guardada"}), 200

    questions = SurveyQuestion.query.filter_by(is_global=True).order_by(SurveyQuestion.order).all()
    return jsonify([{
        "id": q.id, "text": q.text, "type": q.question_type, 
        "options": q.options, "order": q.order, "is_active": q.is_active
    } for q in questions]), 200

@bp.route('/admin/funnels/groups/<int:group_id>/questions', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_group_questions(group_id):
    from app.models import SurveyQuestion
    
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            q = SurveyQuestion.query.get_or_404(id)
            q.text = data.get('text', q.text)
            q.options = data.get('options')
            q.order = data.get('order', q.order)
            q.is_active = data.get('is_active', q.is_active)
        else:
            q = SurveyQuestion(
                text=data.get('text'),
                group_id=group_id,
                question_type=data.get('type', 'select'),
                options=data.get('options'),
                order=data.get('order', 0)
            )
            db.session.add(q)
        db.session.commit()
        return jsonify({"message": "Pregunta de grupo guardada"}), 200

    questions = SurveyQuestion.query.filter_by(group_id=group_id).order_by(SurveyQuestion.order).all()
    return jsonify([{
        "id": q.id, "text": q.text, "type": q.question_type, 
        "options": q.options, "order": q.order, "is_active": q.is_active
    } for q in questions]), 200

@bp.route('/admin/funnels/questions/<int:id>', methods=['DELETE'])
@login_required
@admin_required
def delete_event_question(id):
    from app.models import SurveyQuestion
    q = SurveyQuestion.query.get_or_404(id)
    db.session.delete(q)
    db.session.commit()
    return jsonify({"message": "Pregunta eliminada"}), 200

# --- Advanced Import Tools ---

@bp.route('/admin/import/config', methods=['GET'])
@login_required
@admin_required
def get_import_config():
    return jsonify(ImportService.get_config()), 200

@bp.route('/admin/import/validate', methods=['POST'])
@login_required
@admin_required
def validate_import():
    file = request.files.get('file')
    target = request.form.get('target')
    mapping = json.loads(request.form.get('mapping', '{}'))
    
    if not file or not target:
        return jsonify({"message": "Faltan datos"}), 400
        
    df = pd.read_csv(io.StringIO(file.read().decode('utf-8')))
    report = ImportService.validate(df, target, mapping)
    return jsonify(report), 200

@bp.route('/admin/import/execute', methods=['POST'])
@login_required
@admin_required
def execute_import():
    file = request.files.get('file')
    target = request.form.get('target')
    mapping = json.loads(request.form.get('mapping', '{}'))
    options = json.loads(request.form.get('options', '{}'))
    
    if not file or not target:
        return jsonify({"message": "Faltan datos"}), 400
        
    df = pd.read_csv(io.StringIO(file.read().decode('utf-8')))
    result = ImportService.execute(df, target, mapping, options)
    return jsonify(result), 200
