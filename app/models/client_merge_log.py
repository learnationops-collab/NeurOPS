from datetime import datetime
from app import db


class ClientMergeLog(db.Model):
    """Auditoría de fusiones automáticas de clientes duplicados (por email/instagram/
    teléfono coincidentes). Permite rastrear qué cliente sobrevivió y cuáles se
    fusionaron hacia él, para poder investigar o revertir manualmente si algo se
    fusionó por error."""
    __tablename__ = 'client_merge_logs'
    id = db.Column(db.Integer, primary_key=True)
    survivor_client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False, index=True)
    merged_client_id = db.Column(db.Integer, nullable=False)
    matched_on = db.Column(db.String(50), nullable=True)  # 'email' | 'instagram' | 'phone'
    merged_at = db.Column(db.DateTime, default=datetime.utcnow)

    survivor = db.relationship('Client', backref=db.backref('merge_logs', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'survivor_client_id': self.survivor_client_id,
            'merged_client_id': self.merged_client_id,
            'matched_on': self.matched_on,
            'merged_at': self.merged_at.isoformat() if self.merged_at else None
        }
