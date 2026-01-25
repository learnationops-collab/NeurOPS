from datetime import datetime
from app import db, login
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

# Roles as Constants
ROLE_ADMIN = 'admin'
ROLE_CLOSER = 'closer'

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20), default=ROLE_CLOSER)
    timezone = db.Column(db.String(50), default='America/La_Paz')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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

class Event(db.Model):
    __tablename__ = 'events'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    utm_source = db.Column(db.String(64), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    duration_minutes = db.Column(db.Integer, default=30)
    buffer_minutes = db.Column(db.Integer, default=15)

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

class Appointment(db.Model):
    __tablename__ = 'appointments'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    start_time = db.Column(db.DateTime, index=True)
    status = db.Column(db.String(20), default='scheduled')
    origin = db.Column(db.String(100)) # VSL, Closer, etc.
    appointment_type = db.Column(db.String(50), default='Primera agenda')
    is_pinned = db.Column(db.Boolean, default=False)

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

class DailyReportAnswer(db.Model):
    __tablename__ = 'daily_report_answers'
    id = db.Column(db.Integer, primary_key=True)
    daily_stats_id = db.Column(db.Integer, db.ForeignKey('closer_daily_stats.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('daily_report_questions.id'), nullable=False)
    answer = db.Column(db.Text)
    
    question = db.relationship('DailyReportQuestion')
    daily_stats = db.relationship('CloserDailyStats', backref=db.backref('answers', lazy='dynamic'))

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

# Removed ClientComment as user said "No crees todavía la tabla para comentarios, lo vamos a hacer luego"
