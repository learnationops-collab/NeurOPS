"""Etiquetas genéricas (27/10/2026). Hoy las usan los setters en las conversaciones del Inbox.

  · TagGroup: el grupo que arma el equipo, por ejemplo «Temperatura». `exclusive`: lo etiquetado
    lleva una sola etiqueta del grupo (poner «Frío» saca «Caliente»). Más adelante suma reglas para
    que el sistema etiquete solo.
  · Tag: una etiqueta puesta sobre algo (`target_type` + `target_id`), con su nombre. Sin grupo es una
    etiqueta suelta. Las etiquetas de un grupo son los nombres que ya se usaron en él; el color es el
    del grupo. `target_id` es texto para poder apuntar a ids numéricos o a uuids (personas).
"""
from datetime import datetime

from app import db

TARGET_IG_CONTACT = 'ig_contact'  # una conversación del Inbox (ig_contactos.id)


class TagGroup(db.Model):
    __tablename__ = 'tag_groups'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(60), nullable=False, unique=True)
    color = db.Column(db.String(20), nullable=True)
    exclusive = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class Tag(db.Model):
    __tablename__ = 'tags'

    id = db.Column(db.Integer, primary_key=True)
    tag_group_id = db.Column(db.Integer, db.ForeignKey('tag_groups.id', ondelete='CASCADE'), nullable=True)
    name = db.Column(db.String(60), nullable=False)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.String(64), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    group = db.relationship('TagGroup')

    __table_args__ = (
        db.UniqueConstraint('target_type', 'target_id', 'tag_group_id', 'name', name='uq_tags_target_group_name'),
        db.Index('ix_tags_target', 'target_type', 'target_id'),
        db.Index('ix_tags_group_name', 'tag_group_id', 'name'),
    )
