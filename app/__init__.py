from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_cors import CORS
from config import Config

# Initialize extensions
db = SQLAlchemy()
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

import os

def create_app(config_class=Config):
    # Set static_folder to the React build directory
    app = Flask(__name__, 
                static_folder='../frontend/dist', 
                static_url_path='/static_assets',
                template_folder='../frontend/dist')
    app.config.from_object(config_class)
    
    # Enable CSRF Protection globally
    from flask_wtf.csrf import CSRFProtect
    csrf = CSRFProtect(app)
    
    # Init extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    login.init_app(app)
    
    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register Blueprints
    from app.api import bp as api_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    csrf.exempt(api_bp)

    from app.api.closer import bp as closer_api_bp
    app.register_blueprint(closer_api_bp, url_prefix='/api/closer')
    csrf.exempt(closer_api_bp)

    # Route for the React SPA
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        from flask import send_from_directory
        # If the file exists in the static folder, serve it
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        # Otherwise, serve index.html (React Router handles the rest)
        return send_from_directory(app.static_folder, 'index.html')

    return app
