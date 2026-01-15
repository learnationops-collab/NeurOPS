from flask import render_template, redirect, url_for, flash, request, current_app
from app.public_sales import bp
from app.public_sales.forms import EmailLookupForm, NewClientForm, PublicSaleForm, PublicPaymentForm
from app.models import User, LeadProfile, Enrollment, Program, PaymentMethod, Payment, db
from app.closer.utils import send_sales_webhook
from datetime import datetime
import uuid

def get_closer_or_404(username):
    closer = User.query.filter_by(username=username).first()
    if not closer or closer.role not in ['closer', 'admin']:
        flash('Closer no encontrado o inválido.')
        # Return none to let caller handle redirect or 404
        return None
    return closer

@bp.route('/<closer_username>', methods=['GET', 'POST'])
def lookup(closer_username):
    closer = get_closer_or_404(closer_username)
    if not closer:
        return render_template('public_sales/error.html', message="Closer no encontrado")

    form = EmailLookupForm()
    if form.validate_on_submit():
        email = form.email.data
        user = User.query.filter_by(email=email).first()
        
        if not user:
            # Redirect to create client
            return redirect(url_for('public_sales.create_client', closer_username=closer_username, email=email))
        
        # Check status logic
        # If user exists, update/ensure profile
        if not user.lead_profile:
             profile = LeadProfile(user_id=user.id)
             db.session.add(profile)
             db.session.commit()
        
        # Determine routing based on User state
        # If has active enrollments or payments -> Add Payment
        # Else -> New Sale
        
        # Check for ANY completed payments or active enrollments
        has_payments = Payment.query.join(Enrollment).filter(Enrollment.student_id == user.id, Payment.status == 'completed').count() > 0
        has_enrollments = Enrollment.query.filter_by(student_id=user.id).count() > 0
        
        if has_payments or has_enrollments:
            return redirect(url_for('public_sales.add_payment', closer_username=closer_username, user_id=user.id))
        else:
            return redirect(url_for('public_sales.new_sale', closer_username=closer_username, user_id=user.id))

    return render_template('public_sales/lookup.html', form=form, closer=closer)

@bp.route('/<closer_username>/client/create', methods=['GET', 'POST'])
def create_client(closer_username):
    closer = get_closer_or_404(closer_username)
    if not closer: return render_template('public_sales/error.html', message="Closer no encontrado")

    email = request.args.get('email', '')
    form = NewClientForm()
    
    if request.method == 'GET' and email:
        form.email.data = email

    if form.validate_on_submit():
        # Double check email
        if User.query.filter_by(email=form.email.data).first():
            flash('Este email ya está registrado. Intente buscar de nuevo.')
            return redirect(url_for('public_sales.lookup', closer_username=closer_username))

        # Create User
        temp_pass = str(uuid.uuid4())
        user = User(username=form.username.data, email=form.email.data, role='lead')
        user.set_password(temp_pass)
        db.session.add(user)
        db.session.flush()

        # Create Profile
        profile = LeadProfile(
            user_id=user.id,
            phone=form.phone.data,
            instagram=form.instagram.data,
            utm_source='public_form',
            status='new'
        )
        db.session.add(profile)
        db.session.commit()
        
        flash('Cliente registrado.')
        return redirect(url_for('public_sales.new_sale', closer_username=closer_username, user_id=user.id))

    return render_template('public_sales/new_client.html', form=form, closer=closer)

@bp.route('/<closer_username>/sale/new/<int:user_id>', methods=['GET', 'POST'])
def new_sale(closer_username, user_id):
    closer = get_closer_or_404(closer_username)
    user = User.query.get_or_404(user_id)
    if not closer: return render_template('public_sales/error.html', message="Error")

    form = PublicSaleForm()
    
    # Populate choices
    form.program_id.choices = [(p.id, f"{p.name} (${p.price})") for p in Program.query.filter_by(is_active=True).all()]
    form.payment_method_id.choices = [(m.id, m.name) for m in PaymentMethod.query.filter_by(is_active=True).all()]
    form.lead_id.data = user.id

    if form.validate_on_submit():
        program_id = form.program_id.data
        pay_type = form.payment_type.data
        amount = form.amount.data
        
        program = Program.query.get(program_id)
        
        # Logic: Create Enrollment & Payment
        
        # 1. Create Enrollment
        enrollment = Enrollment(
            student_id=user.id,
            program_id=program_id,
            total_agreed=program.price, # Default to list price
            status='active',
            closer_id=closer.id
        )
        db.session.add(enrollment)
        db.session.flush()
        
        # 2. Create Payment
        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=form.payment_method_id.data,
            amount=amount,
            payment_type=pay_type,
            status='completed',
            date=datetime.utcnow()
        )
        db.session.add(payment)
        
        # 3. Update User Role & Status
        if user.role == 'lead':
            user.role = 'student'
            db.session.add(user)
            
        profile = user.lead_profile
        if not profile:
             profile = LeadProfile(user_id=user.id)
             db.session.add(profile)
        
        if pay_type == 'full':
            profile.status = 'completed'
        else:
            profile.status = 'pending'
            
        db.session.commit()
        
        # Webhook
        send_sales_webhook(payment, closer.username)
        
        return render_template('public_sales/success.html', message="Venta registrada correctamente!", closer=closer)

    return render_template('public_sales/new_sale.html', form=form, closer=closer, user=user)

@bp.route('/<closer_username>/payment/add/<int:user_id>', methods=['GET', 'POST'])
def add_payment(closer_username, user_id):
    closer = get_closer_or_404(closer_username)
    user = User.query.get_or_404(user_id)
    
    # Check for active enrollment
    active_enrollment = Enrollment.query.filter_by(student_id=user.id, status='active').order_by(Enrollment.id.desc()).first()
    
    if not active_enrollment:
        flash('El usuario no tiene inscripciones activas. Registre una nueva venta.')
        return redirect(url_for('public_sales.new_sale', closer_username=closer_username, user_id=user.id))

    form = PublicPaymentForm()
    form.payment_method_id.choices = [(m.id, m.name) for m in PaymentMethod.query.filter_by(is_active=True).all()]

    if form.validate_on_submit():
        amount = form.amount.data
        pay_type = form.payment_type.data
        
        payment = Payment(
            enrollment_id=active_enrollment.id,
            payment_method_id=form.payment_method_id.data,
            amount=amount,
            payment_type=pay_type,
            status='completed',
            date=datetime.utcnow()
        )
        db.session.add(payment)
        
        # Status Update Logic
        # Calculate total paid
        db.session.flush()
        total_paid = db.session.query(db.func.sum(Payment.amount)).filter(
            Payment.enrollment_id == active_enrollment.id,
            Payment.status == 'completed'
        ).scalar() or 0
        
        agreed = active_enrollment.total_agreed or active_enrollment.program.price
        
        if total_paid >= agreed:
            if user.lead_profile:
                user.lead_profile.status = 'completed'
                db.session.add(user.lead_profile)
        
        if pay_type == 'renewal':
             if user.lead_profile:
                user.lead_profile.status = 'renewed'
                db.session.add(user.lead_profile)

        db.session.commit()
        
        # Webhook
        send_sales_webhook(payment, closer.username)
        
        return render_template('public_sales/success.html', message="Pago registrado correctamente!", closer=closer)
        
    # Get payments history for display
    payments = Payment.query.join(Enrollment).filter(Enrollment.student_id == user.id).order_by(Payment.date.desc()).all()

    return render_template('public_sales/add_payment.html', form=form, closer=closer, user=user, payments=payments, enrollment=active_enrollment)
