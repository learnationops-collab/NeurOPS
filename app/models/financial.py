from datetime import datetime
from app import db

class FinancialSale(db.Model):
    __tablename__ = 'financial_sales'
    id = db.Column(db.Integer, primary_key=True)
    email_vendedor = db.Column(db.String(150), nullable=True)
    nombre_cliente = db.Column(db.String(150), nullable=True)
    telefono = db.Column(db.String(50), nullable=True)
    mail_cliente = db.Column(db.String(150), nullable=True)
    tipo_pago = db.Column(db.String(100), nullable=True)
    monto = db.Column(db.Float, nullable=True)
    segundo_pago = db.Column(db.String(100), nullable=True)
    metodo_pago = db.Column(db.String(100), nullable=True)
    examen = db.Column(db.String(100), nullable=True)
    instagram = db.Column(db.String(100), nullable=True)
    setter = db.Column(db.String(100), nullable=True)
    # Metadatos
    raw_data = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    date = db.Column(db.DateTime, default=datetime.utcnow) # Fecha de venta oficial

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
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "date": self.date.isoformat() if self.date else None
        }

class FinancialAgenda(db.Model):
    __tablename__ = 'financial_agendas'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=True)
    registro = db.Column(db.String(100), nullable=True) # ID o fecha de registro en Sheets
    fecha_meet = db.Column(db.String(100), nullable=True) 
    whatsapp = db.Column(db.String(50), nullable=True)
    zona_geografica = db.Column(db.String(100), nullable=True)
    closer = db.Column(db.String(100), nullable=True)
    lead = db.Column(db.String(100), nullable=True) # Tipo de lead o fuente
    mail = db.Column(db.String(150), nullable=True)
    instagram = db.Column(db.String(100), nullable=True)
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
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "date": self.date.isoformat() if self.date else None
        }

