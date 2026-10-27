"""Quién cobra (27/10/2026): por ahora toda la deuda la cobra Jean Carlo. La de los closers que ya no están
y también la de los que siguen (Marlon lo pidió). Manda en el dashboard del closer, la cola de cobro
(«Llamadas cerradas» y los seguimientos de cobro) y el closer que Work le avisa a Deudores de la Academia.
Para volver a repartir por dueño de la agenda, `COBRADOR_EMAIL = None`."""
from sqlalchemy import func

COBRADOR_EMAIL = 'jeancarlo@thelearnation.com'


def cobrador():
    """El usuario que cobra toda la deuda, o None (cada lugar usa su criterio de siempre)."""
    if not COBRADOR_EMAIL:
        return None
    from app.models import User
    usuario = User.query.filter(func.lower(User.email) == COBRADOR_EMAIL).first()
    return usuario if usuario and usuario.is_active else None
