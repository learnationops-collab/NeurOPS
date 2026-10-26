from flask import Blueprint
import logging

logger = logging.getLogger(__name__)

# Marketing › Entrantes: rutas con sesión sobre las conversaciones de Instagram (monitor, mantenimiento y
# calificación). Montado en /api/marketing/entrantes; hasta el 26/10/2026 eran /api/manychat-webhook/*.
# El webhook de entrada de ManyChat se retiró el 26/10/2026: el motor propio (app/automatizaciones)
# escribe Conversation + LeadAnswer directo.
bp = Blueprint('entrantes', __name__)

# Las demás rutas del blueprint (se importan acá, después de definir `bp`).
from app.api import entrantes_monitor, entrantes_mantenimiento, entrantes_calificacion  # noqa: E402,F401
