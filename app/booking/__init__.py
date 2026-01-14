from flask import Blueprint

bp = Blueprint('booking', __name__)

from app.booking import routes
