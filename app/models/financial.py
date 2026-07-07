from datetime import datetime
from app import db

class FinancialSale(db.Model):
    __tablename__ = 'financial_sales'
    id = db.Column(db.Integer, primary_key=True)
    email_vendedor = db.Column(db.String(255), nullable=True)
    nombre_cliente = db.Column(db.String(255), nullable=True)
    telefono = db.Column(db.String(255), nullable=True)
    mail_cliente = db.Column(db.String(255), nullable=True)
    tipo_pago = db.Column(db.String(255), nullable=True)
    monto = db.Column(db.Float, nullable=True)
    segundo_pago = db.Column(db.String(255), nullable=True)
    metodo_pago = db.Column(db.String(255), nullable=True)
    examen = db.Column(db.String(255), nullable=True)
    instagram = db.Column(db.String(255), nullable=True)
    setter = db.Column(db.String(255), nullable=True)
    marca_temporal = db.Column(db.String(255), nullable=True)
    estado = db.Column(db.String(255), nullable=True, default="Completada", server_default="Completada")
    # Metadatos
    raw_data = db.Column(db.JSON, nullable=True)
    sold_in_call = db.Column(db.Boolean, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    date = db.Column(db.DateTime, default=datetime.utcnow) # Fecha de venta oficial (basada en marca_temporal)

    def to_dict(self):
        return {
            "id": self.id,
            "email_vendedor": self.email_vendedor,
            "nombre_cliente": self.nombre_cliente,
            "telefono": self.telefono,
            "mail_cliente": self.mail_cliente,
            "tipo_pago": self.tipo_pago,
            "monto": self.monto,
            "segundo_pago": self.segundo_pago,
            "metodo_pago": self.metodo_pago,
            "examen": self.examen,
            "instagram": self.instagram,
            "setter": self.setter,
            "marca_temporal": self.marca_temporal,
            "estado": self.estado or "Completada",
            "sold_in_call": self.sold_in_call,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "date": self.date.isoformat() if self.date else None
        }

class FinancialAgenda(db.Model):
    __tablename__ = 'financial_agendas'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=True)
    registro = db.Column(db.String(255), nullable=True) 
    fecha_meet = db.Column(db.String(255), nullable=True) 
    whatsapp = db.Column(db.String(255), nullable=True)
    zona_geografica = db.Column(db.String(255), nullable=True)
    closer = db.Column(db.String(255), nullable=True)
    lead = db.Column(db.String(255), nullable=True) 
    mail = db.Column(db.String(255), nullable=True)
    instagram = db.Column(db.String(255), nullable=True)
    estado = db.Column(db.String(255), nullable=True, default="Pendiente", server_default="Pendiente")
    encargado_triage = db.Column(db.String(255), nullable=True)
    # Metadatos
    raw_data = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    date = db.Column(db.DateTime, default=datetime.utcnow) # Fecha de la cita oficial

    def to_dict(self, sales_count=None):
        if sales_count is None:
            # Fallback optimizado sin funciones de base de datos sobre las columnas para permitir uso de indices
            sales_count = 0
            ig_clean = self.instagram.strip().replace('@', '').lower() if self.instagram and self.instagram.lower() not in ('n/a', '') else None
            mail_clean = self.mail.strip().lower() if self.mail and self.mail.lower() not in ('n/a', '') else None
            
            filters = []
            if ig_clean:
                # Usar ilike para evitar full table scans en SQLite/PostgreSQL
                filters.append(FinancialSale.instagram.ilike(f"%{ig_clean}%"))
            if mail_clean:
                filters.append(FinancialSale.mail_cliente.ilike(mail_clean))
                
            if filters:
                from sqlalchemy import or_
                sales_count = FinancialSale.query.filter(or_(*filters)).count()

        # Determinar el estado dinámico de closing
        display_estado = self.estado or "Pendiente"
        has_closer = self.closer and self.closer.strip() and self.closer.strip().lower() != 'sin asignar'
        if has_closer:
            # Buscar la cita correspondiente para extraer closer_result
            from app.models import Client, Appointment
            from sqlalchemy import or_, func
            
            ig_clean = self.instagram.strip().replace('@', '').lower() if self.instagram and self.instagram.lower() not in ('n/a', '') else None
            mail_clean = self.mail.strip().lower() if self.mail and self.mail.lower() not in ('n/a', '') else None
            
            client_filters = []
            if ig_clean:
                client_filters.append(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean)
            if mail_clean:
                client_filters.append(func.lower(Client.email) == mail_clean)
                
            client = None
            if client_filters:
                client = Client.query.filter(or_(*client_filters)).first()
                
            if client and self.date:
                start_of_day = datetime.combine(self.date.date(), datetime.min.time())
                end_of_day = datetime.combine(self.date.date(), datetime.max.time())
                
                appt = Appointment.query.filter(
                    Appointment.client_id == client.id,
                    Appointment.start_time >= start_of_day,
                    Appointment.start_time <= end_of_day
                ).first()
                
                if appt:
                    closer_res = appt.closer_result
                    if closer_res:
                        if closer_res == 'Show up':
                            display_estado = 'Show Up'
                        elif closer_res == 'No Show':
                            display_estado = 'No Show'
                        elif closer_res == 'Cancelado':
                            display_estado = 'Cancelada'
                        elif closer_res == 'Reagendado':
                            display_estado = 'Reagendada'
                        elif closer_res == '2da call':
                            display_estado = '2TH Call'
                        else:
                            display_estado = closer_res
                    else:
                        display_estado = 'Pendiente'
                else:
                    display_estado = 'Pendiente'
            else:
                display_estado = 'Pendiente'

        return {
            "id": self.id,
            "nombre": self.nombre,
            "registro": self.registro or (self.created_at.isoformat() if self.created_at else None),
            "fecha_meet": self.fecha_meet,
            "whatsapp": self.whatsapp,
            "zona_geografica": self.zona_geografica,
            "closer": self.closer,
            "lead": self.lead,
            "mail": self.mail,
            "instagram": self.instagram,
            "estado": self.estado or "Pendiente",
            "closer_result": display_estado,
            "encargado_triage": self.encargado_triage,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "date": self.date.isoformat() if self.date else None,
            "sales_count": sales_count,
            "has_sale": sales_count > 0
        }

