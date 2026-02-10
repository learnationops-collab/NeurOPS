from datetime import datetime
import time
import jwt
from flask import current_app, request
from app import db, login
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

@login.request_loader
def load_user_from_request(request):
    # 1. Check Authorization Header (Bearer Token)
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            auth_header = auth_header.replace('Bearer ', '', 1)
            user_id = User.verify_auth_token(auth_header)
            if user_id:
                return User.query.get(user_id)
        except Exception:
            return None

    # 2. Check Session (Cookie) - Handled automatically by Flask-Login user_loader usually
    return None

# Roles as Constants
ROLE_ADMIN = 'admin'
ROLE_CLOSER = 'closer'
ROLE_SETTER = 'setter'
ROLE_OPERATOR = 'operator'

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20), default=ROLE_CLOSER)
    timezone = db.Column(db.String(50), default='America/La_Paz')
    is_active = db.Column(db.Boolean, default=True)
    two_chat_number = db.Column(db.String(20), nullable=True) # Número vinculado para 2Chat
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_auth_token(self, expires_in=86400):
        # Generate a JWT token
        return jwt.encode(
            {'id': self.id, 'exp': time.time() + expires_in},
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
        )

    @staticmethod
    def verify_auth_token(token):
        try:
            data = jwt.decode(
                token,
                current_app.config['SECRET_KEY'],
                algorithms=['HS256']
            )
            return data['id']
        except Exception:
            return None

    # Relationships for Closers

    # Relationships for Closers
    appointments_as_closer = db.relationship('Appointment', foreign_keys='Appointment.closer_id', backref='closer', lazy='dynamic')
    availability = db.relationship('Availability', backref='closer', lazy='dynamic', cascade="all, delete-orphan")
    weekly_availability = db.relationship('WeeklyAvailability', backref='closer', lazy='dynamic', cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

class Client(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120))
    email = db.Column(db.String(120), index=True, unique=True)
    phone = db.Column(db.String(20))
    instagram = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    enrollments = db.relationship('Enrollment', backref='client', lazy='dynamic', cascade="all, delete-orphan")
    appointments = db.relationship('Appointment', backref='client', lazy='dynamic', cascade="all, delete-orphan")
    survey_answers = db.relationship('SurveyAnswer', backref='client', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Client {self.full_name or self.email}>'

# Association Table for Many-to-Many Event <-> Closer
event_closers = db.Table('event_closers',
    db.Column('event_id', db.Integer, db.ForeignKey('events.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True)
)

class EventGroup(db.Model):
    __tablename__ = 'event_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    events = db.relationship('Event', backref='group', lazy='dynamic')

    def __repr__(self):
        return f'<EventGroup {self.name}>'

class Event(db.Model):
    __tablename__ = 'events'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    utm_source = db.Column(db.String(64), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    duration_minutes = db.Column(db.Integer, default=30)
    buffer_minutes = db.Column(db.Integer, default=15)
    group_id = db.Column(db.Integer, db.ForeignKey('event_groups.id'))
    funnel_steps = db.Column(db.JSON)
    min_score = db.Column(db.Integer, default=0)
    redirect_url_fail = db.Column(db.String(255))
    redirect_url_success = db.Column(db.String(255))

    # Many-to-Many with Closers
    closers = db.relationship('User', secondary=event_closers, lazy='subquery',
        backref=db.backref('assigned_events', lazy=True))

    def __repr__(self):
        return f'<Event {self.name}>'

class Program(db.Model):
    __tablename__ = 'programs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    price = db.Column(db.Float, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    enrollments = db.relationship('Enrollment', backref='program', lazy='dynamic')

    def __repr__(self):
        return f'<Program {self.name}>'

class Enrollment(db.Model):
    __tablename__ = 'enrollments'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=False)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    enrollment_date = db.Column(db.DateTime, default=datetime.utcnow)

    payments = db.relationship('Payment', backref='enrollment', lazy='dynamic', cascade="all, delete-orphan")
    
    closer_rel = db.relationship('User', foreign_keys=[closer_id], backref='sales_made')

    @property
    def total_paid(self):
        completed_payments = self.payments.filter_by(status='completed').all()
        return sum(p.amount for p in completed_payments)

class PaymentMethod(db.Model):
    __tablename__ = 'payment_methods'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    commission_percent = db.Column(db.Float, default=0.0)
    commission_fixed = db.Column(db.Float, default=0.0)
    is_active = db.Column(db.Boolean, default=True)
    
    payments = db.relationship('Payment', backref='method', lazy='dynamic')

class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_methods.id'), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    payment_type = db.Column(db.String(20)) # Primer Pago, Renovación, Pago Completo, Cuota, Seña
    status = db.Column(db.String(20), default='completed')

    payment_method = db.relationship('PaymentMethod', overlaps="method,payments")

class Appointment(db.Model):
    __tablename__ = 'appointments'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    setter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # New field
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    start_time = db.Column(db.DateTime, index=True)
    origin = db.Column(db.String(100)) # VSL, Closer, etc.
    is_pinned = db.Column(db.Boolean, default=False)
    google_event_id = db.Column(db.String(255))
    last_stage = db.Column(db.String(100))
    result = db.Column(db.String(100))
    linked_call = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Availability(db.Model):
    __tablename__ = 'availability'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False) 
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)

class WeeklyAvailability(db.Model):
    __tablename__ = 'weekly_availability'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False) 
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

