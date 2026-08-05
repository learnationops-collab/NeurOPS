from datetime import datetime
from app import db

class Client(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120))
    email = db.Column(db.String(120), index=True, unique=True)
    phone = db.Column(db.String(20))
    instagram = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    objeciones = db.Column(db.Text, nullable=True) # Objeciones del prospecto
    observaciones = db.Column(db.Text, nullable=True) # Notas de triage / calificacion
    dolores = db.Column(db.Text, nullable=True) # Dolores del prospecto
    form_data = db.Column(db.JSON, nullable=True) # Datos del formulario de calificacion externa
    follow_up_status = db.Column(db.String(50), nullable=True, default='Por contactar')
    # Total a pagar por el cliente (ya no por programa/Enrollment: un solo total por cliente).
    # Se autoasigna por programa al registrar el primer pago (AL 1000 / RR 1500 / SI 2000) y
    # queda editable en cada pago siguiente — ver SalesConsistencyService.PROGRAM_DEFAULT_TOTALS.
    total_amount = db.Column(db.Float, nullable=True)

    # Relationships
    enrollments = db.relationship('Enrollment', backref='client', lazy='dynamic', cascade="all, delete-orphan")
    appointments = db.relationship('Appointment', backref='client', lazy='dynamic', cascade="all, delete-orphan")
    survey_answers = db.relationship('SurveyAnswer', backref='client', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Client {self.full_name or self.email}>'

class Lead(db.Model):
    __tablename__ = 'leads'
    id = db.Column(db.Integer, primary_key=True)
    manychat_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    instagram_username = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    stage_id = db.Column(db.Integer, db.ForeignKey('pipeline_stages.id'), nullable=True)
    ad_source = db.Column(db.String(255), nullable=True)
    tags = db.Column(db.JSON, default=[])
    notes = db.Column(db.Text, nullable=True)
    funnel_step = db.Column(db.String(255), nullable=True)  # Paso del funnel (ManyChat)
    last_stage = db.Column(db.Integer, nullable=True)       # Última etapa numérica (ManyChat)

    stage = db.relationship('PipelineStage', backref='leads')

    def __repr__(self):
        return f'<Lead {self.name} ({self.manychat_id})>'

class ClientComment(db.Model):
    __tablename__ = 'client_comments'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CommentNotification(db.Model):
    __tablename__ = 'comment_notifications'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    comment_id = db.Column(db.Integer, db.ForeignKey('client_comments.id'), nullable=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    client = db.relationship('Client', backref=db.backref('comment_notifications', lazy='dynamic', cascade='all, delete-orphan'))
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('received_notifications', lazy='dynamic'))
    sender = db.relationship('User', foreign_keys=[sender_id], backref=db.backref('sent_notifications', lazy='dynamic'))
    comment = db.relationship('ClientComment', backref=db.backref('notifications', lazy='dynamic', cascade='all, delete-orphan'))
