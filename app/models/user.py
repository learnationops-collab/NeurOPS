from datetime import datetime
import time
import jwt
from flask import current_app
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db, login

# Roles as Constants
ROLE_ADMIN = 'admin'
ROLE_CLOSER = 'closer'
ROLE_SETTER = 'setter'
ROLE_OPERATOR = 'operator'
ROLE_SALES_ADMIN = 'sales_admin'

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

@login.request_loader
def load_user_from_request(request):
    auth_header = request.headers.get('Authorization')
    token = None
    if auth_header:
        token = auth_header.replace('Bearer ', '', 1)
    else:
        token = request.args.get('token')
        
    if token:
        try:
            user_id = User.verify_auth_token(token)
            if user_id:
                user = User.query.get(user_id)
                return user
        except Exception as e:
            print(f"DEBUG AUTH: Error in load_user_from_request: {e}")
            return None
    return None

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20), default=ROLE_CLOSER)
    timezone = db.Column(db.String(50), default='America/La_Paz')
    is_active = db.Column(db.Boolean, default=True)
    two_chat_number = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_auth_token(self, expires_in=86400):
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
        except Exception as e:
            print(f"DEBUG AUTH: Token verification failed: {e}")
            return None

    # Relationships are now defined in Appointment model for better singular access
    availability = db.relationship('Availability', backref='closer', lazy='dynamic', cascade="all, delete-orphan")
    weekly_availability = db.relationship('WeeklyAvailability', backref='closer', lazy='dynamic', cascade="all, delete-orphan")
    
    # Adding missing cascades for other related models
    comments_authored = db.relationship('Comment', backref='author_rel', lazy='dynamic', cascade="all, delete-orphan")
    client_comments = db.relationship('ClientComment', backref='author_rel', lazy='dynamic', cascade="all, delete-orphan")
    setter_daily_stats_rel = db.relationship('SetterDailyStats', backref='user_rel', lazy='dynamic', cascade="all, delete-orphan")
    closer_daily_stats_rel = db.relationship('CloserDailyStats', backref='user_rel', lazy='dynamic', cascade="all, delete-orphan")
    view_settings = db.relationship('UserViewSetting', backref='user', lazy='dynamic', cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

class GoogleCalendarToken(db.Model):
    __tablename__ = 'google_calendar_tokens'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    token_json = db.Column(db.Text, nullable=False) 
    google_calendar_id = db.Column(db.String(255), default='primary')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('google_token', uselist=False, cascade="all, delete-orphan"))
