from datetime import datetime
from app import db

URGENCY_LEVELS = ('muy_urgente', 'urgente', 'neutro', 'sin_urgencia')
STATUS_VALUES = ('open', 'reviewed', 'resolved')


class BugReport(db.Model):
    __tablename__ = 'bug_reports'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    user_role = db.Column(db.String(20), nullable=True)
    problem = db.Column(db.Text, nullable=True)
    description = db.Column(db.Text, nullable=False)
    urgency = db.Column(db.String(20), nullable=False)
    route = db.Column(db.String(255), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    technical_context = db.Column(db.Text, nullable=True)
    screenshot = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='open', nullable=False)
    admin_response = db.Column(db.Text, nullable=True)
    responded_at = db.Column(db.DateTime, nullable=True)
    responded_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    is_read_by_user = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('bug_reports', lazy='dynamic'))
    responded_by = db.relationship('User', foreign_keys=[responded_by_id])

    def to_dict(self, include_screenshot=False):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.username if self.user else None,
            "user_role": self.user_role,
            "problem": self.problem,
            "description": self.description,
            "urgency": self.urgency,
            "route": self.route,
            "user_agent": self.user_agent,
            "technical_context": self.technical_context,
            "status": self.status,
            "admin_response": self.admin_response,
            "responded_at": self.responded_at.isoformat() if self.responded_at else None,
            "responded_by_name": self.responded_by.username if self.responded_by else None,
            "is_read_by_user": self.is_read_by_user,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "has_screenshot": bool(self.screenshot),
        }
        if include_screenshot:
            data["screenshot"] = self.screenshot
        return data
