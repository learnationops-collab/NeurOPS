"""Inbox: marca de seguimiento en el mensaje del equipo (ig_mensajes.seguimiento, ADR-W255)

Revision ID: f4b6d8a0c2e5
Revises: e7a2c4f6b8d1
Create Date: 2026-11-26

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'f4b6d8a0c2e5'
down_revision = 'e7a2c4f6b8d1'
branch_labels = None
depends_on = None


def _columnas():
    return {c['name'] for c in sa.inspect(op.get_bind()).get_columns('ig_mensajes')}


def upgrade():
    if 'seguimiento' not in _columnas():
        op.add_column('ig_mensajes', sa.Column('seguimiento', sa.Boolean(), nullable=True))


def downgrade():
    if 'seguimiento' in _columnas():
        op.drop_column('ig_mensajes', 'seguimiento')
