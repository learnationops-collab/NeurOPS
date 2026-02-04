import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess-neuro-key'
    
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

    # Security & Sessions
    SESSION_COOKIE_NAME = 'learnation_workers_session'
    REMEMBER_COOKIE_NAME = 'learnation_workers_remember'
    
    # Production Security
    # If running on HTTPS (Railway usually puts behind proxy), we need Secure cookies
    # But locally we don't use HTTPS usually.
    # Flask-Login/Sessions usually need this for cross-domain iframes or modern browsers on HTTPS.
    SESSION_COOKIE_SECURE = False 
    REMEMBER_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = 'Lax'
