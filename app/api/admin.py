from flask import request, jsonify
from flask_login import login_required
from app.api import bp
from app.services.user_service import UserService
from app.services.financial_service import FinancialService
from app.services.dashboard_service import DashboardService
from app.decorators import admin_required
from app.models import Program, db, User, LeadProfile, Expense, RecurringExpense, Payment, Enrollment, PaymentMethod, Event, DailyReportQuestion
from datetime import datetime, date, timedelta
from sqlalchemy import or_

@bp.route('/admin/dashboard', methods=['GET'])
@login_required
@admin_required
def get_dashboard():
    period = request.args.get('period', 'this_month')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    data = DashboardService.get_main_dashboard_data(
        period=period, 
        start_date_arg=start_date, 
        end_date_arg=end_date
    )
    
    # Process data to be JSON serializable if needed (e.g. dates to strings)
    # The DashboardService seems to return mostly serializable data, 
    # but we should ensure dates are strings.
    
    # Basic date serialization check
    if 'dates' in data:
        data['dates']['start'] = data['dates']['start'].isoformat()
        data['dates']['end'] = data['dates']['end'].isoformat()
        
    if 'recent_activity' in data:
        for activity in data['recent_activity']:
            if 'time' in activity:
                activity['time'] = activity['time'].isoformat()
                
    if 'cohort' in data and 'top_debtors' in data['cohort']:
        for debtor in data['cohort']['top_debtors']:
            student = debtor['student']
            debtor['student'] = {
                "id": student.id,
                "username": student.username,
                "email": student.email
            }

    return jsonify(data), 200

@bp.route('/admin/users', methods=['GET'])
@login_required
@admin_required
def get_users():
    role_filter = request.args.getlist('role') or ['admin', 'closer']
    users = UserService.get_users_by_role(role_filter)
    
    user_list = []
    for u in users:
        user_list.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "timezone": u.timezone,
            "is_active": u.is_active if hasattr(u, 'is_active') else True
        })
    return jsonify(user_list), 200

@bp.route('/admin/programs', methods=['GET'])
@login_required
@admin_required
def get_programs():
    programs = Program.query.order_by(Program.name).all()
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "price": p.price,
        "is_active": p.is_active
    } for p in programs]), 200

@bp.route('/admin/payment-methods', methods=['GET'])
@login_required
@admin_required
def get_payment_methods():
    methods = PaymentMethod.query.filter_by(is_active=True).all()
    return jsonify([{
        "id": m.id,
        "name": m.name,
        "fee_percent": m.commission_percent,
        "fee_fixed": m.commission_fixed
    } for m in methods]), 200

@bp.route('/admin/leads/search', methods=['GET'])
@login_required
@admin_required
def search_leads():
    query_str = request.args.get('q', '')
    if len(query_str) < 2:
        return jsonify([]), 200
        
    term = f"%{query_str}%"
    leads = User.query.filter(
        User.role.in_(['lead', 'student', 'agenda']),
        or_(User.username.ilike(term), User.email.ilike(term))
    ).limit(10).all()
    
    return jsonify([{
        "id": l.id,
        "username": l.username,
        "email": l.email
    } for l in leads]), 200

