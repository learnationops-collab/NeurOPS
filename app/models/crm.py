from datetime import datetime
from app import db

class FeatureToggle(db.Model):
    __tablename__ = 'feature_toggles'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(64), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=False)
    updated_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    updated_by = db.relationship('User')

    def to_dict(self):
        return {
            "key": self.key,
            "is_active": bool(self.is_active),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updated_by": self.updated_by.username if self.updated_by else None
        }

class Pipeline(db.Model):
    __tablename__ = 'pipelines'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    stages = db.relationship('PipelineStage', backref='pipeline', lazy='dynamic')

class PipelineStage(db.Model):
    __tablename__ = 'pipeline_stages'
    id = db.Column(db.Integer, primary_key=True)
    pipeline_id = db.Column(db.Integer, db.ForeignKey('pipelines.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

class UserSetting(db.Model):
    """La configuración de cada usuario, una fila por clave (docs/plan_notas_avisos_settings.md §2.4). Qué
    claves existen y su valor por defecto lo dice `user_settings_service.CATALOGO`."""
    __tablename__ = 'user_settings'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    clave = db.Column(db.String(64), nullable=False)
    valor = db.Column(db.JSON)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'clave', name='uq_user_settings_user_clave'),)

class Notification(db.Model):
    """Un aviso al equipo (docs/plan_notas_avisos_settings.md §2.2). Lo escribe solo `avisos_service.avisar`.
    A quién: `target_type` 'user' (id), 'rol' (nombre) o 'grupo' (lista de ids). `target_users` es de los
    avisos viejos (sin `target_type`): la campanita no los muestra."""
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(50), nullable=True, index=True)
    asunto = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    target_type = db.Column(db.String(10), nullable=True)
    target = db.Column(db.JSON, nullable=True)
    origen = db.Column(db.String(50), nullable=True)
    origen_id = db.Column(db.Integer, nullable=True)
    person_uuid = db.Column(db.String(36), db.ForeignKey('people.uuid'), nullable=True, index=True)
    payload = db.Column(db.JSON, nullable=True)
    leido_por = db.Column(db.JSON, default=list)
    target_users = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.Index('ix_notifications_origen', 'origen', 'origen_id'),)

    def __repr__(self):
        return f'<Notification {self.asunto}>'

class Comment(db.Model):
    __tablename__ = 'comments'
    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    text = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    comment_type = db.Column(db.String(50), nullable=False)
    associated_id = db.Column(db.Integer, nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)
    
    author = db.relationship('User', foreign_keys=[author_id], overlaps="comments_authored,author_rel")
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), lazy='dynamic', cascade="all, delete-orphan")

    __table_args__ = (
        db.Index('idx_comments_target', 'comment_type', 'associated_id'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "author_id": self.author_id,
            "author_name": self.author.username if self.author else "Unknown",
            "created_at": self.created_at.isoformat(),
            "type": self.comment_type,
            "associated_id": self.associated_id,
            "parent_id": self.parent_id
        }

class LeadEventLog(db.Model):
    __tablename__ = 'lead_event_logs'
    id = db.Column(db.Integer, primary_key=True)
    # Opcional desde el 26/10/2026: el contexto pasa a `origen`/`origen_id` y se borra en la etapa 2 del plan
    # (docs/plan_notas_avisos_settings.md §2.1). Mientras tanto se sigue llenando cuando hay agenda.
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True) # None si es ManyChat/sistema
    action_type = db.Column(db.String(100), nullable=False) # e.g. 'comment', 'setter_notes', 'closing_notes', 'status_changed', 'incoming_lead'
    description = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # De qué persona es y con qué se conecta (`origen`: la tabla; `origen_id`: el id). Sin FK en el origen: si
    # se borra la agenda, la entrada sigue en la persona.
    person_uuid = db.Column(db.String(36), db.ForeignKey('people.uuid'), nullable=True)
    origen = db.Column(db.String(30), nullable=True)
    origen_id = db.Column(db.Integer, nullable=True)
    payload = db.Column(db.JSON, nullable=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('lead_event_logs.id'), nullable=True)

    __table_args__ = (
        db.Index('ix_lead_event_logs_person_fecha', 'person_uuid', 'created_at'),
        db.Index('ix_lead_event_logs_origen', 'origen', 'origen_id'),
    )

    # Relationships
    user = db.relationship('User', backref=db.backref('lead_event_logs', lazy='dynamic'))
    appointment = db.relationship('Appointment', backref=db.backref('event_logs', lazy='dynamic', cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "appointment_id": self.appointment_id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else "Sistema",
            "user_role": self.user.role if self.user else "system",
            "action_type": self.action_type,
            "description": self.description,
            "created_at": self.created_at.isoformat()
        }
