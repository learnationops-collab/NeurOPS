from flask import Blueprint

bp = Blueprint('external_academy_api', __name__)

from . import academy
