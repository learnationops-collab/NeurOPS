from datetime import datetime
from app import db

class Pipeline(db.Model):
    __tablename__ = 'pipelines'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    stages = db.relationship('PipelineStage', backref='pipeline', lazy='dynamic')

class PipelineStage(db.Model):
    __tablename__ = 'pipeline_stages'
    id = db.Column(db.Integer, primary_key=True)
    pipeline_id = db.Column(db.Integer, db.ForeignKey('pipelines.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

class UserViewSetting(db.Model):
    __tablename__ = 'user_view_settings'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    view_name = db.Column(db.String(64), nullable=False)
    settings = db.Column(db.JSON)

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    subject = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    read_by = db.Column(db.JSON, default=[])
    target_users = db.Column(db.JSON, default="all")
    associated_id = db.Column(db.Integer, nullable=True)
    associated_type = db.Column(db.String(50), nullable=True) # e.g., 'appointment'
    related_users = db.Column(db.JSON, default=[])
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Notification {self.subject}>'

class Comment(db.Model):
    __tablename__ = 'comments'
    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    text = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    comment_type = db.Column(db.String(50), nullable=False)
    associated_id = db.Column(db.Integer, nullable=False)
    
    author = db.relationship('User', backref='comments_authored')

    __table_args__ = (
        db.Index('idx_comments_target', 'comment_type', 'associated_id'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "author_id": self.author_id,
            "author_name": self.author.username if self.author else "Unknown",
            "created_at": self.created_at.isoformat(),
            "type": self.comment_type,
            "associated_id": self.associated_id
        }
