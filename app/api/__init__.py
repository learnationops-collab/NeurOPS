from flask import Blueprint, jsonify

bp = Blueprint('api', __name__)

@bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "Learnation API"}), 200

# Import sub-routes
from app.api import auth, admin

@bp.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response