class SurveyQuestion(db.Model):
    __tablename__ = 'survey_questions'
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(255), nullable=False)
    question_type = db.Column(db.String(50), default='text')
    options = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    mapping_field = db.Column(db.String(50), nullable=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('event_groups.id'), nullable=True)
    is_global = db.Column(db.Boolean, default=False)
    step = db.Column(db.String(20), default='first_survey') # 'first_survey', 'second_survey'
    
    event = db.relationship('Event', backref='questions')
    group = db.relationship('EventGroup', backref='group_questions')

class SurveyAnswer(db.Model):
    __tablename__ = 'survey_answers'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False) 
    question_id = db.Column(db.Integer, db.ForeignKey('survey_questions.id'), nullable=False)
    answer = db.Column(db.Text)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'))
    
    question = db.relationship('SurveyQuestion')
    appointment = db.relationship('Appointment', backref='survey_answers')

class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    category = db.Column(db.String(50), default='variable')
    is_recurring = db.Column(db.Boolean, default=False)

class RecurringExpense(db.Model):
    __tablename__ = 'recurring_expenses'
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    day_of_month = db.Column(db.Integer, default=1)
    is_active = db.Column(db.Boolean, default=True)

class DailyReportQuestion(db.Model):
    __tablename__ = 'daily_report_questions'
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(255), nullable=False)
    question_type = db.Column(db.String(50), default='text')
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    role = db.Column(db.String(20), default='closer') # 'closer' o 'setter'

class DailyReportAnswer(db.Model):
    __tablename__ = 'daily_report_answers'
    id = db.Column(db.Integer, primary_key=True)
    daily_stats_id = db.Column(db.Integer, db.ForeignKey('closer_daily_stats.id'), nullable=True) # Opcional si es setter
    setter_stats_id = db.Column(db.Integer, db.ForeignKey('setter_daily_stats.id'), nullable=True) # Nuevo vínculo para setter
    question_id = db.Column(db.Integer, db.ForeignKey('daily_report_questions.id'), nullable=False)
    answer = db.Column(db.Text)
    
    question = db.relationship('DailyReportQuestion')
    daily_stats = db.relationship('CloserDailyStats', backref=db.backref('answers', lazy='dynamic'))
    setter_stats = db.relationship('SetterDailyStats', backref=db.backref('answers', lazy='dynamic'))

class SetterDailyStats(db.Model):
    __tablename__ = 'setter_daily_stats'
    id = db.Column(db.Integer, primary_key=True)
    setter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    
    inbound_leads = db.Column(db.Integer, default=0) # Entrantes
    openings = db.Column(db.Integer, default=0) # Aperturas
    not_lead = db.Column(db.Integer, default=0) # No Lead
    new_offers = db.Column(db.Integer, default=0) # New_offer
    links_sent = db.Column(db.Integer, default=0) # Links
    appointments_booked = db.Column(db.Integer, default=0) # Agendas
    follow_ups = db.Column(db.Integer, default=0) # Seguimientos
    
    setter = db.relationship('User', backref=db.backref('setter_daily_stats', lazy='dynamic'))
    __table_args__ = (db.UniqueConstraint('setter_id', 'date', name='_setter_date_uc'),)

