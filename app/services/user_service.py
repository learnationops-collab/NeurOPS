from app import db
from app.models import User, Client, Enrollment, Program, Payment, PaymentMethod, Appointment
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
            if User.query.filter((User.email == data.get('email')) | (User.username == data.get('username'))).first():
                return UserService.error("El email o usuario ya existe.")

            user = User(
                username=data.get('username'),
                email=data.get('email'),
                role=data.get('role', 'closer')
            )
            if data.get('timezone'): user.timezone = data.get('timezone')
            user.set_password(data.get('password') or '12345678')
            
            db.session.add(user)
            db.session.commit()
            return UserService.success(message=f"Usuario {user.username} creado exitosamente.", data={'user': user})
        except Exception as e:
            db.session.rollback()
            return UserService.error(f"Error al crear usuario: {str(e)}")

    @staticmethod
    def create_client(data):
        try:
            if Client.query.filter_by(email=data.get('email')).first():
                return UserService.error("El email del cliente ya existe.")
            
            client = Client(
                full_name=data.get('full_name'),
                email=data.get('email'),
                phone=data.get('phone'),
                instagram=data.get('instagram')
            )
            db.session.add(client)
            db.session.commit()
            return UserService.success(message=f"Cliente {client.full_name} creado exitosamente.", data={'client': client})
        except Exception as e:
            db.session.rollback()
            return UserService.error(f"Error al crear cliente: {str(e)}")

    @staticmethod
    def update_user(id, data):
        user = User.query.get(id)
        if not user: return UserService.update_client(id, data)
        try:
            if 'username' in data: user.username = data['username']
            if 'email' in data: user.email = data['email']
            if 'role' in data: user.role = data['role']
            if 'timezone' in data: user.timezone = data['timezone']
            if data.get('password'): user.set_password(data['password'])
            db.session.commit()
            return UserService.success("Usuario actualizado correctamente.")
        except Exception as e:
            db.session.rollback()
            return UserService.error(f"Error al actualizar: {str(e)}")

    @staticmethod
    def update_client(id, data):
        client = Client.query.get(id)
        if not client: return UserService.error("Cliente no encontrado.", 404)
        try:
            if 'full_name' in data: client.full_name = data['full_name']
            if 'email' in data: client.email = data['email']
            if 'phone' in data: client.phone = data['phone']
            if 'instagram' in data: client.instagram = data['instagram']
            db.session.commit()
            return UserService.success("Cliente actualizado correctamente.")
        except Exception as e:
            db.session.rollback()
            return UserService.error(f"Error al actualizar: {str(e)}")

    @staticmethod
    def delete_user(id, current_user_id):
        if id == current_user_id: return UserService.error("No puedes eliminar tu propio usuario.")
        user = User.query.get(id)
        if not user:
            client = Client.query.get(id)
            if client:
                db.session.delete(client)
                db.session.commit()
                return UserService.success("Cliente eliminado.")
            return UserService.error("No encontrado.", 404)
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
        query = Client.query
        search = filters.get('search')
        program_filter = filters.get('program')
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')
        sort_by = filters.get('sort_by', 'newest')
        closer_id = filters.get('closer_id')

        # Join if filtering by program
        if program_filter:
            programs = program_filter.split(',')
            if programs:
                query = query.join(Enrollment).join(Program).filter(Program.name.in_(programs))
        
        if closer_id:
            query = query.filter(or_(
                Client.appointments.any(Appointment.closer_id == closer_id),
                Client.enrollments.any(Enrollment.closer_id == closer_id)
            ))
        
        if start_date: query = query.filter(Client.created_at >= datetime.strptime(start_date, '%Y-%m-%d'))
        if end_date: query = query.filter(Client.created_at < datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
        if search:
            term = f"%{search}%"
            query = query.filter(or_(Client.full_name.ilike(term), Client.email.ilike(term)))

        if sort_by == 'oldest': query = query.order_by(Client.created_at.asc())
        elif sort_by == 'a-z': query = query.order_by(Client.full_name.asc())
        elif sort_by == 'z-a': query = query.order_by(Client.full_name.desc())
        else: query = query.order_by(Client.created_at.desc())

        return query.paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def get_leads_kpis(filters):
        def apply_filters(q):
            search = filters.get('search')
            program_filter = filters.get('program')
            closer_id = filters.get('closer_id')
            start_date = filters.get('start_date')
            end_date = filters.get('end_date')

            if program_filter:
                programs = program_filter.split(',')
                if programs:
                    # Check if already joined
                    # SQLAlchemy constructs are smart, but safer to robustly join
                    # Assuming q is based on Client or joined with it
                    # We need to act differently based on q source
                    # For simplicity, assuming q starts with Client
                    pass # We need robust check inside main logic
            
            # Since apply_filters is helper, let's just inline logic or simplify
            # Re-implementing specific filter block per query type below is safer
            return q

        # Separate logic for complex joins
        base_q = Client.query
        
        # Apply standard filters to base_q
        search = filters.get('search')
        program_filter = filters.get('program')
        closer_id = filters.get('closer_id')
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')

        if program_filter:
            programs = program_filter.split(',')
            if programs:
                base_q = base_q.join(Enrollment).join(Program).filter(Program.name.in_(programs))
        
        if closer_id:
            base_q = base_q.filter(or_(
                Client.appointments.any(Appointment.closer_id == closer_id),
                Client.enrollments.any(Enrollment.closer_id == closer_id)
            ))
        if start_date: base_q = base_q.filter(Client.created_at >= datetime.strptime(start_date, '%Y-%m-%d'))
        if end_date: base_q = base_q.filter(Client.created_at < datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
        if search: base_q = base_q.filter(or_(Client.full_name.ilike(f"%{search}%"), Client.email.ilike(f"%{search}%")))
        
        total_clients = base_q.count()

        # Revenue Query
        pay_q = db.session.query(
            db.func.sum(Payment.amount),
            db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)
        ).select_from(Client).join(Enrollment).join(Payment).join(PaymentMethod).filter(Payment.status == 'completed')
        
        # Apply same filters to pay_q
        if program_filter:
            programs = program_filter.split(',')
            # We already join Enrollment/Program in base query logic, but pay_q is fresh
            # Should reuse logic.
            pay_q = pay_q.join(Program).filter(Program.name.in_(programs)) # Program is joined via Enrollment usually
        
        if closer_id:
             pay_q = pay_q.filter(or_(
                Client.appointments.any(Appointment.closer_id == closer_id),
                Client.enrollments.any(Enrollment.closer_id == closer_id)
            ))
        if start_date: pay_q = pay_q.filter(Client.created_at >= datetime.strptime(start_date, '%Y-%m-%d'))
        if end_date: pay_q = pay_q.filter(Client.created_at < datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
        if search: pay_q = pay_q.filter(or_(Client.full_name.ilike(f"%{search}%"), Client.email.ilike(f"%{search}%")))

        result = pay_q.first()
        gross_collected = result[0] or 0.0
        cash_collected = gross_collected - (result[1] or 0.0)
        
        # Debt Query? Simple approach: fetch clients and iterate
        # Optimization: Don't iterate all if too many. 
        # But for debt calculation we need all.
        # Let's use base_q.all() if feasible or aggregate in sql
        clients = base_q.all()
        total_debt = 0.0
        for c in clients:
            for enr in c.enrollments:
                debt = (enr.program.price if enr.program else 0.0) - enr.total_paid
                if debt > 0: total_debt += debt
        
        # Program Counts
        program_counts_q = db.session.query(Program.name, db.func.count(Enrollment.id)).select_from(Client).join(Enrollment).join(Program)
        # Apply filters
        if program_filter:
            programs = program_filter.split(',')
            program_counts_q = program_counts_q.filter(Program.name.in_(programs))
        if closer_id:
            program_counts_q = program_counts_q.filter(or_(
                Client.appointments.any(Appointment.closer_id == closer_id),
                Client.enrollments.any(Enrollment.closer_id == closer_id)
            ))
        if start_date: program_counts_q = program_counts_q.filter(Client.created_at >= datetime.strptime(start_date, '%Y-%m-%d'))
        if end_date: program_counts_q = program_counts_q.filter(Client.created_at < datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
        if search: program_counts_q = program_counts_q.filter(or_(Client.full_name.ilike(f"%{search}%"), Client.email.ilike(f"%{search}%")))
        
        program_counts = program_counts_q.group_by(Program.name).all()

        return {
            'total': total_clients,
            'programs': dict(program_counts),
            'revenue': gross_collected,
            'debt': total_debt,
            'cash_collected': cash_collected,
            'projected_revenue': cash_collected + total_debt
        }
