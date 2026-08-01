from flask import Flask
from sqlalchemy import MetaData
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_cors import CORS
from config import Config
import os

naming_convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

# Initialize extensions
db = SQLAlchemy(metadata=MetaData(naming_convention=naming_convention))
migrate = Migrate()
login = LoginManager()
login.login_view = 'auth.login'
login.login_message = 'Por favor inicia sesión para acceder a esta página.'
login.session_protection = 'strong'

@login.unauthorized_handler
def unauthorized():
    from flask import request, jsonify
    if request.path.startswith('/api/'):
        return jsonify({"message": "Unauthorized"}), 401
    from flask import redirect, url_for, flash
    flash(login.login_message)
    return redirect(url_for(login.login_view))

def create_app(config_class=Config):
    app = Flask(__name__, 
                static_folder='../frontend/dist', 
                static_url_path='/static_assets',
                template_folder='../frontend/dist')
    app.config.from_object(config_class)
    from flask_wtf.csrf import CSRFProtect
    csrf = CSRFProtect(app)
    db.init_app(app)
    
    # Import models to ensure they are registered with SQLAlchemy/Migrate
    from app import models

    # Solo usar render_as_batch para SQLite (desarrollo local)
    is_sqlite = app.config.get('SQLALCHEMY_DATABASE_URI', '').startswith('sqlite')
    migrate.init_app(app, db, render_as_batch=is_sqlite)
    login.init_app(app)
    
    # CORS Configuration
    # Must explicitly allow credentials and specific origins for cookies to work
    allowed_origins = [
        "http://localhost:5173", 
        "http://localhost:3000",
        "https://work.thelearnation.com",
        "https://neurops-production.up.railway.app",
        "https://institute.thelearnation.com"
    ]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

    # ProxyFix for Railway (HTTPS detection)
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

    from app.api import bp as api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    from app.api.closer import bp as closer_api_bp
    app.register_blueprint(closer_api_bp, url_prefix='/api/closer')

    from app.api.closer_dashboard import bp as closer_dashboard_api_bp
    app.register_blueprint(closer_dashboard_api_bp, url_prefix='/api/closer')

    from app.api.public import bp as public_api_bp
    app.register_blueprint(public_api_bp, url_prefix='/api')
    csrf.exempt(public_api_bp) # Exento para llamadas publicas / webhooks de n8n

    from app.api.setter import bp as setter_api_bp
    app.register_blueprint(setter_api_bp, url_prefix='/api/setter')

    from app.api.google_calendar import bp as google_calendar_bp
    app.register_blueprint(google_calendar_bp)
    csrf.exempt(google_calendar_bp) # Exento para webhooks de Google Calendar

    from app.api.webhooks import bp as webhooks_bp
    app.register_blueprint(webhooks_bp, url_prefix='/api/webhooks')
    csrf.exempt(webhooks_bp) # Exento para webhooks de Calendly/n8n

    from app.api.analytics import bp as analytics_bp
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')

    from app.api.marketing import bp as marketing_bp
    app.register_blueprint(marketing_bp, url_prefix='/api/marketing')

    from app.api.backup import bp as backup_bp
    app.register_blueprint(backup_bp, url_prefix='/api/backup')
    csrf.exempt(backup_bp) # Exento para tareas externas de backup

    from app.api.comments import bp as comments_bp
    app.register_blueprint(comments_bp, url_prefix='/api/comments')

    from app.api.manychat import bp as manychat_bp
    app.register_blueprint(manychat_bp, url_prefix='/api')
    csrf.exempt(manychat_bp) # Exento para webhooks de ManyChat

    from app.api.triage import bp as triage_bp
    app.register_blueprint(triage_bp, url_prefix='/api/triage')

    from app.api.sheets import bp as sheets_bp
    app.register_blueprint(sheets_bp, url_prefix='/api/sheets')
    csrf.exempt(sheets_bp) # Exento para scripts externos de Google Sheets

    from app.api.workshop import bp as workshop_bp
    app.register_blueprint(workshop_bp, url_prefix='/api/workshop')

    from app.api.metrics import bp as metrics_bp
    app.register_blueprint(metrics_bp, url_prefix='/api/v1/metrics')
    csrf.exempt(metrics_bp) # Exento para sistemas de monitorizacion

    from app.api.conversational import bp as conversational_bp
    app.register_blueprint(conversational_bp, url_prefix='/api/conversational')

    from app.api.alerts import bp as alerts_bp
    app.register_blueprint(alerts_bp, url_prefix='/api')

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        from flask import send_from_directory
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    @app.errorhandler(500)
    def internal_error(error):
        from flask import jsonify
        import traceback
        response = {
            "message": "Internal Server Error"
        }
        # Solo exponemos trazas en modo desarrollo/debug
        if app.debug or app.config.get('DEBUG', False):
            response["error"] = str(error)
            response["trace"] = traceback.format_exc()
        return jsonify(response), 500

    @app.errorhandler(Exception)
    def handle_exception(e):
        from flask import jsonify
        import traceback
        # pass through HTTP errors (como 404, 403, 400)
        if hasattr(e, 'code'):
            try:
                code_val = int(e.code)
                if code_val < 500:
                    return e
            except (ValueError, TypeError):
                pass
        
        response = {
            "message": "Unhandled Exception"
        }
        # Solo exponemos detalles en desarrollo
        if app.debug or app.config.get('DEBUG', False):
            response["error"] = str(e)
            response["trace"] = traceback.format_exc()
        return jsonify(response), 500

    return app
