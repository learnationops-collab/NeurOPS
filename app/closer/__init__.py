from flask import Blueprint

bp = Blueprint('closer', __name__)

from app.closer import routes
