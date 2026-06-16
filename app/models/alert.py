from datetime import datetime
from app import db

class AlertRule(db.Model):
    __tablename__ = 'alert_rules'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    metric = db.Column(db.String(50), nullable=False)  # 'cpl', 'cpql', 'leads', 'inversion', 'agendas', 'ventas'
    condition = db.Column(db.String(20), nullable=False)  # '>', '<'
    value = db.Column(db.Float, nullable=False)
    period = db.Column(db.String(50), nullable=False)  # '7_days', '1_day', 'vs_previous_week'
    scope_type = db.Column(db.String(50), nullable=False)  # 'all', 'keyword', 'campaign', 'ad'
    scope_value = db.Column(db.String(255), nullable=True)  # e.g., 'Clase 26'
    notify_platform = db.Column(db.Boolean, default=True)
    notify_discord = db.Column(db.Boolean, default=False)
    severity = db.Column(db.String(20), nullable=False)  # 'critical', 'warning', 'info', 'opportunity'
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "metric": self.metric,
            "condition": self.condition,
            "value": self.value,
            "period": self.period,
            "scope_type": self.scope_type,
            "scope_value": self.scope_value,
            "notify_platform": self.notify_platform,
            "notify_discord": self.notify_discord,
            "severity": self.severity,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class Alert(db.Model):
    __tablename__ = 'alerts'
    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('alert_rules.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(db.String(150), nullable=False)
    metric = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    scope_value = db.Column(db.String(255), nullable=True)
    current_value = db.Column(db.Float, nullable=False)
    expected_limit = db.Column(db.Float, nullable=False)
    percentage_change = db.Column(db.Float, nullable=True)
    associated_item = db.Column(db.String(255), nullable=True)
    explanation = db.Column(db.Text, nullable=True)
    recommended_action = db.Column(db.Text, nullable=True)
    target_url = db.Column(db.String(255), nullable=True)
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    discord_sent = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    rule = db.relationship('AlertRule', backref=db.backref('alerts', lazy='dynamic'))

    def to_dict(self):
        return {
            "id": self.id,
            "rule_id": self.rule_id,
            "title": self.title,
            "metric": self.metric,
            "severity": self.severity,
            "scope_value": self.scope_value,
            "current_value": self.current_value,
            "expected_limit": self.expected_limit,
            "percentage_change": self.percentage_change,
            "associated_item": self.associated_item,
            "explanation": self.explanation,
            "recommended_action": self.recommended_action,
            "target_url": self.target_url,
            "is_resolved": self.is_resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "discord_sent": self.discord_sent,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
