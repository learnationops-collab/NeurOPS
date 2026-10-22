"""Escribir y leer la bitácora del sistema (`SystemLog`). No hace commit: el evento se guarda junto con
el cambio que lo produjo."""
from app import db
from app.models import SystemLog


def registrar(title, description=None, usuario=None, entity_type=None, entity_id=None):
    log = SystemLog(title=title[:200], description=description, entity_type=entity_type,
                    entity_id=str(entity_id) if entity_id is not None else None,
                    user_id=getattr(usuario, 'id', None))
    db.session.add(log)
    return log


def de(entity_type, entity_id):
    """La historia de una fila, del más viejo al más nuevo."""
    return SystemLog.query.filter_by(entity_type=entity_type, entity_id=str(entity_id)) \
        .order_by(SystemLog.created_at, SystemLog.id).all()