@bp.route('/admin/leads', methods=['GET'])
@login_required
@admin_required
def get_leads():
    filters = {
        'search': request.args.get('search', ''),
        'program': request.args.get('program'),
        'status': request.args.get('status'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'sort_by': request.args.get('sort_by', 'newest'),
        'closer_id': request.args.get('closer_id')
    }
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    pagination = UserService.get_leads_list(filters, page, per_page)
    leads = pagination.items
    
    lead_list = []
    for l in leads:
        lead_list.append({
            "id": l.id,
            "username": l.username,
            "email": l.email,
            "role": l.role,
            "status": l.lead_profile.status if l.lead_profile else None,
            "phone": l.lead_profile.phone if l.lead_profile else None,
            "instagram": l.lead_profile.instagram if l.lead_profile else None,
            "assigned_closer": l.lead_profile.assigned_closer.username if l.lead_profile and l.lead_profile.assigned_closer else None,
            "created_at": l.created_at.isoformat() if hasattr(l, 'created_at') and l.created_at else None
        })
        
    kpis = UserService.get_leads_kpis(filters)
    
    return jsonify({
        "leads": lead_list,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page,
        "kpis": kpis
    }), 200

@bp.route('/admin/leads/<int:id>', methods=['GET'])
@login_required
@admin_required
def get_lead_profile(id):
    user = User.query.get_or_404(id)
    
    profile_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "profile": {
            "phone": user.lead_profile.phone if user.lead_profile else None,
            "instagram": user.lead_profile.instagram if user.lead_profile else None,
            "status": user.lead_profile.status if user.lead_profile else None,
            "is_pinned": user.lead_profile.is_pinned if user.lead_profile else False,
            "assigned_closer": {
                "id": user.lead_profile.assigned_closer_id,
                "username": user.lead_profile.assigned_closer.username
            } if user.lead_profile and user.lead_profile.assigned_closer else None
        },
        "enrollments": [{
            "id": e.id,
            "program": e.program.name,
            "status": e.status,
            "total_agreed": e.total_agreed,
            "date": e.enrollment_date.isoformat() if e.enrollment_date else None
        } for e in user.enrollments],
        "appointments": [{
            "id": a.id,
            "start_time": a.start_time.isoformat(),
            "status": a.status,
            "closer": a.closer.username if a.closer else None
        } for a in user.appointments_as_lead]
    }
    
    return jsonify(profile_data), 200

@bp.route('/admin/users', methods=['POST'])
@login_required
@admin_required
def create_admin_user():
    data = request.get_json() or {}
    res, code = UserService.create_user(data)
    return jsonify(res), code

@bp.route('/admin/users/<int:id>', methods=['PUT'])
@login_required
@admin_required
def update_admin_user(id):
    data = request.get_json() or {}
    res, code = UserService.update_user(id, data)
    return jsonify(res), code

@bp.route('/admin/users/<int:id>', methods=['DELETE'])
@login_required
@admin_required
def delete_admin_user(id):
    res, code = UserService.delete_user(id, current_user.id)
    return jsonify(res), code

@bp.route('/admin/leads/<int:id>', methods=['PATCH'])
@login_required
@admin_required
def update_lead_status(id):
    data = request.get_json() or {}
    # Extract only status/role for quick update if needed
    res, code = UserService.update_user(id, data)
    return jsonify(res), code

# --- Finance API ---

@bp.route('/admin/finance/overview', methods=['GET'])
@login_required
@admin_required
def get_finance_overview():
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    if start_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    else:
        start_date = date.today().replace(day=1)
        
    if end_date_str:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    else:
        # End of current month
        next_month = date.today().replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
        
    data = FinancialService.get_finances_data(start_date, end_date)
    
    # Serialize expenses
    expenses = []
    for e in data['expenses']:
        expenses.append({
            "id": getattr(e, 'id', None),
            "date": e.date.isoformat() if hasattr(e.date, 'isoformat') else str(e.date),
            "description": e.description,
            "category": e.category,
            "amount": float(e.amount)
        })
        
    # Serialize recurring
    recurring = []
    for r in data['recurring_expenses']:
        recurring.append({
            "id": r.id,
            "description": r.description,
            "amount": float(r.amount),
            "day_of_month": r.day_of_month,
            "is_active": r.is_active
        })
        
    return jsonify({
        "expenses": expenses,
        "recurring": recurring,
        "kpis": data['kpis']
    }), 200

@bp.route('/admin/finance/expenses', methods=['POST'])
@login_required
@admin_required
def create_expense():
    data = request.get_json() or {}
    # Convert date string to date object
    if 'date' in data:
        data['date'] = datetime.strptime(data['date'], '%Y-%m-%d').date()
    else:
        data['date'] = date.today()
        
    res, code = FinancialService.create_expense(data)
    return jsonify(res), code

@bp.route('/admin/finance/expenses/<int:id>', methods=['DELETE'])
@login_required
@admin_required
def delete_expense(id):
    res, code = FinancialService.delete_item(Expense, id, "Gasto")
    return jsonify(res), code

