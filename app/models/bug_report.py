from datetime import datetime
from app import db

URGENCY_LEVELS = ('muy_urgente', 'urgente', 'neutro', 'sin_urgencia')


class BugReport(db.Model):
    __tablename__ = 'bug_reports'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    user_role = db.Column(db.String(20), nullable=True)
    description = db.Column(db.Text, nullable=False)
    urgency = db.Column(db.String(20), nullable=False)
    route = db.Column(db.String(255), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    technical_context = db.Column(db.Text, nullable=True)
    screenshot = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='open', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship('User', backref=db.backref('bug_reports', lazy='dynamic'))

    def to_dict(self, include_screenshot=False):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.username if self.user else None,
            "user_role": self.user_role,
            "description": self.description,
            "urgency": self.urgency,
            "route": self.route,
            "user_agent": self.user_agent,
            "technical_context": self.technical_context,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "has_screenshot": bool(self.screenshot),
        }
        if include_screenshot:
            data["screenshot"] = self.screenshot
        return data
