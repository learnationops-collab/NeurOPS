from flask import Blueprint, redirect, request, jsonify, session, url_for
from flask_login import current_user, login_required
from app.services.google_service import GoogleService
from app.models import db, GoogleCalendarToken
import os
from urllib.parse import urlparse

bp = Blueprint('google_calendar_bp', __name__)

# To allow HTTP for local dev
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
# Relax scope validation as Google might return extra scopes (e.g. calendar.readonly)
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

@bp.route('/api/google/login', methods=['GET'])
@login_required
def login():
    # Construct redirect URI based on request
    # If local: http://127.0.0.1:5000/api/google/callback ... wait, redirect is usually separate. 
    # Let's keep callback separate or also under api?
    # Google console allows specific URIs.
    # The user said: http://127.0.0.1:5000/google/callback
    # note: the CALLBACK route is distinct from the login route. The login route is internal. 
    # Callback determines where Google sends user back. 
    # If I change login route, it's fine.
    # But callback route must match Google Console.
    
    # Prioritize environment variable if set (e.g. for localhost:5173 or Prod)
    redirect_uri = os.environ.get('REDIRECT_URI_PROD') or os.environ.get('REDIRECT_URI_DEV')
    if not redirect_uri:
        base_url = request.url_root.rstrip('/')
        redirect_uri = f"{base_url}/google/callback"

    # Capture frontend origin from Referer to ensure redirect back to correct domain (fix for prod defaulting to localhost)
    referer = request.headers.get('Referer')
    if referer:
        parsed = urlparse(referer)
        session['frontend_origin'] = f"{parsed.scheme}://{parsed.netloc}"
    
    flow = GoogleService.get_flow(redirect_uri=redirect_uri)
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent' # Force consent to get refresh token
    )
    
    session['google_oauth_state'] = state
    session['google_redirect_uri'] = redirect_uri
    return jsonify({"auth_url": authorization_url})

@bp.route('/google/callback', methods=['GET'])
def callback():
    state = session.get('google_oauth_state')
    redirect_uri = session.get('google_redirect_uri')
    
    if not state or not redirect_uri:
        return "Invalid Session State", 400

    flow = GoogleService.get_flow(redirect_uri=redirect_uri)
    flow.fetch_token(authorization_response=request.url)

    credentials = flow.credentials
    
    # We need the user to be logged in. Since callback comes from Google, 
    # session cookie should persist if SameSite is lax/none. 
    # If using token auth (header), this flow is tricky for SPA.
    # Usually SPA opens a popup. 
    # If session usage is valid:
    if current_user.is_authenticated:
        GoogleService.save_credentials(current_user.id, credentials)
        # Redirect to frontend settings with success param
        # Use stored origin as primary source, fallback to env var or localhost
        frontend_url = session.get('frontend_origin') or os.environ.get('FRONTEND_URL', 'http://localhost:5173')
        
        target_path = '/admin/settings' if current_user.role == 'admin' else '/closer/settings'
        return redirect(f"{frontend_url}{target_path}?google_connected=success")
    else:
        # If no user session (e.g. cross domain issue), store token in temp session and let frontend claim it?
        # Or return error. Assuming cookie session works for now.
        return "User not logged in", 401

@bp.route('/api/google/calendars', methods=['GET', 'POST'])
@login_required
def manage_calendars():
    if request.method == 'POST':
        data = request.get_json() or {}
        calendar_id = data.get('calendar_id')
        if not calendar_id: return jsonify({"error": "Missing calendar_id"}), 400
        
        token = GoogleCalendarToken.query.filter_by(user_id=current_user.id).first()
        if token:
            token.google_calendar_id = calendar_id
            db.session.commit()
            return jsonify({"message": "Calendar preference saved"}), 200
        return jsonify({"error": "No token found"}), 404

    # GET
    token = GoogleCalendarToken.query.filter_by(user_id=current_user.id).first()
    if not token:
        return jsonify({"connected": False}), 200
        
    calendars = GoogleService.list_calendars(current_user.id)
    return jsonify({
        "connected": True,
        "selected_calendar": token.google_calendar_id,
        "calendars": calendars
    }), 200

@bp.route('/api/google/disconnect', methods=['POST'])
@login_required
def disconnect():
    GoogleCalendarToken.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    return jsonify({"message": "Disconnected"}), 200