@bp.route('/admin/finance/sales', methods=['GET'])
@login_required
@admin_required
def get_sales():
    search = request.args.get('search', '')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    method_id = request.args.get('method_id')
    pay_type = request.args.get('type')
    
    query = Payment.query.join(Enrollment).join(User, Enrollment.student_id == User.id)
    
    if start_date_str:
        query = query.filter(Payment.date >= datetime.strptime(start_date_str, '%Y-%m-%d'))
    if end_date_str:
        query = query.filter(Payment.date < datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1))
    if search:
        term = f"%{search}%"
        query = query.filter(or_(User.username.ilike(term), User.email.ilike(term)))
    if method_id:
        query = query.filter(Payment.payment_method_id == method_id)
    if pay_type:
        query = query.filter(Payment.payment_type == pay_type)
        
    query = query.order_by(Payment.date.desc())
    
    page = request.args.get('page', 1, type=int)
    pagination = query.paginate(page=page, per_page=50, error_out=False)
    
    sales_list = []
    for p in pagination.items:
        sales_list.append({
            "id": p.id,
            "date": p.date.isoformat(),
            "student": p.enrollment.student.username if p.enrollment and p.enrollment.student else "Unknown",
            "program": p.enrollment.program.name if p.enrollment and p.enrollment.program else "Unknown",
            "amount": float(p.amount),
            "type": p.payment_type,
            "method": p.method.name if p.method else "Unknown",
            "status": p.status
        })
        
    return jsonify({
        "sales": sales_list,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    }), 200

# --- Database Management API ---

@bp.route('/admin/db/payment-methods', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_payment_methods():
    if request.method == 'POST':
        data = request.get_json() or {}
        method_id = data.get('id')
        if method_id:
            m = PaymentMethod.query.get_or_404(method_id)
            m.name = data.get('name', m.name)
            m.commission_percent = data.get('fee_percent', m.commission_percent)
            m.commission_fixed = data.get('fee_fixed', m.commission_fixed)
            m.is_active = data.get('is_active', m.is_active)
        else:
            m = PaymentMethod(
                name=data.get('name'),
                commission_percent=data.get('fee_percent', 0.0),
                commission_fixed=data.get('fee_fixed', 0.0)
            )
            db.session.add(m)
        db.session.commit()
        return jsonify({"message": "Metodo guardado"}), 200
        
    methods = PaymentMethod.query.all()
    return jsonify([{
        "id": m.id,
        "name": m.name,
        "fee_percent": m.commission_percent,
        "fee_fixed": m.commission_fixed,
        "is_active": m.is_active
    } for m in methods]), 200

@bp.route('/admin/db/programs', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_programs():
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            p = Program.query.get_or_404(id)
            p.name = data.get('name', p.name)
            p.price = data.get('price', p.price)
            p.is_active = data.get('is_active', p.is_active)
        else:
            p = Program(name=data.get('name'), price=data.get('price'))
            db.session.add(p)
        db.session.commit()
        return jsonify({"message": "Programa guardado"}), 200
        
    programs = Program.query.all()
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "price": p.price,
        "is_active": p.is_active
    } for p in programs]), 200

