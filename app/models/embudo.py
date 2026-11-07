from datetime import datetime
from app import db


class EmbudoConfig(db.Model):
    """El embudo de seguimiento del equipo (una sola fila): en qué días después de la llamada se le
    escribe al lead y desde qué fecha de llamada entra. Lo edita la dirección (ADR-W120)."""
    __tablename__ = 'embudo_config'
    id = db.Column(db.Integer, primary_key=True)
    dias = db.Column(db.JSON, nullable=False)
    desde = db.Column(db.Date, nullable=False)
    updated_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmbudoRegistro(db.Model):
    """Un seguimiento del embudo: qué día del embudo era y si el lead respondió. El estado de cada
    lead en el embudo se deduce de estos registros (ver `embudo_seguimiento_service`)."""
    __tablename__ = 'embudo_registros'
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='CASCADE'),
                               nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    dia = db.Column(db.Integer, nullable=False)
    resultado = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
