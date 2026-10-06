from datetime import datetime
import secrets
import time
import jwt
from flask import current_app, g
from flask_login import UserMixin
import sqlalchemy as sa
from sqlalchemy.ext.hybrid import Comparator, hybrid_property
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
# Rol acotado al panel de contratación (`/admin/hiring`): revisa las
# postulaciones a Asistente Administrativa y Personal y nada más. No hereda
# `admin_required` (finanzas, equipo, base de datos) — ver `hiring_required`
# en app/decorators.py.
ROLE_HIRING = 'hiring'

def _esta_desactivado(user):
    """True si la cuenta esta desactivada. Falsy (False o NULL) es "desactivada", igual que para
    Flask-Login: UserMixin.is_authenticated devuelve `is_active`, asi que una cuenta asi ya recibia 401
    en toda ruta protegida. Los loaders no la entregan para que nada la trate como usuario (ni siquiera
    se guardan los claims de su token) y el login lo dice en vez de darle un JWT que no sirve."""
    return user is not None and not user.is_active


@login.user_loader
def load_user(id):
    user = User.query.get(int(id))
    if _esta_desactivado(user):
        return None
    if user is not None:
        # Flujo de cookie: el rol activo vive en la sesión (el de un token manda en el otro loader).
        from flask import session, has_request_context
        user.activar_rol(session.get('active_role') if has_request_context() else None)
    return user

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
                if _esta_desactivado(user):
                    return None
                if user:
                    user.activar_rol(payload.get('active_role'))
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

class _RolComparator(Comparator):
    """`User.role == 'closer'` (y `!=`, `in_`) en una consulta: cualquier usuario que TENGA ese rol, sea
    el principal (`role`) o uno adicional (`roles_extra`). Así una persona con dos roles aparece en las
    listas de closers, de setters, etc., aunque su rol principal sea otro. El resto de operaciones
    (ordenar, agrupar, `.like`) actúan sobre el rol principal."""

    @staticmethod
    def _tiene(rol):
        extra = (sa.literal(',') + sa.func.coalesce(User.roles_extra, '') + sa.literal(',')).like(f'%,{rol},%')
        return sa.or_(User._role == rol, extra)

    def __eq__(self, otro):
        return self._tiene(otro)

    def __ne__(self, otro):
        return sa.not_(self._tiene(otro))

    def in_(self, otros):
        return sa.or_(*[self._tiene(r) for r in otros]) if otros else sa.false()

    def not_in(self, otros):
        return sa.not_(self.in_(otros))

    notin_ = not_in


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(256))
    # Rol PRINCIPAL (el de siempre). Una persona con varios roles tiene los demás en `roles_extra`
    # (separados por comas) y trabaja con uno a la vez: el ACTIVO. `role` lee el activo y las
    # consultas (`User.role == 'closer'`) encuentran a quien tenga ese rol, principal o no.
    _role = db.Column('role', db.String(20), default=ROLE_CLOSER)
    roles_extra = db.Column(db.String(120), nullable=True)
    timezone = db.Column(db.String(50), default='America/La_Paz')
    is_active = db.Column(db.Boolean, default=True)
    two_chat_number = db.Column(db.String(20), nullable=True)
    # Cuándo el closer confirmó que le llega el WhatsApp de prueba a `two_chat_number` (Configuración).
    # Sin confirmar no recibe agendas de Agendas 2.0: el aviso de cada agenda nueva va a ese número.
    # Cambiar el número lo vuelve a NULL.
    whatsapp_confirmado_en = db.Column(db.DateTime, nullable=True)
    can_view_finance = db.Column(db.Boolean, default=False, server_default="0")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Las cuentas con el mismo `persona_id` son la misma persona con varios roles (ver
    # `app/services/cuentas_vinculadas.py`). NULL: cuenta suelta, que es el caso de casi todas.
    persona_id = db.Column(db.Integer, index=True, nullable=True)

    # El rol activo de ESTE request (lo fija el loader con el claim `active_role` del token o la
    # sesión). Vive solo en la instancia: no se guarda en la base.
    _rol_activo = None

    @hybrid_property
    def role(self):
        return self._rol_activo or self._role

    @role.setter
    def role(self, valor):
        self._role = valor

    @role.comparator
    def role(cls):
        return _RolComparator(cls._role)

    @property
    def roles(self):
        """Todos los roles de la persona: el principal primero y luego los adicionales."""
        extra = [r.strip() for r in (self.roles_extra or '').split(',') if r.strip()]
        return [self._role] + [r for r in extra if r != self._role]

    def tiene_rol(self, rol):
        return rol in self.roles

    def activar_rol(self, rol):
        """Fija el rol activo de este request. Un rol que la persona no tiene se ignora (queda el
        principal): el token puede traer cualquier cosa, así que SIEMPRE se valida acá."""
        self._rol_activo = rol if rol and rol != self._role and rol in self.roles else None

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

    def set_unusable_password(self):
        """Clave aleatoria que nadie conoce: la cuenta no puede iniciar sesion hasta que un admin le fije una.

        Para las cuentas que se crean sin que su duena haya elegido clave (la importacion crea closers y
        setters por su nombre). Antes todas recibian la misma clave escrita en el codigo, y con ella
        cualquiera que la conociera entraba como cualquiera de ellas."""
        self.set_password(secrets.token_urlsafe(32))

    def check_password(self, password):
        # Un usuario sin clave guardada (importado, creado a medias) no coincide con ninguna: antes
        # check_password_hash(None, ...) lanzaba y el login contestaba 500.
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

class GoogleCalendarToken(db.Model):
    __tablename__ = 'google_calendar_tokens'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    token_json = db.Column(db.Text, nullable=False) 
    google_calendar_id = db.Column(db.String(255), default='primary')
    # Cuándo Google rechazó el token (revocado o emitido por otro cliente OAuth). Un token vencido
    # no cuenta como conectado: el usuario tiene que volver a conectar. Al reconectar vuelve a NULL.
    vencido_en = db.Column(db.DateTime, nullable=True)
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
