from flask import Blueprint

bp = Blueprint('public_sales', __name__)

from app.public_sales import routes, forms
