from flask import render_template, redirect, url_for, flash, request, jsonify
from datetime import datetime, date, time, timedelta
from app.admin import bp
from app import db # Still needed for some direct query if service doesn't cover all edge cases, but trying to minimize
from app.decorators import admin_required
from app.services.financial_service import FinancialService
from app.admin.forms import ExpenseForm, RecurringExpenseForm
from app.models import Expense, RecurringExpense # Needed for form object population

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
