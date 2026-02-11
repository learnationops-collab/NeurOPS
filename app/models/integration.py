from datetime import datetime
from app import db

class Integration(db.Model):
    __tablename__ = 'integrations'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=True)
    url_dev = db.Column(db.String(255), nullable=True)
    url_prod = db.Column(db.String(255), nullable=True)
    active_env = db.Column(db.String(20), default='dev')
    payload_config = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "name": self.name,
            "url_dev": self.url_dev,
            "url_prod": self.url_prod,
            "active_env": self.active_env,
            "payload_config": self.payload_config
        }
