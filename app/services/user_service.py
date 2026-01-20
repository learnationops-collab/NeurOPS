from app import db
from app.models import User, LeadProfile, Enrollment, Program, Payment, PaymentMethod, UserViewSetting
from app.services.base import BaseService
from datetime import datetime, timedelta
from sqlalchemy import or_

class UserService(BaseService):
    @staticmethod
    def get_users_by_role(roles):
        return User.query.filter(User.role.in_(roles)).all()

    @staticmethod
    def create_user(data):
        try:
            # Check for existing email/username
            if User.query.filter((User.email == data.get('email')) | (User.username == data.get('username'))).first():
                return UserService.error("El email o usuario ya existe.")

            user = User(
                username=data.get('username'),
                email=data.get('email'),
                role=data.get('role', 'lead')
            )
            if data.get('timezone'):
                user.timezone = data.get('timezone')
                
            password = data.get('password') or '12345678'
            user.set_password(password)
            
            db.session.add(user)
            db.session.flush() # Get ID
            
            # Create Profile if Lead/Student
            if user.role in ['lead', 'student', 'agenda']:
                profile = LeadProfile(
                    user_id=user.id,
                    phone=data.get('phone'),
                    instagram=data.get('instagram'),
                    status=data.get('status', 'new'),
                    utm_source=data.get('utm_source', 'manual')
                )
                db.session.add(profile)
            
            db.session.commit()
            return UserService.success(message=f"Usuario {user.username} creado exitosamente.", data={'user': user})
        except Exception as e:
            db.session.rollback()
            return UserService.error(f"Error al crear usuario: {str(e)}")

    @staticmethod
    def update_user(id, data):
        user = User.query.get(id)
        if not user:
            return UserService.error("Usuario no encontrado.", 404)
        
        try:
            if 'username' in data: user.username = data['username']
            if 'email' in data: user.email = data['email']
            if 'role' in data: user.role = data['role']
            if 'timezone' in data: user.timezone = data['timezone']
            if data.get('password'): user.set_password(data['password'])
            
            # Profile updates
            if user.role in ['lead', 'student', 'agenda']:
                if not user.lead_profile:
                    profile = LeadProfile(user_id=user.id)
                    db.session.add(profile)
                
                if 'phone' in data: user.lead_profile.phone = data['phone']
                if 'instagram' in data: user.lead_profile.instagram = data['instagram']
                if 'status' in data: user.lead_profile.status = data['status']

            db.session.commit()
            return UserService.success("Usuario actualizado correctamente.")
        except Exception as e:
            db.session.rollback()
            return UserService.error(f"Error al actualizar: {str(e)}")

    @staticmethod
    def delete_user(id, current_user_id):
        if id == current_user_id:
            return UserService.error("No puedes eliminar tu propio usuario.")
            
        user = User.query.get(id)
        if not user:
            return UserService.error("Usuario no encontrado.", 404)
            
        try:
            role = user.role
            db.session.delete(user)
            db.session.commit()
            return UserService.success(message=f"Usuario {user.username} eliminado.", data={'role': role})
        except Exception as e:
            db.session.rollback()
            return UserService.error(f"Error al eliminar: {str(e)}")

    @staticmethod
    def get_leads_list(filters, page=1, per_page=50):
        # Base query
        query = User.query.filter(User.role.in_(['lead', 'student', 'agenda']))
        
        # Determine joins based on filters to avoid duplicates is important?
        # SQLAlchemy handles some, but explicit joins are safer if filtering.
        
        search = filters.get('search')
        program_id = filters.get('program')
        status = filters.get('status')
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')
        sort_by = filters.get('sort_by', 'newest')

        if status:
            query = query.join(LeadProfile, User.id == LeadProfile.user_id).filter(LeadProfile.status == status)
        if program_id:
            query = query.join(Enrollment, Enrollment.student_id == User.id).filter(Enrollment.program_id == program_id)
        
        if start_date:
            s_date = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(User.created_at >= s_date)
        if end_date:
            e_date = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(User.created_at < e_date)
            
        if search:
            term = f"%{search}%"
            query = query.filter(or_(User.username.ilike(term), User.email.ilike(term)))

        # Sorting
        if sort_by == 'oldest': query = query.order_by(User.created_at.asc())
        elif sort_by == 'a-z': query = query.order_by(User.username.asc())
        elif sort_by == 'z-a': query = query.order_by(User.username.desc())
        else: query = query.order_by(User.created_at.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return pagination

    @staticmethod
    def get_leads_kpis(filters):
        # We need a fresh query to get totals for the FILTERED set
        # This re-uses logic from legacy but consolidated
        
        # Helper to apply filters to any query starting with User
        def apply_filters(q):
            search = filters.get('search')
            program_id = filters.get('program')
            status = filters.get('status')
            start_date = filters.get('start_date')
            end_date = filters.get('end_date')

            if status: q = q.join(LeadProfile, User.id == LeadProfile.user_id).filter(LeadProfile.status == status)
            if program_id: q = q.join(Enrollment, Enrollment.student_id == User.id).filter(Enrollment.program_id == program_id)
            if start_date: q = q.filter(User.created_at >= datetime.strptime(start_date, '%Y-%m-%d'))
            if end_date: q = q.filter(User.created_at < datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
            if search: q = q.filter(or_(User.username.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
            return q

        # 1. Total Users
        base_q = User.query.filter(User.role.in_(['lead', 'student', 'agenda']))
        base_q = apply_filters(base_q)
        total_users = base_q.count()

        # 2. Financials (Revenue, Cash, Debt)
        # Using joins from User -> Enrollment -> Payment
        # Need to be careful with joins scaling, but logic follows legacy
        
        # Revenue (Gross Agreed?) vs Cash Collected
        # Legacy: Cash Collected = Sum(Payment.amount) - Commissions
        
        pay_q = db.session.query(
            db.func.sum(Payment.amount),
            db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)
        ).select_from(User).join(Enrollment, Enrollment.student_id == User.id).join(Payment).join(PaymentMethod).filter(Payment.status == 'completed')
        
        pay_q = apply_filters(pay_q) 
        # Note: apply_filters works on User query context. Join structure above matches.
        
        result = pay_q.first()
        gross_collected = result[0] or 0.0
        commissions = result[1] or 0.0
        cash_collected = gross_collected - commissions
        
        # Debt Logic (Sum of Active Enrollments Debt)
        # Iterate active enrollments for filtered users?
        # SQL Sum: Sum(Agreed - Paid)
        # Rough SQL approx:
        # We need enrollments of filtered users.
        enr_q = db.session.query(Enrollment).join(User, Enrollment.student_id == User.id).filter(Enrollment.status == 'active')
        enr_q = apply_filters(enr_q)
        active_enrs = enr_q.all()
        
        total_debt = 0.0
        total_agreed = 0.0
        total_paid_debt_ctx = 0.0
        
        for enr in active_enrs:
             # Use model property if possible or raw calc
             paid = enr.total_paid
             agreed = enr.total_agreed if enr.total_agreed is not None else (enr.program.price if enr.program else 0.0)
             debt = agreed - paid
             if debt > 0:
                 total_debt += debt
                 total_agreed += agreed
                 total_paid_debt_ctx += paid
        
        projected_revenue = cash_collected + total_debt

        # 3. Status Breakdown
        status_counts = db.session.query(LeadProfile.status, db.func.count(User.id)).select_from(User).join(LeadProfile, User.id == LeadProfile.user_id).filter(User.role.in_(['lead', 'student', 'agenda']))
        status_counts = apply_filters(status_counts)
        status_counts = status_counts.group_by(LeadProfile.status).all()
        
        # 4. Program Breakdown
        program_counts = db.session.query(Program.name, db.func.count(Enrollment.id)).select_from(User).join(Enrollment, Enrollment.student_id == User.id).join(Program).filter(User.role.in_(['lead', 'student', 'agenda']))
        program_counts = apply_filters(program_counts)
        program_counts = program_counts.group_by(Program.name).all()

        return {
            'total': total_users,
            'statuses': dict(status_counts),
            'programs': dict(program_counts),
            'revenue': gross_collected, # Gross Revenue (Cash)
            'debt': total_debt,
            'commission': commissions,
            'cash_collected': cash_collected, # Net Cash
            'projected_revenue': projected_revenue,
            'debt_breakdown': {'agreed': total_agreed, 'paid': total_paid_debt_ctx}
        }
