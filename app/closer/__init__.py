from flask import Blueprint

bp = Blueprint('closer', __name__)

from app.closer import bp
# Import routes to register them with the blueprint
from app.closer.routes import dashboard, leads, calendar, sales
# legacy routes file is kept but empty to prevent import errors if referenced directly, though it implies it should be removed from imports if it has no routes.
# kept for safety.
if False:
    from app.closer import routes as legacy_routes


@bp.context_processor
def inject_calendar_status():
    from flask_login import current_user
    from app.models import GoogleCalendarToken
    
    connected = False
    if current_user.is_authenticated:
        connected = GoogleCalendarToken.query.filter_by(user_id=current_user.id).first() is not None
        
    return dict(calendar_connected=connected)
