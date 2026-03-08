from datetime import datetime
from app import db

class PublicRegistration(db.Model):
    __tablename__ = 'public_registrations'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=True) # Adding phone just in case, though name is priority for now
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime, nullable=True) # Timestamp of when 2chat was triggered
    status = db.Column(db.String(20), default='pending') # pending, completed, failed

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "status": self.status
        }
