from datetime import datetime, timedelta
from app import db

QUESTION_TYPES = ('single', 'multiple', 'true_false')
ROADMAP_ACCENTS = ('magenta', 'blue', 'green')

# Una lección se muestra "Nueva" mientras no pase este umbral y el usuario no le haya
# tocado nada -- después de eso, si sigue sin ver, pasa a ser "Pendiente" (backlog viejo,
# ya no es una novedad).
NEW_LESSON_WINDOW_DAYS = 7


class PlaybookRoadmap(db.Model):
    __tablename__ = 'playbook_roadmaps'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    accent = db.Column(db.String(20), default='magenta', nullable=False)
    order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    modules = db.relationship(
        'PlaybookModule', backref='roadmap', lazy='dynamic',
        order_by='PlaybookModule.order', cascade='all, delete-orphan'
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "accent": self.accent,
            "order": self.order,
            "module_count": self.modules.count(),
        }


class PlaybookModule(db.Model):
    __tablename__ = 'playbook_modules'
    id = db.Column(db.Integer, primary_key=True)
    roadmap_id = db.Column(db.Integer, db.ForeignKey('playbook_roadmaps.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    lessons = db.relationship(
        'PlaybookLesson', backref='module', lazy='dynamic',
        order_by='PlaybookLesson.order', cascade='all, delete-orphan'
    )

    def to_dict(self):
        return {
            "id": self.id,
            "roadmap_id": self.roadmap_id,
            "name": self.name,
            "order": self.order,
            "lesson_count": self.lessons.count(),
        }


class PlaybookLesson(db.Model):
    __tablename__ = 'playbook_lessons'
    id = db.Column(db.Integer, primary_key=True)
    module_id = db.Column(db.Integer, db.ForeignKey('playbook_modules.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    loom_link = db.Column(db.String(500), nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=True)
    # Pegada a mano por quien publica -- indexa a Learnito (buscador por transcripción, todavía
    # no construido, ver bitácora). Se guarda desde ya para no perder el dato mientras tanto.
    transcript = db.Column(db.Text, nullable=True)
    # Vacío/nulo = visible para todos los roles.
    target_roles = db.Column(db.JSON, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    order = db.Column(db.Integer, default=0, nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    created_by = db.relationship('User', foreign_keys=[created_by_id])
    questions = db.relationship(
        'PlaybookQuestion', backref='lesson', lazy='dynamic',
        order_by='PlaybookQuestion.order', cascade='all, delete-orphan'
    )
    progress_rows = db.relationship('PlaybookLessonProgress', backref='lesson', lazy='dynamic', cascade='all, delete-orphan')
    completions = db.relationship('PlaybookCompletion', backref='lesson', lazy='dynamic', cascade='all, delete-orphan')

    def is_new(self):
        return self.created_at is not None and (datetime.utcnow() - self.created_at) < timedelta(days=NEW_LESSON_WINDOW_DAYS)

    def state_for_user(self, user_id, completed_ids=None, watched_ids=None):
        """completed_ids/watched_ids: sets precomputadas (evita N+1 al listar muchas lecciones).
        Si no se pasan, se resuelven con una consulta puntual."""
        is_completed = self.id in completed_ids if completed_ids is not None else \
            PlaybookCompletion.query.filter_by(lesson_id=self.id, user_id=user_id).first() is not None
        if is_completed:
            return 'completado'
        is_watched = self.id in watched_ids if watched_ids is not None else \
            PlaybookLessonProgress.query.filter_by(lesson_id=self.id, user_id=user_id).filter(
                PlaybookLessonProgress.video_watched_at.isnot(None)
            ).first() is not None
        if is_watched:
            return 'en_progreso'
        return 'nuevo' if self.is_new() else 'pendiente'

    def to_dict(self, include_questions=False, include_correct=False):
        return {
            "id": self.id,
            "module_id": self.module_id,
            "title": self.title,
            "description": self.description,
            "loom_link": self.loom_link,
            "duration_minutes": self.duration_minutes,
            "transcript": self.transcript if include_correct else None,
            "target_roles": self.target_roles or [],
            "is_active": self.is_active,
            "order": self.order,
            "created_by_name": self.created_by.username if self.created_by else None,
            "created_by_role": self.created_by.role if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "question_count": self.questions.count(),
            "completions_count": self.completions.count(),
            "questions": [q.to_dict(include_correct=include_correct) for q in self.questions] if include_questions else None,
        }


class PlaybookQuestion(db.Model):
    __tablename__ = 'playbook_questions'
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('playbook_lessons.id', ondelete='CASCADE'), nullable=False, index=True)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(20), default='single', nullable=False)
    order = db.Column(db.Integer, default=0, nullable=False)

    options = db.relationship(
        'PlaybookOption', backref='question', lazy='dynamic',
        order_by='PlaybookOption.order', cascade='all, delete-orphan'
    )

    def to_dict(self, include_correct=False):
        return {
            "id": self.id,
            "question_text": self.question_text,
            "question_type": self.question_type,
            "order": self.order,
            "options": [o.to_dict(include_correct=include_correct) for o in self.options],
        }


class PlaybookOption(db.Model):
    __tablename__ = 'playbook_options'
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('playbook_questions.id', ondelete='CASCADE'), nullable=False, index=True)
    option_text = db.Column(db.String(500), nullable=False)
    is_correct = db.Column(db.Boolean, default=False, nullable=False)
    order = db.Column(db.Integer, default=0, nullable=False)

    def to_dict(self, include_correct=False):
        data = {"id": self.id, "option_text": self.option_text, "order": self.order}
        if include_correct:
            data["is_correct"] = self.is_correct
        return data


class PlaybookLessonProgress(db.Model):
    """Marca 'video visto' -- estado intermedio entre nunca abrir la lección y aprobar el
    quiz (PlaybookCompletion). Sin esto no habría forma de distinguir 'Nuevo' de 'En progreso'
    en la lista de pendientes."""
    __tablename__ = 'playbook_lesson_progress'
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('playbook_lessons.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    video_watched_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint('lesson_id', 'user_id', name='uq_playbook_lesson_progress'),
    )


class PlaybookCompletion(db.Model):
    __tablename__ = 'playbook_completions'
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('playbook_lessons.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('lesson_id', 'user_id', name='uq_playbook_completion'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "lesson_id": self.lesson_id,
            "user_id": self.user_id,
            "user_name": self.user.username if self.user else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
