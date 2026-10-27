"""Lo que el equipo trabaja sobre una conversación del Inbox, además de las etiquetas (27/10/2026).

  · Note: una nota interna (`kind = note`, el lead no la ve) o un evento del historial (`kind = event`:
    reasignada, cambió la etapa, corrigió una variable). Apunta a algo por `target_type` + `target_id`,
    como `Tag`.
  · Task: una tarea con vencimiento y responsable, sobre lo mismo.
  · QuickReply: una respuesta rápida del equipo (`/precio`). Puede llevar variables: «{nombre}».
  · AudioClip: un audio subido al sistema. Vive en la base (no hay almacenamiento de archivos); se
    reproduce con sesión. Para mandarlo por Instagram hará falta una URL pública (con el corte de Kommo).
  · InboxRead: hasta cuándo leyó cada persona del equipo cada conversación (los «sin leer»).
"""
from datetime import datetime

from app import db

NOTE = 'note'
EVENT = 'event'


class Note(db.Model):
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.String(64), nullable=False)
    kind = db.Column(db.String(10), nullable=False, default=NOTE)
    body = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    author = db.relationship('User')

    __table_args__ = (db.Index('ix_notes_target', 'target_type', 'target_id'),)


class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    due_at = db.Column(db.DateTime, nullable=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    done_at = db.Column(db.DateTime, nullable=True)
    done_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    assignee = db.relationship('User', foreign_keys=[assigned_to])

    __table_args__ = (
        db.Index('ix_tasks_target', 'target_type', 'target_id'),
        db.Index('ix_tasks_assigned_open', 'assigned_to', 'done_at'),
    )


class QuickReply(db.Model):
    __tablename__ = 'quick_replies'

    id = db.Column(db.Integer, primary_key=True)
    shortcut = db.Column(db.String(40), nullable=False, unique=True)
    title = db.Column(db.String(80), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class AudioClip(db.Model):
    __tablename__ = 'audio_clips'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    mime = db.Column(db.String(60), nullable=False)
    size = db.Column(db.Integer, nullable=False)
    duration_s = db.Column(db.Integer, nullable=True)
    data = db.Column(db.LargeBinary, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    author = db.relationship('User')


class InboxRead(db.Model):
    __tablename__ = 'inbox_reads'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    contact_id = db.Column(db.Integer, db.ForeignKey('ig_contactos.id', ondelete='CASCADE'), primary_key=True)
    read_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
