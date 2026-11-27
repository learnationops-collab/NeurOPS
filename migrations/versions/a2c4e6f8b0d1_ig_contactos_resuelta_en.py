"""Inbox: «No requiere respuesta» (ig_contactos.resuelta_en)

Revision ID: a2c4e6f8b0d1
Revises: f4b2d6a8c0e3
Create Date: 2026-11-25

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'a2c4e6f8b0d1'
down_revision = 'f4b2d6a8c0e3'
branch_labels = None
depends_on = None


def upgrade():
    columnas = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('ig_contactos')}
    if 'resuelta_en' not in columnas:
        op.add_column('ig_contactos', sa.Column('resuelta_en', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('ig_contactos', 'resuelta_en')
