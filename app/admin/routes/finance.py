from flask import render_template, redirect, url_for, flash, request, jsonify
from datetime import datetime, date, time, timedelta
from app.admin import bp
from app import db # Still needed for some direct query if service doesn't cover all edge cases, but trying to minimize
from app.decorators import admin_required
from app.services.financial_service import FinancialService
from app.admin.forms import ExpenseForm, RecurringExpenseForm, AdminSaleForm
from app.models import Expense, RecurringExpense, Program, PaymentMethod, Enrollment, Payment, User, LeadProfile
from app.closer.utils import send_sales_webhook
from sqlalchemy import or_

@bp.route('/finances', methods=['GET', 'POST'])
@admin_required
def finances():
    today = date.today()
    
    # 1. Date Filters
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    if start_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    else:
        start_date = datetime.combine(today.replace(day=1), time.min)

    if end_date_str:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        if end_date.hour == 0:
            end_date = end_date.replace(hour=23, minute=59, second=59)
    else:
        next_month = today.replace(day=28) + timedelta(days=4)
        end_date = datetime.combine(next_month - timedelta(days=next_month.day), time.max)

    # 2. Forms
    expense_form = ExpenseForm()
    recurring_form = RecurringExpenseForm()

    # 3. Handle Expense Submission
    if expense_form.validate_on_submit():
        data = {
            'description': expense_form.description.data,
            'amount': expense_form.amount.data,
            'date': expense_form.date.data,
            'category': expense_form.category.data
        }
        res, code = FinancialService.create_expense(data)
        if request.args.get('ajax'):
            return jsonify({'success': res['success']})
        
        if res['success']:
            flash(res['message'])
        else:
            flash(res['message'], 'error')
        return redirect(url_for('admin.finances'))

    # 4. Fetch Data via Service
    finance_data = FinancialService.get_finances_data(start_date, end_date)
    
    # 5. Handle AJAX Response
    if request.args.get('ajax'):
        # Prepare KPIs for JSON
        kpis = finance_data['kpis']
        html_kpis = {
            'total_expenses': "{:,.2f}".format(kpis['total_expenses']),
            'active_recurring': "{:,.2f}".format(sum(r.amount for r in finance_data['recurring_expenses'] if r.is_active)),
            'cash_collected': "{:,.2f}".format(kpis['cash_collected']),
            'gross_revenue': "{:,.2f}".format(kpis['gross_revenue']),
            'total_commission': "{:,.2f}".format(kpis['total_commission']),
            'net_profit': "{:,.2f}".format(kpis['net_profit']),
            'net_profit_positive': kpis['net_profit'] >= 0
        }
        
        return jsonify({
            'html_expenses': render_template('admin/partials/expenses_table.html', expenses=finance_data['expenses']),
            'html_recurring': render_template('admin/partials/recurring_table.html', recurring_expenses=finance_data['recurring_expenses']),
            'kpis': html_kpis
        })

    # 6. Render Template
    s_date_val = start_date_str if start_date_str else start_date.strftime('%Y-%m-%d')
    e_date_val = end_date_str if end_date_str else end_date.strftime('%Y-%m-%d')

    return render_template('admin/finances.html',
                           start_date=s_date_val,
                           end_date=e_date_val,
                           gross_revenue=finance_data['kpis']['gross_revenue'],
                           total_commission=finance_data['kpis']['total_commission'],
                           cash_collected=finance_data['kpis']['cash_collected'],
                           total_expenses=finance_data['kpis']['total_expenses'],
                           net_profit=finance_data['kpis']['net_profit'],
                           expenses=finance_data['expenses'],
                           recurring_expenses=finance_data['recurring_expenses'],
                           expense_form=expense_form,
                           recurring_form=recurring_form)

@bp.route('/finances/recurring/add', methods=['POST'])
@admin_required
def add_recurring_expense():
    form = RecurringExpenseForm()
    if form.validate_on_submit():
        data = {
            'description': form.description.data,
            'amount': form.amount.data,
            'day_of_month': form.day_of_month.data,
            'is_active': form.is_active.data
        }
        res, code = FinancialService.create_recurring_expense(data)
        if request.args.get('ajax'):
             return jsonify({'success': res['success']})
        flash(res['message'])
    else:
        if request.args.get('ajax'):
             return jsonify({'success': False, 'errors': form.errors}), 400
        flash('Error al agregar gasto fijo.')
    return redirect(url_for('admin.finances'))

@bp.route('/finances/generate', methods=['POST'])
@admin_required
def generate_monthly_expenses():
    res, code = FinancialService.generate_monthly_recurring_expenses()
    if request.args.get('ajax'):
        return jsonify(res)
    flash(res['message'])
    return redirect(url_for('admin.finances'))