class CloserDailyStats(db.Model):
    __tablename__ = 'closer_daily_stats'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    
    calls_scheduled = db.Column(db.Integer, default=0)
    calls_completed = db.Column(db.Integer, default=0)
    calls_no_show = db.Column(db.Integer, default=0)
    calls_canceled = db.Column(db.Integer, default=0)
    
    sales_count = db.Column(db.Integer, default=0)
    sales_amount = db.Column(db.Float, default=0.0)
    cash_collected = db.Column(db.Float, default=0.0)
    
    slots_defined = db.Column(db.Integer, default=0)
    self_generated_bookings = db.Column(db.Integer, default=0)  
    
    closer = db.relationship('User', backref=db.backref('daily_stats', lazy='dynamic'))
    __table_args__ = (db.UniqueConstraint('closer_id', 'date', name='_closer_date_uc'),)

class GoogleCalendarToken(db.Model):
    __tablename__ = 'google_calendar_tokens'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    token_json = db.Column(db.Text, nullable=False) 
    google_calendar_id = db.Column(db.String(255), default='primary')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('google_token', uselist=False, cascade="all, delete-orphan"))

class Integration(db.Model):
    __tablename__ = 'integrations'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=True)
    url_dev = db.Column(db.String(255), nullable=True)
    url_prod = db.Column(db.String(255), nullable=True)
    active_env = db.Column(db.String(20), default='dev')
    payload_config = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "name": self.name,
            "url_dev": self.url_dev,
            "url_prod": self.url_prod,
            "active_env": self.active_env,
            "payload_config": self.payload_config
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

class UserViewSetting(db.Model):
    __tablename__ = 'user_view_settings'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    view_name = db.Column(db.String(64), nullable=False)
    settings = db.Column(db.JSON)

class Campaign(db.Model):
    __tablename__ = 'campaigns'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    external_id = db.Column(db.String(100), unique=True)
    type = db.Column(db.String(20)) # Pago, Orgánico
    traffic = db.Column(db.String(50))
    funnel_type = db.Column(db.String(50))
    objective = db.Column(db.String(100))
    status = db.Column(db.String(20))
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    ad_sets = db.relationship('AdSet', backref='campaign', lazy='dynamic', cascade="all, delete-orphan")

class AdSet(db.Model):
    __tablename__ = 'ad_sets'
    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaigns.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    external_id = db.Column(db.String(100), unique=True)
    audience = db.Column(db.String(200))
    conversion_event = db.Column(db.String(100))
    status = db.Column(db.String(20))
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    ads = db.relationship('Ad', backref='ad_set', lazy='dynamic', cascade="all, delete-orphan")

class MarketingBudget(db.Model):
    __tablename__ = 'marketing_budgets'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    budget = db.Column(db.Float, default=0.0)
    spent = db.Column(db.Float, default=0.0)
    source = db.Column(db.String(50))

class ClientComment(db.Model):
    __tablename__ = 'client_comments'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Ad(db.Model):
    __tablename__ = 'ads'
    id = db.Column(db.Integer, primary_key=True)
    ad_set_id = db.Column(db.Integer, db.ForeignKey('ad_sets.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    external_id = db.Column(db.String(100), unique=True)
    keyword = db.Column(db.String(100))
    stage = db.Column(db.String(50))
    status = db.Column(db.String(20))
    details = db.Column(db.Text)
    total_spend = db.Column(db.Float, default=0.0)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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
    notes = db.Column(db.Text, nullable=True) # Para guardar el comentario inicial

    stage = db.relationship('PipelineStage', backref='leads')

    def __repr__(self):
        return f'<Lead {self.name} ({self.manychat_id})>'

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    subject = db.Column(db.String(100), nullable=False) # Asunto
    content = db.Column(db.Text, nullable=False) # Content
    read_by = db.Column(db.JSON, default=[]) # List of user IDs (JSON)
    target_users = db.Column(db.JSON, default="all") # "all", "role:admin", or list of user IDs
    related_users = db.Column(db.JSON, default=[]) # List of related user IDs
    created_at = db.Column(db.DateTime, default=datetime.utcnow) # Fecha de creacion

    def __repr__(self):
        return f'<Notification {self.subject}>'

class Comment(db.Model):
    __tablename__ = 'comments'
    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    text = db.Column(db.String(500), nullable=False) # Límite razonable
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    comment_type = db.Column(db.String(50), nullable=False) # 'appointment', 'lead', etc.
    associated_id = db.Column(db.Integer, nullable=False)
    
    author = db.relationship('User', backref='comments_authored')

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
            "associated_id": self.associated_id
        }

