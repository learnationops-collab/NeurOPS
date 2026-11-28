"""«Pedir actualización» (27/11/2026, ADR-W275): alguien del equipo le pide a quien confirma (Dari) que le
cuente cómo viene una sesión, con texto y/o audio; ella responde igual. Un pedido, una respuesta: para
seguir la charla se hace otro pedido. Los audios viven en la base, como `AudioClip`."""
from datetime import datetime

from app import db


class UpdateRequest(db.Model):
    __tablename__ = 'update_requests'

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='CASCADE'),
                               nullable=False, index=True)
    person_uuid = db.Column(db.String(36), nullable=True)
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    message = db.Column(db.Text, nullable=True)
    audio = db.Column(db.LargeBinary, nullable=True)
    audio_mime = db.Column(db.String(60), nullable=True)
    reply = db.Column(db.Text, nullable=True)
    reply_audio = db.Column(db.LargeBinary, nullable=True)
    reply_audio_mime = db.Column(db.String(60), nullable=True)
    replied_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    replied_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    requester = db.relationship('User', foreign_keys=[requested_by])
    recipient = db.relationship('User', foreign_keys=[recipient_id])
    replier = db.relationship('User', foreign_keys=[replied_by])
