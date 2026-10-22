from datetime import datetime

from app import db


class SystemLog(db.Model):
    """Bitácora general del sistema (22/10/2026): un evento con título y descripción. `entity_type` y
    `entity_id` dicen sobre qué fila fue (p. ej. 'sale', '1130'), para leer la historia de una cosa."""
    __tablename__ = 'system_logs'
    __table_args__ = (db.Index('ix_system_logs_entity', 'entity_type', 'entity_id'),)

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    entity_type = db.Column(db.String(40), nullable=True)
    entity_id = db.Column(db.String(64), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'description': self.description,
            'entity_type': self.entity_type, 'entity_id': self.entity_id, 'user_id': self.user_id,
            'user': getattr(self.user, 'username', None) if self.user_id else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
