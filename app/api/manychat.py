from flask import Blueprint
import logging

logger = logging.getLogger(__name__)

# Rutas con sesión sobre las conversaciones de Instagram (monitor, mantenimiento y calificación de Entrantes).
# El webhook de entrada de ManyChat (POST /api/manychat-webhook) se retiró el 26/10/2026: ManyChat está apagado
# y el motor propio (app/automatizaciones) escribe Conversation + LeadAnswer directo.
bp = Blueprint('manychat', __name__)

# Las demás rutas del blueprint (se importan acá, después de definir `bp`).
from app.api import manychat_monitor, manychat_mantenimiento  # noqa: E402,F401
