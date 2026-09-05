from datetime import datetime
from app import db


class TrainingVideo(db.Model):
    __tablename__ = 'training_videos'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    loom_link = db.Column(db.String(500), nullable=False)
    # Lista de roles a quienes se les muestra (ver app.models.user para los valores válidos).
    # Vacía o nula = se muestra a cualquier rol autenticado.
    target_roles = db.Column(db.JSON, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    created_by = db.relationship('User', foreign_keys=[created_by_id])
    questions = db.relationship(
        'TrainingVideoQuestion', backref='video', lazy='dynamic',
        order_by='TrainingVideoQuestion.order', cascade='all, delete-orphan'
    )
    completions = db.relationship(
        'TrainingVideoCompletion', backref='video', lazy='dynamic',
        cascade='all, delete-orphan'
    )

    def to_dict(self, include_questions=False, include_correct=False):
        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "loom_link": self.loom_link,
            "target_roles": self.target_roles or [],
            "is_active": self.is_active,
            "created_by_name": self.created_by.username if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "question_count": self.questions.count(),
            "completions_count": self.completions.count(),
        }
        if include_questions:
            data["questions"] = [q.to_dict(include_correct=include_correct) for q in self.questions]
        return data


class TrainingVideoQuestion(db.Model):
    __tablename__ = 'training_video_questions'
    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('training_videos.id', ondelete='CASCADE'), nullable=False, index=True)
    question_text = db.Column(db.Text, nullable=False)
    order = db.Column(db.Integer, default=0, nullable=False)

    options = db.relationship(
        'TrainingVideoOption', backref='question', lazy='dynamic',
        order_by='TrainingVideoOption.order', cascade='all, delete-orphan'
    )

    def to_dict(self, include_correct=False):
        return {
            "id": self.id,
            "question_text": self.question_text,
            "order": self.order,
            "options": [o.to_dict(include_correct=include_correct) for o in self.options],
        }


class TrainingVideoOption(db.Model):
    __tablename__ = 'training_video_options'
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('training_video_questions.id', ondelete='CASCADE'), nullable=False, index=True)
    option_text = db.Column(db.String(500), nullable=False)
    is_correct = db.Column(db.Boolean, default=False, nullable=False)
    order = db.Column(db.Integer, default=0, nullable=False)

    def to_dict(self, include_correct=False):
        data = {"id": self.id, "option_text": self.option_text, "order": self.order}
        if include_correct:
            data["is_correct"] = self.is_correct
        return data


class TrainingVideoCompletion(db.Model):
    __tablename__ = 'training_video_completions'
    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('training_videos.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('video_id', 'user_id', name='uq_training_video_completion'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "video_id": self.video_id,
            "user_id": self.user_id,
            "user_name": self.user.username if self.user else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
