from flask import render_template, request, redirect, url_for, flash, session
from app.admin import bp
from app.decorators import admin_required
from app import db
from app.models import User, LeadProfile, Appointment, Enrollment, Payment, CloserDailyStats
import csv
import io
from werkzeug.utils import secure_filename

# --- DASHBOARD & WIPE ---

@bp.route('/operations/dashboard')
@admin_required
def operations_dashboard():
    return render_template('admin/operations_dashboard.html')

@bp.route('/operations/wipe-data', methods=['POST'])
@admin_required
def operations_wipe_data():
    try:
        # Delete dependent tables first
        db.session.query(Payment).delete()
        db.session.query(Enrollment).delete()
        db.session.query(Appointment).delete()
        
        # We need to be careful with lead_profiles and users
        # Delete only users who are NOT admin or closer
        # Using subquery or iterative delete
        
        leads_to_delete = User.query.filter(User.role.notin_(['admin', 'closer'])).all()
        count = len(leads_to_delete)
        
        for u in leads_to_delete:
            if u.lead_profile:
                db.session.delete(u.lead_profile)
            db.session.delete(u)
            
        # Optional: Clear Daily Stats? User said "Toda la vieja base de datos", 
        # usually stats are historical, but for a "Wipe" usually means clean slate.
        # Let's keep CloserDailyStats if they are valuable, or delete?
        # Assuming "old database" migration implies we want fresh state.
        # But maybe we keep closer stats? Let's leave stats for now unless requested.
        
        db.session.commit()
        flash(f'Base de datos limpiada. Eliminados {count} usuarios y todos los registros asociados.', 'success')
        
    except Exception as e:
        db.session.rollback()
        flash(f'Error al limpiar base de datos: {str(e)}', 'error')
        
    return redirect(url_for('admin.operations_dashboard'))

# --- ORPHAN SALES ---

@bp.route('/operations/orphan-sales', methods=['GET', 'POST'])
@admin_required
def operations_orphan_sales():
    # Fetch orphans: Users created by import sales with 'orphan_sale' source
    # We want to show the SALES associated with these users.
    
    # 1. Get Orphan Users
    orphan_users = User.query.join(LeadProfile).filter(LeadProfile.utm_source == 'orphan_sale').all()
    orphan_ids = [u.id for u in orphan_users]
    
    # 2. Get Payments linked to these users (via Enrollment)
    # We return a structure: { 'payment': p, 'orphan_user': u, 'probables': [] }
    orphans_list = []
    
    if orphan_ids:
        payments = Payment.query.join(Enrollment).filter(Enrollment.student_id.in_(orphan_ids)).all()
        
        for p in payments:
            u = p.enrollment.student
            # Basic probabilistic matching? (Same email text?)
            # Or just pass the orphan to the template
            orphans_list.append({
                'payment': p,
                'orphan_user': u,
                'program': p.enrollment.program.name
            })
    
    return render_template('admin/operations_orphan_sales.html', orphans=orphans_list)

@bp.route('/operations/assign-sale/<int:payment_id>', methods=['POST'])
@admin_required
def operations_assign_sale(payment_id):
    target_email = request.form.get('target_email')
    
    payment = Payment.query.get_or_404(payment_id)
    orphan_user = payment.enrollment.student
    
    # Find Target User
    target_user = User.query.filter_by(email=target_email).first()
    
    if not target_user:
        flash(f'No se encontró ningún usuario con el email {target_email}', 'error')
        return redirect(url_for('admin.operations_orphan_sales'))
        
    # Reassign Logic
    try:
        # 1. Update Enrollment
        enrollment = payment.enrollment
        
        # Check if target already has enrollment for this program?
        existing_enroll = Enrollment.query.filter_by(student_id=target_user.id, program_id=enrollment.program_id).first()
        
        if existing_enroll:
            # Move payment to existing enrollment
            payment.enrollment_id = existing_enroll.id
            # Delete old enrollment if it has no other payments?
            if not enrollment.payments.filter(Payment.id != payment.id).first():
                 db.session.delete(enrollment)
        else:
            # Move match entire enrollment to new user
            enrollment.student_id = target_user.id
            
        db.session.commit()
        
        # 2. Clean up Orphan User if empty?
        # If orphan user has no more enrollments, delete it
        if not Enrollment.query.filter_by(student_id=orphan_user.id).first():
            if orphan_user.lead_profile:
                db.session.delete(orphan_user.lead_profile)
            db.session.delete(orphan_user)
            db.session.commit()
            
        flash(f'Venta reasignada exitosamente a {target_user.email}', 'success')
        
    except Exception as e:
        db.session.rollback()
        flash(f'Error al reasignar: {str(e)}', 'error')

    return redirect(url_for('admin.operations_orphan_sales'))

