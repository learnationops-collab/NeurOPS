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
    # Solo usar render_as_batch para SQLite (desarrollo local)
    is_sqlite = app.config.get('SQLALCHEMY_DATABASE_URI', '').startswith('sqlite')
    migrate.init_app(app, db, render_as_batch=is_sqlite)
    login.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.api import bp as api_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    csrf.exempt(api_bp)

    from app.api.closer import bp as closer_api_bp
    app.register_blueprint(closer_api_bp, url_prefix='/api/closer')
    csrf.exempt(closer_api_bp)

    from app.api.public import bp as public_api_bp
    app.register_blueprint(public_api_bp, url_prefix='/api')
    csrf.exempt(public_api_bp)

    from app.api.google_calendar import bp as google_calendar_bp
    app.register_blueprint(google_calendar_bp)
    csrf.exempt(google_calendar_bp)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        from flask import send_from_directory
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    return app