@bp.route('/admin/recurring-expense/delete/<int:id>', methods=['POST'])
@admin_required
def delete_recurring_expense(id):
    res, code = FinancialService.delete_item(RecurringExpense, id, "Gasto fijo")
    if request.args.get('ajax'):
        return jsonify({'success': res['success']})
    flash(res['message'])
    return redirect(url_for('admin.finances'))

@bp.route('/admin/recurring-expense/toggle/<int:id>', methods=['POST'])
@admin_required
def toggle_recurring_expense(id):
    res, code = FinancialService.toggle_recurring(id)
    if request.args.get('ajax'):
        return jsonify({'success': res['success']})
    flash(res['message'])
    return redirect(url_for('admin.finances'))

@bp.route('/admin/expense/delete/<int:id>', methods=['POST'])
@admin_required
def delete_expense(id):
    res, code = FinancialService.delete_item(Expense, id, "Gasto")
    if request.args.get('ajax'):
        return jsonify({'success': res['success']})
    flash(res['message'])
    return redirect(url_for('admin.finances'))

@bp.route('/admin/expense/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_expense(id):
    expense = Expense.query.get_or_404(id)
    form = ExpenseForm(obj=expense)
    
    if form.validate_on_submit():
        form.populate_obj(expense)
        db.session.commit()
        flash('Gasto actualizado correctamente.')
        return redirect(url_for('admin.finances'))
        
    return render_template('admin/edit_expense.html', form=form, expense=expense)

@bp.route('/admin/recurring-expense/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_recurring_expense(id):
    rex = RecurringExpense.query.get_or_404(id)
    form = RecurringExpenseForm(obj=rex)
    
    if request.method == 'GET':
        form.is_active.data = 1 if rex.is_active else 0

    if form.validate_on_submit():
        rex.description = form.description.data
        rex.amount = form.amount.data
        rex.day_of_month = form.day_of_month.data
        rex.is_active = bool(form.is_active.data)
        
        db.session.commit()
        flash('Configuración de gasto fijo actualizada.')
        return redirect(url_for('admin.finances'))
        
    return render_template('admin/edit_recurring_expense.html', form=form, rex=rex)

# --- Payment Management (Enrollments) ---

from app.admin.forms import PaymentForm
from app.models import Enrollment, Payment, PaymentMethod, User
from app.closer.utils import send_sales_webhook
from sqlalchemy import or_

@bp.route('/payments/add/<int:enrollment_id>', methods=['GET', 'POST'])
@admin_required
def add_payment(enrollment_id):
    enrollment = Enrollment.query.get_or_404(enrollment_id)
    form = PaymentForm()
    next_url = request.args.get('next')
    
    # Populate methods
    methods = PaymentMethod.query.filter_by(is_active=True).all()
    form.payment_method_id.choices = [(m.id, m.name) for m in methods]
    
    # Populate Closers
    closers = User.query.filter(or_(User.role == 'closer', User.role == 'admin')).all()
    form.closer_id.choices = [(u.id, u.username) for u in closers]

    if request.method == 'GET':
        if enrollment.closer_id:
            form.closer_id.data = enrollment.closer_id
    
    if form.validate_on_submit():
        # Update Enrollment Closer
        if form.closer_id.data:
            enrollment.closer_id = form.closer_id.data
            db.session.add(enrollment)
            
        payment = Payment(
            enrollment_id=enrollment.id,
            amount=form.amount.data,
            date=datetime.combine(form.date.data, datetime.now().time()), # Use current time
            payment_type=form.payment_type.data,
            payment_method_id=form.payment_method_id.data,
            reference_id=form.reference_id.data,
            status=form.status.data
        )
        db.session.add(payment)
        db.session.commit()
        
        # Webhook
        send_sales_webhook(payment, request.user_agent.string) # Passing context or cleaner way
        # Note: legacy used current_user.username, but webhook util expects... ?
        # Checked legacy: send_sales_webhook(payment, current_user.username)
        # Let's use current_user.username if available
        from flask_login import current_user
        send_sales_webhook(payment, current_user.username)
        
        # Auto-update status
        user = User.query.get(enrollment.student_id)
        if user:
            user.update_status_based_on_debt()
        
        flash('Pago registrado.')
        if next_url:
            return redirect(next_url)
            
        return redirect(url_for('admin.edit_client', id=enrollment.student_id))
        
    return render_template('admin/payment_form.html', form=form, title=f"Nuevo Pago - {enrollment.program.name}")

@bp.route('/payments/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_payment(id):
    payment = Payment.query.get_or_404(id)
    form = PaymentForm(obj=payment)
    
    methods = PaymentMethod.query.filter_by(is_active=True).all()
    form.payment_method_id.choices = [(m.id, m.name) for m in methods]
    
    # Populate Closers
    closers = User.query.filter(or_(User.role == 'closer', User.role == 'admin')).all()
    form.closer_id.choices = [(u.id, u.username) for u in closers]
    
    if request.method == 'GET':
         if payment.date:
             form.date.data = payment.date.date()
         
         if payment.enrollment.closer_id:
             form.closer_id.data = payment.enrollment.closer_id
    
    if form.validate_on_submit():
        if form.closer_id.data:
            payment.enrollment.closer_id = form.closer_id.data
            db.session.add(payment.enrollment)

        payment.amount = form.amount.data
        payment.date = datetime.combine(form.date.data, datetime.min.time())
        payment.payment_type = form.payment_type.data
        payment.payment_method_id = form.payment_method_id.data
        payment.reference_id = form.reference_id.data
        payment.status = form.status.data
        
        db.session.commit()
        
        # Auto-update status
        user = User.query.get(payment.enrollment.student_id)
        if user:
            user.update_status_based_on_debt()
        
        flash('Pago actualizado.')
        
        next_url = request.args.get('next')
        if next_url:
            return redirect(next_url)
            
        return redirect(url_for('admin.edit_client', id=payment.enrollment.student_id))
        
    return render_template('admin/payment_form.html', form=form, title="Editar Pago")

@bp.route('/payments/delete/<int:id>')
@admin_required
def delete_payment(id):
    payment = Payment.query.get_or_404(id)
    enrollment = payment.enrollment
    student_id = enrollment.student_id
    
    db.session.delete(payment)
    db.session.flush()
    
    if enrollment.payments.count() == 0:
        db.session.delete(enrollment)
        
    db.session.commit()
    
    user = User.query.get(student_id)
    if user:
        user.update_status_based_on_debt()
    
    flash('Pago eliminado.')
    
    next_url = request.args.get('next')
    if next_url:
        return redirect(next_url)
        
    return redirect(url_for('admin.edit_client', id=student_id))

@bp.route('/sales')
@bp.route('/sales/analysis')
@admin_required
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
    )

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

    # KPI Calculation Logic
    stats_query = db.session.query(
        db.func.sum(Payment.amount),
        db.func.count(Payment.id),
        db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)
    ).join(Enrollment, Payment.enrollment_id == Enrollment.id).join(User, Enrollment.student_id == User.id).outerjoin(PaymentMethod, Payment.payment_method_id == PaymentMethod.id)

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
    cash_collected_val = total_gross - fees
    avg_ticket = (total_gross / count) if count > 0 else 0.0

    kpis = {
        'sales_count': count,
        'total_revenue': "{:,.2f}".format(total_gross),
        'cash_collected': "{:,.2f}".format(cash_collected_val),
        'avg_ticket': "{:,.2f}".format(avg_ticket)
    }

    if is_load_more and not is_ajax:
         return render_template('admin/partials/sales_rows.html', payments=payments, start_index=start_index)
        
    if is_ajax:
         return jsonify({
            'html': render_template('admin/partials/sales_rows.html', payments=payments, start_index=start_index),
            'kpis': kpis,
            'has_next': pagination.has_next,
            'next_page': pagination.next_num
         })
         
    methods = PaymentMethod.query.filter_by(is_active=True).all()
    programs = Program.query.all()
    closers = User.query.filter_by(role='closer').all()
    # --- Program Analysis (New) ---
    program_analysis = []
    
    # Clone filters for aggregation (reusing stats_query base would be ideal but it joins differently?)
    # reusing the logic from stats_query but grouping by Program
    
    prog_stats_query = db.session.query(
        Program.name,
        db.func.sum(Payment.amount),
        db.func.count(Payment.id),
        db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)
    ).join(Enrollment, Payment.enrollment_id == Enrollment.id).join(Program, Enrollment.program_id == Program.id).join(User, Enrollment.student_id == User.id).outerjoin(PaymentMethod, Payment.payment_method_id == PaymentMethod.id)

    # Apply same filters
    if start_date_str: prog_stats_query = prog_stats_query.filter(Payment.date >= datetime.strptime(start_date_str, '%Y-%m-%d'))
    if end_date_str: prog_stats_query = prog_stats_query.filter(Payment.date < datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1))
    if search: prog_stats_query = prog_stats_query.filter(or_(User.username.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
    if method_filter: prog_stats_query = prog_stats_query.filter(Payment.payment_method_id == method_filter)
    if type_filter: prog_stats_query = prog_stats_query.filter(Payment.payment_type == type_filter)
    if program_filter: prog_stats_query = prog_stats_query.filter(Enrollment.program_id == program_filter)
    
    prog_stats = prog_stats_query.group_by(Program.name).all()
    
    # Calculate totals for verify (should match main KPIs)
    # Process
    for p_name, p_gross, p_count, p_fees in prog_stats:
        p_gross = p_gross or 0.0
        p_fees = p_fees or 0.0
        p_count = p_count or 0
        p_cash = p_gross - p_fees
        p_avg = (p_gross / p_count) if p_count > 0 else 0.0
        p_pct = (p_count / count * 100) if count > 0 else 0.0
        
        program_analysis.append({
            'name': p_name,
            'count': p_count,
            'pct': p_pct,
            'cash': p_cash,
            'ticket': p_avg
        })
        
    # Sort by cash collected desc
    program_analysis.sort(key=lambda x: x['cash'], reverse=True)

    payment_types = [
        ('full', 'Pago Completo'),
        ('down_payment', 'Primer Pago'),
        ('installment', 'Cuota'),
        ('renewal', 'Renovación')
    ]
    
    return render_template('admin/sales_list.html', 
                           payments=payments, 
                           pagination=pagination,
                           # Pass explicit variables for initial load as template expects them at top level too
                           total_sales_count=count,
                           total_revenue=total_gross,
                           cash_collected=cash_collected_val,
                           avg_ticket=avg_ticket,
                           
                           start_date=start_date_str, 
                           end_date=end_date_str,
                           search=search,
                           method_id=method_filter,
                           payment_type=type_filter,
                           program_id=program_filter,
                           
                           all_methods=methods,
                           all_programs=programs,
                           payment_types=payment_types,
                           closers=closers,
                           start_index=start_index,
                           program_analysis=program_analysis)


@bp.route('/sale/new', methods=['GET', 'POST'])
@admin_required
def create_sale():
    form = AdminSaleForm()
    # Populate Choices
    form.program_id.choices = [(p.id, f"{p.name} (${p.price})") for p in Program.query.filter_by(is_active=True).all()]
    form.payment_method_id.choices = [(m.id, m.name) for m in PaymentMethod.query.filter_by(is_active=True).all()]
    form.closer_id.choices = [(u.id, u.username) for u in User.query.filter(or_(User.role == 'closer', User.role == 'admin')).all()]
    
    # Handle GET initial data
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
        closer_id = form.closer_id.data
        
        program = Program.query.get(program_id)
        
        # Validation
        if pay_type == 'full' and amount < program.price:
             flash(f'Error: El pago completo debe ser al menos ${program.price}.')
             return render_template('sales/new_sale.html', form=form, title="Nueva Venta (Admin)")

        # Enrollment Logic
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
                flash('Error: No se puede cobrar cuota sin inscripción activa.')
                return render_template('sales/new_sale.html', form=form, title="Nueva Venta (Admin)")
        else:
            # Update closer if changed/reassigned
             if enrollment.closer_id != closer_id:
                 enrollment.closer_id = closer_id
                 db.session.add(enrollment)
        
        # Payment Logic
        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=form.payment_method_id.data,
            amount=amount,
            payment_type=pay_type, 
            status='completed',
            date=datetime.now()
        )
        db.session.add(payment)
        
        # User Status Logic
        user = User.query.get(lead_id)
        # Promote lead to student if applicable
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
                return render_template('sales/new_sale.html', form=form, title="Nueva Venta (Admin)")
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
        
        # Webhook
        closer_name = User.query.get(closer_id).username if closer_id else 'Admin'
        send_sales_webhook(payment, closer_name)
        
        flash('Venta registrada exitosamente (Admin).')
        return redirect(url_for('admin.sales_list'))
        

    return render_template('sales/new_sale.html', form=form, title="Nueva Venta (Admin)")

@bp.route('/sales/bulk_assign', methods=['POST'])
@admin_required
def bulk_assign_sales_closer():
    closer_id = request.form.get('closer_id')
    payment_ids = request.form.getlist('payment_ids')
    
    if not closer_id:
        flash('Debe seleccionar un closer.')
        return redirect(url_for('admin.sales_list'))
        
    if not payment_ids:
        flash('Debe seleccionar al menos una venta.')
        return redirect(url_for('admin.sales_list'))
        
    closer = User.query.get(closer_id)
    if not closer or closer.role not in ['closer', 'admin']:
         flash('Closer inválido.')
         return redirect(url_for('admin.sales_list'))
         
    count = 0
    for pid in payment_ids:
        payment = Payment.query.get(pid)
        if payment and payment.enrollment:
            if payment.enrollment.closer_id != closer.id:
                payment.enrollment.closer_id = closer.id
                db.session.add(payment.enrollment)
                count += 1
                
    db.session.commit()
    flash(f'{count} ventas reasignadas a {closer.username}.')
    return redirect(url_for('admin.sales_list'))
