from datetime import datetime
import time
import jwt
from flask import current_app, g
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db, login

# Roles as Constants
ROLE_ADMIN = 'admin'
ROLE_CLOSER = 'closer'
ROLE_SETTER = 'setter'
ROLE_OPERATOR = 'operator'
ROLE_TRIAGE = 'triage'
ROLE_DIRECTOR_COMERCIAL = 'director_comercial'
ROLE_DIRECTOR_MARKETING = 'director_marketing'

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
            payload = User.decode_auth_token(token)
            if payload:
                user = User.query.get(payload.get('id'))
                if user:
                    # Guardado en g (vida = un solo request) para que get_impersonation_state()
                    # pueda leer is_impersonating/original_user_* de ESTE token en vez de la
                    # sesión de cookie compartida por todo el navegador - ver TokenPriorityLoginManager
                    # en app/__init__.py para por qué este token manda sobre esa cookie.
                    g.token_claims = payload
                return user
        except Exception as e:
            print(f"DEBUG AUTH: Error in load_user_from_request: {e}")
            return None
    return None


def get_impersonation_state():
    """
    (is_impersonating, original_user_id, original_user_role) del usuario actual.

    Si el request se autenticó con un JWT propio (pestaña abierta vía "Simular en pestaña
    nueva"), el estado sale de las claims de ESE token, no de la sesión de cookie compartida
    por todas las pestañas del navegador - así cada pestaña simulada mantiene su propia
    identidad sin pisar a las demás. Si no hay token (flujo clásico de cookie), cae a
    flask.session como siempre.
    """
    claims = getattr(g, 'token_claims', None)
    if claims is not None:
        return (
            bool(claims.get('is_impersonating')),
            claims.get('original_user_id'),
            claims.get('original_user_role'),
        )
    from flask import session
    return (
        bool(session.get('is_impersonating')),
        session.get('original_user_id'),
        session.get('original_user_role'),
    )

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
    can_view_finance = db.Column(db.Boolean, default=False, server_default="0")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_auth_token(self, expires_in=86400, **extra_claims):
        payload = {'id': self.id, 'exp': time.time() + expires_in}
        payload.update(extra_claims)
        return jwt.encode(
            payload,
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
        )

    @staticmethod
    def decode_auth_token(token):
        try:
            return jwt.decode(
                token,
                current_app.config['SECRET_KEY'],
                algorithms=['HS256']
            )
        except Exception:
            return None

    @staticmethod
    def verify_auth_token(token):
        payload = User.decode_auth_token(token)
        return payload.get('id') if payload else None

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

class CloserAlias(db.Model):
    __tablename__ = 'closer_aliases'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    alias_name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('aliases', lazy='dynamic', cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else "",
            "alias_name": self.alias_name,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
