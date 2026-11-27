"""Cómo ve cada persona sus conversaciones con Learnito en Work: fijadas arriba y con el nombre que les puso
(26/11/2026, ADR-W251). La conversación en sí vive en la Academia; acá solo lo que es de la pantalla de Work."""
from datetime import datetime
import sqlalchemy as sa
from app import db


class LearnitoConversacion(db.Model):
    __tablename__ = 'learnito_conversaciones'
    __table_args__ = (db.UniqueConstraint('user_id', 'conversacion_id', name='uq_learnito_conv_user'),)
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    conversacion_id = db.Column(db.Integer, nullable=False)
    titulo = db.Column(db.String(120), nullable=True)
    fijada = db.Column(db.Boolean, nullable=False, default=False, server_default=sa.false())
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