@bp.route('/admin/db/events', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_events():
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            e = Event.query.get_or_404(id)
            e.name = data.get('name', e.name)
            e.utm_source = data.get('utm_source', e.utm_source)
            e.is_active = data.get('is_active', e.is_active)
        else:
            e = Event(name=data.get('name'), utm_source=data.get('utm_source'))
            db.session.add(e)
        db.session.commit()
        return jsonify({"message": "Evento guardado"}), 200
        
    events = Event.query.all()
    return jsonify([{
        "id": ev.id,
        "name": ev.name,
        "utm_source": ev.utm_source,
        "is_active": ev.is_active
    } for ev in events]), 200

@bp.route('/admin/db/questions', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_questions():
    if request.method == 'POST':
        data = request.get_json() or {}
        id = data.get('id')
        if id:
            q = DailyReportQuestion.query.get_or_404(id)
            q.text = data.get('text', q.text)
            q.question_type = data.get('type', q.question_type)
            q.is_active = data.get('is_active', q.is_active)
            q.order = data.get('order', q.order)
        else:
            q = DailyReportQuestion(
                text=data.get('text'), 
                question_type=data.get('type', 'text'),
                order=data.get('order', 0)
            )
            db.session.add(q)
        db.session.commit()
        return jsonify({"message": "Pregunta guardada"}), 200
        
    questions = DailyReportQuestion.query.order_by(DailyReportQuestion.order).all()
    return jsonify([{
        "id": q.id,
        "text": q.text,
        "type": q.question_type,
        "order": q.order,
        "is_active": q.is_active
    } for q in questions]), 200

@bp.route('/admin/db/agendas', methods=['GET'])
@login_required
@admin_required
def manage_agendas():
    search = request.args.get('search', '')
    query = Appointment.query.join(User, Appointment.lead_id == User.id)
    
    if search:
        term = f"%{search}%"
        query = query.filter(or_(User.username.ilike(term), User.email.ilike(term)))
        
    query = query.order_by(Appointment.start_time.desc())
    
    page = request.args.get('page', 1, type=int)
    pagination = query.paginate(page=page, per_page=50, error_out=False)
    
    return jsonify({
        "data": [{
            "id": a.id,
            "lead": a.lead.username if a.lead else "Unknown",
            "closer": a.closer.username if a.closer else "Unknown",
            "date": a.start_time.isoformat(),
            "status": a.status,
            "type": a.appointment_type
        } for a in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages
    }), 200

@bp.route('/admin/finance/sales', methods=['POST'])
@login_required
@admin_required
def register_new_sale():
    data = request.get_json() or {}
    lead_id = data.get('lead_id')
    program_id = data.get('program_id')
    pay_type = data.get('payment_type')
    amount = data.get('amount')
    closer_id = data.get('closer_id')
    method_id = data.get('payment_method_id')
    
    if not all([lead_id, program_id, pay_type, amount, method_id]):
        return jsonify({"message": "Faltan campos obligatorios"}), 400
        
    program = Program.query.get_or_404(program_id)
    user = User.query.get_or_404(lead_id)
    
    # 1. Enrollment Logic
    enrollment = Enrollment.query.filter_by(student_id=lead_id, program_id=program_id, status='active').first()
    
    if not enrollment:
        if pay_type in ['full', 'down_payment', 'renewal']:
            enrollment = Enrollment(
                student_id=lead_id,
                program_id=program_id,
                total_agreed=amount if pay_type == 'full' else program.price,
                status='active',
                closer_id=closer_id
            )
            db.session.add(enrollment)
            db.session.flush()
        else:
            return jsonify({"message": "No se puede cobrar cuota sin inscripcion activa"}), 400
    else:
        if closer_id:
            enrollment.closer_id = closer_id
            
    # 2. Payment Logic
    payment = Payment(
        enrollment_id=enrollment.id,
        payment_method_id=method_id,
        amount=amount,
        payment_type=pay_type,
        status='completed',
        date=datetime.now()
    )
    db.session.add(payment)
    
    # 3. User Status Logic
    if user.role == 'lead':
        user.role = 'student'
        
    if not user.lead_profile:
        profile = LeadProfile(user_id=user.id, status='new')
        db.session.add(profile)
    else:
        profile = user.lead_profile

    if pay_type == 'renewal':
        profile.status = 'renewed'
    elif pay_type == 'full':
        profile.status = 'completed'
    elif pay_type == 'down_payment':
        profile.status = 'pending'
    elif pay_type == 'installment':
        db.session.flush()
        total_paid = db.session.query(db.func.sum(Payment.amount)).filter_by(enrollment_id=enrollment.id).scalar() or 0
        if total_paid >= (enrollment.total_agreed or program.price):
            profile.status = 'completed'
        else:
            if profile.status not in ['completed', 'renewed']:
                profile.status = 'pending'
                
    db.session.commit()
    
    # Webhook could be added here if needed, following legacy util
    
    return jsonify({"message": "Venta registrada con exito", "payment_id": payment.id}), 201
