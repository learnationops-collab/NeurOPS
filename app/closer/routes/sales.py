from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from app.closer import bp
from app.models import Payment, Enrollment, User, Program, PaymentMethod, LeadProfile, db
from app.closer.forms import SaleForm, CloserPaymentForm
from app.closer.utils import send_sales_webhook
from datetime import datetime, timedelta
from sqlalchemy import or_
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

@bp.route('/sales')
@closer_required
def sales_list():
    search = request.args.get('search', '')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    method_filter = request.args.get('method')
    type_filter = request.args.get('type')
    program_filter = request.args.get('program')
    
    query = Payment.query.join(
        Enrollment, Payment.enrollment_id == Enrollment.id
    ).join(
        User, Enrollment.student_id == User.id
    ).filter(Enrollment.closer_id == current_user.id)

    if start_date_str: query = query.filter(Payment.date >= datetime.strptime(start_date_str, '%Y-%m-%d'))
    if end_date_str: query = query.filter(Payment.date < datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1))
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(User.username.ilike(search_term), User.email.ilike(search_term)))
    if method_filter: query = query.filter(Payment.payment_method_id == method_filter)
    if type_filter: query = query.filter(Payment.payment_type == type_filter)
    if program_filter: query = query.filter(Enrollment.program_id == program_filter)

    query = query.order_by(Payment.date.desc())
    
    page = request.args.get('page', 1, type=int)
    pagination = query.paginate(page=page, per_page=50, error_out=False)
    payments = pagination.items
    start_index = (page - 1) * 50
    
    is_load_more = request.args.get('load_more')
    is_ajax = request.args.get('ajax')

    # KPI Calculation Logic (Simplified or reused Service?)
    # For now, inline as in legacy, but cleaner.
    # Actually, let's keep it inline for list specific context or move to service if generic?
    # This matches the 'filtered list stats'. Service has 'get_leads_kpis' but not 'sales_list_kpis'.
    # For speed, implementing inline logic mirroring legacy.
    
    stats_query = db.session.query(
        db.func.sum(Payment.amount),
        db.func.count(Payment.id),
        db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)
    ).join(Enrollment, Payment.enrollment_id == Enrollment.id).join(User, Enrollment.student_id == User.id).outerjoin(PaymentMethod, Payment.payment_method_id == PaymentMethod.id).filter(Enrollment.closer_id == current_user.id)

    if start_date_str: stats_query = stats_query.filter(Payment.date >= datetime.strptime(start_date_str, '%Y-%m-%d'))
    if end_date_str: stats_query = stats_query.filter(Payment.date < datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1))
    if search: stats_query = stats_query.filter(or_(User.username.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
    if method_filter: stats_query = stats_query.filter(Payment.payment_method_id == method_filter)
    if type_filter: stats_query = stats_query.filter(Payment.payment_type == type_filter)
    if program_filter: stats_query = stats_query.filter(Enrollment.program_id == program_filter)
    
    total_gross, count, fees = stats_query.first()
    total_gross = total_gross or 0.0
    fees = fees or 0.0
    count = count or 0
    cash_net = total_gross - fees
    my_commission = cash_net * 0.10
    
    # Debt
    debt_query = db.session.query(Enrollment).filter(Enrollment.closer_id == current_user.id, Enrollment.status == 'active')
    if search: debt_query = debt_query.join(User).filter(or_(User.username.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
    if program_filter: debt_query = debt_query.filter(Enrollment.program_id == program_filter)
    
    total_debt = 0.0
    for enr in debt_query.all():
         paid = enr.total_paid
         agreed = enr.total_agreed if enr.total_agreed is not None else (enr.program.price if enr.program else 0.0)
         if agreed > paid: total_debt += (agreed - paid)

    kpis = {
        'revenue': total_gross,
        'cash_collected': cash_net,
        'my_commission': my_commission,
        'count': count,
        'debt': total_debt
    }

    if is_load_more and not is_ajax:
        return render_template('closer/partials/sales_rows.html', payments=payments, start_index=start_index)
        
    if is_ajax:
         return jsonify({
            'html': render_template('closer/partials/sales_rows.html', payments=payments, start_index=start_index),
            'kpis': {
                'sales_count': kpis['count'],
                'revenue': "{:,.2f}".format(kpis['revenue']),
                'cash_collected': "{:,.2f}".format(kpis['cash_collected']),
                'my_commission': "{:,.2f}".format(kpis['my_commission']),
                'debt': "{:,.2f}".format(kpis['debt'])
            },
            'has_next': pagination.has_next,
            'next_page': pagination.next_num
         })
         
    methods = PaymentMethod.query.filter_by(is_active=True).all()
    programs = Program.query.all()
    
    return render_template('closer/sales_list.html', 
                           payments=payments, 
                           pagination=pagination,
                           kpis=kpis,
                           start_date=start_date_str, 
                           end_date=end_date_str,
                           search=search,
                           method_filter=method_filter and int(method_filter),
                           type_filter=type_filter,
                           program_filter=program_filter,
                           methods=methods,
                           programs=programs,
                           start_index=start_index)

@bp.route('/sale/new', methods=['GET', 'POST'])
@closer_required
def create_sale():
    form = SaleForm()
    form.program_id.choices = [(p.id, f"{p.name} (${p.price})") for p in Program.query.filter_by(is_active=True).all()]
    form.payment_method_id.choices = [(m.id, m.name) for m in PaymentMethod.query.filter_by(is_active=True).all()]
    
    if request.method == 'GET':
        lead_id = request.args.get('lead_id', type=int)
        if lead_id:
            lead = User.query.get(lead_id)
            if lead:
                form.lead_id.data = lead.id
                form.lead_search.data = f"{lead.username} ({lead.email})"
    
    if form.validate_on_submit():
        lead_id = form.lead_id.data
        program_id = form.program_id.data
        pay_type = form.payment_type.data
        amount = form.amount.data
        
        program = Program.query.get(program_id)
        
        if pay_type == 'full' and amount < program.price:
             flash(f'Error: El pago completo debe ser al menos ${program.price}.')
             return render_template('sales/new_sale.html', form=form, title="Nueva Venta")
             
        enrollment = Enrollment.query.filter_by(student_id=lead_id, program_id=program_id, status='active').first()
        
        if not enrollment:
            if pay_type in ['full', 'down_payment', 'renewal']:
                 enrollment = Enrollment(
                     student_id=lead_id,
                     program_id=program_id,
                     total_agreed=amount if pay_type == 'full' else program.price,
                     status='active',
                     closer_id=current_user.id
                 )
                 db.session.add(enrollment)
                 db.session.flush()
            else:
                flash('Error: No se puede cobrar cuota sin inscripción activa.')
                return render_template('sales/new_sale.html', form=form, title="Nueva Venta")
        
        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=form.payment_method_id.data,
            amount=amount,
            payment_type=pay_type, 
            status='completed'
        )
        db.session.add(payment)
        
        user = User.query.get(lead_id)
        if user.role == 'lead':
            user.role = 'student'
            db.session.add(user)
            
        if not user.lead_profile:
            profile = LeadProfile(user_id=user.id, status='new')
            db.session.add(profile)
        else:
            profile = user.lead_profile

        if pay_type == 'renewal':
            if profile.status != 'completed':
                flash('Error: Solo se puede renovar si el cliente está completado.')
                db.session.rollback()
                return render_template('sales/new_sale.html', form=form, title="Nueva Venta")
            profile.status = 'renewed'
        elif pay_type == 'full':
            profile.status = 'completed'
        elif pay_type == 'down_payment':
            profile.status = 'pending'
        elif pay_type == 'installment':
             db.session.flush()
             total_paid = db.session.query(db.func.sum(Payment.amount)).filter_by(enrollment_id=enrollment.id).scalar() or 0
             if total_paid >= program.price:
                 profile.status = 'completed'
             else:
                 if profile.status != 'completed' and profile.status != 'renewed':
                     profile.status = 'pending'
                     
        db.session.commit()
        send_sales_webhook(payment, current_user.username)
        flash('Venta registrada exitosamente.')
        return redirect(url_for('closer.sales_list'))
        
    return render_template('sales/new_sale.html', form=form, title="Nueva Venta")

@bp.route('/sale/edit/<int:id>', methods=['GET', 'POST'])
@closer_required
def edit_sale(id):
    payment = Payment.query.get_or_404(id)
    form = SaleForm(obj=payment)
    
    if request.method == 'GET':
        form.lead_id.data = payment.enrollment.student_id
        form.lead_search.data = f"{payment.enrollment.student.username} ({payment.enrollment.student.email})"
        form.program_id.data = payment.enrollment.program_id
        
    form.program_id.choices = [(p.id, f"{p.name} (${p.price})") for p in Program.query.all()]
    form.payment_method_id.choices = [(m.id, m.name) for m in PaymentMethod.query.filter_by(is_active=True).all()]

    if form.validate_on_submit():
        payment.amount = form.amount.data
        payment.payment_type = form.payment_type.data
        payment.payment_method_id = form.payment_method_id.data
        
        db.session.commit()
        flash('Venta actualizada.')
        return redirect(url_for('closer.sales_list'))
        
    return render_template('sales/new_sale.html', form=form, title="Editar Venta")

@bp.route('/sale/delete/<int:id>')
@closer_required
def delete_sale(id):
    payment = Payment.query.get_or_404(id)
    enrollment = payment.enrollment
    student_id = enrollment.student_id
    
    db.session.delete(payment)
    db.session.flush()
    
    if enrollment.payments.count() == 0:
        db.session.delete(enrollment)
        
    db.session.commit()
    
    user = User.query.get(student_id)
    if user: user.update_status_based_on_debt()
        
    flash('Venta eliminada.')
    return redirect(url_for('closer.sales_list'))

@bp.route('/lead/<int:id>/new-sale', methods=['GET', 'POST'])
@closer_required
def new_sale(id):
    lead = User.query.get_or_404(id)
    form = SaleForm()
    form.program_id.choices = [(p.id, f"{p.name} (${p.price})") for p in Program.query.filter_by(is_active=True).all()]
    form.payment_method_id.choices = [(m.id, m.name) for m in PaymentMethod.query.filter_by(is_active=True).all()]
    form.lead_id.data = lead.id

    if form.validate_on_submit():
        program = Program.query.get(form.program_id.data)
        enrollment = Enrollment(
            student_id=lead.id,
            program_id=program.id,
            total_agreed=program.price,
            status='active',
            closer_id=current_user.id
        )
        db.session.add(enrollment)
        db.session.flush()
        
        payment = Payment(
            enrollment_id=enrollment.id,
            amount=form.amount.data,
            date=datetime.utcnow(),
            payment_type=form.payment_type.data,
            payment_method_id=form.payment_method_id.data,
            status='completed'
        )
        db.session.add(payment)
        
        if lead.role == 'lead':
            lead.role = 'student'
            db.session.add(lead)
            
        if not lead.lead_profile:
             profile = LeadProfile(user_id=lead.id, status='new')
             db.session.add(profile)
        else:
             profile = lead.lead_profile
             
        pay_type = form.payment_type.data
        if pay_type == 'full': profile.status = 'completed'
        elif pay_type == 'down_payment': profile.status = 'pending'
        elif pay_type == 'installment': profile.status = 'pending'
        elif pay_type == 'renewal': profile.status = 'renewed'
        
        db.session.commit()
        send_sales_webhook(payment, current_user.username)
        flash('Venta registrada exitosamente.')
        return redirect(url_for('closer.lead_detail', id=lead.id))
        
    return render_template('closer/sale_form.html', form=form, title=f"Nueva Venta: {lead.username}", lead_id=lead.id)

@bp.route('/enrollment/<int:id>/add-payment', methods=['GET', 'POST'])
@closer_required
def add_payment(id):
    enrollment = Enrollment.query.get_or_404(id)
    form = CloserPaymentForm()
    form.payment_method_id.choices = [(m.id, m.name) for m in PaymentMethod.query.filter_by(is_active=True).all()]
    
    if form.validate_on_submit():
        payment = Payment(
            enrollment_id=enrollment.id,
            amount=form.amount.data,
            date=datetime.combine(form.date.data, datetime.now().time()),
            payment_type=form.payment_type.data,
            payment_method_id=form.payment_method_id.data,
            reference_id=form.reference_id.data,
            status=form.status.data
        )
        db.session.add(payment)
        db.session.commit()
        
        user = User.query.get(enrollment.student_id)
        if user: user.update_status_based_on_debt()
        send_sales_webhook(payment, current_user.username)
        flash('Pago agregado.')
        return redirect(url_for('closer.lead_detail', id=enrollment.student_id))
        
    return render_template('closer/payment_form.html', form=form, title="Registrar Pago", lead_id=enrollment.student_id)

@bp.route('/payment/edit/<int:id>', methods=['GET', 'POST'])
@closer_required
def edit_payment(id):
    payment = Payment.query.get_or_404(id)
    form = CloserPaymentForm(obj=payment)
    form.payment_method_id.choices = [(m.id, m.name) for m in PaymentMethod.query.filter_by(is_active=True).all()]

    if form.validate_on_submit():
        payment.amount = form.amount.data
        payment.date = datetime.combine(form.date.data, payment.date.time())
        payment.payment_type = form.payment_type.data
        payment.payment_method_id = form.payment_method_id.data
        payment.reference_id = form.reference_id.data
        payment.status = form.status.data
        db.session.commit()
        
        user = User.query.get(payment.enrollment.student_id)
        if user: user.update_status_based_on_debt()
        flash('Pago actualizado.')
        return redirect(url_for('closer.lead_detail', id=payment.enrollment.student_id))
        
    return render_template('closer/payment_form.html', form=form, title="Editar Pago")

@bp.route('/payment/delete-detail/<int:id>')
@closer_required
def delete_payment_detail(id):
    payment = Payment.query.get_or_404(id)
    enrollment = payment.enrollment
    student_id = enrollment.student_id
    db.session.delete(payment)
    db.session.flush()
    if enrollment.payments.count() == 0: db.session.delete(enrollment)
    db.session.commit()
    user = User.query.get(student_id)
    if user: user.update_status_based_on_debt()
    flash('Pago eliminado.')
    return redirect(url_for('closer.lead_detail', id=student_id))

@bp.route('/enrollment/delete/<int:id>')
@closer_required
def delete_enrollment(id):
    enrollment = Enrollment.query.get_or_404(id)
    student_id = enrollment.student_id
    db.session.delete(enrollment)
    db.session.commit()
    flash('Inscripción eliminada.')
    return redirect(url_for('closer.lead_detail', id=student_id))
