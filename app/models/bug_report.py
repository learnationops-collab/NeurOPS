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
    # Marcas de "ultima vez que cada lado vio la conversacion" -- reemplazan al viejo
    # admin_response de una sola respuesta. Un mensaje cuenta como no leido para el
    # reportante si es de otro usuario (un manager) y llego despues de user_last_read_at,
    # y viceversa para manager_last_read_at con mensajes del propio reportante.
    user_last_read_at = db.Column(db.DateTime, nullable=True)
    manager_last_read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('bug_reports', lazy='dynamic'))
    messages = db.relationship(
        'BugReportMessage', backref='report', lazy='dynamic',
        order_by='BugReportMessage.created_at', cascade='all, delete-orphan'
    )

    def to_dict(self, include_screenshot=False):
        last_message = BugReportMessage.query.filter_by(bug_report_id=self.id) \
            .order_by(BugReportMessage.created_at.desc()).first()
        unread_for_user = self.messages.filter(
            BugReportMessage.sender_id != self.user_id,
            BugReportMessage.created_at > (self.user_last_read_at or datetime.min)
        ).first() is not None
        unread_for_manager = self.messages.filter(
            BugReportMessage.sender_id == self.user_id,
            BugReportMessage.created_at > (self.manager_last_read_at or datetime.min)
        ).first() is not None

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
            "message_count": self.messages.count(),
            "last_message": last_message.to_dict() if last_message else None,
            "unread_for_user": unread_for_user,
            "unread_for_manager": unread_for_manager,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "has_screenshot": bool(self.screenshot),
        }
        if include_screenshot:
            data["screenshot"] = self.screenshot
        return data


class BugReportMessage(db.Model):
    __tablename__ = 'bug_report_messages'
    id = db.Column(db.Integer, primary_key=True)
    bug_report_id = db.Column(db.Integer, db.ForeignKey('bug_reports.id', ondelete='CASCADE'), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    sender_role = db.Column(db.String(20), nullable=True)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    sender = db.relationship('User', foreign_keys=[sender_id])

    def to_dict(self):
        return {
            "id": self.id,
            "bug_report_id": self.bug_report_id,
            "sender_id": self.sender_id,
            "sender_name": self.sender.username if self.sender else None,
            "sender_role": self.sender_role,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
