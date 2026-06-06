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
    # Metadatos
    raw_data = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    date = db.Column(db.DateTime, default=datetime.utcnow) # Fecha de la cita oficial

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "registro": self.registro,
            "fecha_meet": self.fecha_meet,
            "whatsapp": self.whatsapp,
            "zona_geografica": self.zona_geografica,
            "closer": self.closer,
            "lead": self.lead,
            "mail": self.mail,
            "instagram": self.instagram,
            "estado": self.estado or "Pendiente",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "date": self.date.isoformat() if self.date else None
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


