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
        program_id = filters.get('program')
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')
        sort_by = filters.get('sort_by', 'newest')
        closer_id = filters.get('closer_id')

        if program_id:
            query = query.join(Enrollment).filter(Enrollment.program_id == program_id)
        
        if closer_id:
            # Join with Appointment or Enrollment to filter by closer
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
            program_id = filters.get('program')
            closer_id = filters.get('closer_id')
            start_date = filters.get('start_date')
            end_date = filters.get('end_date')

            if program_id: q = q.join(Enrollment).filter(Enrollment.program_id == program_id)
            if closer_id: 
                q = q.filter(or_(
                    Client.appointments.any(Appointment.closer_id == closer_id),
                    Client.enrollments.any(Enrollment.closer_id == closer_id)
                ))
            if start_date: q = q.filter(Client.created_at >= datetime.strptime(start_date, '%Y-%m-%d'))
            if end_date: q = q.filter(Client.created_at < datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
            if search: q = q.filter(or_(Client.full_name.ilike(f"%{search}%"), Client.email.ilike(f"%{search}%")))
            return q

        base_q = Client.query
        base_q = apply_filters(base_q)
        total_clients = base_q.count()

        pay_q = db.session.query(
            db.func.sum(Payment.amount),
            db.func.sum((Payment.amount * (PaymentMethod.commission_percent / 100.0)) + PaymentMethod.commission_fixed)
        ).select_from(Client).join(Enrollment).join(Payment).join(PaymentMethod).filter(Payment.status == 'completed')
        pay_q = apply_filters(pay_q) 
        result = pay_q.first()
        gross_collected = result[0] or 0.0
        cash_collected = gross_collected - (result[1] or 0.0)
        
        enrs = apply_filters(Enrollment.query.join(Client)).all()
        total_debt = 0.0
        for enr in enrs:
             debt = (enr.program.price if enr.program else 0.0) - enr.total_paid
             if debt > 0: total_debt += debt
        
        program_counts = db.session.query(Program.name, db.func.count(Enrollment.id)).select_from(Client).join(Enrollment).join(Program)
        program_counts = apply_filters(program_counts).group_by(Program.name).all()

        return {
            'total': total_clients,
            'programs': dict(program_counts),
            'revenue': gross_collected,
            'debt': total_debt,
            'cash_collected': cash_collected,
            'projected_revenue': cash_collected + total_debt
        }
