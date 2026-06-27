import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        if os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENV') == 'production':
            raise RuntimeError("La variable de entorno SECRET_KEY es obligatoria en produccion.")
        SECRET_KEY = 'neurops-secret-key-development-fallback-2026'
    
    # Database Config
    # Default to sqlite for local dev, but prepared for PostgreSQL
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///local.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Increase SQLite timeout to reduce 'database is locked' errors (Only for SQLite)
    if SQLALCHEMY_DATABASE_URI.startswith('sqlite'):
        SQLALCHEMY_ENGINE_OPTIONS = {
            "connect_args": {"timeout": 30}
        }
    
    # Webhooks
    VENTAS_WEBHOOK = os.environ.get('VENTAS_WEBHOOK')

    # Meta Pixel
    META_PIXEL_ID = os.environ.get('META_PIXEL_ID')

    # Security & Sessions
    SESSION_COOKIE_NAME = 'learnation_workers_session'
    REMEMBER_COOKIE_NAME = 'learnation_workers_remember'
    
    # Production Security
    # Habilitar cookies seguras solo si se ejecuta en entorno de produccion.
    _is_prod = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENV') == 'production' or os.environ.get('RAILWAY_ENVIRONMENT') is not None
    SESSION_COOKIE_SECURE = _is_prod
    REMEMBER_COOKIE_SECURE = _is_prod
    SESSION_COOKIE_SAMESITE = 'Lax'