class ExcludedSale(db.Model):
    __tablename__ = 'excluded_sales'
    id = db.Column(db.Integer, primary_key=True)
    marca_temporal = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "marca_temporal": self.marca_temporal,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class TeamMember(db.Model):
    __tablename__ = 'team_members'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(255), nullable=False)
    salary_type = db.Column(db.String(50), nullable=False, default='fijo')  # 'fijo' or 'variable'
    base_salary = db.Column(db.Float, default=0.0)
    payment_method = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "salary_type": self.salary_type,
            "base_salary": self.base_salary,
            "payment_method": self.payment_method,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class MonthlyPayroll(db.Model):
    __tablename__ = 'monthly_payroll'
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('team_members.id'), nullable=False)
    month = db.Column(db.String(7), nullable=False)  # YYYY-MM
    base_salary = db.Column(db.Float, default=0.0)
    commissions = db.Column(db.Float, default=0.0)
    bonuses = db.Column(db.Float, default=0.0)
    payment_method = db.Column(db.String(255), nullable=True)
    is_paid = db.Column(db.Boolean, default=False)
    paid_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    member = db.relationship('TeamMember', backref=db.backref('payroll_payments', lazy='dynamic', cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "member_id": self.member_id,
            "member_name": self.member.name if self.member else "Eliminado",
            "month": self.month,
            "base_salary": self.base_salary,
            "commissions": self.commissions,
            "bonuses": self.bonuses,
            "payment_method": self.payment_method,
            "is_paid": self.is_paid,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class MonthlyPaymentMethodBalance(db.Model):
    __tablename__ = 'monthly_payment_method_balances'
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.String(7), nullable=False)  # YYYY-MM
    payment_method = db.Column(db.String(255), nullable=False)  # e.g., 'Stripe', 'AirTM', etc.
    actual_amount = db.Column(db.Float, default=0.0)  # Lo que hay
    expected_amount = db.Column(db.Float, default=0.0)  # Lo que debe haber
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('month', 'payment_method', name='_month_pm_uc'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "month": self.month,
            "payment_method": self.payment_method,
            "actual_amount": self.actual_amount,
            "expected_amount": self.expected_amount
        }

class MonthlySaving(db.Model):
    __tablename__ = 'monthly_savings'
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.String(7), unique=True, nullable=False)  # YYYY-MM
    savings = db.Column(db.Float, default=0.0)  # Ahorros
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "month": self.month,
            "savings": self.savings
        }