import os
import csv
import io
import uuid
from flask import render_template, request, redirect, url_for, flash, session, current_app
from werkzeug.utils import secure_filename
from datetime import datetime
from app.admin import bp
from app.decorators import admin_required
from app import db
from app.models import User, LeadProfile, Appointment, Enrollment, Payment, Program, PaymentMethod, CloserDailyStats

# Helper to save temp file
def save_temp_file(file):
    temp_dir = os.path.join(current_app.root_path, '..', 'storage', 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    filename = f"{uuid.uuid4()}_{secure_filename(file.filename)}"
    path = os.path.join(temp_dir, filename)
    file.save(path)
    return filename, path

def get_temp_file_path(filename):
    return os.path.join(current_app.root_path, '..', 'storage', 'temp', filename)

# --- IMPORT PRE-CHECKS (MAPPING) ---

@bp.route('/operations/import/calls/precheck', methods=['POST'])
@admin_required
def operations_import_calls_precheck():
    if 'file' not in request.files:
        flash('No file part')
        return redirect(url_for('admin.operations_dashboard'))
        
    file = request.files['file']
    if file.filename == '':
        flash('No selected file')
        return redirect(url_for('admin.operations_dashboard'))
        
    if file:
        filename, path = save_temp_file(file)
        
        # Read headers
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                reader = csv.reader(f)
                headers = next(reader)
                # peek first row for preview?
                # first_row = next(reader, [])
        except Exception as e:
            flash(f'Error leyendo CSV: {str(e)}', 'error')
            return redirect(url_for('admin.operations_dashboard'))
            
        required_fields = {
            'email': 'Email (Identificador)',
            'date': 'Fecha de Agenda'
        }
        optional_fields = {
            'name': 'Nombre Completo',
            'phone': 'Teléfono',
            'instagram': 'Instagram',
            'closer': 'Closer Asignado' # If available
        }
        
        return render_template('admin/operations_import_map.html',
                               import_type='calls',
                               filename=filename,
                               csv_headers=headers,
                               required_fields=required_fields,
                               optional_fields=optional_fields,
                               preview_row={}) # TODO: Pass preview data

@bp.route('/operations/import/sales/precheck', methods=['POST'])
@admin_required
def operations_import_sales_precheck():
    if 'file' not in request.files:
        flash('No file part')
        return redirect(url_for('admin.operations_dashboard'))
        
    file = request.files['file']
    if file.filename == '':
        flash('No selected file')
        return redirect(url_for('admin.operations_dashboard'))
        
    if file:
        filename, path = save_temp_file(file)
        
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                reader = csv.reader(f)
                headers = next(reader)
        except Exception as e:
            flash(f'Error leyendo CSV: {str(e)}', 'error')
            return redirect(url_for('admin.operations_dashboard'))
            
        required_fields = {
            'email': 'Email (Match con Lead)',
            'amount': 'Monto Total',
            'date': 'Fecha de Venta',
            'program': 'Programa',
            'method': 'Método de Pago'
        }
        optional_fields = {
            'type': 'Tipo (Full/Cuota)',
            'closer': 'Closer (Si difiere de Lead)'
        }
        
        return render_template('admin/operations_import_map.html',
                               import_type='sales',
                               filename=filename,
                               csv_headers=headers,
                               required_fields=required_fields,
                               optional_fields=optional_fields,
                               preview_row={})

# --- IMPORT EXECUTE ---

@bp.route('/operations/import/execute', methods=['POST'])
@admin_required
def operations_import_execute():
    import_type = request.form.get('import_type')
    filename = request.form.get('filename')
    path = get_temp_file_path(filename)
    
    if not os.path.exists(path):
        flash('El archivo temporal ha expirado o no existe. Sube el archivo nuevamente.', 'error')
        return redirect(url_for('admin.operations_dashboard'))
        
    # Get Mappings
    # Form keys are 'map_fieldkey' -> value is 'csv_header'
    mapping = {}
    for key in request.form:
        if key.startswith('map_'):
            field = key.replace('map_', '')
            csv_header = request.form[key]
            if csv_header:
                mapping[field] = csv_header
                
    count_processed = 0
    count_errors = 0
    
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            
            # --- CALLS IMPORT LOGIC ---
            if import_type == 'calls':
                for row in reader:
                    # Map data
                    email = row.get(mapping.get('email', ''), '').strip().lower()
                    if not email: continue
                    
                    date_str = row.get(mapping.get('date', ''), '')
                    name = row.get(mapping.get('name', ''), '').strip()
                    phone = row.get(mapping.get('phone', ''), '').strip()
                    ig = row.get(mapping.get('instagram', ''), '').strip()
                    
                    # 1. User/Lead
                    user = User.query.filter_by(email=email).first()
                    if not user:
                        base_username = name.split()[0].lower() if name else email.split('@')[0]
                        # Unique check logic simplified
                        user = User(
                            username=f"{base_username}_{uuid.uuid4().hex[:4]}",
                            email=email,
                            role='lead',
                            created_at=datetime.utcnow() 
                        )
                        user.set_password('temp1234')
                        db.session.add(user)
                        db.session.flush()
                        
                        profile = LeadProfile(user_id=user.id, phone=phone, instagram=ig, status='new', utm_source='import_calls')
                        db.session.add(profile)
                    else:
                        # Update contact info if missing
                        if user.lead_profile:
                            if not user.lead_profile.phone and phone: user.lead_profile.phone = phone
                            if not user.lead_profile.instagram and ig: user.lead_profile.instagram = ig
                    
                    # 2. Appointment
                    # Parse date
                    # Try flexible parsing
                    appt_date = datetime.utcnow()
                    if date_str:
                         # Very basic parser, enhance as needed
                         try: appt_date = datetime.strptime(date_str, '%d/%m/%Y %H:%M') # Common
                         except: 
                             try: appt_date = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                             except: pass
                             
                    # Check duplicate appointment (same user, same time)
                    exists = Appointment.query.filter_by(lead_id=user.id, start_time=appt_date).first()
                    if not exists:
                        # Closer?
                        # If mapped closer column exists, try to find closer user
                        closer_id = None
                        
                        appt = Appointment(
                            lead_id=user.id,
                            closer_id=closer_id, # Can remain None or default
                            start_time=appt_date,
                            status='completed', # Assume historic calls are completed
                            outcome='held'
                        )
                        db.session.add(appt)
                        count_processed += 1
                        
            # --- SALES IMPORT LOGIC ---
            elif import_type == 'sales':
                # Ensure Import PM
                pm_import = PaymentMethod.query.filter_by(name='Imported').first()
                if not pm_import:
                    pm_import = PaymentMethod(name='Imported')
                    db.session.add(pm_import)
                    db.session.commit()
                    
                orphans = [] # To track orphans if we wanted to bulk insert them.
                             # But here we might just create incomplete users or skip.
                
                for row in reader:
                    email = row.get(mapping.get('email', ''), '').strip().lower()
                    if not email: continue
                    
                    # Find User
                    user = User.query.filter_by(email=email).first()
                    if not user:
                        # ORPHAN LOGIC
                        # Create an "Orphan" Sale? Or Create a Placeholder User?
                        # User requirement: "Operations can bring whole old DB... manual assign if not auto"
                        # Strategy: Create a "Skeleton" User tagged as orphan-source
                        
                        user = User(
                            username=f"orphan_{uuid.uuid4().hex[:8]}",
                            email=email,
                            role='lead', # Or 'orphan' role? Let's stick to lead but tag profile
                            created_at=datetime.utcnow()
                        )
                        user.set_password('orphan123')
                        db.session.add(user)
                        db.session.flush()
                        
                        profile = LeadProfile(user_id=user.id, status='new', utm_source='orphan_sale')
                        db.session.add(profile)
                        # We will flag this sale later via logic or just rely on 'orphan_sale' utm to find them
                    
                    # Continue with sale creation linked to this user (real or skeleton)
                    amount_str = row.get(mapping.get('amount', ''), '0')
                    # clean amount
                    try: amount = float(str(amount_str).replace('$','').replace(',','').strip())
                    except: amount = 0.0
                    
                    prog_name = row.get(mapping.get('program', ''), 'General')
                    
                    # Program
                    program = Program.query.filter(Program.name.ilike(prog_name)).first()
                    if not program:
                        program = Program(name=prog_name, price=0, is_active=True)
                        db.session.add(program)
                        db.session.flush()
                        
                    # Enrollment
                    enroll = Enrollment.query.filter_by(student_id=user.id, program_id=program.id).first()
                    if not enroll:
                        enroll = Enrollment(student_id=user.id, program_id=program.id, status='active', enrollment_date=datetime.utcnow(), total_agreed=amount)
                        db.session.add(enroll)
                        db.session.flush()
                        
                    # Payment
                    # Date
                    p_date_str = row.get(mapping.get('date', ''), '')
                    p_date = datetime.utcnow()
                    # Parse...
                    
                    payment = Payment(
                        enrollment_id=enroll.id,
                        payment_method_id=pm_import.id,
                        amount=amount,
                        date=p_date,
                        payment_type='full', # TODO: map type
                        status='completed',
                        reference_id=f"IMP-{uuid.uuid4().hex[:6]}"
                    )
                    db.session.add(payment)
                    count_processed += 1
                    
            db.session.commit()
            flash(f'Importación completada. {count_processed} registros procesados.', 'success')
            
    except Exception as e:
        db.session.rollback()
        flash(f'Error critico en importación: {str(e)}', 'error')
        
    # Cleanup temp
    try: os.remove(path)
    except: pass
    
    return redirect(url_for('admin.operations_dashboard'))
