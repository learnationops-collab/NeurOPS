from datetime import datetime
from app import db

class WorkshopTemplate(db.Model):
    """Representa una plantilla de mensaje enviada vía ManyChat (Broadcast/Flow)"""
    __tablename__ = 'workshop_templates'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    external_id = db.Column(db.String(100), unique=True, nullable=True) # ID de ManyChat
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    buttons = db.relationship('WorkshopButton', backref='template', lazy='dynamic', cascade="all, delete-orphan")
    sends = db.relationship('WorkshopTemplateSent', backref='template', lazy='dynamic', cascade="all, delete-orphan")

class WorkshopButton(db.Model):
    """Botones interactivos dentro de una plantilla"""
    __tablename__ = 'workshop_buttons'
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('workshop_templates.id'), nullable=False)
    label = db.Column(db.String(100), nullable=False) # Texto del botón
    identifier = db.Column(db.String(100), nullable=False) # Valor que enviará ManyChat (ej: 'ver_clase_1')
    
    interactions = db.relationship('WorkshopInteraction', backref='button', lazy='dynamic', cascade="all, delete-orphan")

class WorkshopTemplateSent(db.Model):
    """Registro de envíos de plantillas (Agregado por día)"""
    __tablename__ = 'workshop_template_sends'
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('workshop_templates.id'), nullable=False)
    date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    count = db.Column(db.Integer, default=0) # Cuántas veces se envió la plantilla este día

    __table_args__ = (db.UniqueConstraint('template_id', 'date', name='_template_date_uc'),)

class WorkshopInteraction(db.Model):
    """Interacción individual de un lead con un botón de la plantilla"""
    __tablename__ = 'workshop_interactions'
    id = db.Column(db.Integer, primary_key=True)
    button_id = db.Column(db.Integer, db.ForeignKey('workshop_buttons.id'), nullable=False)
    lead_id = db.Column(db.Integer, db.ForeignKey('manychat_leads.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # El Lead puede interactuar múltiples veces o con diferentes botones
